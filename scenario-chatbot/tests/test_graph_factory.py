import unittest

from lib.graph_factory import (
    _node_factory,
    _normalize_form_schema,
)
from lib.react_flow_parser import ReactFlowEdge, ReactFlowNode


class GraphFactoryTests(unittest.TestCase):
    def test_message_template_substitution(self) -> None:
        node = ReactFlowNode(
            id="message-test",
            type="message",
            data={"content": "hello {{name}}"},
        )
        fn = _node_factory(node)
        result = fn({"slot": {"name": "VALUE"}})
        self.assertEqual(result["data"]["content"], "hello VALUE")

    def test_setslot_template_substitution(self) -> None:
        node = ReactFlowNode(
            id="setslot-test",
            type="setSlot",
            data={"assignments": [{"key": "bkgNr", "value": "{{number}}"}]},
        )
        fn = _node_factory(node)
        result = fn({"slot": {"number": "123"}})
        self.assertEqual(result["slot"]["bkgNr"], "123")

    def test_form_defaultvalue_template_substitution(self) -> None:
        form_data = {
            "title": "Test",
            "elements": [
                {"name": "field", "type": "input", "defaultValue": "{{value}}"}
            ],
        }
        normalized = _normalize_form_schema(form_data, {"value": "OK"})
        self.assertEqual(
            normalized["elements"][0]["defaultValue"],
            "OK",
        )

    def test_link_content_template_substitution(self) -> None:
        node = ReactFlowNode(
            id="link-test",
            type="link",
            data={"content": "http://example.com/{{id}}"},
        )
        fn = _node_factory(node)
        result = fn({"slot": {"id": "ABC"}})
        self.assertEqual(result["data"]["content"], "http://example.com/ABC")

    def test_branch_content_template_substitution(self) -> None:
        node = ReactFlowNode(
            id="branch-test",
            type="branch",
            data={
                "evaluationType": "CONDITION",
                "conditions": [
                    {
                        "id": "cond_1",
                        "slot": "name",
                        "operator": "==",
                        "value": "Kim",
                    }
                ],
                "replies": [{"value": "cond_1", "display": "OK"}],
                "content": "hello {{name}}",
            },
            next_nodes=[ReactFlowEdge(source="branch-test", target="next", sourceHandle="cond_1")],
        )
        fn = _node_factory(node)
        result = fn({"slot": {"name": "Kim"}})
        self.assertEqual(result["data"]["content"], "hello Kim")


if __name__ == "__main__":
    unittest.main()
