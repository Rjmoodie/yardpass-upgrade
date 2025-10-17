import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  user_id: string;
  display_name: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    // Type cast the data to ensure role is properly typed
    return {
      ...data,
      role: data.role as 'attendee' | 'organizer',
      verification_status: data.verification_status as 'none' | 'pending' | 'verified' | 'pro'
    };
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Check if this is a new user signup
          if (event === 'SIGNED_IN' && session.user.created_at === session.user.updated_at) {
            // New user - create profile if it doesn't exist
            const displayName = session.user.user_metadata?.display_name || 'User';
            const phone = session.user.phone || session.user.user_metadata?.phone;
            
            const { error: profileError } = await supabase
              .from('user_profiles')
              .upsert({
                user_id: session.user.id,
                display_name: displayName,
                phone: phone,
                role: 'attendee',
                verification_status: 'none',
                created_at: new Date().toISOString(),
              });
            
            if (profileError) {
              console.error('Error creating user profile:', profileError);
            }
          }
          
          // Fetch user profile to get role and other info
          setTimeout(async () => {
            const userProfile = await fetchUserProfile(session.user.id);
            setProfile(userProfile);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then(setProfile);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

  const updateRole = async (role: 'attendee' | 'organizer') => {
    if (!user) {
      console.error('updateRole: No user logged in');
      return { error: 'No user logged in' };
    }
    
    console.log('updateRole: Updating role to:', role, 'for user:', user.id);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('user_id', user.id)
      .select();
    
    console.log('updateRole result:', { data, error });
    
    if (!error) {
      // Refetch the complete profile to ensure consistency
      const updatedProfile = await fetchUserProfile(user.id);
      if (updatedProfile) {
        console.log('updateRole: Setting updated profile with role:', role);
        setProfile(updatedProfile);
      }
    } else {
      console.error('updateRole: Database error:', error);
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    
    // Clear guest sessions to prevent conflicts
    localStorage.removeItem('ticket-guest-session');
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