"use client";

// context/AuthContext.tsx
// Global auth context using Supabase Auth

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import getSupabase from "@/lib/supabase";
import type { User, AuthState } from "@/types";

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isAdmin: false,
  isLoading: true,
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signOut: async () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoggedIn: false,
    isAdmin: false,
    isLoading: true,
  });

  const supabase = getSupabase();

  // Build our User object from Supabase auth user + profiles table
  const loadProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setState({ user: null, isLoggedIn: false, isAdmin: false, isLoading: false });
        return;
      }

      const authUser = session.user;

      // Fetch or upsert profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      const user: User = {
        id: authUser.id,
        email: authUser.email || "",
        username: profile?.username || authUser.user_metadata?.preferred_username || authUser.email?.split("@")[0] || "",
        name: profile?.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || "",
        avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || "",
        role: profile?.role || "user",
        created_at: profile?.created_at || authUser.created_at || "",
        updated_at: profile?.updated_at || "",
      };

      setState({
        user,
        isLoggedIn: true,
        isAdmin: user.role === "admin",
        isLoading: false,
      });
    } catch (err) {
      console.error("Auth load error:", err);
      setState({ user: null, isLoggedIn: false, isAdmin: false, isLoading: false });
    }
  }, [supabase]);

  useEffect(() => {
    // Initial load
    loadProfile();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      loadProfile();
    });

    return () => subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const signInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch (err) {
      console.error("Google OAuth error:", err);
      throw err;
    }
  };

  const signInWithGithub = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.origin },
      });
    } catch (err) {
      console.error("GitHub OAuth error:", err);
      throw err;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, isLoggedIn: false, isAdmin: false, isLoading: false });
  };

  const refreshUser = () => loadProfile();

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signInWithGithub,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
