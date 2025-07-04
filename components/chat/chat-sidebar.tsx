"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, Filter as FilterIcon, GripVertical, MessageSquarePlus, Paperclip, Pencil, Plus, Search, Settings, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { FaFilter } from "react-icons/fa";
import { IoCreate } from "react-icons/io5";
import { v4 as uuidv4 } from "uuid";
import { ClientChatFilter, FilterCriteria } from "../../types/filter";
import { Database } from "../../types/supabase";
import FilterModal from "./chat-filter-modal";
import ProfilePage from "@/app/profile/page";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/context/modal-context";

type Label = Database["public"]["Tables"]["chat_labels"]["Row"];
type ChatWithDetails = { id: string; name: string | null; is_group: boolean; created_at: string; updated_at: string; last_message: { id: string; content: string | null; sender_id: string; sender_name: string; created_at: string; has_attachment: boolean; } | null; unread_count: number; labels: Label[]; };
const LOCAL_STORAGE_FILTERS_KEY = "chatAppClientFilters";

export default function ChatSidebar({ onChatClick }: { onChatClick?: (chatId: string) => void } = {}) {
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [definedFilters, setDefinedFilters] = useState<ClientChatFilter[]>([]);
  const [activeFilter, setActiveFilter] = useState<ClientChatFilter | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingFilter, setEditingFilter] = useState<ClientChatFilter | null>(null);
  const [userLabels, setUserLabels] = useState<Label[]>([]);

  const fetchAllChatDetails = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: chatMembers, error: memberError } = await supabase.from("chat_members").select("chat_id").eq("profile_id", user.id);
      if (memberError || !chatMembers) { setChats([]); setLoading(false); return; }
      
      const chatIds = chatMembers.map((member) => member.chat_id);
      if (chatIds.length === 0) { setChats([]); setLoading(false); return; }

      const { data: labels } = await supabase.from("chat_labels").select("*").eq("profile_id", user.id);
      const { data: labelAssignments } = await supabase.from("chat_label_assignments").select("*").eq("profile_id", user.id).in("chat_id", chatIds);

      const chatDetailsPromises = chatIds.map(async (chatId) => {
        const { data, error } = await supabase.rpc("get_chat_details", { chat_id_param: chatId, user_id_param: user.id });
        if (error || !data || data.length === 0) return null;
        
        const chatLabels = labelAssignments?.filter(la => la.chat_id === chatId).map(la => labels?.find(l => l.id === la.label_id)).filter((l): l is Label => l !== undefined) || [];
        return { ...data[0], labels: chatLabels };
      });
      
      const chatDetailsResults = await Promise.all(chatDetailsPromises);
      const validChats = chatDetailsResults.filter((chat): chat is ChatWithDetails => chat !== null);
      validChats.sort((a, b) => new Date(b.last_message?.created_at || b.updated_at).getTime() - new Date(a.last_message?.created_at || a.updated_at).getTime());
      setChats(validChats);
    } catch (error) { console.error("Error fetching chats:", error); } 
    finally { setLoading(false); }
  }, [user, supabase]);

  useEffect(() => {
    fetchAllChatDetails();
    if (!user) return;
    const fetchLabels = async () => {
        const { data, error } = await supabase.from("chat_labels").select("*").eq("profile_id", user.id).order("name");
        if (error) console.error("Error fetching user labels:", error);
        else setUserLabels(data || []);
    };
    fetchLabels();
    const storedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
    if (storedFilters) try { setDefinedFilters(JSON.parse(storedFilters)); } catch(e) { console.error(e) }
  }, [user, fetchAllChatDetails]);

  useEffect(() => {
    if (definedFilters.length > 0 || localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY)) {
        localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(definedFilters));
    }
  }, [definedFilters]);

  useEffect(() => {
    if (!user) return;

    const messageListener = supabase.channel('public:messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const newMsg = payload.new;
      const isMember = chats.some(c => c.id === newMsg.chat_id);
      if (isMember) {
        const { data, error } = await supabase.rpc("get_chat_details", { chat_id_param: newMsg.chat_id, user_id_param: user.id });
        if (!error && data && data.length > 0) {
          const updatedChatDetails = data[0] as ChatWithDetails;
          const { data: labels } = await supabase.from("chat_labels").select("*, chat_label_assignments!inner(*)").eq('chat_label_assignments.chat_id', newMsg.chat_id).eq('profile_id', user.id);
          updatedChatDetails.labels = labels || [];
          setChats(prevChats => {
              const newChats = prevChats.filter(c => c.id !== newMsg.chat_id);
              newChats.push(updatedChatDetails);
              newChats.sort((a, b) => new Date(b.last_message?.created_at || b.updated_at).getTime() - new Date(a.last_message?.created_at || a.updated_at).getTime());
              return newChats;
          });
        }
      }
    }).subscribe();
      
    const readListener = supabase.channel(`read-status-listener-${user.id}`).on('broadcast', { event: 'chat_read' }, (payload) => {
        const { chatId } = payload.payload;
        setChats(prevChats => prevChats.map(chat => chat.id === chatId ? { ...chat, unread_count: 0 } : chat));
    }).subscribe();
        
    const membersListener = supabase.channel('public:chat_members').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `profile_id=eq.${user.id}`}, () => {
        fetchAllChatDetails();
    }).subscribe();

    return () => {
      supabase.removeChannel(messageListener);
      supabase.removeChannel(readListener);
      supabase.removeChannel(membersListener);
    };
  }, [user, supabase, fetchAllChatDetails, chats]);

  const filteredChats = useMemo(() => {
    if (!chats) return [];
    let processedChats = [...chats];
    if (searchTerm.trim()) {
      processedChats = processedChats.filter((chat) => chat.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    // La logique de filtre avancé peut être réintégrée ici
    return processedChats;
  }, [chats, searchTerm]);

  const handleNewChat = () => router.push("/new-chat");
  const openNewFilterModal = () => { setEditingFilter(null); setShowFilterModal(true); };
  const openEditFilterModal = (filter: ClientChatFilter) => { setEditingFilter(filter); setShowFilterModal(true); };
  const handleSaveFilter = (name: string, criteria: FilterCriteria) => { /* ... */ };
  const handleDeleteFilter = (filterId: string) => { /* ... */ };
  const applyFilter = (filter: ClientChatFilter | null) => { setActiveFilter(filter); };

  return (
    <div className="flex flex-col h-full border-r bg-muted/40">
      <div className="flex overflow-y-hidden h-16 flex-shrink-0 items-center justify-between border-b bg-background px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm"><FaFilter size={20} className="h-3 w-3" />{activeFilter ? activeFilter.name : "Custom Filters"}{activeFilter && (<X className="ml-1 h-3 w-3" onClick={(e) => { e.stopPropagation(); applyFilter(null); }} />)}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuItem onClick={openNewFilterModal} className="cursor-pointer"><Plus className="mr-2 h-4 w-4" />Create New Filter</DropdownMenuItem>
            {/* ... Autres items de filtre ... */}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleNewChat}><IoCreate className="h-5 w-5" /></Button></TooltipTrigger>
            <TooltipContent><p>New Chat</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild><Link href="/settings" passHref><Button variant="ghost" size="icon" asChild><div><Settings className="h-5 w-5" /></div></Button></Link></TooltipTrigger>
            <TooltipContent><p>Settings</p></TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-shrink-0 overflow-y-hidden p-4 border-b">
        <div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="text" placeholder="Search chats..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto hide-scrollbar">
        {loading ? ( <div className="flex h-full items-center justify-center py-10"><GripVertical className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filteredChats.length === 0 ? ( <div className="flex h-full flex-col items-center justify-center p-6 text-center"><FilterIcon className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-lg font-medium">No Chats Found</p></div>
        ) : (
          <ul className="divide-y">
            {filteredChats.map((chat) => {
              const isActive = pathname === `/chat/${chat.id}`;
              const chatName = chat.name || (chat.is_group ? "Unnamed Group" : "Unnamed Chat");
              const avatarFallback = chatName.substring(0, 2).toUpperCase();
              return (
                <li key={chat.id} className={`${isActive ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                  <Link href={`/chat/${chat.id}`} className={`block px-4 py-3`} onClick={() => onChatClick?.(chat.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0 border"><AvatarFallback className={chat.is_group ? "bg-green-200" : "bg-slate-100"}>{chat.is_group ? <Users className="h-5 w-5" /> : avatarFallback}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>{chatName}</p>
                          <p className="truncate text-xs text-muted-foreground">{chat.last_message?.content || (chat.last_message?.has_attachment ? "Attachment" : "No messages yet")}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 space-y-1">
                        <p className={`text-xs whitespace-nowrap`}>{new Date(chat.last_message?.created_at || chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        {chat.unread_count > 0 && (
                          <Badge variant={isActive ? "default" : "secondary"} className="h-5 bg-green-500 text-white px-1.5 text-xs font-semibold">{chat.unread_count}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
      {showFilterModal && <FilterModal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} onSave={handleSaveFilter} existingFilter={editingFilter} userLabels={userLabels} />}
      {/* Bouton Mon Profil en bas de la sidebar qui ouvre un modal */}
      <ProfileModalButton user={user} />
    </div>
  );
}

// Composant bouton + modal profil
function ProfileModalButton({ user }: { user: any }) {
  const { openModal } = useModal();
  return (
    <div className="border-t bg-background p-4 flex items-center gap-3 cursor-pointer hover:bg-muted transition" onClick={() => user?.id && openModal({ type: "profile", userId: user.id })}>
      <Avatar className="h-10 w-10">
        <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-medium text-sm">Mon Profil</span>
        <span className="text-xs text-muted-foreground">Voir & Modifier</span>
      </div>
    </div>
  );
}