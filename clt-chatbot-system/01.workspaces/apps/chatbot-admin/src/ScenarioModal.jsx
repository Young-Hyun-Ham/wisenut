import { useState, useEffect } from 'react';
import styles from './ScenarioModal.module.css';
import useAlert from './hooks/useAlert';

function ScenarioModal({ isOpen, onClose, onSave, scenario }) {
  const [name, setName] = useState('');
  // <<< [수정] job 상태 제거 >>>
  // const [job, setJob] = useState('Batch');
  const [description, setDescription] = useState('');
  const { showAlert } = useAlert();

  const isEditMode = !!scenario;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setName(scenario.name || '');
        // <<< [수정] job 상태 설정 제거 >>>
        // setJob(scenario.job || 'Batch');
        setDescription(scenario.description || '');
      } else {
        setName('');
        // <<< [수정] job 상태 설정 제거 >>>
        // setJob('Batch');
        setDescription('');
      }
    }
  }, [isOpen, scenario, isEditMode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();

    // <<< [추가] 특수문자 필터링 (/, +) >>>
    const invalidCharsRegex = /[\/\+]/;
    if (invalidCharsRegex.test(trimmedName)) {
      showAlert("Scenario name cannot contain '/' or '+'.");
      return;
    }
    // <<< [추가 끝] >>>

    if (trimmedName) {
      // <<< [수정] job 값을 'Process'로 고정 (수정 시에는 기존 값 유지) >>>
      const jobToSave = isEditMode ? (scenario.job || 'Process') : 'Process';
      onSave({ name: trimmedName, job: jobToSave, description: description.trim() });
      // --- [수정 끝] >>>
    } else {
      showAlert('Please enter a scenario name.');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>{isEditMode ? 'Edit Scenario' : 'Create New Scenario'}</h2>
        {/* <<< [수정] 문구에서 Job Type 제거 --- */}
        <p>{isEditMode ? 'Edit the name and description of your scenario.' : 'Enter a name and optionally add a description for your new scenario.'}</p>
        {/* --- [수정 끝] >>> */}
        <form onSubmit={handleSubmit}>
          <label className={styles.label}>Name</label>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scenario Name"
            autoFocus
          />
          {/* --- 👇 [수정] Job Type 선택 UI 숨김 --- */}
          {/*
          <label className={styles.label}>Job Type</label>
          <select
            className={styles.input}
            value={job}
            onChange={(e) => setJob(e.target.value)}
          >
            <option value="Batch">Batch</option>
            <option value="Process">Process</option>
            <option value="Long Transaction">Long Transaction</option>
          </select>
          */}
          {/* --- 👆 [수정 끝] --- */}
          <label className={styles.label}>Description (Optional)</label>
          <textarea
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a brief description for the scenario"
            rows={3}
            style={{ resize: 'vertical' }}
          />
          <div className={styles.buttonGroup}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.createButton}>
              {isEditMode ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScenarioModal;