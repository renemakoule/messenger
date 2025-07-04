import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import React from "react";

const GroupManager = dynamic(() => import("@/components/chat/group-chat-management"), { ssr: false });

export default function SettingsGroupModal({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  console.log("SettingsGroupModal props", { chatId });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-[90vh] p-0 bg-white dark:bg-slate-950 border-none shadow-xl rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Paramètres du groupe</DialogTitle>
        <React.Suspense fallback={<div className="p-8 text-center">Chargement du panneau de configuration du groupe...</div>}>
          <GroupManager chatId={chatId} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
} 