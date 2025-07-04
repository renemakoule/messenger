import React, { createContext, useContext, useState, ReactNode } from "react";
import ProfileModal from "@/components/profile/ProfileModal";
import Settings1on1Modal from "@/components/chat/Settings1on1Modal";
import SettingsGroupModal from "@/components/chat/SettingsGroupModal";

// Types de modals supportés
export type ModalType =
  | null
  | { type: "profile"; userId: string }
  | { type: "settings-1on1"; chatId: string; otherUserId: string }
  | { type: "settings-group"; chatId: string };

interface ModalContextValue {
  modal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalType>(null);

  const openModal = (modal: ModalType) => setModal(modal);
  const closeModal = () => setModal(null);

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
      <GlobalModal modal={modal} onClose={closeModal} />
    </ModalContext.Provider>
  );
}

// Composant qui affiche le bon modal selon le contexte
function GlobalModal({ modal, onClose }: { modal: ModalType; onClose: () => void }) {
  if (!modal) return null;
  if (modal.type === "profile") {
    return <ProfileModal userId={modal.userId} onClose={onClose} />;
  }
  if (modal.type === "settings-1on1") {
    return <Settings1on1Modal chatId={modal.chatId} otherUserId={modal.otherUserId} onClose={onClose} />;
  }
  if (modal.type === "settings-group") {
    return <SettingsGroupModal chatId={modal.chatId} onClose={onClose} />;
  }
  return null;
} 