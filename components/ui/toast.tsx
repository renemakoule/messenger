// Ce fichier est désormais obsolète. Utilisez NotificationProvider et useNotification à la place.
"use client";
import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";

interface Toast {
  id: number;
  message: string;
  type?: "success" | "error" | "info";
}

const ToastContext = createContext<{
  showToast: (toast: Omit<Toast, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(toast.message, {
          icon: "/logo.png",
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed z-50 bottom-6 right-6 flex flex-col gap-2 items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded shadow-lg text-white animate-in fade-in-0 slide-in-from-bottom-4 duration-300 min-w-[220px] max-w-xs
              ${toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-slate-800"}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function Toast({ message, type = "info", onClose }: { message: string; type?: "info" | "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const color = type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-blue-500";
  return (
    <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-semibold ${color} animate-in fade-in slide-in-from-top-4`}>
      {message}
    </div>
  );
} 