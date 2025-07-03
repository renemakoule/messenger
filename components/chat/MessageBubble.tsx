"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AttachmentPreview from "@/components/attachments/attachment-preview";
import { Check, CheckCheck } from "lucide-react";

// Recréer les types ici pour rendre le composant autonome
type Profile = { id: string; display_name: string | null; avatar_url: string | null; };
type MessageStatusType = 'sent' | 'delivered' | 'read';
type Message = { id: string; sender_id: string; content: string | null; attachment_url: string | null; attachment_type: string | null; created_at: string; status?: MessageStatusType; sender: Profile; };
type AttachmentType = "image" | "video" | "document" | "audio";

const generateAvatarGradient = (userId: string) => {
    if (!userId) return 'linear-gradient(135deg, #e0e0e0, #f0f0f0)';
    const hash = userId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const h = hash % 360;
    return `linear-gradient(135deg, hsl(${h}, 85%, 70%), hsl(${(h + 40) % 360}, 90%, 75%))`;
};

const MessageStatus = ({ status }: { status?: MessageStatusType }) => {
    if (!status) return null;
    const commonClass = "inline-block ml-2";
    if (status === 'sent') return <Check size={16} className={`${commonClass} text-slate-400`} />;
    if (status === 'delivered') return <CheckCheck size={16} className={`${commonClass} text-slate-400`} />;
    if (status === 'read') return <CheckCheck size={16} className={`${commonClass} text-blue-500`} />;
    return null;
};

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  isGroupChat: boolean;
}

export function MessageBubble({ message, isCurrentUser, isGroupChat }: MessageBubbleProps) {
  return (
    <div className={`flex items-end gap-3 my-3 animate-in fade-in-25 slide-in-from-bottom-4 duration-300 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      {!isCurrentUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.sender.avatar_url || ''} />
          <AvatarFallback style={{ background: generateAvatarGradient(message.sender_id) }} className="font-semibold text-white">
            {message.sender.display_name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`flex flex-col max-w-xl rounded-2xl px-4 py-2.5 shadow-md ${isCurrentUser ? 'bg-primary text-white rounded-br-none' : 'bg-white dark:bg-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
        {isGroupChat && !isCurrentUser && <p className="text-xs font-bold text-indigo-400 mb-1">{message.sender.display_name}</p>}
        
        {message.attachment_url && <AttachmentPreview url={message.attachment_url} type={message.attachment_type as AttachmentType} />}
        
        {message.content && <p className="text-base break-words whitespace-pre-wrap">{message.content}</p>}
        
        <div className="flex items-center justify-end text-xs mt-1.5 opacity-80">
          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isCurrentUser && <MessageStatus status={message.status} />}
        </div>
      </div>
    </div>
  );
}