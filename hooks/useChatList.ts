// hooks/useChatList.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";

type Label = Database["public"]["Tables"]["chat_labels"]["Row"];
type ChatWithDetails = {
  id: string;
  name: string | null;
  is_group: boolean;
  other_member_id: string | null;
  created_at: string;
  updated_at: string;
  last_message: { id: string; content: string | null; sender_id: string; sender_name: string; created_at: string; has_attachment: boolean; } | null;
  unread_count: number;
  labels: Label[];
};

export function useChatList() {
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  const fetchAllChatDetails = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // On ne remet le loading à true que si on n'a pas encore de chats
    if (chats.length === 0) {
      setLoading(true);
    }

    try {
      const { data: chatDetailsResults, error } = await supabase.rpc("get_chats_details_for_user", {
        user_id_param: user.id
      });

      if (error) {
        console.error("Error fetching chats with RPC:", error);
        setChats([]);
        return;
      }

      const { data: labels } = await supabase.from("chat_labels").select("*").eq("profile_id", user.id);
      const chatIds = chatDetailsResults.map(c => c.id);
      const { data: labelAssignments } = await supabase.from("chat_label_assignments").select("*").eq("profile_id", user.id).in("chat_id", chatIds);

      const validChatsWithLabels = chatDetailsResults.map(chat => {
        const chatLabels = labelAssignments?.filter(la => la.chat_id === chat.id).map(la => labels?.find(l => l.id === la.label_id)).filter((l): l is Label => l !== undefined) || [];
        return { ...chat, labels: chatLabels };
      });

      validChatsWithLabels.sort((a, b) =>
        new Date(b.last_message?.created_at || b.updated_at).getTime() -
        new Date(a.last_message?.created_at || a.updated_at).getTime()
      );

      setChats(validChatsWithLabels);
    } catch (error) {
      console.error("Error in fetchAllChatDetails:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase, chats.length]);

  useEffect(() => {
    if (user) {
      fetchAllChatDetails();
    } else {
      setLoading(false);
      setChats([]);
    }
  }, [user, fetchAllChatDetails]);
  
  useEffect(() => {
    if (!user) return;

    const handleUpdate = () => {
      // Un léger délai pour éviter les re-fetchs multiples en cas d'événements groupés
      const timer = setTimeout(() => {
        fetchAllChatDetails();
      }, 500);
      return () => clearTimeout(timer);
    };

    const messageListener = supabase.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleUpdate)
      .subscribe();
        
    const membersListener = supabase.channel('public:chat_members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `profile_id=eq.${user.id}`}, handleUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(messageListener);
      supabase.removeChannel(membersListener);
    };
  }, [user, supabase, fetchAllChatDetails]);

  // Cet effet gère spécifiquement la mise à jour des "unread_count" sans tout recharger
  useEffect(() => {
    if (!user) return;
    const readListener = supabase.channel(`read-status-listener-${user.id}`)
      .on('broadcast', { event: 'chat_read' }, (payload) => {
          const { chatId } = payload.payload;
          setChats(prevChats => prevChats.map(chat => chat.id === chatId ? { ...chat, unread_count: 0 } : chat));
      }).subscribe();

    return () => {
      supabase.removeChannel(readListener);
    }
  }, [user, supabase]);


  return { chats, loading, refetch: fetchAllChatDetails };
}