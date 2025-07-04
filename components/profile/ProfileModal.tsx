import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import React from "react";
import ProfileContent from "./ProfileContent";

export default function ProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  console.log("ProfileModal props", { userId });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] p-0 bg-white dark:bg-slate-950 border-none shadow-xl rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Profil utilisateur</DialogTitle>
        <React.Suspense fallback={<div className="p-8 text-center">Chargement du profil...</div>}>
          <ProfileContent userId={userId} onClose={onClose} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
} 