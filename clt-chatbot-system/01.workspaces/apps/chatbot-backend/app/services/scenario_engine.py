from __future__ import annotations

import json
import logging
import re
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

INTERACTIVE_TYPES = {"form", "slotfilling", "message", "branch", "link", "iframe", "toast"}


def _safe_lower(value: Any) -> str:
    if value is None:
        return ""
    return str(value).lower()


def evaluate_condition(slot_value: Any, operator: str, condition_value: Any) -> bool:
    slot_str = str(slot_value or "")
    cond_str = str(condition_value or "")

    if operator in {"==", "!="} and cond_str.lower() in {"true", "false"}:
        bool_slot = slot_str.lower() == "true"
        bool_cond = cond_str.lower() == "true"
        return bool_slot == bool_cond if operator == "==" else bool_slot != bool_cond

    num_slot, num_cond = None, None
    try:
        num_slot = float(slot_value)
    except (TypeError, ValueError):
        pass
    try:
        num_cond = float(condition_value)
    except (TypeError, ValueError):
        pass

    if operator == ">" and num_slot is not None and num_cond is not None:
        return num_slot > num_cond
    if operator == "<" and num_slot is not None and num_cond is not None:
        return num_slot < num_cond
    if operator == ">=" and num_slot is not None and num_cond is not None:
        return num_slot >= num_cond
    if operator == "<=" and num_slot is not None and num_cond is not None:
        return num_slot <= num_cond
    if operator == "contains":
        return cond_str in slot_str
    if operator == "!contains":
        return cond_str not in slot_str
    if operator == "==":
        return slot_str == cond_str
    if operator == "!=":
        return slot_str != cond_str

    logger.warning("Unsupported operator in scenario condition: %s", operator)
    return False


def get_deep_value(obj: Any, path: str) -> Any:
    if not path or not obj:
        return None
    tokens = re.findall(r"[^.\[\]]+|\[[^\]]+\]", path)
    current = obj
    for token in tokens:
        key = token
        if token.startswith("[") and token.endswith("]"):
            key = token[1:-1]
        if isinstance(current, dict) and key in current:
            current = current[key]
        elif isinstance(current, list) and key.isdigit():
            idx = int(key)
            if 0 <= idx < len(current):
                current = current[idx]
            else:
                return None
        else:
            return None
    return current


def interpolate_message(message: Optional[str], slots: Dict[str, Any]) -> str:
    if message is None:
        return ""
    text = message.replace("%7B%7B", "{{").replace("%7D%7D", "}}")
    pattern = re.compile(r"\{\{([^}]+)\}\}")

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        value = get_deep_value(slots, key)
        if value is None:
            return match.group(0)
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)

    return pattern.sub(_replace, text)


