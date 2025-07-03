"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useAuth } from "@/context/auth-context"; // On utilise VOTRE contexte !

// Le client Convex est créé une seule fois et réutilisé.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  // On récupère la session depuis votre AuthProvider.
  // Ce hook va provoquer un re-rendu du composant lorsque la session change.
  const { session } = useAuth();

  // À chaque re-rendu, nous mettons à jour la fonction d'authentification de Convex
  // avec la dernière session disponible. C'est la manière la plus directe de synchroniser les deux.
  // La fonction passée à setAuth sera appelée par Convex au moment de la requête.
  convex.setAuth(async () => {
    // Si une session Supabase existe, on retourne son token.
    if (session?.access_token) {
      return session.access_token;
    }
    // Sinon, on retourne null, indiquant à Convex que l'utilisateur est déconnecté.
    return null;
  });

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}