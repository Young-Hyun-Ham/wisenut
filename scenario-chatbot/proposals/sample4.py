from dataclasses import dataclass
from functools import partial
import json
from pathlib import Path
from typing import Optional, TypedDict, Literal
from langgraph.graph import StateGraph, END
from langgraph.types import Command, interrupt, Send
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables import RunnableConfig
import time

from lib.workflow import WorkflowNode, parse_workflow

#### constants start
MS = 0.001
#### costants end

 
scenarioFile = './data/scenario01.json'
# scenarioFile = './circlebell_test.json'
with open(scenarioFile, 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

nodes = parse_workflow(raw_data)

def node_factory(n: WorkflowNode):
    # n.data를 로컬 변수로 캡처
    current_data = n.data
    node_type = n.type
    
    if node_type == 'branch':
        current_replies = current_data.get('replies')
        def branch_fn(state: dict, _data=current_data, _replies=current_replies):  
            choice = interrupt(_replies)
            choice = 'unknown'
            return {'type':node_type, 'data': _data, 'choice': choice}
        return branch_fn
        
    elif node_type == 'message':
        def message_fn(state: dict, _data=current_data):
            return {'type':node_type, 'data': _data}
        return message_fn
    
    elif node_type == 'delay':
        def delay_fn(state: dict, _data=current_data):
            duration = _data.get('duration')
            print(f">>>>[SLEEP]{duration}ms 동안 sleep합니다...")
            time.sleep(duration * MS)
            return {'type':node_type, 'data': _data}
        return delay_fn

    elif node_type == 'api':
        def api_fn(state: dict, _data=current_data):
            print(f'call api to {_data['url']}')
            return {'type':node_type, 'data': _data}
        return api_fn
    
    else:
        def etc_fn(state: dict, _data=current_data):
            return {'type':node_type, 'data': _data}
        return etc_fn

def create_router(sourceId: str, path_map):
    targetRoutes = list(path_map.keys())
    
    def _router_fn(state):
        selected = state['choice']
        print(f'selected: {selected}, targetRoutes:{targetRoutes}')
        if selected in targetRoutes:
            return selected
        else:
            return targetRoutes[0]
        
    return _router_fn

builder = StateGraph(dict)

for node in nodes:
    builder.add_node(node.id, node_factory(node))

    if len(node.next_nodes) == 1:
        builder.add_edge(node.id, node.next_nodes[0].target)
    elif len(node.next_nodes) == 0:
        builder.add_edge(node.id, END)
    else:
        # 팩토리 함수를 호출하여 해당 path_map을 사용하는 독립적인 라우터 함수 등록
        builder.add_conditional_edges(
            node.id, 
            create_router(node.id, node.path_map), 
            node.path_map
        )
        

builder.set_entry_point(nodes[0].id)
    
checkpointer=InMemorySaver()
graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "1"}}

events = graph.stream({}, stream_mode="values", config=config)
for event in events:
    print(f"[EVENT]{event}")
    if '__interrupt__' in event:
        interrupt = event['__interrupt__']
        print(interrupt[0].value)
