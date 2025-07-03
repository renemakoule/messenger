"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Database } from "../types/supabase";
import { createClient } from "@/lib/supabase/client";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Utiliser useCallback pour que la fonction ne soit pas recréée à chaque render,
  // ce qui est une bonne pratique pour les dépendances de useEffect.
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setProfile(null);
      } else {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error in profile fetch:", error);
      setProfile(null);
    }
  }, [supabase]);

  const refreshSession = useCallback(async () => {
    try {
      // Pas besoin de setIsLoading(true) ici car on le fait déjà dans le useEffect initial.
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      
      setSession(currentSession);
      const currentUser = currentSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserProfile(currentUser.id);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error refreshing session:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, fetchUserProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    // Le middleware se chargera de la redirection, mais on peut la forcer ici aussi.
    router.push("/auth/login");
    router.refresh(); // S'assurer que le layout se réinitialise
  };

  useEffect(() => {
    // Premier chargement
    refreshSession();

    // Écoute les changements d'état d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        fetchUserProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      
      // SOLUTION: Si l'utilisateur vient de se connecter (ce qui est le cas après un callback OAuth),
      // on force un rafraîchissement de la page. Cela va re-exécuter les Server Components
      // avec la nouvelle session et garantir que les données sont à jour.
      if (event === 'SIGNED_IN') {
        router.refresh();
      }

      // On met à jour l'état de chargement une fois que la session est initialisée.
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router, fetchUserProfile, refreshSession]);

  return (
    <AuthContext.Provider value={{ user, profile, session, isLoading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}