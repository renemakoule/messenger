"use client";
import AttachmentUploader from "@/components/attachments/attachment-uploader";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import ChatLabelManager from "@/components/chat/chat-label-manager";
import GroupChatManager from "@/components/chat/group-chat-management";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/supabase";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from "@/components/ui/notification-provider";

// Types partagés, essentiels pour la communication entre composants
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Chat = Database["public"]["Tables"]["chats"]["Row"];
type MessageStatusType = 'sent' | 'delivered' | 'read';
type Message = Database["public"]["Tables"]["messages"]["Row"] & { sender: Profile; status?: MessageStatusType; };
type AttachmentType = "image" | "video" | "document" | "audio";

export default function ChatMessagePage() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user, profile } = useAuth();
  const supabase = createClient();
  const params = useParams();
  const chatId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);

   // États pour la gestion des pièces jointes
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<AttachmentType | null>(null);
  const [showAttachmentUploader, setShowAttachmentUploader] = useState(false);
  
  // Logique pour l'enregistrement vocal
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { notify } = useNotification();

  // Scroll vers le bas à chaque nouveau message
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Scroll vers le bas instantané au chargement initial
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [loading]);

  // Fetch des données initiales et notification de lecture
  useEffect(() => {
    if (!user || !chatId) return;
    const fetchChatDetails = async () => {
      setLoading(true);
      try {
        const { data: chatData } = await supabase.from("chats").select("*").eq("id", chatId).single();
        if (!chatData) return;
        setChat(chatData);

        const { data: membersData } = await supabase.from("chat_members").select("profiles(*)").eq("chat_id", chatId);
        setMembers(membersData?.map(m => m.profiles) as any[] || []);

        const { data: messagesData } = await supabase.from("messages").select("*, sender:profiles(*)").eq("chat_id", chatId).order("created_at");
        setMessages(messagesData?.map(m => ({...m, status: 'read'})) as Message[] || []);

        // Notifier la sidebar que ce chat est maintenant lu
        const channel = supabase.channel(`read-status-listener-${user.id}`);
        await channel.send({
          type: 'broadcast',
          event: 'chat_read',
          payload: { chatId: chatId }
        });

      } catch (error) {
        console.error("Error fetching chat details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChatDetails();
  }, [user, chatId, supabase]);

  // Abonnements en temps réel
  useEffect(() => {
    if (!user || !chatId) return;
    const channel = supabase.channel(`chat:${chatId}`);
    channel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMessage = payload.payload as Message;
        if (newMessage.sender_id !== user.id) {
          setMessages((prev) => [...prev, { ...newMessage, status: 'delivered' }]);
          channel.send({ type: 'broadcast', event: 'message_read', payload: { messageId: newMessage.id, readerId: user.id } });
        }
      })
      .on('broadcast', { event: 'message_read' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.payload.messageId ? { ...m, status: 'read' } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, chatId, supabase]);
  
  const sendMessage = async (content: string | null = newMessage, url: string | null = null, type: AttachmentType | null = null) => {
    if (!user || !profile || !chatId || (!content && !url)) return;
    setSending(true);
    const optimisticMessage: Message = { id: `temp_${Date.now()}`, chat_id: chatId, sender_id: user.id, content, attachment_url: url, attachment_type: type, is_read: false, status: 'sent', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sender: profile };
    setMessages((prev) => [...prev, optimisticMessage]);
    const messageToInsert = { chat_id: chatId, sender_id: user.id, content, attachment_url: url, attachment_type: type };
    setNewMessage("");
    try {
      const { data, error } = await supabase.from("messages").insert(messageToInsert).select("*, sender:profiles(*)").single();
      if (error || !data) throw error || new Error("No data returned");
      const realMessage = data as Message;
      const channel = supabase.channel(`chat:${chatId}`);
      await channel.send({ type: 'broadcast', event: 'new_message', payload: { ...realMessage, status: 'delivered' } });
      setMessages((prev) => prev.map(m => m.id === optimisticMessage.id ? { ...realMessage, status: 'delivered' } : m));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    } finally {
      setSending(false);
    }
  };
  
  const handleStartRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      setIsRecording(true);
      mediaRecorderRef.current.start();
      
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size === 0) return;
        const audioBlob = event.data;
        const fileName = `voice-messages/${user?.id}_${uuidv4()}.webm`;
        setSending(true);
        const { error } = await supabase.storage.from("chat_attachments").upload(fileName, audioBlob);
        if (error) {
          console.error("Upload failed", error);
          setSending(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from("chat_attachments").getPublicUrl(fileName);
        await sendMessage(null, publicUrl, 'audio');
        setSending(false);
      };
    } catch (e) {
      notify({ message: "Could not start recording. Please check microphone permissions.", type: "error" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const getChatName = () => chat?.is_group ? (chat.name ?? 'Group Chat') : (members.find(m => m.id !== user?.id)?.display_name ?? 'Chat');
  const getOtherMember = () => !chat?.is_group ? (members.find(m => m.id !== user?.id) ?? null) : null;

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-black">
      <ChatHeader
        chat={chat}
        chatName={getChatName()}
        otherMember={getOtherMember()}
        onShowInfo={() => setShowChatInfo(true)}
        onShowGroupManager={() => setShowGroupManager(true)}
      />
      
      
      
      <MessageList
        ref={messagesEndRef}
        loading={loading}
        messages={messages}
        userId={user?.id}
        isGroupChat={chat?.is_group || false}
      />

      {/* On affiche le composant d'upload s'il doit être visible */}
      {showAttachmentUploader && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <AttachmentUploader 
            chatId={chatId} 
            onUploadComplete={(url, type) => {
              // Une fois l'upload terminé, on envoie le message avec la pièce jointe
              sendMessage(null, url, type);
              setShowAttachmentUploader(false);
            }} 
            onCancel={() => setShowAttachmentUploader(false)} 
          />
        </div>
      )}
      
      <ChatInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSendMessage={() => sendMessage()}
        onStartRecording={handleStartRecording}
        onStopRecording={stopRecording}
        isRecording={isRecording}
        isSending={sending}
        // CORRECTION: Passer la fonction pour gérer le clic
        onAttachClick={() => setShowAttachmentUploader(prev => !prev)}
      />

      
      
      {showChatInfo && (
        <div className="absolute top-0 right-0 h-full w-96 bg-white z-30 shadow-lg border-l dark:bg-slate-950 dark:border-slate-800 p-4">
            <button className="absolute top-2 right-2 p-2" onClick={() => setShowChatInfo(false)}>Close</button>
            <ChatLabelManager chatId={chatId} />
        </div>
      )}
      {showGroupManager && (
        <div className="absolute top-0 right-0 h-full w-96 bg-white z-30 shadow-lg border-l dark:bg-slate-950 dark:border-slate-800 p-4">
            <button className="absolute top-2 right-2 p-2" onClick={() => setShowGroupManager(false)}>Close</button>
            <GroupChatManager chatId={chatId} />
        </div>
      )}
    </div>
  );
}