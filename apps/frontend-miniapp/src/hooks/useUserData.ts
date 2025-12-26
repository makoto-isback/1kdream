/**
 * useUserData Hook
 * 
 * Reactive hook for accessing UserDataSync state
 * Replaces useAuth() - UserDataSync is now the single source of truth
 */

import { useState, useEffect } from 'react';
import { userDataSync } from '../services/userDataSync';
import { User } from '../services/users';

export const useUserData = () => {
  const [user, setUser] = useState<User | null>(userDataSync.getUser());
  const [isAuthReady, setIsAuthReady] = useState(userDataSync.isAuthReady());

  useEffect(() => {
    // CRITICAL: Subscriptions persist across auth transitions
    // Only unsubscribe on explicit logout or component unmount
    // Empty dependency array ensures subscriptions are created once and persist
    
    // Subscribe to user updates
    const unsubscribeUser = userDataSync.subscribe('user', (userData: User | null) => {
      // Only update if user data exists (don't clear on null unless explicit logout)
      if (userData) {
        setUser(userData);
      } else if (isAuthReady === false) {
        // Only clear user if authReady is false (explicit logout)
        setUser(null);
      }
    });

    // Subscribe to authReady updates
    // TERMINAL: Once true, never reverts to false
    const unsubscribeAuthReady = userDataSync.subscribe('authReady', (ready: boolean) => {
      if (ready) {
        setIsAuthReady(true);
        // Once authReady is true, it never goes back to false
      }
    });

    // Check initial state
    if (userDataSync.isAuthReady()) {
      setIsAuthReady(true);
    }

    // Cleanup ONLY on component unmount (not on auth transitions)
    return () => {
      unsubscribeUser();
      unsubscribeAuthReady();
    };
  }, []); // Empty deps: subscriptions persist across auth transitions

  return {
    user,
    isAuthReady,
    refreshUser: async () => {
      await userDataSync.manualRefresh('user');
    },
  };
};

