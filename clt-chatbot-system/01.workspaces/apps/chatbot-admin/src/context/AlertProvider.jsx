import { createContext, useState, useCallback, useRef } from 'react';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

export const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const [alertState, setAlertState] = useState({ isOpen: false, message: '' });
  const [confirmState, setConfirmState] = useState({ isOpen: false, message: '' });

  // --- 💡 수정된 부분 시작 ---
  const alertResolver = useRef(null);
  const confirmResolver = useRef(null);

  const showAlert = useCallback((message) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        message,
      });
      alertResolver.current = resolve;
    });
  }, []);

  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
      });
      confirmResolver.current = resolve;
    });
  }, []);

  const handleAlertClose = () => {
    if (alertResolver.current) {
      alertResolver.current();
      alertResolver.current = null;
    }
    setAlertState({ isOpen: false, message: '' });
  };
  
  const handleConfirm = () => {
    if (confirmResolver.current) {
      confirmResolver.current(true);
      confirmResolver.current = null;
    }
    setConfirmState({ isOpen: false, message: '' });
  };

  const handleCancel = () => {
    if (confirmResolver.current) {
      confirmResolver.current(false);
      confirmResolver.current = null;
    }
    setConfirmState({ isOpen: false, message: '' });
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        isOpen={alertState.isOpen}
        message={alertState.message}
        onClose={handleAlertClose}
      />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AlertContext.Provider>
  );
  // --- 💡 수정된 부분 끝 ---
};