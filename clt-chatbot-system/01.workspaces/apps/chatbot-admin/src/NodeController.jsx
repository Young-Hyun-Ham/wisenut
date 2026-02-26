import { useState, useEffect } from 'react';
import useStore from './store';
import styles from './NodeController.module.css';
import ApiNodeController from './components/controllers/ApiNodeController';
import FormNodeController from './components/controllers/FormNodeController';
import LlmNodeController from './components/controllers/LlmNodeController';
import ToastNodeController from './components/controllers/ToastNodeController';
import IframeNodeController from './components/controllers/IframeNodeController';
import MessageNodeController from './components/controllers/MessageNodeController';
import SlotFillingNodeController from './components/controllers/SlotFillingNodeController';
import BranchNodeController from './components/controllers/BranchNodeController';
import LinkNodeController from './components/controllers/LinkNodeController';
import FixedMenuNodeController from './components/controllers/FixedMenuNodeController';
import SetSlotNodeController from './components/controllers/SetSlotNodeController'; // Added
import DelayNodeController from './components/controllers/DelayNodeController'; // <<< [추가]

const nodeControllerMap = {
  message: MessageNodeController,
  slotfilling: SlotFillingNodeController,
  branch: BranchNodeController,
  link: LinkNodeController,
  fixedmenu: FixedMenuNodeController,
  form: FormNodeController,
  api: ApiNodeController,
  llm: LlmNodeController,
  toast: ToastNodeController,
  iframe: IframeNodeController,
  setSlot: SetSlotNodeController, // Added
  delay: DelayNodeController, // <<< [추가]
};

function NodeController() {
  const { selectedNodeId, nodes, updateNodeData } = useStore();
  const [localNode, setLocalNode] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  useEffect(() => {
    if (selectedNode) {
      setLocalNode(JSON.parse(JSON.stringify(selectedNode)));
      setIsDirty(false);
    } else {
      setLocalNode(null);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (localNode && selectedNode) {
      const hasChanged = JSON.stringify(localNode.data) !== JSON.stringify(selectedNode.data);
      setIsDirty(hasChanged);
    }
  }, [localNode, selectedNode]);

  if (!localNode) {
    return (
      <div className={styles.controllerContainer}>
        <div className={styles.mainControls}>
          <h3>Controller</h3>
          <p className={styles.placeholder}>Please select a node to edit.</p>
        </div>
      </div>
    );
  }

  const handleSaveChanges = () => {
    updateNodeData(localNode.id, localNode.data);
    setIsDirty(false);
  };

  const renderContent = () => {
    const ControllerComponent = nodeControllerMap[localNode.type];
    // --- 👇 [수정] backend prop을 commonProps에 추가 ---
    const commonProps = { localNode, setLocalNode };
    // --- 👆 [수정 끝] ---

    return ControllerComponent
      ? <ControllerComponent {...commonProps} />
      : <p className={styles.placeholder}>This node type has no editable properties.</p>;
  };

  return (
    <div className={styles.controllerContainer}>
      <div className={styles.mainControls}>
        <h3>Type: {localNode.type}</h3>
        <div className={styles.form}>
          {renderContent()}
        </div>
      </div>
      <div className={styles.controllerActions}>
        <button onClick={handleSaveChanges} className={styles.saveNodeButton} disabled={!isDirty}>
          Save Changes {isDirty && ' *'}
        </button>
      </div>
    </div>
  );
}

export default NodeController;
