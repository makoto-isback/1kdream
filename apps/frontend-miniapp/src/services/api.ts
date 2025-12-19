import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
// CRITICAL: Do NOT reload on 401 - this causes infinite reload loops
// Instead, let AuthContext handle auth errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
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

