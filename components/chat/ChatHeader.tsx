"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Info, Users } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/context/modal-context";
import SimpleContactSettingsModal from "@/components/chat/SimpleContactSettingsModal";
const ChatSettingsPanel = dynamic(() => import("@/app/(chat)/chat/[id]/settings-panel"), { ssr: false });
const GroupChatManager = dynamic(() => import("@/components/chat/group-chat-management"), { ssr: false });

type Profile = { id: string; display_name: string | null; avatar_url: string | null; };
type Chat = { id: string; name: string | null; is_group: boolean; };

const generateAvatarGradient = (userId: string) => {
    if (!userId) return 'linear-gradient(135deg, #e0e0e0, #f0f0f0)';
    const hash = userId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const h = hash % 360;
    return `linear-gradient(135deg, hsl(${h}, 85%, 70%), hsl(${(h + 40) % 360}, 90%, 75%))`;
};

interface ChatHeaderProps {
  chat: Chat | null;
  chatName: string;
  otherMember: Profile | null;
  onShowInfo: () => void;
  onShowGroupManager: () => void;
}

export function ChatHeader({ chat, chatName, otherMember, onShowInfo, onShowGroupManager }: ChatHeaderProps) {
  const [openSettings, setOpenSettings] = useState(false);
  if (!chat) return <div className="h-20 flex-shrink-0" />; // Placeholder

  // Adaptation pour compatibilité avec SimpleContactSettingsModal
  const otherUser = otherMember ? {
    id: otherMember.id,
    display_name: otherMember.display_name || '',
    avatar_url: otherMember.avatar_url || null,
    username: (otherMember as any).username || '',
    status: (otherMember as any).status,
    phone: (otherMember as any).phone,
    bio: (otherMember as any).bio,
  } : null;

  return (
    <>
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg px-6">
        <div
          className="flex items-center gap-4 cursor-pointer group"
          onClick={() => {
            if (!chat.is_group && otherMember) setOpenSettings(true);
            // (optionnel) pour groupe : openModal({ type: "settings-group", chatId: chat.id });
          }}
          tabIndex={0}
          role="button"
          aria-label={chat.is_group ? 'Paramètres du groupe' : 'Infos du contact'}
        >
          <Avatar className="h-12 w-12 border-2 border-white shadow-lg group-hover:scale-105 transition-transform">
            <AvatarImage src={chat.is_group ? undefined : otherMember?.avatar_url || undefined} alt={chatName} />
            <AvatarFallback className="text-xl font-semibold text-white" style={{ background: generateAvatarGradient(chat.is_group ? chat.id : otherMember?.id || '') }}>
              {chat.is_group ? <Users /> : chatName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:underline">{chatName}</h2>
            <p className="text-sm text-green-500 font-semibold flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onShowInfo}><Info className="text-slate-500" /></Button>
          {chat.is_group && <Button variant="ghost" size="icon" onClick={onShowGroupManager}><Users className="text-slate-500" /></Button>}
        </div>
      </header>
      {/* Modal settings 1-on-1 autonome */}
      {!chat.is_group && otherUser && (
        <SimpleContactSettingsModal
          open={openSettings}
          onClose={() => setOpenSettings(false)}
          otherUser={otherUser}
          chatId={chat.id}
        />
      )}
    </>
  );
}