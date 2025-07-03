// convex/messages.ts (Corrigé)
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// La fonction `ctx.auth.getUserIdentity()` renverra maintenant les infos du token Supabase.
export const getForChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    // On vérifie l'identité pour protéger la route
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Ne renvoie rien si l'utilisateur n'est pas authentifié.
      return [];
    }

    // Le reste de la logique est bon.
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    return Promise.all(
      messages.map(async (message) => {
        const senderProfile = await ctx.db.get(message.senderId);
        return {
          ...message,
          sender: { // On ne renvoie que les infos publiques
            _id: senderProfile?._id,
            displayName: senderProfile?.displayName,
            avatarUrl: senderProfile?.avatarUrl,
            // ATTENTION: ne jamais renvoyer le `userId` ou d'autres infos sensibles
          },
        };
      })
    );
  },
});

export const send = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User is not authenticated.");
    }

    // `identity.subject` est l'ID de l'utilisateur Supabase (le `sub` du JWT)
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
      
    if (!profile) {
      // Ici, il faudrait gérer le cas où un utilisateur Supabase n'a pas encore de profil dans Convex
      // On pourrait le créer à la volée.
      throw new Error("User profile does not exist in Convex.");
    }

    // Le reste est bon
    await ctx.db.insert("messages", {
      chatId: args.chatId,
      senderId: profile._id,
      content: args.content,
    });
    
    await ctx.db.patch(args.chatId, { lastMessageTimestamp: Date.now() });
  },
});