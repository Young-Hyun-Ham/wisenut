import json
import time

from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from pydantic import BaseModel

from lib.graph_factory import GraphFactory
from lib.graph_registry import GraphRegistry
from lib.scenario_repo import ScenarioNotFound, ScenarioRepository
from lib.trace_logger import append_event, append_trace

router = APIRouter()
_last_interrupt_node: dict[str, str] = {}
_conversation_locks: set[str] = set()


@lru_cache
def get_scenario_repo() -> ScenarioRepository:
    return ScenarioRepository()


@lru_cache
def get_graph_registry() -> GraphRegistry:
    return GraphRegistry(GraphFactory(MemorySaver()))


class ChatRequest(BaseModel):
    conversation_id: str
    user_action: object | None = None
    scenario_data: dict | None = None


async def _sse_stream(
    run_id: str,
    conversation_id: str,
    graph: object,
    input_obj: object,
    resume_from_node_id: str | None,
    started_at: float,
):
    config = {"configurable": {"thread_id": conversation_id}}
    skipping = resume_from_node_id is not None
    last_node_id: str | None = None

    try:
        append_event(
            run_id=run_id,
            event_type="stream_start",
            node=resume_from_node_id,
            payload={"resume": resume_from_node_id is not None},
            level="info",
        )
        for event in graph.stream(input_obj, stream_mode="values", config=config):
            if "__interrupt__" in event:
                payload = event["__interrupt__"][0].value
                node_id = payload.get("node_id") if isinstance(payload, dict) else None
                if node_id:
                    _last_interrupt_node[conversation_id] = node_id
                    last_node_id = node_id

                append_event(
                    run_id=run_id,
                    event_type="interrupt",
                    node=node_id,
                    payload=payload if isinstance(payload, dict) else {"raw": str(payload)},
                    level="info",
                )

                yield (
                    "event: message\n"
                    f"data: {json.dumps({'conversation_id': conversation_id, 'output': {'type': 'interrupt', 'data': payload}}, ensure_ascii=False)}\n\n"
                )
                break

            if not event:
                continue

            if skipping:
                current_id = event.get("data", {}).get("id")
                if current_id == resume_from_node_id:
                    skipping = False
                continue

            current_node_id = event.get("data", {}).get("id")
            if current_node_id:
                last_node_id = current_node_id

            normalized_output = {
                "type": event.get("type", "message"),
                "data": event.get("data", {}),
                "slot": event.get("slot", {}),
            }
            append_event(
                run_id=run_id,
                event_type=normalized_output["type"] or "message",
                node=current_node_id,
                payload=normalized_output,
                latency_ms=normalized_output["data"].get("latency_ms")
                if isinstance(normalized_output["data"], dict)
                else None,
                level="info",
            )
            payload = {"conversation_id": conversation_id, "output": normalized_output}
            yield f"event: message\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
        duration_ms = int((time.time() - started_at) * 1000)
        append_trace(
            run_id=run_id,
            thread_id=conversation_id,
            status="completed",
            duration_ms=duration_ms,
            node=last_node_id,
        )
        append_event(
            run_id=run_id,
            event_type="stream_end",
            node=last_node_id,
            payload={"status": "completed"},
            latency_ms=duration_ms,
            level="info",
        )
    except Exception as exc:
        duration_ms = int((time.time() - started_at) * 1000)
        append_trace(
            run_id=run_id,
            thread_id=conversation_id,
            status="failed",
            duration_ms=duration_ms,
            node=last_node_id,
            error=str(exc),
        )
        append_event(
            run_id=run_id,
            event_type="error",
            node=last_node_id,
            payload={"message": str(exc)},
            latency_ms=duration_ms,
            level="error",
        )
        error_payload = {"conversation_id": conversation_id, "error": str(exc)}
        yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
    finally:
        _conversation_locks.discard(conversation_id)

    yield "event: end\ndata: done\n\n"


@router.post("/chat/{scenario_id}")
def chat(
    scenario_id: str,
    body: ChatRequest,
    repo: ScenarioRepository = Depends(get_scenario_repo),
    registry: GraphRegistry = Depends(get_graph_registry),
):
    run_id = body.conversation_id
    started_at = time.time()
    if body.conversation_id in _conversation_locks:
        append_event(
            run_id=run_id,
            event_type="request_rejected",
            payload={"reason": "conversation already processing"},
            level="warn",
        )
        raise HTTPException(status_code=409, detail="conversation already processing")
    _conversation_locks.add(body.conversation_id)
    append_trace(
        run_id=run_id,
        thread_id=body.conversation_id,
        status="started",
    )

    if body.scenario_data is not None:
        scenario_payload = body.scenario_data
        if not isinstance(scenario_payload.get("nodes"), list):
            _conversation_locks.discard(body.conversation_id)
            append_trace(
                run_id=run_id,
                thread_id=body.conversation_id,
                status="failed",
                duration_ms=int((time.time() - started_at) * 1000),
                error="scenario_data.nodes must be array",
            )
            raise HTTPException(status_code=422, detail="scenario_data.nodes must be array")
        if not isinstance(scenario_payload.get("edges", []), list):
            _conversation_locks.discard(body.conversation_id)
            append_trace(
                run_id=run_id,
                thread_id=body.conversation_id,
                status="failed",
                duration_ms=int((time.time() - started_at) * 1000),
                error="scenario_data.edges must be array",
            )
            raise HTTPException(status_code=422, detail="scenario_data.edges must be array")
        append_trace(
            run_id=run_id,
            thread_id=body.conversation_id,
            status="running",
            node="scenario_data",
        )
        append_event(
            run_id=run_id,
            event_type="scenario_loaded",
            payload={"source": "request.scenario_data", "scenario_id": scenario_id},
            level="info",
        )
        graph = registry.get_graph(scenario_id, scenario_payload, time.time())
    else:
        try:
            append_event(
                run_id=run_id,
                event_type="scenario_read_start",
                payload={"scenario_id": scenario_id},
                level="info",
            )
            scenario = repo.get_scenario(scenario_id)
            append_trace(
                run_id=run_id,
                thread_id=body.conversation_id,
                status="running",
                node="scenario_repo_loaded",
            )
            append_event(
                run_id=run_id,
                event_type="scenario_loaded",
                payload={"source": "scenario_repo", "scenario_id": scenario_id},
                level="info",
            )
        except ScenarioNotFound:
            _conversation_locks.discard(body.conversation_id)
            append_trace(
                run_id=run_id,
                thread_id=body.conversation_id,
                status="failed",
                duration_ms=int((time.time() - started_at) * 1000),
                error="scenario not found",
            )
            raise HTTPException(status_code=404, detail="scenario not found")
        except json.JSONDecodeError:
            _conversation_locks.discard(body.conversation_id)
            append_trace(
                run_id=run_id,
                thread_id=body.conversation_id,
                status="failed",
                duration_ms=int((time.time() - started_at) * 1000),
                error="scenario parse failed",
            )
            raise HTTPException(status_code=422, detail="scenario parse failed")

        graph = registry.get_graph(scenario_id, scenario.data, scenario.mtime)
    input_obj = Command(resume=body.user_action) if body.user_action is not None else {}
    resume_from_node_id = (
        _last_interrupt_node.get(body.conversation_id)
        if body.user_action is not None
        else None
    )

    return StreamingResponse(
        _sse_stream(
            run_id,
            body.conversation_id,
            graph,
            input_obj,
            resume_from_node_id,
            started_at,
        ),
        media_type="text/event-stream",
    )
