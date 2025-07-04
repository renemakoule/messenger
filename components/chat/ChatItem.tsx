// components/chat/ChatItem.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Paperclip } from "lucide-react";
import PresenceIndicator from "@/components/presence/presence-indicator";
import { useAuth } from "@/context/auth-context";

// Recréons le type ici pour que le composant soit autonome
type ChatItemProps = {
  chat: {
    id: string;
    name: string | null;
    is_group: boolean;
    other_member_id: string | null;
    updated_at: string;
    last_message: {
      sender_id: string;
      content: string | null;
      created_at: string;
      has_attachment: boolean;
    } | null;
    unread_count: number;
  };
  onChatClick?: (chatId: string) => void;
};

export function ChatItem({ chat, onChatClick }: ChatItemProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isActive = pathname === `/chat/${chat.id}`;
  const chatName = chat.name || (chat.is_group ? "Unnamed Group" : "Unnamed Chat");
  const avatarFallback = chatName.substring(0, 2).toUpperCase();

  return (
    <li className={`${isActive ? "bg-primary/5" : "hover:bg-muted/50"} transition-colors duration-150`}>
      <Link href={`/chat/${chat.id}`} className="block px-4 py-3" onClick={() => onChatClick?.(chat.id)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-10 w-10 border">
                <AvatarFallback className={chat.is_group ? "bg-green-200 text-green-700" : "bg-slate-200 text-slate-600"}>
                  {chat.is_group ? <Users className="h-5 w-5" /> : avatarFallback}
                </AvatarFallback>
              </Avatar>
              {!chat.is_group && chat.other_member_id && (
                <div className="absolute bottom-0 right-0">
                  <PresenceIndicator userId={chat.other_member_id} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>{chatName}</p>
              <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                {chat.last_message?.sender_id === user?.id && <span className="font-semibold">You:</span>}
                {chat.last_message ? (
                  chat.last_message.content ? (
                    <span>{chat.last_message.content}</span>
                  ) : chat.last_message.has_attachment ? (
                    <>
                      <Paperclip className="h-3 w-3 flex-shrink-0" />
                      <span>Attachment</span>
                    </>
                  ) : (
                    <span className="italic">No content</span>
                  )
                ) : (
                  <span className="italic">No messages yet</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0 space-y-1">
            <p className="text-xs whitespace-nowrap text-muted-foreground">
              {new Date(chat.last_message?.created_at || chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {chat.unread_count > 0 && (
              <Badge variant={isActive ? "default" : "secondary"} className="h-5 bg-green-500 text-white px-1.5 text-xs font-semibold">
                {chat.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}