import json
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langgraph.types import Command
from langgraph.checkpoint.memory import MemorySaver

from app.lib.graph_factory import GraphFactory
from app.lib.graph_registry import GraphRegistry
from app.lib.scenario_repo import ScenarioNotFound, ScenarioRepository
from app.db.deps import get_db
from sqlalchemy.orm import Session

router = APIRouter()
_last_interrupt_node: dict[str, str] = {}


def get_scenario_repo(db: Session = Depends(get_db)) -> ScenarioRepository:
    return ScenarioRepository(db)


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
    for event in graph.stream(input_obj, stream_mode="values", config=config):
        if "__interrupt__" in event:
            payload = event["__interrupt__"][0].value
            node_id = payload.get("node_id") if isinstance(payload, dict) else None
            if node_id:
                _last_interrupt_node[conversation_id] = node_id
            print(f"[INTERRUPT] {conversation_id}: {payload}")
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

        # print(f"[EVENT]{event}")
        payload = {"conversation_id": conversation_id, "output": event}
        yield f"event: message\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
    yield "event: end\ndata: done\n\n"


@router.post("/langgraph/chat/{scenario_id}")
def langgraphChat(
    scenario_id: str,
    body: ChatRequest,
    repo: ScenarioRepository = Depends(get_scenario_repo),
    registry: GraphRegistry = Depends(get_graph_registry),
):
    if body.user_action is not None:
        print(f"[USER_ACTION] {body.conversation_id}: {body.user_action}")
    try:
        scenario = repo.get_scenario(scenario_id)
    except ScenarioNotFound:
        raise HTTPException(status_code=404, detail="scenario not found")
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="scenario parse failed")

    print(f"[langgraphChat scenario.data ======================>] {scenario}")
    graph = registry.get_graph(scenario_id, scenario.data, scenario.mtime)
    print(f"[langgraphChat nodes ======================>] {graph.nodes}")
    print(f"[langgraphChat edges ======================>] {graph.builder.edges}")
    print(f"[langgraphChat mermaid ======================>] {graph.get_graph().draw_mermaid()}")
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
