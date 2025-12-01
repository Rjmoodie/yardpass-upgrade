import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  user_id: string;
  display_name: string;
  username?: string; // ✅ Added username field for guest engagement requirement
  phone?: string;
  role: 'attendee' | 'organizer';
  verification_status: 'none' | 'pending' | 'verified' | 'pro';
  created_at: string;
  photo_url?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName: string, phone?: string) => Promise<{ error: Error | null }>;
  signUpWithPhone: (phone: string, displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateRole: (role: 'attendee' | 'organizer') => Promise<{ error: Error | null }>;
  updateProfileOptimistic: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ SECURITY FIX: Fetch with retry logic (no more setTimeout hack)
  const fetchUserProfile = async (
    userId: string,
    retries: number = 3
  ): Promise<UserProfile | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (!error && data) {
        // Success - return typed profile
        return {
          ...data,
          role: data.role as 'attendee' | 'organizer',
          verification_status: data.verification_status as 'none' | 'pending' | 'verified' | 'pro'
        };
      }
      
      if (error && error.code !== 'PGRST116') {
        // Real error (not just "not found")
        console.error(`[Auth] Error fetching profile (attempt ${attempt}/${retries}):`, error);
        return null;
      }
      
      // Profile not found yet - retry with exponential backoff
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000); // Max 3s
        console.log(`[Auth] Profile not ready, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error(`[Auth] Profile not found after ${retries} attempts for user:`, userId);
    return null;
  };

  useEffect(() => {
    // ✅ FIX: Handle initial session and subscription separately to avoid duplicate logs
    let mounted = true;
    
    // Check for existing session ONCE on mount
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      
      // ✅ FIX: Handle refresh token errors gracefully
      if (error) {
        console.error('[Auth] Session error:', error);
        // If refresh token is invalid, clear session and sign out
        if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid Refresh Token')) {
          console.log('[Auth] Refresh token invalid, clearing session...');
          setSession(null);
          setUser(null);
          setProfile(null);
          // Clear localStorage to prevent theme flash
          try {
            localStorage.removeItem('user_role');
          } catch (e) {
            // Silently fail if localStorage unavailable
          }
          // Sign out to clear Supabase session
          supabase.auth.signOut().catch(() => {
            // Ignore sign out errors
          });
        }
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        if (import.meta.env.DEV) {
          console.log('[Auth] User authenticated:', session.user.email);
        }
        
        fetchUserProfile(session.user.id).then(userProfile => {
          if (!mounted) return;
          
          if (userProfile) {
            if (import.meta.env.DEV) {
              console.log('[Auth] ✅ Profile loaded:', userProfile.role);
            }
            // ✅ Save role to localStorage immediately to prevent theme flash on reload
            if (userProfile.role) {
              try {
                localStorage.setItem('user_role', userProfile.role);
              } catch (e) {
                // Silently fail if localStorage is unavailable
              }
            }
            setProfile(userProfile);
          } else {
            console.error('[Auth] ❌ Failed to load profile after retries');
            setProfile(null);
          }
        }).catch(error => {
          if (!mounted) return;
          console.error('[Auth] Profile fetch error:', error);
          setProfile(null);
        });
      }
      
      setLoading(false);
    });

    // Set up listener for FUTURE auth changes (not initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // ✅ FIX: Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.error('[Auth] Token refresh failed, signing out...');
          setSession(null);
          setUser(null);
          setProfile(null);
          try {
            localStorage.removeItem('user_role');
          } catch (e) {
            // Silently fail
          }
          await supabase.auth.signOut().catch(() => {
            // Ignore sign out errors
          });
          setLoading(false);
          return;
        }
        
        // Only log for actual auth events (not initial load)
        if (event !== 'INITIAL_SESSION') {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            if (import.meta.env.DEV) {
              console.log('[Auth] User authenticated:', session.user.email);
            }
            
            fetchUserProfile(session.user.id).then(userProfile => {
              if (!mounted) return;
              
              if (userProfile) {
                if (import.meta.env.DEV) {
                  console.log('[Auth] ✅ Profile loaded:', userProfile.role);
                }
                // ✅ Save role to localStorage immediately to prevent theme flash on reload
                if (userProfile.role) {
                  try {
                    localStorage.setItem('user_role', userProfile.role);
                  } catch (e) {
                    // Silently fail if localStorage is unavailable
                  }
                }
                setProfile(userProfile);
              } else {
                setProfile(null);
              }
            });
          } else {
            setProfile(null);
          }
          
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { error };
  };

  const verifyPhoneOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
          phone: phone || null,
        }
      }
    });
    return { error };
  };

  const signUpWithPhone = async (phone: string, displayName: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        data: {
          display_name: displayName,
        }
      }
    });
    
    // If OTP was sent successfully, we need to create the profile after verification
    // This will be handled in the auth state change listener
    return { error };
  };

  // ✅ SECURITY FIX: Role updates now go through server-side function
  const updateRole = async (role: 'attendee' | 'organizer') => {
    if (!user) {
      console.error('[Auth] updateRole: No user logged in');
      return { error: new Error('No user logged in') };
    }
    
    console.log('[Auth] Requesting role update to:', role);
    
    // ⚠️ NOTE: This will call the database function which requires admin privileges
    // For normal users upgrading to organizer, implement a separate verification flow
    try {
      const { data, error } = await supabase.rpc('update_user_role', {
        p_user_id: user.id,
        p_new_role: role
      });
      
      if (error) {
        console.error('[Auth] Role update failed:', error);
        
        // Provide user-friendly error message
        if (error.message?.includes('Unauthorized')) {
          return { 
            error: new Error('You do not have permission to change roles. Please contact support.')
          };
        }
        
        return { error: new Error(error.message || 'Failed to update role') };
      }
      
      console.log('[Auth] ✅ Role updated:', data);
      
      // ✅ Save role to localStorage immediately to prevent theme flash
      try {
        localStorage.setItem('user_role', role);
      } catch (e) {
        // Silently fail if localStorage is unavailable
      }
      
      // ✅ Optimistic update for instant UI response
      setProfile(prev => prev ? { ...prev, role } : prev);
      
      // Then fetch full profile to ensure consistency
      fetchUserProfile(user.id).then(updatedProfile => {
        if (updatedProfile) {
          // ✅ Save role to localStorage when profile is updated
          if (updatedProfile.role) {
            try {
              localStorage.setItem('user_role', updatedProfile.role);
            } catch (e) {
              // Silently fail if localStorage is unavailable
            }
          }
          setProfile(updatedProfile);
        }
      });
      
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('[Auth] updateRole exception:', error);
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    
    // Clear guest sessions and cached role to prevent conflicts
    localStorage.removeItem('ticket-guest-session');
    localStorage.removeItem('user_role');
  };

  // ✅ Optimistic profile update for instant UI changes
  const updateProfileOptimistic = (updates: Partial<UserProfile>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : prev);
    
    // ✅ Save role to localStorage if it's being updated optimistically
    if (updates.role) {
      try {
        localStorage.setItem('user_role', updates.role);
      } catch (e) {
        // Silently fail if localStorage is unavailable
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      signIn,
      signInWithPhone,
      verifyPhoneOtp,
      signUp,
      signUpWithPhone,
      signOut,
      updateRole: updateRole as any,
      updateProfileOptimistic,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}