def _resolve_start_node(scenario: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    nodes = scenario.get("nodes") or []
    edges = scenario.get("edges") or []
    start_id = scenario.get("startNodeId")

    if start_id:
        for node in nodes:
            if node.get("id") == start_id:
                return deepcopy(node)
        logger.warning("Start nodeId %s not found in scenario %s", start_id, scenario.get("id"))

    targets = {edge.get("target") for edge in edges}
    for node in nodes:
        if node.get("id") not in targets:
            return deepcopy(node)
    return deepcopy(nodes[0]) if nodes else None


def _should_stop(node: Dict[str, Any]) -> bool:
    node_type = node.get("type")
    if node_type == "branch":
        eval_type = node.get("data", {}).get("evaluationType")
        return eval_type != "CONDITION"
    return node_type in INTERACTIVE_TYPES


def _should_await_input(node: Dict[str, Any]) -> bool:
    node_type = node.get("type")
    if node_type in {"form", "slotfilling"}:
        return True
    if node_type == "branch" and node.get("data", {}).get("evaluationType") != "CONDITION":
        return True
    return False


def _apply_form_defaults(node: Dict[str, Any], slots: Dict[str, Any]) -> None:
    elements = node.get("data", {}).get("elements") or []
    for element in elements:
        name = element.get("name")
        default_value = element.get("defaultValue")
        if not name or default_value is None or (isinstance(default_value, str) and default_value.strip() == ""):
            continue
        if name in slots:
            continue
        if element.get("type") == "checkbox" and isinstance(default_value, str):
            slots[name] = [item.strip() for item in default_value.split(",") if item.strip()]
        else:
            interpolated = interpolate_message(str(default_value), slots)
            slots[name] = interpolated


def _interpolate_node(node: Dict[str, Any], slots: Dict[str, Any]) -> Dict[str, Any]:
    node_copy = deepcopy(node)
    data = node_copy.get("data")
    if isinstance(data, dict):
        if "content" in data and isinstance(data["content"], str):
            data["content"] = interpolate_message(data["content"], slots)
        if node_copy.get("type") == "form" and isinstance(data.get("title"), str):
            data["title"] = interpolate_message(data["title"], slots)
        if isinstance(data.get("elements"), list):
            for element in data["elements"]:
                if "label" in element and isinstance(element["label"], str):
                    element["label"] = interpolate_message(element["label"], slots)
                if "placeholder" in element and isinstance(element["placeholder"], str):
                    element["placeholder"] = interpolate_message(element["placeholder"], slots)
                if element.get("type") in {"dropbox", "checkbox"} and isinstance(element.get("options"), list):
                    interpolated_options: List[Any] = []
                    for option in element["options"]:
                        if isinstance(option, str):
                            interpolated_options.append(interpolate_message(option, slots))
                        else:
                            interpolated_options.append(option)
                    element["options"] = interpolated_options
        if node_copy.get("type") == "branch" and isinstance(data.get("replies"), list):
            for reply in data["replies"]:
                if "display" in reply and isinstance(reply["display"], str):
                    reply["display"] = interpolate_message(reply["display"], slots)
    return node_copy


def get_next_node(
    scenario: Dict[str, Any],
    current_node_id: Optional[str],
    source_handle_id: Optional[str] = None,
    slots: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    slots = slots or {}
    nodes = scenario.get("nodes") or []
    edges = scenario.get("edges") or []
    if not nodes:
        return None

    if not current_node_id:
        return _resolve_start_node(scenario)

    source_node = next((node for node in nodes if node.get("id") == current_node_id), None)
    if not source_node:
        return None

    next_edge = None

    if source_node.get("type") == "llm":
        conditions = source_node.get("data", {}).get("conditions") or []
        output_var = source_node.get("data", {}).get("outputVar")
        llm_output = _safe_lower(slots.get(output_var))
        for condition in conditions:
            keyword = condition.get("keyword")
            if keyword and keyword.lower() in llm_output:
                next_edge = next(
                    (edge for edge in edges if edge.get("source") == current_node_id and edge.get("sourceHandle") == condition.get("id")),
                    None,
                )
                if next_edge:
                    break

    if not next_edge and source_node.get("type") == "branch" and source_node.get("data", {}).get("evaluationType") == "CONDITION":
        conditions = source_node.get("data", {}).get("conditions") or []
        replies = source_node.get("data", {}).get("replies") or []
        for index, condition in enumerate(conditions):
            slot_value = get_deep_value(slots, condition.get("slot") or "")
            value_to_compare = (
                get_deep_value(slots, condition.get("value") or "") if condition.get("valueType") == "slot" else condition.get("value")
            )
            if evaluate_condition(slot_value, condition.get("operator"), value_to_compare):
                handle_id = replies[index].get("value") if index < len(replies) else None
                next_edge = next(
                    (edge for edge in edges if edge.get("source") == current_node_id and edge.get("sourceHandle") == handle_id),
                    None,
                )
                if next_edge:
                    break
        if not next_edge:
            next_edge = next(
                (edge for edge in edges if edge.get("source") == current_node_id and edge.get("sourceHandle") == "default"),
                None,
            )

    if not next_edge and source_handle_id:
        next_edge = next(
            (edge for edge in edges if edge.get("source") == current_node_id and edge.get("sourceHandle") == source_handle_id),
            None,
        )

    if not next_edge and not source_handle_id and source_node.get("type") == "branch":
        next_edge = next((edge for edge in edges if edge.get("source") == current_node_id and not edge.get("sourceHandle")), None)

    if not next_edge and not source_handle_id and source_node.get("type") != "branch":
        next_edge = next((edge for edge in edges if edge.get("source") == current_node_id and not edge.get("sourceHandle")), None)

    if next_edge:
        target = next_edge.get("target")
        next_node = next((node for node in nodes if node.get("id") == target), None)
        if next_node:
            return deepcopy(next_node)
        logger.error("Next node %s not found for edge %s", target, next_edge.get("id"))

    if source_node.get("parentNode"):
        return get_next_node(scenario, source_node.get("parentNode"), None, slots)

    return None


def _apply_set_slot(node: Dict[str, Any], slots: Dict[str, Any]) -> None:
    assignments = node.get("data", {}).get("assignments") or []
    for assignment in assignments:
        key = assignment.get("key")
        value = assignment.get("value")
        if not key:
            continue
        interpolated = interpolate_message(str(value or ""), slots)
        slots[key] = interpolated


def _auto_advance(
    scenario: Dict[str, Any],
    node: Dict[str, Any],
    slots: Dict[str, Any],
) -> Tuple[Optional[Dict[str, Any]], List[Any]]:
    node_type = node.get("type")
    events: List[Any] = []
    if node_type == "delay":
        return get_next_node(scenario, node.get("id"), None, slots), events
    if node_type == "setSlot":
        _apply_set_slot(node, slots)
        return get_next_node(scenario, node.get("id"), None, slots), events
    if node_type == "toast":
        message = node.get("data", {}).get("message")
        events.append(
            {
                "type": "toast",
                "message": interpolate_message(message, slots),
                "toastType": node.get("data", {}).get("toastType", "info"),
            }
        )
        return get_next_node(scenario, node.get("id"), None, slots), events
    if node_type in {"api", "llm", "link", "iframe"}:
        return get_next_node(scenario, node.get("id"), None, slots), events
    return None, events


def run_scenario(
    scenario: Dict[str, Any],
    scenario_state: Optional[Dict[str, Any]],
    message: Optional[Dict[str, Any]],
    slots: Optional[Dict[str, Any]],
    scenario_session_id: Optional[str] = None,
    language: str = "ko",
) -> Dict[str, Any]:
    slots = dict(slots or {})
    message = message or {}
    scenario_state = scenario_state or {}
    scenario_id = str(scenario.get("id"))

    if not scenario_state.get("scenarioId"):
        start_node = _resolve_start_node(scenario)
        if not start_node:
            return {
                "type": "scenario_end",
                "message": "Scenario data is empty.",
                "scenarioState": None,
                "slots": slots,
                "events": [],
                "status": "failed",
            }
        _apply_form_defaults(start_node, slots)
        start_node = _interpolate_node(start_node, slots)
        state = {
            "scenarioId": scenario_id,
            "currentNodeId": start_node.get("id"),
            "awaitingInput": _should_await_input(start_node),
        }
        return {
            "type": "scenario_start",
            "nextNode": start_node,
            "scenarioState": state,
            "slots": slots,
            "events": [],
            "status": "active",
        }

    current_node_id = scenario_state.get("currentNodeId")
    awaiting_input = bool(scenario_state.get("awaitingInput"))
    source_handle = message.get("sourceHandle") or message.get("source_handle")
    form_data = message.get("formData") or {}
    if isinstance(form_data, dict):
        slots.update(form_data)

    if awaiting_input and current_node_id and message.get("text"):
        current_node = next((node for node in (scenario.get("nodes") or []) if node.get("id") == current_node_id), None)
        if current_node and current_node.get("data", {}).get("slot"):
            slot_name = current_node["data"]["slot"]
            slots[slot_name] = message.get("text")

    next_node = get_next_node(scenario, current_node_id, source_handle, slots)
    events: List[Any] = []

    while next_node and not _should_stop(next_node):
        advanced, new_events = _auto_advance(scenario, next_node, slots)
        if new_events:
            events.extend(new_events)
        if not advanced:
            break
        next_node = advanced

    if next_node:
        if next_node.get("type") == "form":
            _apply_form_defaults(next_node, slots)
        rendered_node = _interpolate_node(next_node, slots)
        state = {
            "scenarioId": scenario_id,
            "currentNodeId": rendered_node.get("id"),
            "awaitingInput": _should_await_input(rendered_node),
        }
        return {
            "type": "scenario",
            "nextNode": rendered_node,
            "scenarioState": state,
            "slots": slots,
            "events": events,
            "status": "active",
        }

    return {
        "type": "scenario_end",
        "message": "Scenario completed.",
        "scenarioState": None,
        "slots": slots,
        "events": events,
        "status": "completed",
    }
