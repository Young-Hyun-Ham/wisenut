import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Callable
from pathlib import Path

@dataclass
class ReactFlowEdge:
    source: str
    target: str
    sourceHandle: Optional[str] = None

@dataclass
class ReactFlowNode:
    id: str
    type: str
    data: Dict[str, Any]
    is_start_node: bool = False
    next_nodes: List[ReactFlowEdge] = field(default_factory=list)
    
    @property
    def path_map(_self) -> Dict[str,str]:
        path_map = {
            edge.sourceHandle: edge.target
            for edge in _self.next_nodes
            if edge.sourceHandle
        }
        return path_map

def parse_react_flow_data(raw_data: dict)-> List[ReactFlowNode]:
    nodes_data = raw_data.get('nodes', [])
    edges_data = raw_data.get('edges', [])
    startNodeId = raw_data.get('start_node_id')
    print(f"[parse_react_flow_data] raw_data=================> : {raw_data}")
    print(f"[parse_react_flow_data] startNodeId: {startNodeId}")
    # 1. 필요한 필드만 추출하여 객체 생성 (position, width 등 제외)
    nodes_map = {}
    for n in nodes_data:
        data = dict(n.get('data') or {})
        if n.get('type') == 'branch' and data.get('evaluationType') == 'CONDITION':
            conditions = data.get('conditions') or []
            replies = data.get('replies') or []
            if len(replies) > len(conditions):
                replies = replies[:len(conditions)]
                data['replies'] = replies
            for idx, condition in enumerate(conditions):
                if idx >= len(replies):
                    continue
                reply_value = replies[idx].get('value') if isinstance(replies[idx], dict) else None
                if reply_value:
                    condition['id'] = reply_value
        nodes_map[n['id']] = ReactFlowNode(
            id=n['id'],
            type=n['type'],
            data=data,
        )
    
    # 2. Edge 정보를 순회하며 노드 객체에 연결 추가
    for e in edges_data:
        edge = ReactFlowEdge(
            source=e['source'],
            target=e['target']
        )

        if e.get('sourceHandle'):
            edge.sourceHandle = e.get('sourceHandle')
        
        if edge.source in nodes_map:
            nodes_map[edge.source].next_nodes.append(edge)

    node_list = list(nodes_map.values())

    # 3. 시작노드 마킹
    if startNodeId:
        nodes_map[startNodeId].is_start_node = True
    else :
        node_list[0].is_start_node = True

    return node_list

if __name__ == "__main__":
    root_dir = Path(__file__).resolve().parent / ".."
    data_dir = root_dir / "data"

    # file_path = data_dir / "scenario01.json"
    file_path = data_dir / "circlebell_test.json"
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    # --- 실행 및 결과 확인 ---
    nodes = parse_react_flow_data(raw_data)

    for node in nodes:
        # asdict를 사용하면 깔끔한 딕셔너리 형태로 변환되어 출력/저장이 쉽습니다.
        print(json.dumps(asdict(node), indent=2, ensure_ascii=False))

    # types = set([node.type for node in nodes])
    # print(f"usedTypes = {types}")
