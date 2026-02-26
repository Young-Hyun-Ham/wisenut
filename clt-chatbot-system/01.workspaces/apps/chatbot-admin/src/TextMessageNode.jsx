import { Handle, Position } from 'reactflow';
import styles from './EditableNode.module.css'; // Reuse existing styles

function TextMessageNode({ data }) {
  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default TextMessageNode;