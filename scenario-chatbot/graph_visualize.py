


import json
from pathlib import Path

from lib.graph_factory import GraphFactory
from lib.react_flow_parser import parse_react_flow_data
from lib.scenario_repo import ScenarioRepository


if __name__ == "__main__":
    root_dir = Path(__file__).resolve().parent
   
    repo = ScenarioRepository(root_dir)
    scenario_data = repo.get_scenario("scenario01")
    
    checkpointer = None
    graph_factory = GraphFactory(checkpointer)
    graph = graph_factory.build_graph(scenario_data.data)
    print(graph.get_graph().draw_mermaid())