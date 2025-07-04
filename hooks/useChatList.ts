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

  const fetchInitialChatList = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_chats_details_for_user", {
        user_id_param: user.id
      });
      if (error) throw error;
      
      const { data: labels } = await supabase.from("chat_labels").select("*").eq("profile_id", user.id);
      const chatIds = data.map(c => c.id);
      const { data: labelAssignments } = await supabase.from("chat_label_assignments").select("*").eq("profile_id", user.id).in("chat_id", chatIds);
      
      const validChatsWithLabels = data.map(chat => {
        const chatLabels = labelAssignments?.filter(la => la.chat_id === chat.id).map(la => labels?.find(l => l.id === la.label_id)).filter((l): l is Label => l !== undefined) || [];
        return { ...chat, labels: chatLabels };
      });
      validChatsWithLabels.sort((a, b) => new Date(b.last_message?.created_at || b.updated_at).getTime() - new Date(a.last_message?.created_at || a.updated_at).getTime());
      setChats(validChatsWithLabels);
    } catch (error) {
      console.error("Error fetching initial chat list:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchInitialChatList();
  }, [fetchInitialChatList]);

  const updateOrAddChat = useCallback(async (chatId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_chat_details', {
        chat_id_param: chatId,
        user_id_param: user.id
      });

      if (error || !data || data.length === 0) {
        console.error(`Could not fetch details for chat ${chatId}`, error);
        return;
      }
      
      const updatedChatDetails = data[0] as ChatWithDetails;
      
      // Récupérer les labels pour ce chat spécifique
      const { data: labels } = await supabase.from("chat_labels").select("*, chat_label_assignments!inner(*)").eq('chat_label_assignments.chat_id', chatId).eq('profile_id', user.id);
      updatedChatDetails.labels = labels || [];

      setChats(prevChats => {
        // Enlever l'ancienne version du chat s'il existe
        const otherChats = prevChats.filter(c => c.id !== chatId);
        // Ajouter la nouvelle version et retrier la liste
        const newChats = [updatedChatDetails, ...otherChats];
        newChats.sort((a, b) => new Date(b.last_message?.created_at || b.updated_at).getTime() - new Date(a.last_message?.created_at || a.updated_at).getTime());
        return newChats;
      });

    } catch (e) {
      console.error("Failed to update chat details surgically", e);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;

    const messageListener = supabase.channel('realtime-sidebar-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
      (payload) => {
        const newMsg = payload.new as { chat_id: string };
        updateOrAddChat(newMsg.chat_id);
      })
      .subscribe();
        
    const membersListener = supabase.channel('realtime-sidebar-members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `profile_id=eq.${user.id}`}, 
      (payload) => {
        const eventType = payload.eventType;
        if (eventType === 'INSERT') {
          const newMembership = payload.new as { chat_id: string };
          updateOrAddChat(newMembership.chat_id);
        } else if (eventType === 'DELETE') {
          const oldMembership = payload.old as { chat_id?: string };
          if (oldMembership.chat_id) {
            setChats(prev => prev.filter(c => c.id !== oldMembership.chat_id));
          }
        }
      })
      .subscribe();

    const readListener = supabase.channel(`read-status-listener-${user.id}`)
      .on('broadcast', { event: 'chat_read' }, (payload) => {
          const { chatId } = payload.payload;
          setChats(prevChats => prevChats.map(chat => 
            chat.id === chatId ? { ...chat, unread_count: 0 } : chat
          ));
      }).subscribe();

    return () => {
      supabase.removeChannel(messageListener);
      supabase.removeChannel(membersListener);
      supabase.removeChannel(readListener);
    };
  }, [user, supabase, updateOrAddChat]);

  return { chats, loading, refetch: fetchInitialChatList };
}