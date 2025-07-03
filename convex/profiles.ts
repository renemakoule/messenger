import { mutation, query } from "./_generated/server";

/**
 * Crée ou met à jour un profil utilisateur dans la base de données Convex.
 * Cette fonction est appelée par le frontend après la connexion pour s'assurer
 * que l'utilisateur authentifié via Supabase a bien un profil correspondant dans Convex.
 */
export const createOrUpdate = mutation({
  handler: async (ctx) => {
    // Récupère l'identité de l'utilisateur à partir du token JWT Supabase validé.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Cannot create or update profile for an unauthenticated user.");
    }

    // Recherche un profil existant lié à cet ID utilisateur Supabase.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    // Récupère les informations du token. Assurez-vous que Supabase inclut ces `claims`.
    const displayName = identity.name ?? "New User";
    const avatarUrl = identity.pictureUrl ?? "/default-avatar.png"; // Prévoir un avatar par défaut
    const username = identity.nickname ?? displayName.toLowerCase().replace(/\s+/g, '');

    if (profile === null) {
      // Si le profil n'existe pas, on le crée.
      console.log(`Creating new profile for user ${identity.subject}`);
      await ctx.db.insert("profiles", {
        userId: identity.subject,
        username: username,
        displayName: displayName,
        avatarUrl: avatarUrl,
      });
    } else {
      // Si le profil existe, on vérifie si une mise à jour est nécessaire.
      if (profile.displayName !== displayName || profile.avatarUrl !== avatarUrl) {
        console.log(`Updating profile for user ${identity.subject}`);
        await ctx.db.patch(profile._id, {
          displayName: displayName,
          avatarUrl: avatarUrl,
        });
      }
    }
  },
});

/**
 * Récupère le profil de l'utilisateur actuellement authentifié.
 */
export const getCurrent = query({
    handler: async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return null;
      }
      return await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique();
    },
});