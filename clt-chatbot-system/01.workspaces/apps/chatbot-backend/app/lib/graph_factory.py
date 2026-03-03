from __future__ import annotations

import time
from typing import Callable, Dict, TypedDict, Any

from langgraph.graph import StateGraph, END
from langgraph.types import interrupt

from app.lib.api_node_parser import parse_api_node_data
from app.lib.http_client import http_request
from app.lib.path_extractor import extract_path
from app.lib.template import render_template

from app.lib.react_flow_parser import ReactFlowNode, parse_react_flow_data

class GraphState(TypedDict, total=False):
    type: str
    data: Dict[str, Any]
    slot: Dict[str, Any]
    choice: Any

def _render_if_template(value: object, slot: Dict) -> object:
    if isinstance(value, str) and "{{" in value and "}}" in value:
        return render_template(value, slot)
    return value


def _render_content_data(data: Dict, slot: Dict) -> Dict:
    content = data.get("content")
    if isinstance(content, str) and "{{" in content and "}}" in content:
        rendered = render_template(content, slot)
        if rendered != content:
            updated = dict(data)
            updated["content"] = rendered
            return updated
    return data


def _normalize_form_schema(form_data: Dict, slot: Dict | None = None) -> Dict:
    elements = form_data.get("elements", [])
    normalized = []
    for el in elements:
        default_value = el.get("defaultValue")
        if slot is not None:
            default_value = _render_if_template(default_value, slot)
        normalized.append(
            {
                "name": el.get("name"),
                "type": el.get("type"),
                "label": el.get("label"),
                "placeholder": el.get("placeholder"),
                "defaultValue": default_value,
                "validation": el.get("validation"),
            }
        )
    return {"title": form_data.get("title"), "elements": normalized}


def _select_condition_choice(
    slot: Dict,
    conditions: list,
    replies: list,
    path_map: Dict[str, str],
) -> str | None:
    for cond in conditions:
        slot_key = cond.get("slot")
        if not slot_key:
            continue
        slot_value = slot.get(slot_key)
        if slot_value is None:
            continue
        operator = cond.get("operator")
        cond_value = cond.get("value")
        matched = False
        if operator == "==":
            matched = slot_value == cond_value
        elif operator == "contains" and cond_value is not None:
            if isinstance(slot_value, str):
                matched = str(cond_value) in slot_value
            else:
                matched = str(cond_value) in str(slot_value)
        if not matched:
            continue
        cond_id = cond.get("id")
        if cond_id:
            if cond_id in path_map:
                return cond_id
            for handle in path_map:
                if handle and handle.startswith(cond_id):
                    return handle
        if "default" in path_map:
            return "default"
        return None
    if "default" in path_map:
        return "default"
    return None

def _node_factory(node: ReactFlowNode) -> Callable[[Dict], Dict]:
    node_type = node.type
    current_data = node.data
    node_id = node.id
    path_map = node.path_map

    def _fn(state: Dict, _data=current_data) -> Dict:
        slot = state.get('slot', {})
        if node_type == "message":
            new_data = _render_content_data(_data, slot)
            return {"type": node_type, "data": new_data, "slot": slot}
        
        if node_type == "delay":
            durationMS = _data['duration']
            #sleep 로직의 변경이 필요할 수 도 있다.
            time.sleep(durationMS * 0.001)
            return {"type": node_type, "data": _data, "slot": slot}
        
        if node_type == "api":
            dto = parse_api_node_data(_data)
            headers = dto.headers
            body = render_template(dto.body, slot) if dto.body else None
            status_code, resp_data = http_request(
                dto.method, dto.url, headers=headers, body=body
            )
            if status_code >= 400:
                return {
                    "type": node_type,
                    "data": _data,
                    "slot": slot,
                    "error": {"status": status_code, "body": resp_data},
                }
            if isinstance(resp_data, dict):
                for mapping in dto.responseMapping:
                    val = extract_path(resp_data, mapping.path)
                    slot[mapping.slot] = val
            # print(f"[API_RESULT]status_code:{status_code}, resp_data:{resp_data}, slot:{slot}")
            return {"type": node_type, "data": _data, "slot": slot}
        
        if node_type == "setSlot":
            assignments = _data.get("assignments", [])
            for assignment in assignments:
                key = assignment.get("key")
                if not key:
                    continue
                value = assignment.get("value")
                if isinstance(value, str):
                    value = _render_if_template(value, slot)
                slot[key] = value
            return {"type": node_type, "data": _data, "slot": slot}

        if node_type == "form":
            form_req = {
                "type": "form",
                "node_id": node_id,
                "data": _normalize_form_schema(_data, slot),
            }
            form_res = interrupt(form_req)
            slot.update(form_res)

        elif node_type == "link":
            new_data = _render_content_data(_data, slot)
            return {"type": node_type, "data": new_data, "slot": slot}
              
        if node_type == "branch" and _data.get("evaluationType") == "BUTTON":
            replies = _data.get("replies", [])
            choice = interrupt(
                {"type": "button", "node_id": node_id, "replies": replies}
            )
            return {"type": node_type, "data": _data, "slot": slot, "choice": choice}
        
        elif node_type == "branch" and _data.get("evaluationType") == "CONDITION":
            new_data = _render_content_data(_data, slot)
            conditions = new_data.get("conditions", [])
            replies = new_data.get("replies", [])
            choice = _select_condition_choice(slot, conditions, replies, path_map)
            return {"type": node_type, "data": new_data, "slot": slot, "choice": choice}

        return {"type": node_type, "data": _data, "slot": slot}

    return _fn


def _create_router(path_map: Dict[str, str]) -> Callable[[Dict], str]:
    target_routes = list(path_map.keys())

    def _router_fn(state: Dict) -> str:
        if not target_routes:
            return END
        choice = state.get("choice")
        print(f"[CHECK_ROUTE]{choice}, routes:{target_routes}")
        if choice in path_map:
            return choice
        return target_routes[0]

    return _router_fn


class GraphFactory:
    def __init__(self, checkpointer: object) -> None:
        self._checkpointer = checkpointer

    def build_graph(self, raw_scenario: Dict) -> object:
        nodes = parse_react_flow_data(raw_scenario)
        builder: StateGraph = StateGraph(GraphState)

        for node in nodes:
            builder.add_node(node.id, _node_factory(node))
            if len(node.next_nodes) == 1:
                builder.add_edge(node.id, node.next_nodes[0].target)
            elif len(node.next_nodes) == 0:
                builder.add_edge(node.id, END)
            else:
                builder.add_conditional_edges(
                    node.id,
                    _create_router(node.path_map),
                    node.path_map,
                )

        start_nodes = [n for n in nodes if n.is_start_node]
        entry = start_nodes[0].id if start_nodes else nodes[0].id
        builder.set_entry_point(entry)
        return builder.compile(checkpointer=self._checkpointer)
