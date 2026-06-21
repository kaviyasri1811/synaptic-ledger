import { User } from '../types';

export const createAuthService = (appType: 'chatbot' | 'library') => {
  const API_URL = `/api/${appType}/auth`;
  const tokenKey = `${appType}_token`;

  return {
    async login(email: string, password: string): Promise<User> {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem(tokenKey, data.token);
      return data.user;
    },

    async register(name: string, email: string, password: string, role: string): Promise<User> {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }
      const data = await res.json();
      localStorage.setItem(tokenKey, data.token);
      return data.user;
    },

    async getCurrentUser(): Promise<User | null> {
      const token = localStorage.getItem(tokenKey);
      if (!token) return null;

      const res = await fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        localStorage.removeItem(tokenKey);
        return null;
      }
      const data = await res.json();
      return data.user;
    },

    logout() {
      localStorage.removeItem(tokenKey);
    },

    getToken() {
      return localStorage.getItem(tokenKey);
    }
  };
};

export const chatbotAuthService = createAuthService('chatbot');
export const libraryAuthService = createAuthService('library');

