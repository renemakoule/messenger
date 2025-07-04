import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// On définit le schéma ici
const schema = defineSchema({
  profiles: defineTable({
    userId: v.string(),
    username: v.string(),
    displayName: v.string(),
    avatarUrl: v.string(),
    status: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  chats: defineTable({
    name: v.optional(v.string()),
    isGroup: v.boolean(),
    createdBy: v.id("profiles"),
    lastMessageTimestamp: v.optional(v.number()),
  }).index("by_lastMessage", ["lastMessageTimestamp"]),

  chatMembers: defineTable({
    chatId: v.id("chats"),
    profileId: v.id("profiles"),
    isAdmin: v.boolean(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_chatId", ["chatId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    senderId: v.id("profiles"),
    content: v.optional(v.string()),
    attachmentUrl: v.optional(v.string()),
    attachmentType: v.optional(v.string()),
  }).index("by_chatId", ["chatId"]),

  chatLabels: defineTable({
    profileId: v.id("profiles"),
    name: v.string(),
    color: v.string(),
  }).index("by_profileId", ["profileId"]),

  chatLabelAssignments: defineTable({
    chatId: v.id("chats"),
    labelId: v.id("chatLabels"),
    profileId: v.id("profiles"),
  }).index("by_chatId_and_profileId", ["chatId", "profileId"]),
  
  presence: defineTable({
      userId: v.string(),
      room: v.string(),
      updated: v.number(),
  })
    .index("by_room_updated", ["room", "updated"])
    .index("by_user_id", ["userId", "room"]),

  pinnedChats: defineTable({
    profileId: v.id("profiles"),
    chatId: v.id("chats"),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_chatId", ["chatId"])
    .index("by_profileId_and_chatId", ["profileId", "chatId"]),

  archivedChats: defineTable({
    profileId: v.id("profiles"),
    chatId: v.id("chats"),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_chatId", ["chatId"])
    .index("by_profileId_and_chatId", ["profileId", "chatId"]),
});

// La ligne la plus importante : on exporte le schéma comme exportation par défaut.
export default schema;