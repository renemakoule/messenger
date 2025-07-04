import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import React from "react";

const SettingsPanel = dynamic(() => import("@/app/(chat)/chat/[id]/settings-panel"), { ssr: false });

export default function Settings1on1Modal({ chatId, otherUserId, onClose }: { chatId: string; otherUserId: string; onClose: () => void }) {
  console.log("Settings1on1Modal props", { chatId, otherUserId });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-[90vh] p-0 bg-white dark:bg-slate-950 border-none shadow-xl rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Paramètres du chat</DialogTitle>
        <React.Suspense fallback={<div className="p-8 text-center">Chargement du panneau de configuration...</div>}>
          <SettingsPanel chatId={chatId} otherUserId={otherUserId} onClose={onClose} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
} 