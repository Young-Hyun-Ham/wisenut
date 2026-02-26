import json
import os
import sys
import urllib.request


def _post_sse(url: str, payload: dict):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        buffer = ""
        for raw in resp:
            chunk = raw.decode("utf-8")
            buffer += chunk
            while "\n\n" in buffer:
                event_block, buffer = buffer.split("\n\n", 1)
                lines = event_block.splitlines()
                if not lines:
                    continue
                data_lines = [line[6:] for line in lines if line.startswith("data: ")]
                if not data_lines:
                    continue
                payload = "\n".join(data_lines).strip()
                if not payload:
                    continue
                try:
                    yield json.loads(payload)
                except json.JSONDecodeError:
                    continue


def run():
    base_url = os.getenv("CHAT_BASE_URL", "http://localhost:8000")
    scenario_id = sys.argv[1] if len(sys.argv) > 1 else "scenario99"
    conversation_id = "conv-99"
    user_input = "hi"

    next_payload = {"conversation_id": conversation_id, "user_input": user_input}
    while True:
        payload = next_payload
        next_payload = None
        for msg in _post_sse(f"{base_url}/api/v1/chat/{scenario_id}", payload):
            output = msg.get("output", {})
            if output.get("type") == "interrupt":
                data = output.get("data", {})
                if data.get("type") == "button":
                    replies = data.get("replies", [])
                    for idx, item in enumerate(replies, start=1):
                        print(f"{idx}. {item.get('display')} ({item.get('value')})")
                    choice = input("선택: ").strip()
                    print(f"your choice: {choice}")
                    try:
                        idx = int(choice)
                        user_action = replies[idx - 1]["value"]
                    except (ValueError, IndexError, KeyError):
                        user_action = choice
                    next_payload = {
                        "conversation_id": conversation_id,
                        "user_input": user_input,
                        "user_action": user_action,
                    }
                    break
                print(json.dumps(msg, ensure_ascii=False))
                return
            else:
                print(json.dumps(msg, ensure_ascii=False))
        if next_payload is None:
            return


if __name__ == "__main__":
    run()
