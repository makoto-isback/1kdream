import { useState, useEffect } from 'react';

/**
 * Hook to detect when the component has mounted on the client side
 * Returns true only after the component has mounted (client-side)
 */
export function useClientReady(): boolean {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

