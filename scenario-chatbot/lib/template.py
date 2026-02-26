import re


def render_template(text: str, slot: dict) -> str:
    def repl(match: re.Match) -> str:
        key = match.group(1).strip()
        return str(slot.get(key, ""))

    return re.sub(r"\{\{([^}]+)\}\}", repl, text or "")
