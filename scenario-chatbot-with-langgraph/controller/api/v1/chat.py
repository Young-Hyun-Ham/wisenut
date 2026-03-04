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

router = APIRouter()
_last_interrupt_node: dict[str, str] = {}
_conversation_locks: dict[str, float] = {}
_LOCK_TTL_SECONDS = 5.0


@lru_cache
def get_scenario_repo() -> ScenarioRepository:
    return ScenarioRepository()


@lru_cache
def get_graph_registry() -> GraphRegistry:
    return GraphRegistry(GraphFactory(MemorySaver()))


class ChatRequest(BaseModel):
    conversation_id: str
    user_action: object | None = None


async def _sse_stream(
    conversation_id: str,
    graph: object,
    input_obj: object,
    resume_from_node_id: str | None,
):
    config = {"configurable": {"thread_id": conversation_id}}
    skipping = resume_from_node_id is not None

    try:
        for event in graph.stream(input_obj, stream_mode="values", config=config):
            if "__interrupt__" in event:
                payload = event["__interrupt__"][0].value
                node_id = payload.get("node_id") if isinstance(payload, dict) else None
                if node_id:
                    _last_interrupt_node[conversation_id] = node_id

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

            normalized_output = {
                "type": event.get("type", "message"),
                "data": event.get("data", {}),
                "slot": event.get("slot", {}),
            }
            payload = {"conversation_id": conversation_id, "output": normalized_output}
            yield f"event: message\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
    except Exception as exc:
        error_payload = {"conversation_id": conversation_id, "error": str(exc)}
        yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
    finally:
        _conversation_locks.pop(conversation_id, None)

    yield "event: end\ndata: done\n\n"


@router.post("/chat/{scenario_id}")
def chat(
    scenario_id: str,
    body: ChatRequest,
    repo: ScenarioRepository = Depends(get_scenario_repo),
    registry: GraphRegistry = Depends(get_graph_registry),
):
    now_ts = time.time()
    lock_until = _conversation_locks.get(body.conversation_id, 0.0)
    if lock_until > now_ts:
        raise HTTPException(status_code=409, detail="conversation already processing")
    _conversation_locks[body.conversation_id] = now_ts + _LOCK_TTL_SECONDS

    try:
        scenario = repo.get_scenario(scenario_id)
    except ScenarioNotFound:
        _conversation_locks.pop(body.conversation_id, None)
        raise HTTPException(status_code=404, detail="scenario not found")
    except json.JSONDecodeError:
        _conversation_locks.pop(body.conversation_id, None)
        raise HTTPException(status_code=422, detail="scenario parse failed")

    graph = registry.get_graph(scenario_id, scenario.data, scenario.mtime)
    input_obj = Command(resume=body.user_action) if body.user_action is not None else {}
    resume_from_node_id = (
        _last_interrupt_node.get(body.conversation_id)
        if body.user_action is not None
        else None
    )

    return StreamingResponse(
        _sse_stream(body.conversation_id, graph, input_obj, resume_from_node_id),
        media_type="text/event-stream",
    )
