
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}

export type Role = 'admin' | 'student' | 'hod' | 'faculty';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
  lastActive?: string;
  queriesToday?: number;
}

export interface DocumentImage {
  id: string;
  data: string; // base64
  pageNumber: number;
  contextText?: string;
}

export interface Document {
  id: string;
  name: string;
  subjectId?: string;
  size?: number;
  status?: 'indexed' | 'indexing' | 'failed';
  content: string;
  uploadedAt: string;
  images?: DocumentImage[];
}

export type ImageSize = '1K' | '2K' | '4K';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
  imageUrl?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface KnowledgeBase {
  documents: Document[];
}

// Library Interfaces
export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  departmentId: string;
  totalCopies: number;
  availableCopies: number;
  coverUrl?: string;
  description?: string;
  ebookUrl?: string;
}

export interface BookIssue {
  id: string;
  bookId: string;
  userId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  fineAmount: number;
  status: 'issued' | 'returned' | 'overdue';
}

export interface BookReservation {
  id: string;
  bookId: string;
  userId: string;
  reservationDate: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'fine' | 'due_reminder' | 'reservation_available' | 'general';
}
