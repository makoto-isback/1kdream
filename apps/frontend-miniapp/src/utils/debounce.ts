/**
 * Debounce utility for HTTP fetches
 * Ensures multiple calls within the window collapse into one request
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds (default: 3000ms)
 * @returns Debounced function that returns a promise
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 3000
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<any> | null = null;
  let pendingResolve: ((value: any) => void) | null = null;
  let pendingReject: ((error: any) => void) | null = null;

  const debounced = ((...args: Parameters<T>) => {
    return new Promise((resolve, reject) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Store resolve/reject for the latest call
      pendingResolve = resolve;
      pendingReject = reject;

      // If there's already a pending promise, wait for it
      if (pendingPromise) {
        pendingPromise
          .then((result) => {
            // If this is still the latest call, resolve it
            if (pendingResolve === resolve) {
              resolve(result);
            }
          })
          .catch((error) => {
            // If this is still the latest call, reject it
            if (pendingReject === reject) {
              reject(error);
            }
          });
        return;
      }

      // Set new timeout
      timeoutId = setTimeout(async () => {
        timeoutId = null;
        pendingPromise = fn(...args);
        
        try {
          const result = await pendingPromise;
          if (pendingResolve) {
            pendingResolve(result);
          }
        } catch (error) {
          if (pendingReject) {
            pendingReject(error);
          }
        } finally {
          pendingPromise = null;
          pendingResolve = null;
          pendingReject = null;
        }
      }, delay);
    });
  }) as T;

  return debounced;
}

/**
 * Create a debounced fetch function with a shared cache
 * Multiple calls within the delay window will share the same promise
 */
export function createDebouncedFetch<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 3000
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let sharedPromise: Promise<any> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    // If there's already a pending promise, return it
    if (sharedPromise) {
      return sharedPromise;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Create new promise
    sharedPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        timeoutId = null;
        const promise = fn(...args);
        
        try {
          const result = await promise;
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          sharedPromise = null;
        }
      }, delay);
    });

    return sharedPromise;
  }) as T;

  return debounced;
}

