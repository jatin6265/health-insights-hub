import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, UserStatus, UserProfile } from '@/types/auth';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  status: UserStatus | null;
  loading: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  isTrainee: boolean;
  isActive: boolean;
  isPending: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    status: null,
    loading: true,
    isAdmin: false,
    isTrainer: false,
    isTrainee: false,
    isActive: false,
    isPending: false,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return { profile: null, role: null };
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching role:', roleError);
      }

      const role = roleData?.role as AppRole | null;

      return { profile: profile as UserProfile, role };
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      return { profile: null, role: null };
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
        }));

        // Fetch user data on sign in
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id).then(({ profile, role }) => {
              const status = profile?.status as UserStatus | null;
              setState(prev => ({
                ...prev,
                profile,
                role,
                status,
                loading: false,
                isAdmin: role === 'admin',
                isTrainer: role === 'trainer',
                isTrainee: role === 'trainee',
                isActive: status === 'active',
                isPending: status === 'pending',
              }));
            });
          }, 0);
        } else {
          setState(prev => ({
            ...prev,
            profile: null,
            role: null,
            status: null,
            loading: false,
            isAdmin: false,
            isTrainer: false,
            isTrainee: false,
            isActive: false,
            isPending: false,
          }));
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user ?? null,
        session,
      }));

      if (session?.user) {
        fetchUserData(session.user.id).then(({ profile, role }) => {
          const status = profile?.status as UserStatus | null;
          setState(prev => ({
            ...prev,
            profile,
            role,
            status,
            loading: false,
            isAdmin: role === 'admin',
            isTrainer: role === 'trainer',
            isTrainee: role === 'trainee',
            isActive: status === 'active',
            isPending: status === 'pending',
          }));
        });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshUserData = useCallback(async () => {
    if (state.user) {
      const { profile, role } = await fetchUserData(state.user.id);
      const status = profile?.status as UserStatus | null;
      setState(prev => ({
        ...prev,
        profile,
        role,
        status,
        isAdmin: role === 'admin',
        isTrainer: role === 'trainer',
        isTrainee: role === 'trainee',
        isActive: status === 'active',
        isPending: status === 'pending',
      }));
    }
  }, [state.user, fetchUserData]);

  return {
    ...state,
    signOut,
    refreshUserData,
  };
}
