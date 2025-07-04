import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Fonction "type guard" pour aider TypeScript à filtrer les valeurs nulles.
function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Récupère la liste de toutes les conversations pour l'utilisateur actuellement authentifié.
 * Les chats sont triés par le message le plus récent.
 * Cette query est réactive et se mettra à jour automatiquement.
 */
export const getChatsForUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!userProfile) {
      // Le profil n'est peut-être pas encore créé, retourner un tableau vide.
      return [];
    }

    const memberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_profileId", (q) => q.eq("profileId", userProfile._id))
      .collect();

    const chatIds = memberships.map((m) => m.chatId);

    const chatsWithDetails = await Promise.all(
      chatIds.map(async (chatId) => {
        const chat = await ctx.db.get(chatId);
        if (!chat) return null;

        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
          .order("desc")
          .first();

        const members = await ctx.db.query("chatMembers").withIndex("by_chatId", (q) => q.eq("chatId", chatId)).collect();
        const otherMemberIds = members.filter((m) => m.profileId !== userProfile._id).map((m) => m.profileId);

        let chatName = chat.name;
        if (!chat.isGroup && otherMemberIds.length > 0) {
          const otherProfile = await ctx.db.get(otherMemberIds[0]);
          chatName = otherProfile?.displayName;
        }

        return {
          ...chat,
          name: chatName,
          lastMessage: lastMessage,
        };
      })
    );

    const validChats = chatsWithDetails.filter(isNotNull);

    return validChats.sort((a, b) =>
      (b.lastMessage?._creationTime || b._creationTime) - (a.lastMessage?._creationTime || a._creationTime)
    );
  },
});

export const pinChat = mutation({
  args: { profileId: v.id("profiles"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    // Vérifie si déjà épinglé
    const existing = await ctx.db
      .query("pinnedChats")
      .withIndex("by_profileId_and_chatId", (q) => q.eq("profileId", args.profileId).eq("chatId", args.chatId))
      .first();
    if (!existing) {
      await ctx.db.insert("pinnedChats", {
        profileId: args.profileId,
        chatId: args.chatId,
        createdAt: Date.now(),
      });
    }
  },
});

export const unpinChat = mutation({
  args: { profileId: v.id("profiles"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pinnedChats")
      .withIndex("by_profileId_and_chatId", (q) => q.eq("profileId", args.profileId).eq("chatId", args.chatId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const isChatPinned = query({
  args: { profileId: v.id("profiles"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pinnedChats")
      .withIndex("by_profileId_and_chatId", (q) => q.eq("profileId", args.profileId).eq("chatId", args.chatId))
      .first();
    return !!existing;
  },
});

export const archiveChat = mutation({
  args: { profileId: v.id("profiles"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("archivedChats")
      .withIndex("by_profileId_and_chatId", (q) => q.eq("profileId", args.profileId).eq("chatId", args.chatId))
      .first();
    if (!existing) {
      await ctx.db.insert("archivedChats", {
        profileId: args.profileId,
        chatId: args.chatId,
        createdAt: Date.now(),
      });
    }
  },
});

export const unarchiveChat = mutation({
  args: { profileId: v.id("profiles"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("archivedChats")
      .withIndex("by_profileId_and_chatId", (q) => q.eq("profileId", args.profileId).eq("chatId", args.chatId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const isChatArchived = query({
  args: { profileId: v.id("profiles"), chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("archivedChats")
      .withIndex("by_profileId_and_chatId", (q) => q.eq("profileId", args.profileId).eq("chatId", args.chatId))
      .first();
    return !!existing;
  },
});