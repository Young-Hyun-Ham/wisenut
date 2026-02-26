import { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
// 1. Import CSS module
import styles from './EditableNode.module.css';

function EditableNode({ id, data }) {
  const [isEditing, setIsEditing] = useState(false);

  const onChange = useCallback((evt) => {
    data.onChange(id, evt.target.value);
  }, [id, data]);

  const onBlur = () => setIsEditing(false);
  const onKeyDown = (evt) => {
    if (evt.key === 'Enter') {
      setIsEditing(false);
    }
  };

  const onDeleteClick = useCallback(() => {
    data.onDelete(id);
  }, [id, data]);

  return (
    // 2. Replace inline style with className
    <div className={styles.node}>
      <button
        onClick={onDeleteClick}
        className={styles.deleteButton}
        title="Delete"
      >
        ×
      </button>

      <Handle type="target" position={Position.Top} />

      <div onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <input
            type="text"
            defaultValue={data.label}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            autoFocus
            className={styles.input} // Apply className to input as well
          />
        ) : (
          <div>{data.label}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default EditableNode;