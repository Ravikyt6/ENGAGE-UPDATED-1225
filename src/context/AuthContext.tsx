import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/services/supabase";

type User = {
  id: string;
  email: string;
  name?: string;
  role?: "admin" | "user" | "creator";
  accountType?: "earning" | "promotion";
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, accountType: "earning" | "promotion") => Promise<boolean>;
  googleLogin: (accountType?: "earning" | "promotion") => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function getProfileUser(authUser: any): Promise<User> {
  let role: User["role"] = "user";
  let accountType: User["accountType"] = "earning";
  let name =
    (authUser.user_metadata?.full_name as string) ||
    (authUser.user_metadata?.name as string) ||
    authUser.email ||
    "User";

  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("name, role, account_type")
      .eq("id", authUser.id)
      .maybeSingle();

    if (data) {
      role = data.role as User["role"];
      name = data.name || name;
      accountType = data.account_type as User["accountType"];
    }
  }

  return {
    id: authUser.id,
    email: authUser.email || "",
    name,
    role,
    accountType,
  };
}

const LIVE_MODE_KEY = "engage_runtime_mode";

const ACCOUNT_TYPE_KEY = "engage_pending_account_type";

async function applyPendingAccountType() {
  if (!supabase) return;
  const pending = localStorage.getItem(ACCOUNT_TYPE_KEY);
  if (pending !== "earning" && pending !== "promotion") return;
  const { error } = await supabase.rpc("set_my_account_type", { p_account_type: pending });
  if (!error) localStorage.removeItem(ACCOUNT_TYPE_KEY);
}


function isLiveMode() {
  return localStorage.getItem(LIVE_MODE_KEY) === "supabase";
}

function saveLocalUser(user: User | null) {
  if (user) localStorage.setItem("engage_user", JSON.stringify(user));
  else localStorage.removeItem("engage_user");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("engage_user") || "null");
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Supabase handles the OAuth callback on the current origin.
  // Keep the app in live mode before session hydration completes.
  if (supabaseConfigured && window.location.hash.includes("access_token=")) {
    localStorage.setItem(LIVE_MODE_KEY, "supabase");
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      if (isLiveMode() && supabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();

        if (data.session?.user && active) {
          await applyPendingAccountType();
          const u = data.session.user;
          setUser(await getProfileUser(u));
        }
      }

      if (active) setLoading(false);
    }

    boot();

    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isLiveMode()) return;

      if (session?.user) {
        // Apply the selected signup type before reading the authoritative profile.
        applyPendingAccountType()
          .then(() => getProfileUser(session.user))
          .then((profileUser) => {
            if (!active) return;
            setUser(profileUser);
            saveLocalUser(profileUser);
          })
          .catch(() => {
            if (!active) return;
            setUser(null);
            saveLocalUser(null);
          });
      } else {
        setUser(null);
        saveLocalUser(null);
      }
    });

    return () => {
      active = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);

    try {
      const cleanEmail = email.toLowerCase().trim();

      if (isLiveMode() && supabaseConfigured && supabase) {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) throw error;

        const u = data.user;
        if (!u) return false;

        // Do not trust user_metadata.role here. Admin promotion is stored
        // in public.profiles and must be read from there.
        const profileUser = await getProfileUser(u);
        setUser(profileUser);
        saveLocalUser(profileUser);

        return true;
      }

      const localUsers = JSON.parse(localStorage.getItem("engage_local_users") || "[]");
      const account = localUsers.find((u: any) => String(u.email || "").toLowerCase() === cleanEmail);

      if (!account || account.password !== password) {
        throw new Error("Invalid email or password.");
      }

      const localUser: User = {
        id: account.id,
        email: cleanEmail,
        name: account.name,
        role: account.role || "user",
        accountType: account.accountType || "earning",
      };

      setUser(localUser);
      saveLocalUser(localUser);
      return true;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    accountType: "earning" | "promotion"
  ) => {
    setLoading(true);

    try {
      const cleanEmail = email.toLowerCase().trim();

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (isLiveMode() && supabaseConfigured && supabase) {
        const { data, error } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: name.trim() || "User",
                role: "user",
                account_type: accountType,
              },
            },
          });

        if (error) throw error;

        if (data.user && data.session) {
          setUser({
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: name.trim() || "User",
            role: "user",
            accountType,
          });
        }

        return true;
      }

      const users = JSON.parse(
        localStorage.getItem("engage_local_users") || "[]"
      );

      if (
        users.some(
          (u: any) =>
            u.email === cleanEmail
        )
      ) {
        throw new Error("Email is already registered.");
      }

      const newUser = {
        id: `local_${crypto.randomUUID()}`,
        email: cleanEmail,
        password,
        name: name.trim() || "User",
        role: "user",
        accountType,
      };

      users.push(newUser);
      localStorage.setItem(
        "engage_local_users",
        JSON.stringify(users)
      );

      const publicUser: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: "user",
        accountType,
      };

      setUser(publicUser);
      saveLocalUser(publicUser);

      return true;
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (accountType: "earning" | "promotion" = "earning") => {
    setLoading(true);

    try {
      // Google OAuth is a real Supabase redirect when Supabase is configured.
      // Set the runtime mode before leaving the app so the OAuth callback is
      // restored from the Supabase session instead of falling back to local mode.
      if (supabaseConfigured && supabase) {
        localStorage.setItem(LIVE_MODE_KEY, "supabase");
        localStorage.setItem("engage_pending_account_type", accountType);

        const redirectTo = `${window.location.origin}/video`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });

        if (error) throw error;
        return true;
      }

      // Local fallback when Supabase is not configured.
      const localUser: User = {
        id: `local_google_${crypto.randomUUID()}`,
        email: "google-user@local",
        name: "Google User",
        role: "user",
        accountType,
      };

      setUser(localUser);
      saveLocalUser(localUser);
      return true;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (isLiveMode() && supabase) {
      await supabase.auth.signOut();
    }

    setUser(null);
    saveLocalUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        googleLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return ctx;
}
