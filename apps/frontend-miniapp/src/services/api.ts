import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { socketService } from './socket';
import { userDataSync } from './userDataSync';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// User-scoped endpoints that require socket authentication
const USER_SCOPED_ENDPOINTS = ['/users/me', '/bets/my'];
const NO_RETRY_ENDPOINTS = ['/users/me', '/bets/my'];

// Retry configuration for 429 errors
interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _retryDelay?: number;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 5000; // 5 seconds

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(retryCount: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * Retry request with exponential backoff for 429 errors
 */
async function retryRequest(
  error: AxiosError,
  retryCount: number = 0
): Promise<any> {
  const config = error.config as RetryConfig;
  
  if (!config) {
    return Promise.reject(error);
  }

  // Only retry 429 errors
  if (error.response?.status !== 429) {
    return Promise.reject(error);
  }

  // Don't retry if max retries reached
  if (retryCount >= MAX_RETRIES) {
    console.warn('[API] Max retries reached for 429 error, giving up');
    return Promise.reject(error);
  }

  const delay = getRetryDelay(retryCount);
  console.log(`[API] 429 Too Many Requests - retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

  // Wait before retrying
  await new Promise(resolve => setTimeout(resolve, delay));

  // Retry the request
  try {
    return await api.request(config);
  } catch (retryError) {
    // If still 429, try again
    if ((retryError as AxiosError).response?.status === 429) {
      return retryRequest(retryError as AxiosError, retryCount + 1);
    }
    return Promise.reject(retryError);
  }
}

// Add token to requests
api.interceptors.request.use((config) => {
  // 🔴 HARD BLOCK: User-scoped endpoints require socket authentication
  // EXCEPT during controlled hydration after socket auth
  // This must run BEFORE retry logic and rate limiter
  if (config.url) {
    const isUserScoped = USER_SCOPED_ENDPOINTS.some(endpoint => config.url?.includes(endpoint));
    if (isUserScoped) {
      const socketAuth = socketService.isSocketAuthenticated();
      const isHydrating = userDataSync.isHydrating();
      
      // Allow ONLY when socket is authenticated AND UserDataSync is hydrating
      if (!socketAuth || !isHydrating) {
        console.warn(`[API BLOCKED] User-scoped endpoint blocked: ${config.url} (socketAuth: ${socketAuth}, isHydrating: ${isHydrating})`);
        return Promise.reject(new Error('SOCKET_NOT_READY'));
      }
      
      console.log(`✅ [API] User-scoped endpoint ALLOWED during hydration: ${config.url}`);
    }
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors with 429 retry logic
// CRITICAL: Do NOT reload on 401 - this causes infinite reload loops
// Instead, let AuthContext handle auth errors gracefully
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // 🔥 Disable retries for user-scoped endpoints (prevents retry storms)
    const config = error.config;
    if (config && config.url) {
      const isNoRetry = NO_RETRY_ENDPOINTS.some(endpoint => config.url?.includes(endpoint));
      if (isNoRetry) {
        console.warn(`[API] Retry disabled for user-scoped endpoint: ${config.url}`);
        return Promise.reject(error);
      }
    }

    // Handle 429 with retry logic (only for non-user-scoped endpoints)
    if (error.response?.status === 429) {
      try {
        return await retryRequest(error);
      } catch (retryError) {
        // All retries failed - don't throw UI error, just log
        console.warn('[API] All retries failed for 429 error, preserving UI state');
        // Return a rejected promise but don't show error to user
        // The UI will continue using cached data
        return Promise.reject(retryError);
      }
    }

    // Handle 401 errors
    if (error.response?.status === 401) {
      // Token expired or invalid - remove token but DON'T reload
      // AuthContext will handle re-authentication
      const token = localStorage.getItem('token');
      if (token) {
        console.warn('[API] 401 Unauthorized - removing invalid token');
        localStorage.removeItem('token');
      }
      // Do NOT reload - let the app handle auth state gracefully
    }

    return Promise.reject(error);
  }
);

export default api;

