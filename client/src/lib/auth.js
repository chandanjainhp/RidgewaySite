/**
 * Authentication API utilities
 * Handles auth requests with the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Register a new user
 */
export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: userData.fullName,
        email: userData.email,
        password: userData.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Registration failed');
    }

    // Store tokens
    if (data.data?.accessToken) {
      localStorage.setItem('ridgeway_token', data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem('ridgeway_refresh_token', data.data.refreshToken);
      }
      if (data.data.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      document.cookie = 'ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax';
    }

    return data.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to register user');
  }
};

/**
 * Login user
 */
export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Login failed');
    }

    // Store tokens
    if (data.data?.accessToken) {
      localStorage.setItem('ridgeway_token', data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem('ridgeway_refresh_token', data.data.refreshToken);
      }
      if (data.data.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      document.cookie = 'ridgeway_auth=1; path=/; max-age=86400; SameSite=Lax';
    }

    return data.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to login');
  }
};

/**
 * Get stored auth token
 */
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ridgeway_token');
};

/**
 * Get stored user data
 */
export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

/**
 * Logout user (clear stored data)
 */
export const logoutUser = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('ridgeway_token');
  localStorage.removeItem('ridgeway_refresh_token');
  localStorage.removeItem('user');
  document.cookie = 'ridgeway_auth=; path=/; max-age=0; SameSite=Lax';
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const token = getAuthToken();
  return typeof token === 'string' && token.length > 0;
};
