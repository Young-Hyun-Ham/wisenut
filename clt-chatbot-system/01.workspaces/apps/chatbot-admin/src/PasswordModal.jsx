import { useState } from 'react';
import styles from './PasswordModal.module.css';

function PasswordModal({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // 비밀번호가 'clt2025'인 경우 인증 처리
    if (password === 'clt2025') {
      onAuthenticate();
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Enter Password</h2>
        <p>Please enter the password to access this page.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.submitButton}>
              Enter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordModal;