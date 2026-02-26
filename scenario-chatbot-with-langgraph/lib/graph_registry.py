from dataclasses import dataclass
from typing import Dict

from lib.graph_factory import GraphFactory


@dataclass
class GraphEntry:
    graph: object
    mtime: float


class GraphRegistry:
    def __init__(self, factory: GraphFactory) -> None:
        self._factory = factory
        self._cache: Dict[str, GraphEntry] = {}

    def get_graph(self, scenario_id: str, raw_scenario: Dict, mtime: float) -> object:
        cached = self._cache.get(scenario_id)
        if cached and cached.mtime == mtime:
            return cached.graph
        graph = self._factory.build_graph(raw_scenario)
        self._cache[scenario_id] = GraphEntry(graph=graph, mtime=mtime)
        return graph
