"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, Filter as FilterIcon, GripVertical, MessageSquarePlus, Paperclip, Search, Settings, Users, X, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaFilter } from "react-icons/fa";
import { IoCreate } from "react-icons/io5";
import { ClientChatFilter, FilterCriteria } from "../../types/filter";
import { Database } from "../../types/supabase";
import FilterModal from "./chat-filter-modal";
import { useModal } from "@/context/modal-context";
import PresenceIndicator, { usePresence } from "@/components/presence/presence-indicator";
import { useChatList } from "@/hooks/useChatList"; // <-- NOUVEL IMPORT

type Label = Database["public"]["Tables"]["chat_labels"]["Row"]; // Gardez ce type pour FilterModal
const LOCAL_STORAGE_FILTERS_KEY = "chatAppClientFilters";

export default function ChatSidebar({ onChatClick }: { onChatClick?: (chatId: string) => void } = {}) {
  // Toute la logique complexe est maintenant ici :
  const { chats, loading } = useChatList();
  
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
  const presenceState = usePresence();

  // Logique pour les filtres (qui pourrait aussi être extraite dans un hook plus tard)
  useEffect(() => {
    if (!user) return;
    const fetchLabels = async () => {
        const { data, error } = await supabase.from("chat_labels").select("*").eq("profile_id", user.id).order("name");
        if (error) console.error("Error fetching user labels:", error);
        else setUserLabels(data || []);
    };
    fetchLabels();
    const storedFilters = localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY);
    if (storedFilters) try { setDefinedFilters(JSON.parse(storedFilters)); } catch(e) { console.error(e) }
  }, [user, supabase]);

  useEffect(() => {
    if (definedFilters.length > 0 || localStorage.getItem(LOCAL_STORAGE_FILTERS_KEY)) {
        localStorage.setItem(LOCAL_STORAGE_FILTERS_KEY, JSON.stringify(definedFilters));
    }
  }, [definedFilters]);

  const filteredChats = useMemo(() => {
    if (!chats) return [];
    let processedChats = [...chats];
    if (searchTerm.trim()) {
      processedChats = processedChats.filter((chat) => chat.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    // La logique de filtre avancé sera réintégrée ici si besoin
    return processedChats;
  }, [chats, searchTerm]);

  const handleNewChat = () => router.push("/new-chat");
  const openNewFilterModal = () => { setEditingFilter(null); setShowFilterModal(true); };
  const handleSaveFilter = (name: string, criteria: FilterCriteria) => {};
  const applyFilter = (filter: ClientChatFilter | null) => { setActiveFilter(filter); };

  return (
    <div className="flex flex-col h-full border-r bg-muted/40">
      {/* ... Le JSX reste exactement le même ... */}
      <div className="flex overflow-y-hidden h-16 flex-shrink-0 items-center justify-between border-b bg-background px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm"><FaFilter size={20} className="h-3 w-3" />{activeFilter ? activeFilter.name : "Custom Filters"}{activeFilter && (<X className="ml-1 h-3 w-3" onClick={(e) => { e.stopPropagation(); applyFilter(null); }} />)}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuItem onClick={openNewFilterModal} className="cursor-pointer"><Plus className="mr-2 h-4 w-4" />Create New Filter</DropdownMenuItem>
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
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-10 w-10 border">
                            <AvatarFallback className={chat.is_group ? "bg-green-200" : "bg-slate-100"}>
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
                              {chat.last_message?.sender_id === user?.id && (
                                <span className="font-semibold">You:</span>
                              )}
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
      <ProfileModalButton user={user} />
    </div>
  );
}

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