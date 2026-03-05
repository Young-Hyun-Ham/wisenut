import json

import anyio

from controller.api.v1.chat import ChatRequest, chat


async def _first_message_payload(response, predicate=None):
    buffer = ""
    async for chunk in response.body_iterator:
        if isinstance(chunk, bytes):
            buffer += chunk.decode()
        else:
            buffer += chunk
        if "\n\n" not in buffer:
            continue
        event_block, buffer = buffer.split("\n\n", 1)
        lines = event_block.splitlines()
        if "event: message" not in lines:
            continue
        data_lines = [line[6:] for line in lines if line.startswith("data: ")]
        if not data_lines:
            continue
        payload = json.loads("\n".join(data_lines))
        if predicate is None or predicate(payload):
            return payload
    return None


def test_chat_interrupt_and_resume_with_button_choice():
    response = chat("scenario99", ChatRequest(conversation_id="conv-99"))
    assert response.media_type == "text/event-stream"

    payload = anyio.run(
        _first_message_payload,
        response,
        lambda p: p.get("output", {}).get("type") == "interrupt",
    )
    assert payload is not None
    assert payload["conversation_id"] == "conv-99"
    assert payload["output"]["type"] == "interrupt"
    replies = payload["output"]["data"]["replies"]
    assert replies

    selected_value = replies[0]["value"]
    response2 = chat(
        "scenario99",
        ChatRequest(
            conversation_id="conv-99",
            user_action=selected_value,
        ),
    )
    payload2 = anyio.run(
        _first_message_payload,
        response2,
        lambda p: p.get("output", {}).get("type") == "message",
    )
    assert payload2 is not None
    assert payload2["conversation_id"] == "conv-99"
    assert payload2["output"]["type"] == "message"


def test_form_interrupt_schema_normalized():
    response = chat("scenario01", ChatRequest(conversation_id="conv-01"))
    assert response.media_type == "text/event-stream"

    payload = anyio.run(
        _first_message_payload,
        response,
        lambda p: p.get("output", {}).get("type") == "interrupt",
    )
    assert payload is not None
    output = payload["output"]
    assert output["type"] == "interrupt"
    data = output["data"]
    assert data["type"] == "form"
    assert isinstance(data.get("node_id"), str)
    schema = data.get("data")
    assert isinstance(schema, dict)
    assert isinstance(schema.get("title"), str)
    elements = schema.get("elements")
    assert isinstance(elements, list)
    assert elements
    element = elements[0]
    assert "name" in element
    assert "type" in element
    assert "label" in element
