"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type NotificationType = "info" | "success" | "error";

interface Notification {
  id: number;
  message: string;
  type?: NotificationType;
}

interface NotificationContextType {
  notify: (notification: Omit<Notification, "id">) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((notification: Omit<Notification, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotifications((prev) => [...prev, { ...notification, id }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
    // Notification push navigateur
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(notification.message, {
          icon: "/logo.png",
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="fixed z-50 bottom-6 right-6 flex flex-col gap-2 items-end">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`px-4 py-3 rounded shadow-lg text-white animate-in fade-in-0 slide-in-from-bottom-4 duration-300 min-w-[220px] max-w-xs font-medium
              ${notif.type === "success" ? "bg-green-600" : notif.type === "error" ? "bg-red-600" : "bg-slate-800"}`}
          >
            {notif.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within a NotificationProvider");
  return ctx;
} 