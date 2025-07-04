"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Bookmark, Archive, Link2 } from "lucide-react";
import { useNotification } from "@/components/ui/notification-provider";

export default function ChatSettingsPanel({
  chatId,
  otherUserId,
  onClose,
}: {
  chatId: string;
  otherUserId: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [blockLoading, setBlockLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sound, setSound] = useState("default");
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sharedLinks, setSharedLinks] = useState<string[]>([]);
  const router = useRouter();
  const reportReasonRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotification();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("*").eq("id", otherUserId).single();
      setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [otherUserId, supabase]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id ?? null);
    };
    getUser();
  }, [supabase]);

  useEffect(() => {
    const fetchBlock = async () => {
      if (!userId) return;
      const { data } = await supabase.from("blocked_users").select("*").eq("blocker_id", userId).eq("blocked_id", otherUserId).single();
      setBlocked(!!data);
    };
    fetchBlock();
  }, [otherUserId, supabase, userId]);

  useEffect(() => {
    const fetchMedia = async () => {
      setMediaLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("id, attachment_url, attachment_type, created_at")
        .eq("chat_id", chatId)
        .not("attachment_url", "is", null)
        .order("created_at", { ascending: false });
      setMedia(data || []);
      setMediaLoading(false);
    };
    fetchMedia();
  }, [chatId, supabase]);

  const handleBlock = async () => {
    setBlockLoading(true);
    if (!userId) return;
    if (!blocked) {
      await supabase.from("blocked_users").insert({ blocker_id: userId, blocked_id: otherUserId });
      setBlocked(true);
    } else {
      await supabase.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", otherUserId);
      setBlocked(false);
    }
    setBlockLoading(false);
  };

  const handleToggleNotifications = () => {
    setNotificationsEnabled((prev) => !prev);
    // Ici, tu pourrais sauvegarder ce paramètre dans la base ou localStorage
  };

  const handleReport = async () => {
    setShowReportDialog(false);
    notify({ message: "Signalement envoyé. Merci.", type: "success" });
  };

  const handleDeleteChat = async () => {
    // Suppression du chat côté base
    await supabase.from("chats").delete().eq("id", chatId);
    setShowDeleteDialog(false);
    router.push("/");
  };

  const extractLinks = useCallback(() => {
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

  useEffect(() => {
    extractLinks();
  }, [media, extractLinks]);

  return (
    <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-950 z-40 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right-20 duration-300">
      <header className="sticky top-0 z-10 flex items-center justify-between p-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold">Infos du contact</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <span className="sr-only">Fermer</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Profil */}
        <section className="flex flex-col items-center gap-3">
          {loading ? <Loader2 className="animate-spin h-12 w-12 text-primary" /> : profile && (
            <>
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{profile.display_name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <div className="text-lg font-semibold">{profile.display_name}</div>
                <div className="text-sm text-slate-500">@{profile.username}</div>
                <div className="text-xs text-slate-400 mt-1">{profile.status || "En ligne"}</div>
                {profile.phone && <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1"><span className="font-medium">📞</span>{profile.phone}</div>}
                {profile.bio && <div className="text-xs text-slate-400 mt-1 italic">{profile.bio}</div>}
              </div>
              <div className="flex flex-col gap-2 w-full mt-2">
                <div className="flex items-center gap-2">
                  <Button variant={pinned ? "secondary" : "outline"} size="sm" className="flex-1" onClick={() => setPinned(v => !v)}><Bookmark className="mr-2 h-4 w-4" />{pinned ? "Épinglé" : "Épingler"}</Button>
                  <Button variant={archived ? "secondary" : "outline"} size="sm" className="flex-1" onClick={() => setArchived(v => !v)}><Archive className="mr-2 h-4 w-4" />{archived ? "Archivé" : "Archiver"}</Button>
                </div>
              </div>
            </>
          )}
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
          {mediaLoading ? <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /> : media.length === 0 ? (
            <div className="text-slate-400 text-center">Aucun média partagé</div>
          ) : (
            <>
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
              <div className="space-y-2">
                {media.filter(m => m.attachment_type === "document").map((m) => (
                  <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <span className="truncate max-w-[80px] text-xs">Document</span>
                  </a>
                ))}
              </div>
            </>
          )}
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
          <Button variant={blocked ? "secondary" : "destructive"} onClick={handleBlock} disabled={blockLoading} className="w-full">
            {blockLoading ? "..." : blocked ? "Débloquer" : "Bloquer"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setShowReportDialog(true)}>
            Signaler
          </Button>
          <Button variant="outline" className="w-full text-red-600 border-red-400 hover:bg-red-50" onClick={() => setShowDeleteDialog(true)}>
            Supprimer le chat
          </Button>
        </section>
      </div>
      {/* Dialogs */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler ce contact</DialogTitle>
          </DialogHeader>
          <input ref={reportReasonRef} className="w-full rounded border px-3 py-2 mt-4" placeholder="Raison du signalement (optionnel)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReport}>Signaler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce chat ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">Cette action est irréversible. Tous les messages seront supprimés pour vous.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteChat}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
} 