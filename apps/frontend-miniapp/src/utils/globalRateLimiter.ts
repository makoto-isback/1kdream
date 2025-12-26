/**
 * Global Rate Limiter
 * Enforces max 1 request per endpoint per 10 seconds across the entire app
 */

interface EndpointLock {
  endpoint: string;
  timestamp: number;
}

const endpointLocks = new Map<string, number>();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds

/**
 * Check if an endpoint can make a request
 * @param endpoint - Endpoint identifier (e.g., '/bets/my', '/lottery/active')
 * @returns true if request is allowed, false if rate limited
 */
export function canMakeRequest(endpoint: string): boolean {
  const now = Date.now();
  const lastRequest = endpointLocks.get(endpoint);
  
  if (!lastRequest) {
    return true;
  }
  
  const timeSinceLastRequest = now - lastRequest;
  return timeSinceLastRequest >= RATE_LIMIT_WINDOW;
}

/**
 * Record that a request was made to an endpoint
 * @param endpoint - Endpoint identifier
 */
export function recordRequest(endpoint: string): void {
  endpointLocks.set(endpoint, Date.now());
}

/**
 * Get time until next request is allowed (in milliseconds)
 * @param endpoint - Endpoint identifier
 * @returns milliseconds until next request, or 0 if allowed now
 */
export function getTimeUntilNextRequest(endpoint: string): number {
  const now = Date.now();
  const lastRequest = endpointLocks.get(endpoint);
  
  if (!lastRequest) {
    return 0;
  }
  
  const timeSinceLastRequest = now - lastRequest;
  const remaining = RATE_LIMIT_WINDOW - timeSinceLastRequest;
  return Math.max(0, remaining);
}

/**
 * Clear all rate limit locks (for testing)
 */
export function clearRateLimits(): void {
  endpointLocks.clear();
}

/**
 * Get normalized endpoint from URL
 * Removes query params and IDs to group similar endpoints
 */
export function normalizeEndpoint(url: string): string {
  // Remove query params
  const withoutQuery = url.split('?')[0];
  
  // Normalize IDs (replace UUIDs and numbers with :id)
  const normalized = withoutQuery
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
  
  return normalized;
}

