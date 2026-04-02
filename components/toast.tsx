"use client";

import { useEffect, useState } from "react";

type ToastProps = {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
};

export function Toast({ message, onDismiss, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setDisplayMessage(message);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [message, duration, onDismiss]);

  if (!displayMessage) {
    return null;
  }

  return (
    <div className={`toast ${visible ? "toast-enter" : "toast-exit"}`} role="status">
      <p className="toast-message">{displayMessage}</p>
    </div>
  );
}
