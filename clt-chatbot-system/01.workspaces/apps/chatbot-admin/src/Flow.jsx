import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ReactFlow, { Controls, useReactFlow, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

import MessageNode from './nodes/MessageNode';
import BranchNode from './nodes/BranchNode';
import SlotFillingNode from './nodes/SlotFillingNode';
import ApiNode from './nodes/ApiNode';
import FormNode from './nodes/FormNode';
import FixedMenuNode from './nodes/FixedMenuNode';
import LinkNode from './nodes/LinkNode';
import LlmNode from './nodes/LlmNode';
import ToastNode from './nodes/ToastNode';
import IframeNode from './nodes/IframeNode';
import ScenarioNode from './nodes/ScenarioNode';
import SetSlotNode from './nodes/SetSlotNode'; // Added
import DelayNode from './nodes/DelayNode'; // <<< [추가]
import ScenarioGroupModal from './ScenarioGroupModal';
import ChatbotSimulator from './ChatbotSimulator';
import NodeController from './NodeController';
import useStore, { ALL_NODE_TYPES } from './store'; // 💡 [수정] ALL_NODE_TYPES 임포트
import SlotDisplay from './SlotDisplay';
import styles from './Flow.module.css';
import { SettingsIcon } from './components/Icons';

const nodeTypes = {
  message: MessageNode,
  branch: BranchNode,
  slotfilling: SlotFillingNode,
  api: ApiNode,
  form: FormNode,
  fixedmenu: FixedMenuNode,
  link: LinkNode,
  llm: LlmNode,
  toast: ToastNode,
  iframe: IframeNode,
  scenario: ScenarioNode,
  setSlot: SetSlotNode, // Added
  delay: DelayNode, // <<< [추가]
};

// 💡 [추가] 노드 레이블 매핑
const nodeLabels = {
  message: '+ Message',
  form: '+ Form',
  branch: '+ Condition Branch',
  slotfilling: '+ SlotFilling',
  api: '+ API',
  llm: '+ LLM',
  setSlot: '+ Set Slot',
  delay: '+ Delay',
  fixedmenu: '+ Fixed Menu',
  link: '+ Link',
  toast: '+ Toast',
  iframe: '+ iFrame',
  scenario: '+ Scenario Group', // Scenario Group 버튼용
};

function Flow({ scenario, scenarios }) {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    fetchScenario, saveScenario, addNode, selectedNodeId,
    setSelectedNodeId, duplicateNode, deleteSelectedEdges,
    nodeColors, setNodeColor, nodeTextColors, setNodeTextColor,
    exportSelectedNodes, importNodes, addScenarioAsGroup,
    visibleNodeTypes // 💡 [추가] visibleNodeTypes 가져오기
  } = useStore();

  const { getNodes, project } = useReactFlow();
  const reactFlowWrapper = useRef(null);
  const selectedNodesCount = getNodes().filter(n => n.selected).length;

  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isSimulatorVisible, setIsSimulatorVisible] = useState(false);
  const [isColorSettingsVisible, setIsColorSettingsVisible] = useState(false);
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  useEffect(() => {
    if (scenario) {
      fetchScenario(scenario.id);
    }
  }, [scenario, fetchScenario]);

  const visibleNodes = useMemo(() => {
    const collapsedGroupIds = new Set(nodes.filter(n => n.type === 'scenario' && n.data.isCollapsed).map(n => n.id));
    return nodes.filter(n => !n.parentNode || !collapsedGroupIds.has(n.parentNode));
  }, [nodes]);

  const handleNodeClick = (event, node) => {
    setSelectedNodeId(node.id);
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
  };

  const handleMainResize = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startSize = rightPanelWidth;
    const startPosition = mouseDownEvent.clientX;

    const onMouseMove = (mouseMoveEvent) => {
      const newSize = startSize - (mouseMoveEvent.clientX - startPosition);
      if (newSize > 350 && newSize < 1000) {
        setRightPanelWidth(newSize);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDuplicateNode = () => {
    if (selectedNodeId) {
      duplicateNode(selectedNodeId);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const isNodeSelected = nodes.some(node => node.selected);
      if (!isNodeSelected) {
        deleteSelectedEdges();
      }
    }
  };

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      addNode(type, position);
    },
    [project, addNode]
  );
  
  const handleExportNodes = () => {
    const allNodes = getNodes();
    const selectedNodes = allNodes.filter(n => n.selected);
    exportSelectedNodes(selectedNodes);
  };

  // 💡 [수정] 스토어의 visibleNodeTypes를 기반으로 버튼 필터링
  const visibleNodeButtons = ALL_NODE_TYPES
    .filter(type => visibleNodeTypes.includes(type) && type !== 'fixedmenu' && type !== 'scenario')
    .map(type => ({ type, label: nodeLabels[type] || `+ ${type}` }));

  // 💡 [수정] 컬러 세팅은 모든 노드(fixedmenu 제외)에 대해 표시
  const colorSettingButtons = ALL_NODE_TYPES
    .filter(type => type !== 'fixedmenu' && type !== 'scenario')
    .map(type => ({ type, label: nodeLabels[type] || `+ ${type}` }));


  return (
    <div className={styles.flowContainer}>
      <ScenarioGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        scenarios={scenarios.filter(s => s.id !== scenario.id)}
        onSelect={(selected) => {
          addScenarioAsGroup(selected);
          setIsGroupModalOpen(false);
        }}
      />
      <div className={styles.leftSidebar}>
        <div className={styles.sidebarHeader}>
            <h3>Add Node</h3>
            <span className={styles.globalColorSettingButton} onClick={() => setIsColorSettingsVisible(!isColorSettingsVisible)}>
                <SettingsIcon />
            </span>
        </div>

        {isColorSettingsVisible && (
            <div className={styles.colorSettingsPanel}>
                {/* 💡 [수정] colorSettingButtons 사용 */}
                {colorSettingButtons.map(({ type, label }) => (
                    <div key={type} className={styles.colorSettingItem}>
                        <span>{label.replace('+ ', '')}</span>
                        <div className={styles.colorInputs}>
                          <input
                              type="color"
                              value={nodeColors[type]}
                              onChange={(e) => setNodeColor(type, e.target.value)}
                          />
                          <input
                              type="color"
                              value={nodeTextColors[type]}
                              onChange={(e) => setNodeTextColor(type, e.target.value)}
                          />
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* 💡 [수정] visibleNodeButtons 사용 */}
        {visibleNodeButtons.map(({ type, label }) => (
            <button
                key={type}
                onClick={() => addNode(type)}
                onDragStart={(event) => onDragStart(event, type)}
                draggable
                className={styles.sidebarButton}
                style={{
                    backgroundColor: nodeColors[type],
                    color: nodeTextColors[type]
                }}
            >
                {label}
            </button>
        ))}

        {/* 💡 [수정] 'scenario' 타입이 visibleNodeTypes에 있을 때만 Scenario Group 버튼 표시 */}
        {visibleNodeTypes.includes('scenario') && (
          <>
            <div className={styles.separator} />
            <button onClick={() => setIsGroupModalOpen(true)} className={styles.sidebarButton} style={{backgroundColor: nodeColors.scenario, color: nodeTextColors.scenario}}>
              + Scenario Group
            </button>
          </>
        )}
        
        <div className={styles.separator} />
        <button onClick={importNodes} className={styles.sidebarButton} style={{backgroundColor: '#555', color: 'white'}}>
          Import Nodes
        </button>
        <button onClick={handleExportNodes} className={styles.sidebarButton} disabled={selectedNodesCount === 0} style={{backgroundColor: '#555', color: 'white'}}>
          Export Nodes ({selectedNodesCount})
        </button>

        {selectedNodeId && (
          <>
            <div className={styles.separator} />
            <button onClick={handleDuplicateNode} className={`${styles.sidebarButton} ${styles.duplicateButton}`}>
              + Duplicate Node
            </button>
          </>
        )}
      </div>

      <div className={styles.mainContent} ref={reactFlowWrapper}>
        <SlotDisplay />
        <div className={styles.topRightControls}>
          <div onClick={() => saveScenario(scenario)}>
            <img src="/images/save.png" alt="Save Icon" className={styles.saveButton}/>
          </div>
          <div onClick={() => setIsSimulatorVisible(!isSimulatorVisible)}>
            <img src="/images/chat_simulator.png" alt="Simulator Icon" className={!isSimulatorVisible ? styles.botButtonHidden : styles.botButton}/>
          </div>
        </div>
        <ReactFlow
          nodes={visibleNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onKeyDown={handleKeyDown}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          style={{ backgroundColor: '#ffffff' }}
        >
          <Controls />
          <MiniMap nodeColor={(n) => nodeColors[n.type] || '#ddd'} nodeStrokeWidth={3} zoomable pannable />
        </ReactFlow>
      </div>

      <div className={`${styles.controllerPanel} ${selectedNodeId ? styles.visible : ''}`}>
        <NodeController />
      </div>

      <div className={`${styles.resizerV} ${isSimulatorVisible && !isSimulatorExpanded ? styles.visible : ''}`} onMouseDown={handleMainResize} />

      <div
        className={`${styles.rightContainer} ${isSimulatorVisible ? styles.visible : ''}`}
        style={{ width: isSimulatorExpanded ? 'max(600px, 50%)' : isSimulatorVisible ? `${rightPanelWidth}px` : '0' }}
      >
        <div className={styles.panel}>
          <ChatbotSimulator
            nodes={nodes}
            edges={edges}
            isVisible={isSimulatorVisible}
            isExpanded={isSimulatorExpanded}
            setIsExpanded={setIsSimulatorExpanded}
          />
        </div>
      </div>
    </div>
  );
}

import { ReactFlowProvider } from 'reactflow';

function FlowWithProvider(props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

export default FlowWithProvider;
