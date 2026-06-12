"use client";

// context/AuthContext.tsx
// Global auth context using PocketBase auth store

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import getPocketBase from "@/lib/pb";
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

  const pb = getPocketBase();

  const syncAuth = useCallback(() => {
    const model = pb.authStore.record as User | null;
    setState({
      user: model,
      isLoggedIn: pb.authStore.isValid,
      isAdmin: (model as User | null)?.role === "admin",
      isLoading: false,
    });
  }, [pb]);

  useEffect(() => {
    // Initial sync
    syncAuth();

    // Listen to auth state changes and sync to cookies for full reload-persistence and SSR support
    const unsub = pb.authStore.onChange((token, model) => {
      if (typeof document !== "undefined") {
        document.cookie = pb.authStore.exportToCookie({ secure: false, sameSite: "lax" });
      }
      syncAuth();
    });

    return () => unsub();
  }, [pb, syncAuth]);

  const signInWithGoogle = async () => {
    try {
      await pb.collection("users").authWithOAuth2({ provider: "google" });
    } catch (err) {
      console.error("Google OAuth error:", err);
      throw err;
    }
  };

  const signInWithGithub = async () => {
    try {
      await pb.collection("users").authWithOAuth2({ provider: "github" });
    } catch (err) {
      console.error("GitHub OAuth error:", err);
      throw err;
    }
  };

  const signOut = async () => {
    pb.authStore.clear();
    if (typeof document !== "undefined") {
      document.cookie = "pb_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  };

  const refreshUser = () => syncAuth();

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
