// (Handle, Position 임포트 제거)
import styles from './ChatNodes.module.css';
import useStore from '../store';
// (AnchorIcon, StartNodeIcon 임포트 제거)
import { SetSlotIcon } from '../components/Icons'; // 1. 아이콘 임포트 유지
import NodeWrapper from './NodeWrapper'; // 2. Wrapper 임포트

function SetSlotNode({ id, data }) {
  // 3. 공통 로직 제거
  const nodeColor = useStore((state) => state.nodeColors.setSlot) || '#8e44ad';
  const textColor = useStore((state) => state.nodeTextColors.setSlot) || '#ffffff';

  // (isAnchored, isStartNode 로직 제거)

  return (
    // 4. NodeWrapper로 감싸기
    <NodeWrapper
      id={id}
      typeLabel="Set Slot"
      icon={<SetSlotIcon />} // 5. 아이콘 전달
      nodeColor={nodeColor}
      textColor={textColor}
    >
      {/* 6. 기존 nodeBody의 내용만 children으로 전달 */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Assignments</span>
        {(data.assignments || []).map((assign, index) => (
          <div key={index} className={styles.previewBox}>
            <span style={{fontWeight: 'bold'}}>{assign.key}</span> = <span>{assign.value}</span>
          </div>
        ))}
        {(!data.assignments || data.assignments.length === 0) && (
          <div className={styles.formElementsPlaceholder}>No assignments configured.</div>
        )}
      </div>
    </NodeWrapper>
  );
}

export default SetSlotNode;