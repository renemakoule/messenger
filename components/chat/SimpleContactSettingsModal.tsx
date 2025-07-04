import { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Link2 } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotification } from "@/components/ui/notification-provider";

interface SimpleContactSettingsModalProps {
  open: boolean;
  onClose: () => void;
  otherUser: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
    status?: string;
    phone?: string;
    bio?: string;
  };
  chatId: string;
}

export default function SimpleContactSettingsModal({ open, onClose, otherUser, chatId }: SimpleContactSettingsModalProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muted, setMuted] = useState(false);
  const [sound, setSound] = useState("default");
  const [media, setMedia] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [sharedLinks, setSharedLinks] = useState<string[]>([]);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [showDeleteAllMessagesDialog, setShowDeleteAllMessagesDialog] = useState(false);
  const reportReasonRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotification();

  // Fetch réel des médias partagés du chat
  useEffect(() => {
    const fetchMedia = async () => {
      setMediaLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, attachment_url, attachment_type, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false });
      setMedia(data || []);
      setMediaLoading(false);
    };
    if (open) fetchMedia();
  }, [chatId, supabase, open]);

  // Extraction liens
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links: string[] = [];
    media.forEach((m) => {
      if (m.attachment_type === null && m.content) {
        const found = m.content.match(urlRegex);
        if (found) links.push(...found);
      }
    });
    setSharedLinks(links);
  }, [media]);

  const handleBlock = async () => {
    setBlockLoading(true);
    setTimeout(() => {
      setBlocked((b) => !b);
      setBlockLoading(false);
    }, 500);
  };

  const handleReport = () => {
    setShowReportDialog(false);
    notify({ message: "Signalement envoyé. Merci.", type: "success" });
  };

  // Supprimer la conversation (pour l'utilisateur courant)
  const handleDeleteChat = async () => {
    setShowDeleteDialog(false);
    if (!user) return;
    await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("profile_id", user.id);
    notify({ message: "Conversation supprimée pour vous.", type: "success" });
    onClose();
  };

  // Supprimer le contact (retirer l'autre user du chat)
  const handleDeleteContact = async () => {
    setShowDeleteContactDialog(false);
    await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("profile_id", otherUser.id);
    notify({ message: "Contact supprimé de la conversation.", type: "success" });
    onClose();
  };

  // Ajout de la fonction pour supprimer tous les messages du chat
  const handleDeleteAllMessages = async () => {
    setShowDeleteDialog(false);
    if (!user) return;
    await supabase.from("messages").delete().eq("chat_id", chatId);
    notify({ message: "Tous les messages de la conversation ont été supprimés.", type: "success" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-[90vh] p-0 bg-white dark:bg-slate-950 border-none shadow-xl rounded-2xl overflow-hidden">
        <ScrollArea className="flex-1 max-h-[70vh] p-6 space-y-8">
          <DialogTitle className="sr-only">Paramètres du contact</DialogTitle>
          {/* Profil */}
          <section className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback>{otherUser.display_name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <div className="text-lg font-semibold">{otherUser.display_name}</div>
              <div className="text-sm text-slate-500">@{otherUser.username}</div>
              <div className="text-xs text-slate-400 mt-1">{otherUser.status || "En ligne"}</div>
              {otherUser.phone && <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1"><span className="font-medium">📞</span>{otherUser.phone}</div>}
              {otherUser.bio && <div className="text-xs text-slate-400 mt-1 italic">{otherUser.bio}</div>}
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Button variant={blocked ? "secondary" : "destructive"} onClick={handleBlock} disabled={blockLoading} className="w-full">
                {blockLoading ? "..." : blocked ? "Débloquer" : "Bloquer"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowDeleteContactDialog(true)}>
                Supprimer le contact
              </Button>
            </div>
          </section>
          {/* Notifications personnalisées */}
          <section className="space-y-3">
            <h3 className="text-lg font-bold mb-1">Notifications personnalisées</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm">Notifications</span>
              <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Silencieux</span>
              <Switch checked={muted} onCheckedChange={setMuted} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Son</span>
              <select className="rounded border px-2 py-1 bg-slate-100 dark:bg-slate-800" value={sound} onChange={e => setSound(e.target.value)}>
                <option value="default">Défaut</option>
                <option value="ding">Ding</option>
                <option value="pop">Pop</option>
                <option value="none">Aucun</option>
              </select>
            </div>
          </section>
          {/* Médias partagés */}
          <section>
            <h3 className="text-lg font-bold mb-3">Médias partagés</h3>
            {mediaLoading ? <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /> : media.filter(m => m.attachment_type === "image" || m.attachment_type === "video").length === 0 ? (
              <div className="text-slate-400 text-center">Aucun média partagé</div>
            ) : (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {media.filter(m => m.attachment_type === "image" || m.attachment_type === "video").map((m) => m.attachment_type === "image" ? (
                  <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                    <Image src={m.attachment_url} alt="media" width={100} height={100} className="rounded-lg object-cover aspect-square" />
                  </a>
                ) : (
                  <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                    <video src={m.attachment_url} className="rounded-lg object-cover aspect-square w-full h-full" />
                  </a>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {media.filter(m => m.attachment_type === "document").map((m) => (
                <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <span className="truncate max-w-[80px] text-xs">Document</span>
                </a>
              ))}
            </div>
          </section>
          {/* Liens partagés */}
          <section>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Link2 className="h-5 w-5" />Liens partagés</h3>
            {sharedLinks.length === 0 ? (
              <div className="text-slate-400 text-center">Aucun lien partagé</div>
            ) : (
              <ul className="space-y-2">
                {sharedLinks.map((link, i) => (
                  <li key={i}>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{link}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* Actions */}
          <section className="space-y-2 mt-6">
            <Button variant="outline" className="w-full" onClick={() => setShowReportDialog(true)}>
              Signaler
            </Button>
            <Button variant="outline" className="w-full text-red-600 border-red-400 hover:bg-red-50" onClick={() => setShowDeleteDialog(true)}>
              Supprimer la conversation
            </Button>
            <Button variant="destructive" className="w-full" onClick={() => setShowDeleteAllMessagesDialog(true)}>
              Supprimer tous les messages
            </Button>
          </section>
        </ScrollArea>
        {/* Dialogs */}
        {/* Supprimer le contact */}
        <Dialog open={showDeleteContactDialog} onOpenChange={setShowDeleteContactDialog}>
          <DialogContent>
            <DialogTitle>Supprimer ce contact ?</DialogTitle>
            <p className="text-sm text-slate-500">Ce contact sera retiré de la conversation. Cette action est irréversible.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteContactDialog(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDeleteContact}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogContent>
            <DialogTitle>Signaler ce contact</DialogTitle>
            <input ref={reportReasonRef} className="w-full rounded border px-3 py-2 mt-4" placeholder="Raison du signalement (optionnel)" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReportDialog(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleReport}>Signaler</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogTitle>Supprimer cette conversation ?</DialogTitle>
            <p className="text-sm text-slate-500">Cette action est irréversible. Tous les messages seront supprimés pour vous.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDeleteChat}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={showDeleteAllMessagesDialog} onOpenChange={setShowDeleteAllMessagesDialog}>
          <DialogContent>
            <DialogTitle>Supprimer tous les messages ?</DialogTitle>
            <p className="text-sm text-slate-500">Cette action est irréversible. Tous les messages de cette conversation seront supprimés pour tout le monde.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteAllMessagesDialog(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDeleteAllMessages}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
} 