
import { get, set, del } from 'idb-keyval';
import { Document, User, ChatSession } from '../types';

const DOCUMENTS_KEY = 'knowledge_base';
const USER_KEY = 'app_user';
const SESSIONS_KEY = 'chat_sessions';

export const storage = {
  async saveDocuments(docs: Document[]): Promise<void> {
    try {
      await set(DOCUMENTS_KEY, docs);
    } catch (error) {
      console.error('Failed to save documents to IndexedDB:', error);
      throw new Error('Storage limit reached or database error.');
    }
  },

  async getDocuments(): Promise<Document[]> {
    try {
      const docs = await get<Document[]>(DOCUMENTS_KEY);
      return docs || [];
    } catch (error) {
      console.error('Failed to get documents from IndexedDB:', error);
      return [];
    }
  },

  async saveSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await set(SESSIONS_KEY, sessions);
    } catch (error) {
      console.error('Failed to save sessions to IndexedDB:', error);
    }
  },

  async getSessions(): Promise<ChatSession[]> {
    try {
      const sessions = await get<ChatSession[]>(SESSIONS_KEY);
      return sessions || [];
    } catch (error) {
      console.error('Failed to get sessions from IndexedDB:', error);
      return [];
    }
  },

  saveUser(user: User | null): void {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  },

  getUser(): User | null {
    const saved = localStorage.getItem(USER_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
};
