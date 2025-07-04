"use client";

import { useState, useEffect, useRef } from "react";
import { Database } from "../../types/supabase";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { UserPlus, UserMinus, ShieldCheck, Shield, Loader2, Bookmark, Archive, Link2, Link, Flag, LogOut, Trash } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNotification } from "@/components/ui/notification-provider";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ChatMember = {
  id: string; // This is chat_members.id
  profile: Profile;
  is_admin: boolean;
};

export default function GroupChatManager({ chatId, openOnMount = false }: { chatId: string, openOnMount?: boolean }) {
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUserIdsToAdd, setSelectedUserIdsToAdd] = useState<string[]>([]);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [memberToManage, setMemberToManage] = useState<{ id: string; name: string } | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [media, setMedia] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [sharedLinks, setSharedLinks] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muted, setMuted] = useState(false);
  const [sound, setSound] = useState("default");
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const reportReasonRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [membersLoading, setMembersLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");

  const { user } = useAuth();
  const supabase = createClient();
  const { notify } = useNotification();

  const setLoadingState = (key: string, isLoading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: isLoading }));
  };

  useEffect(() => {
    if (!user || !chatId) return;

    const fetchGroupData = async () => {
      setLoading(true);
      try {
        const { data: memberData, error: memberError } = await supabase.from("chat_members").select("id, is_admin, profile_id, profiles!inner(*)").eq("chat_id", chatId);
        if (memberError) throw memberError;

        const formattedMembers = memberData
          .filter((m) => m.profiles)
          .map((member) => ({
            id: member.id,
            profile: Array.isArray(member.profiles) ? member.profiles[0] as Profile : member.profiles as Profile,
            is_admin: member.is_admin,
          }));
        setMembers(formattedMembers);

        const currentUserMember = memberData.find((m) => m.profile_id === user.id);
        setCurrentUserIsAdmin(currentUserMember?.is_admin || false);

        const memberProfileIds = memberData.map((m) => m.profile_id);
        const { data: allUsersData, error: allUsersError } = await supabase
          .from("profiles")
          .select("*")
          .not("id", "in", `(${memberProfileIds.join(",")})`);
        if (allUsersError) throw allUsersError;
        setAvailableUsers(allUsersData || []);
      } catch (error) {
        console.error("Error fetching group data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroupData();
    const channel = supabase
      .channel(`group_chat_manager_${chatId}_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_members", filter: `chat_id=eq.${chatId}` }, fetchGroupData)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, chatId, supabase]);

  useEffect(() => {
    const fetchMedia = async () => {
      setMediaLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("id, content, attachment_url, attachment_type, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false });
      setMedia(data || []);
      setMediaLoading(false);
    };
    if (isSheetOpen) fetchMedia();
  }, [chatId, supabase, isSheetOpen]);

  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links: string[] = [];
    media.forEach((m) => {
      if (m.attachment_type === null && m.content) {
        const found = m.content.match(urlRegex);
        if (found) links.push(...found);
      }
    });
    setSharedLinks(links);
  }, [media]);

  const toggleUserSelectionForAdd = (userId: string) => {
    setSelectedUserIdsToAdd((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleAddMembers = async () => {
    if (!user || !chatId || selectedUserIdsToAdd.length === 0) return;
    setLoadingState("addMembers", true);
    try {
      const memberInserts = selectedUserIdsToAdd.map((profileId) => ({
        chat_id: chatId,
        profile_id: profileId,
        is_admin: false,
      }));
      const { error } = await supabase.from("chat_members").insert(memberInserts);
      if (error) throw error;
      
      // Optimistically update the UI by moving selected users from availableUsers to members
      const newMembers = [...members];
      const newAvailableUsers = [...availableUsers];
      
      selectedUserIdsToAdd.forEach(profileId => {
        const userIndex = newAvailableUsers.findIndex(u => u.id === profileId);
        if (userIndex !== -1) {
          const user = newAvailableUsers[userIndex];
          // Create a new member with a temporary ID (will be updated on next fetch)
          const newMember: ChatMember = {
            id: `temp-${Date.now()}-${profileId}`,
            profile: user,
            is_admin: false
          };
          newMembers.push(newMember);
          newAvailableUsers.splice(userIndex, 1);
        }
      });
      
      setMembers(newMembers);
      setAvailableUsers(newAvailableUsers);
      setSelectedUserIdsToAdd([]);
    } catch (error) {
      console.error("Error adding members:", error);
    } finally {
      setLoadingState("addMembers", false);
    }
  };

  const handleRemoveMember = async () => {
    if (!user || !chatId || !memberToManage) return;
    setLoadingState(`remove_${memberToManage.id}`, true);
    try {
      const { error } = await supabase.from("chat_members").delete().eq("id", memberToManage.id);
      if (error) throw error;
      
      // Optimistically update the UI immediately
      const removedMember = members.find(m => m.id === memberToManage.id);
      if (removedMember) {
        // Remove from members list
        setMembers(prevMembers => prevMembers.filter(m => m.id !== memberToManage.id));
        
        // Add back to available users list
        setAvailableUsers(prevUsers => [...prevUsers, removedMember.profile]);
      }
      
      setMemberToManage(null);
    } catch (error) {
      console.error("Error removing member:", error);
    } finally {
      setLoadingState(`remove_${memberToManage.id}`, false);
    }
  };

  const handleToggleAdminStatus = async (memberId: string, currentStatus: boolean) => {
    if (!user || !chatId) return;
    setLoadingState(`admin_${memberId}`, true);
    try {
      const { error } = await supabase.from("chat_members").update({ is_admin: !currentStatus }).eq("id", memberId);
      if (error) throw error;
      
      // Optimistically update the UI immediately
      setMembers(prevMembers => 
        prevMembers.map(member => 
          member.id === memberId 
            ? { ...member, is_admin: !currentStatus } 
            : member
        )
      );
    } catch (error) {
      console.error("Error updating admin status:", error);
    } finally {
      setLoadingState(`admin_${memberId}`, false);
    }
  };

  const handleLeaveGroup = async () => {
    setShowLeaveDialog(false);
    await supabase.from("chat_members").delete().eq("chat_id", chatId).eq("profile_id", user.id);
    notify({ message: "Vous avez quitté le groupe.", type: "success" });
    setIsSheetOpen(false);
  };

  const handleDeleteGroup = async () => {
    setShowDeleteDialog(false);
    await supabase.from("chats").delete().eq("id", chatId);
    await supabase.from("messages").delete().eq("chat_id", chatId);
    await supabase.from("chat_members").delete().eq("chat_id", chatId);
    notify({ message: "Groupe supprimé.", type: "success" });
    setIsSheetOpen(false);
  };

  const handleReport = () => {
    setShowReportDialog(false);
    notify({ message: "Signalement envoyé. Merci.", type: "success" });
  };

  useEffect(() => {
    const fetchMembers = async () => {
      setMembersLoading(true);
      const { data: memberData } = await supabase
        .from("chat_members")
        .select("id, is_admin, profile_id, profiles:profiles(*)")
        .eq("chat_id", chatId);
      setMembers(
        (memberData || []).map((m) => ({
          id: m.id,
          is_admin: m.is_admin,
          profile: Array.isArray(m.profiles) ? m.profiles[0] as Profile : m.profiles as Profile,
        }))
      );
      setMembersLoading(false);
      // Vérifie si l'utilisateur courant est admin
      const me = (memberData || []).find((m) => m.profile_id === user?.id);
      setCurrentUserIsAdmin(!!me?.is_admin);
    };
    if (isSheetOpen) fetchMembers();
  }, [chatId, supabase, user, isSheetOpen]);

  useEffect(() => {
    const fetchAvailable = async () => {
      const { data: allUsers } = await supabase.from("profiles").select("*");
      const memberIds = members.map((m) => m.profile.id);
      setAvailableUsers((allUsers || []).filter((u) => !memberIds.includes(u.id)));
    };
    if (isSheetOpen && currentUserIsAdmin) fetchAvailable();
  }, [members, isSheetOpen, currentUserIsAdmin, supabase]);

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setActionLoading((prev) => ({ ...prev, addMember: true }));
    await supabase.from("chat_members").insert({ chat_id: chatId, profile_id: selectedUserId, is_admin: false });
    setSelectedUserId("");
    setActionLoading((prev) => ({ ...prev, addMember: false }));
    // Rafraîchir membres
    const { data: memberData } = await supabase
      .from("chat_members")
      .select("id, is_admin, profile_id, profiles:profiles(*)")
      .eq("chat_id", chatId);
    setMembers(
      (memberData || []).map((m) => ({
        id: m.id,
        is_admin: m.is_admin,
        profile: Array.isArray(m.profiles) ? m.profiles[0] as Profile : m.profiles as Profile,
      }))
    );
  };

  const handleToggleAdmin = async (profileId: string, isAdmin: boolean) => {
    setActionLoading((prev) => ({ ...prev, [`admin_${profileId}`]: true }));
    await supabase.from("chat_members").update({ is_admin: !isAdmin }).eq("chat_id", chatId).eq("profile_id", profileId);
    setActionLoading((prev) => ({ ...prev, [`admin_${profileId}`]: false }));
    setMembers((prev) => prev.map((m) => m.profile.id === profileId ? { ...m, is_admin: !isAdmin } : m));
  };

  const handleSaveGroup = async () => {
    setActionLoading((prev) => ({ ...prev, saveGroup: true }));
    await supabase.from("chats").update({ name: groupName, description: groupDesc, avatar_url: avatarUrl }).eq("id", chatId);
    setEditMode(false);
    setActionLoading((prev) => ({ ...prev, saveGroup: false }));
  };

  const handleAvatarUpload = async () => {
    try {
      // ... code upload ...
    } catch (e) {
      notify({ message: "Erreur lors de l'upload de l'avatar.", type: "error" });
    }
  };

  useEffect(() => {
    if (openOnMount) setIsSheetOpen(true);
  }, [openOnMount]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Manage Group
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[400px] sm:max-w-[540px] p-0 flex flex-col max-h-[100vh]">
          <SheetHeader className="p-6">
            <SheetTitle>Manage Group</SheetTitle>
            <SheetDescription>Gérez les membres, médias, notifications et paramètres avancés du groupe.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="relative group">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl || undefined} alt={groupName || "Avatar"} />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl">{groupName?.charAt(0).toUpperCase() || "G"}</AvatarFallback>
                </Avatar>
                {editMode && currentUserIsAdmin && (
                  <label className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 cursor-pointer shadow-md">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && user) {
                          setActionLoading((prev) => ({ ...prev, avatar: true }));
                          try {
                            const fileExt = file.name.split('.').pop();
                            const fileName = `group_avatars/${chatId}_${Date.now()}.${fileExt}`;
                            const { data, error } = await supabase.storage
                              .from("group_avatars")
                              .upload(fileName, file, {
                                cacheControl: "3600",
                                upsert: true,
                                metadata: { owner: user.id },
                              });
                            if (error) throw error;
                            const { data: urlData } = supabase.storage.from("group_avatars").getPublicUrl(data.path);
                            setAvatarUrl(urlData.publicUrl);
                          } catch (err) {
                            notify({ message: "Erreur lors de l'upload de l'avatar.", type: "error" });
                          } finally {
                            setActionLoading((prev) => ({ ...prev, avatar: false }));
                          }
                        }
                      }}
                    />
                    {actionLoading.avatar ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <UserPlus className="h-5 w-5" />
                    )}
                  </label>
                )}
              </div>
              {editMode && currentUserIsAdmin ? (
                <div className="w-full flex flex-col gap-2 items-center">
                  <Input value={groupName} onChange={e => setGroupName(e.target.value)} className="text-center text-lg font-bold" maxLength={32} />
                  <Textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)} className="text-center" maxLength={120} placeholder="Description du groupe" />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Annuler</Button>
                    <Button size="sm" onClick={handleSaveGroup} disabled={actionLoading.saveGroup}>Sauvegarder</Button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="text-lg font-bold text-center">{groupName}</div>
                  <div className="text-sm text-muted-foreground text-center mb-1">{groupDesc}</div>
                  {currentUserIsAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => setEditMode(true)}>
                      Modifier le groupe
                    </Button>
                  )}
                </div>
              )}
            </div>
            {/* Section actions rapides */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button variant={pinned ? "secondary" : "outline"} size="sm" className="flex-1" onClick={() => setPinned(v => !v)}><Bookmark className="mr-2 h-4 w-4" />{pinned ? "Épinglé" : "Épingler"}</Button>
                <Button variant={archived ? "secondary" : "outline"} size="sm" className="flex-1" onClick={() => setArchived(v => !v)}><Archive className="mr-2 h-4 w-4" />{archived ? "Archivé" : "Archiver"}</Button>
              </div>
              <Button variant="outline" size="sm" className="flex-1 mt-2" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/join/${chatId}`); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}>
                <Link className="mr-2 h-4 w-4" />{inviteCopied ? "Lien copié !" : "Inviter via lien"}
              </Button>
            </section>
            {/* Notifications personnalisées */}
            <section className="space-y-3">
              <h3 className="text-lg font-bold mb-1">Notifications personnalisées</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm">Notifications</span>
                <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Silencieux</span>
                <Switch checked={muted} onCheckedChange={setMuted} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Son</span>
                <select className="rounded border px-2 py-1 bg-slate-100 dark:bg-slate-800" value={sound} onChange={e => setSound(e.target.value)}>
                  <option value="default">Défaut</option>
                  <option value="ding">Ding</option>
                  <option value="pop">Pop</option>
                  <option value="none">Aucun</option>
                </select>
              </div>
            </section>
            {/* Médias partagés */}
            <section>
              <h3 className="text-lg font-bold mb-3">Médias partagés</h3>
              {mediaLoading ? <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" /> : media.filter(m => m.attachment_type === "image" || m.attachment_type === "video").length === 0 ? (
                <div className="text-slate-400 text-center">Aucun média partagé</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {media.filter(m => m.attachment_type === "image" || m.attachment_type === "video").map((m) => m.attachment_type === "image" ? (
                    <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                      <Image src={m.attachment_url} alt="media" width={100} height={100} className="rounded-lg object-cover aspect-square" />
                    </a>
                  ) : (
                    <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                      <video src={m.attachment_url} className="rounded-lg object-cover aspect-square w-full h-full" />
                    </a>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {media.filter(m => m.attachment_type === "document").map((m) => (
                  <a key={m.id} href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <span className="truncate max-w-[80px] text-xs">Document</span>
                  </a>
                ))}
              </div>
            </section>
            {/* Liens partagés */}
            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Link2 className="h-5 w-5" />Liens partagés</h3>
              {sharedLinks.length === 0 ? (
                <div className="text-slate-400 text-center">Aucun lien partagé</div>
              ) : (
                <ul className="space-y-2">
                  {sharedLinks.map((link, i) => (
                    <li key={i}>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{link}</a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Group Members Section */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Group Members ({members.length})</h3>
              <ScrollArea className="h-64 border border-border rounded-md">
                {membersLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">No members in this group.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {members.map((member) => (
                      <li key={member.profile.id} className="flex items-center justify-between p-3 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profile.avatar_url || undefined} alt={member.profile.display_name || member.profile.username || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary">{member.profile.display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <p className="text-sm font-medium text-foreground">
                              {member.profile.display_name || member.profile.username}
                              {member.profile.id === user?.id && <span className="text-muted-foreground text-xs ml-1">(You)</span>}
                            </p>
                            {member.is_admin && (
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-0.5 mt-1 border-green-500 text-green-600 bg-green-50 dark:bg-green-900/50 dark:border-green-400 dark:text-green-300"
                              >
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                        {currentUserIsAdmin && member.profile.id !== user?.id && (
                          <div className="flex items-center space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-primary/10"
                                  onClick={() => handleToggleAdmin(member.profile.id, member.is_admin)}
                                  disabled={actionLoading[`admin_${member.profile.id}`]}
                                  aria-label={member.is_admin ? "Revoke Admin" : "Make Admin"}
                                >
                                  {actionLoading[`admin_${member.profile.id}`] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : member.is_admin ? (
                                    <ShieldCheck className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">{member.is_admin ? "Revoke Admin" : "Make Admin"}</TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      onClick={() => setMemberToManage({ id: member.id, name: member.profile.display_name || member.profile.username || "" })}
                                      aria-label="Remove Member"
                                    >
                                      <UserMinus className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="top">Remove Member</TooltipContent>
                              </Tooltip>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {memberToManage?.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove <strong>{memberToManage?.name}</strong> from this group?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setMemberToManage(null)} disabled={actionLoading[`remove_${memberToManage?.id}`]}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleRemoveMember}
                                    disabled={actionLoading[`remove_${memberToManage?.id}`]}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {actionLoading[`remove_${memberToManage?.id}`] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <ScrollBar orientation="vertical" />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Add Members Section */}
            {currentUserIsAdmin && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Add Members</h3>
                {availableUsers.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground bg-muted/50 rounded-md">All users are already in this group.</p>
                ) : (
                  <>
                    <ScrollArea className="h-48 border border-border rounded-md mb-3">
                      <ul className="divide-y divide-border">
                        {availableUsers.map((profile) => (
                          <li
                            key={profile.id}
                            className="flex items-center justify-between p-3 hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => toggleUserSelectionForAdd(profile.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`add-user-${profile.id}`}
                                checked={selectedUserIdsToAdd.includes(profile.id)}
                                onCheckedChange={() => toggleUserSelectionForAdd(profile.id)}
                                aria-label={`Select ${profile.display_name || profile.username}`}
                              />
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                                <AvatarFallback className="bg-primary/10 text-primary">{profile.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                              </Avatar>
                              <Label htmlFor={`add-user-${profile.id}`} className="text-sm font-normal text-foreground cursor-pointer">
                                {profile.display_name || profile.username}
                              </Label>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <ScrollBar orientation="vertical" />
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                    <Button
                      onClick={handleAddMembers}
                      disabled={selectedUserIdsToAdd.length === 0 || actionLoading["addMembers"]}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      {actionLoading["addMembers"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      Add Selected Members ({selectedUserIdsToAdd.length})
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 p-4 border-t border-border justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="ghost" size="icon" onClick={() => setShowReportDialog(true)} aria-label="Signaler le groupe">
                    <Flag className="h-5 w-5 text-yellow-600" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Signaler le groupe</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="ghost" size="icon" onClick={() => setShowLeaveDialog(true)} aria-label="Quitter le groupe">
                    <LogOut className="h-5 w-5 text-blue-600" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Quitter le groupe</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)} aria-label="Supprimer le groupe">
                    <Trash className="h-5 w-5 text-destructive" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Supprimer le groupe</TooltipContent>
            </Tooltip>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogTitle>Signaler ce groupe</DialogTitle>
          <input ref={reportReasonRef} className="w-full rounded border px-3 py-2 mt-4" placeholder="Raison du signalement (optionnel)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReport}>Signaler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogTitle>Quitter ce groupe ?</DialogTitle>
          <p className="text-sm text-slate-500">Vous ne recevrez plus de messages de ce groupe.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleLeaveGroup}>Quitter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogTitle>Supprimer ce groupe ?</DialogTitle>
          <p className="text-sm text-slate-500">Cette action est irréversible. Tous les messages et membres seront supprimés.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
