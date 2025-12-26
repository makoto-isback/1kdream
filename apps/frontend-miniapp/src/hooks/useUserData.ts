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
    // ALWAYS call setState to trigger React re-render, even if data is the same
    const unsubscribeUser = userDataSync.subscribe('user', (userData: User | null) => {
      console.log('[useUserData] User subscription callback fired:', userData ? `user ${userData.id}` : 'null');
      // ALWAYS update state to trigger re-render
      setUser(userData);
    });

    // Subscribe to authReady updates
    // TERMINAL: Once true, never reverts to false
    // ALWAYS call setState to trigger React re-render
    const unsubscribeAuthReady = userDataSync.subscribe('authReady', (ready: boolean) => {
      console.log('[useUserData] authReady subscription callback fired:', ready);
      setIsAuthReady(ready);
    });

    // Sync initial state immediately
    const initialUser = userDataSync.getUser();
    const initialAuthReady = userDataSync.isAuthReady();
    console.log('[useUserData] Initial sync:', { hasUser: !!initialUser, authReady: initialAuthReady });
    if (initialUser) {
      setUser(initialUser);
    }
    if (initialAuthReady) {
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

