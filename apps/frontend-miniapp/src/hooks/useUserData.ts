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
    // Subscribe to user updates
    const unsubscribeUser = userDataSync.subscribe('user', (userData: User | null) => {
      setUser(userData);
    });

    // Subscribe to authReady updates
    const unsubscribeAuthReady = userDataSync.subscribe('authReady', (ready: boolean) => {
      setIsAuthReady(ready);
    });

    return () => {
      unsubscribeUser();
      unsubscribeAuthReady();
    };
  }, []);

  return {
    user,
    isAuthReady,
    refreshUser: async () => {
      await userDataSync.manualRefresh('user');
    },
  };
};

