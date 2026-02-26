import React from 'react';
import styles from './AlertModal.module.css';

function AlertModal({ isOpen, message, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttonGroup}>
          <button onClick={onClose} className={styles.okButton}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertModal;