"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthUser } from "@/types/auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabaseRef = useRef(createSupabaseBrowserClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    // A foto não vem no token (ver get-server-auth): é carregada à parte e
    // preenchida depois, para o cookie de sessão não crescer com base64.
    async function loadProfile() {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;
        const me = await res.json();
        setUser((prev) => (prev ? {
          ...prev,
          id: me.id,
          name: me.name,
          email: me.email,
          role: me.role,
          permissions: me.permissions,
          image: me.image ?? null,
        } : prev));
      } catch {
        // avatar cai para as iniciais do nome
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? parseUser(session.user) : null);
      setIsLoading(false);
      if (session?.user) loadProfile();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? parseUser(session.user) : null);
      setIsLoading(false);
      if (session?.user) loadProfile();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseUser(supabaseUser: any): AuthUser {
  const meta = supabaseUser.app_metadata ?? {};
  return {
    id: (meta.prisma_id as string) ?? supabaseUser.id,
    email: supabaseUser.email ?? "",
    name: (supabaseUser.user_metadata?.name as string) ?? supabaseUser.email ?? "",
    role: (meta.role as string) ?? "MEMBER",
    image: null,
    permissions: (meta.permissions as Record<string, string>) ?? null,
  };
}
