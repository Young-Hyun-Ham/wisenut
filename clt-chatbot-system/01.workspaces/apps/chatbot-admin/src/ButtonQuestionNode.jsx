import { Handle, Position } from 'reactflow';
import styles from './EditableNode.module.css';

function ButtonQuestionNode({ data }) {
  // data format: { question: '...', answers: ['answer1', 'answer2'] }
  const { question, answers = [] } = data;

  return (
    <div className={styles.node} style={{ border: '1px solid #1a192b', background: '#eee' }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ padding: '5px', fontWeight: 'bold' }}>{question}</div>
      <div style={{ marginTop: '10px' }}>
        {answers.map((answer, index) => (
          <div key={index} style={{ position: 'relative', padding: '5px 10px', borderTop: '1px solid #ccc' }}>
            {answer}
            {/* Individual handle for each answer (button) */}
            <Handle
              type="source"
              // Calculate handle position dynamically to avoid overlap
              position={Position.Right}
              id={`answer-${index}`} // Unique ID for each handle
              style={{ top: `${20 + index * 31}px`, background: '#555' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ButtonQuestionNode;