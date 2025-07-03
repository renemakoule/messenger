"use client";
import { useRef, useState, useEffect, useMemo, forwardRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { MessageBubble } from "./MessageBubble";

// Recréer les types nécessaires pour l'autonomie du composant
type Profile = { id: string; display_name: string | null; avatar_url: string | null; };
type MessageStatusType = 'sent' | 'delivered' | 'read';
type Message = { id: string; sender_id: string; content: string | null; attachment_url: string | null; attachment_type: string | null; created_at: string; status?: MessageStatusType; sender: Profile; };

// Fonction de formatage de date intelligente
const formatDateSeparator = (dateStr: string | Date) => {
    const messageDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
  
    if (messageDate.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (messageDate.toDateString() === yesterday.toDateString()) return "Hier";
    return messageDate.toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' });
};

interface MessageListProps {
  loading: boolean;
  messages: Message[];
  userId: string | undefined;
  isGroupChat: boolean;
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(({ loading, messages, userId, isGroupChat }, ref) => {
  const [visibleDate, setVisibleDate] = useState<string | null>(null);
  const dateSeparatorRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const messagesByDate = useMemo(() => messages.reduce<Record<string, Message[]>>((groups, message) => {
    const dateKey = new Date(message.created_at).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(message);
    return groups;
  }, {}), [messages]);
  
  // Effet pour mettre à jour la date visible en se basant sur le scroll
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (loading || !scrollContainer) return;
    
    // Au premier chargement, définir la date la plus récente
    const dateKeys = Object.keys(messagesByDate);
    if(dateKeys.length > 0) {
        setVisibleDate(formatDateSeparator(dateKeys[dateKeys.length - 1]));
    }
    
    const observer = new IntersectionObserver((entries) => {
        // On trouve la première balise qui est visible depuis le haut
        const firstVisibleEntry = entries.find(entry => entry.isIntersecting);
        if (firstVisibleEntry) {
            const date = (firstVisibleEntry.target as HTMLElement).dataset.date;
            if (date) setVisibleDate(date);
        }
    }, { 
        root: scrollContainer, 
        threshold: 0.1,
        // Se déclenche dès qu'une balise entre dans la zone du haut de l'écran
        rootMargin: "0px 0px -90% 0px"
    });
    
    dateSeparatorRefs.current.forEach(ref => { if(ref) observer.observe(ref); });
    return () => { observer.disconnect(); };
  }, [loading, messagesByDate]);

  return (
    <main className="flex-1 h-full overflow-y-hidden relative" ref={scrollAreaRef}>
      {/* Badge de date flottant/fixe */}
      {visibleDate && !loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-opacity duration-300">
          <Badge variant="secondary" className="text-sm font-semibold shadow-lg bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
            {visibleDate}
          </Badge>
        </div>
      )}
      
      <ScrollArea className="h-full px-6 pt-2 pb-4">
        {loading ? ( <div className="flex h-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>
        ) : messages.length === 0 ? ( <div className="flex h-full flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-2"><MessageSquarePlus className="h-20 w-20"/><p className="text-xl font-semibold">No messages yet.</p><p>Be the first to say something!</p></div>
        ) : (
          <div className="space-y-2 pb-4">
            {Object.entries(messagesByDate).map(([dateKey, dateMessages], index) => (
              <div key={dateKey}>
                {/* Balise de date invisible pour l'IntersectionObserver */}
                <div 
                  ref={(el) => { dateSeparatorRefs.current[index] = el; }} 
                  data-date={formatDateSeparator(dateKey)}
                  className="h-px" // Invisible mais présent dans le DOM
                ></div>
                {dateMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} isCurrentUser={message.sender_id === userId} isGroupChat={isGroupChat} />
                ))}
              </div>
            ))}
            <div ref={ref} />
          </div>
        )}
      </ScrollArea>
    </main>
  );
});

MessageList.displayName = "MessageList";