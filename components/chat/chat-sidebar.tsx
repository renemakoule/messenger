// components/chat/chat-sidebar.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useModal } from "@/context/modal-context";
import { useChatList } from "@/hooks/useChatList";
import { useChatFilters } from "@/hooks/useChatFilters"; // <-- NOUVEL IMPORT

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Filter as FilterIcon, GripVertical } from "lucide-react";
import { ChatSidebarHeader } from "./ChatSidebarHeader";
import { ChatSearch } from "./ChatSearch";
import { ChatItem } from "./ChatItem";
import FilterModal from "./chat-filter-modal";
import { Database } from "../../types/supabase";
import { createClient } from "@/lib/supabase/client";

type Label = Database["public"]["Tables"]["chat_labels"]["Row"];

function ProfileModalButton({ user }) {
  const { openModal } = useModal();
  return (
    <div className="mt-auto border-t bg-background p-4 flex items-center gap-3 cursor-pointer hover:bg-muted transition" onClick={() => user?.id && openModal({ type: "profile", userId: user.id })}>
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

export default function ChatSidebar({ onChatClick }: { onChatClick?: (chatId: string) => void } = {}) {
  const { chats, loading: chatsLoading } = useChatList();
  const { filteredChats: finalChatList, saveFilter, activeFilter, applyFilter } = useChatFilters(chats);

  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  
  const [userLabels, setUserLabels] = useState<Label[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingFilter, setEditingFilter] = useState(null);

  useEffect(() => {
    if (!user) return;
    const fetchLabels = async () => {
        const { data, error } = await supabase.from("chat_labels").select("*").eq("profile_id", user.id).order("name");
        if (error) console.error("Error fetching user labels:", error);
        else setUserLabels(data || []);
    };
    fetchLabels();
  }, [user, supabase]);

  // La recherche se fait maintenant sur la liste déjà filtrée
  const searchedChats = useMemo(() => {
    if (!searchTerm.trim()) return finalChatList;
    return finalChatList.filter(chat =>
      chat.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [finalChatList, searchTerm]);

  return (
    <div className="flex flex-col h-full border-r bg-muted/40">
      <ChatSidebarHeader
        activeFilter={activeFilter}
        onNewFilter={() => { setEditingFilter(null); setShowFilterModal(true); }}
        onNewChat={() => router.push("/new-chat")}
        onSettings={() => router.push("/settings")}
        onClearFilter={() => applyFilter(null)}
      />

      <ChatSearch searchTerm={searchTerm} onSearchChange={(e) => setSearchTerm(e.target.value)} />

      <ScrollArea className="flex-1 overflow-y-auto hide-scrollbar">
        {chatsLoading ? (
          <div className="flex h-full items-center justify-center py-10"><GripVertical className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : searchedChats.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <FilterIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Chats Found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {searchedChats.map((chat) => (
              <ChatItem key={chat.id} chat={chat} onChatClick={onChatClick} />
            ))}
          </ul>
        )}
      </ScrollArea>

      <ProfileModalButton user={user} />
      
      {showFilterModal && (
        <FilterModal 
          isOpen={showFilterModal} 
          onClose={() => setShowFilterModal(false)} 
          onSave={(name, criteria) => saveFilter(name, criteria, editingFilter?.id)} 
          existingFilter={editingFilter} 
          userLabels={userLabels} 
        />
      )}
    </div>
  );
}