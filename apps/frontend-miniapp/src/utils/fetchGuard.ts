/**
 * Fetch guard to prevent duplicate simultaneous requests
 * Uses timestamp-based locks to ensure only one fetch happens at a time
 */

interface FetchLock {
  timestamp: number;
  promise: Promise<any>;
}

const fetchLocks = new Map<string, FetchLock>();
const LOCK_TIMEOUT = 5000; // 5 seconds - if a fetch takes longer, allow retry

/**
 * Guard a fetch function to prevent duplicate simultaneous calls
 * @param key - Unique key for this fetch operation
 * @param fn - Fetch function to guard
 * @returns Guarded fetch function
 */
export function guardFetch<T extends (...args: any[]) => Promise<any>>(
  key: string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const lock = fetchLocks.get(key);

    // If there's a recent lock (within timeout), return the existing promise
    if (lock && (now - lock.timestamp) < LOCK_TIMEOUT) {
      console.log(`[FetchGuard] ⏸️ Duplicate fetch prevented for key: ${key}`);
      return lock.promise;
    }

    // Create new fetch
    const promise = fn(...args);
    
    // Store lock
    fetchLocks.set(key, {
      timestamp: now,
      promise,
    });

    // Clean up lock after promise resolves/rejects
    promise
      .finally(() => {
        const currentLock = fetchLocks.get(key);
        // Only remove if this is still the current lock
        if (currentLock?.promise === promise) {
          fetchLocks.delete(key);
        }
      });

    return promise;
  }) as T;
}

/**
 * Clear all fetch locks (useful for testing or cleanup)
 */
export function clearFetchLocks(): void {
  fetchLocks.clear();
}

