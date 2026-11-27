import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getProfile, setPushToken, type Profile } from './api';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await getProfile(s.user.id));
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer so we never call Supabase from inside its own callback.
      setTimeout(() => load(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const value: AuthState = {
    session,
    profile,
    loading,
    refreshProfile: async () => {
      if (session) setProfile(await getProfile(session.user.id));
    },
    signOut: async () => {
      try {
        await setPushToken(null);
      } catch {
        // signing out still works offline
      }
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** For screens that only render when signed in. */
export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('Not signed in');
  return profile;
}
