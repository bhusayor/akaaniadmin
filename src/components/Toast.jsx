import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconCheck } from './icons.jsx';

const ToastContext = createContext(() => {});

/** `const toast = useToast(); toast('Saved')` */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  const toast = useCallback((msg) => {
    setMessage(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className={
          'fixed bottom-7 left-1/2 z-200 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap ' +
          'rounded-[10px] bg-ink px-4.5 py-2.5 text-[13px] font-medium text-white shadow-tall ' +
          'transition-all duration-300 ' +
          (message ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-5 opacity-0')
        }
      >
        <span className="text-accent"><IconCheck size={14} stroke={2.5} /></span>
        {message}
      </div>
    </ToastContext.Provider>
  );
}
