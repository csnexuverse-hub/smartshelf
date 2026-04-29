// lib/api.ts - Central API client for all backend calls

import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min timeout for AI processing
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────
export const login = async (username: string, password: string) => {
  const res = await api.post('/api/auth/login', { username, password });
  return res.data;
};

// ─── Sessions ────────────────────────────────────────────────
export const getSessions = async () => {
  const res = await api.get('/api/sessions/');
  return res.data;
};

export const createSession = async (data: { name: string; location?: string; department?: string }) => {
  const res = await api.post('/api/sessions/', data);
  return res.data;
};

export const getSession = async (id: string) => {
  const res = await api.get(`/api/sessions/${id}`);
  return res.data;
};

export const deleteSession = async (id: string) => {
  const res = await api.delete(`/api/sessions/${id}`);
  return res.data;
};

// ─── Books ───────────────────────────────────────────────────
export const scanBook = async (sessionId: string, file: File, onProgress?: (pct: number) => void) => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/api/books/sessions/${sessionId}/scan`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return res.data;
};

export const getSessionBooks = async (sessionId: string) => {
  const res = await api.get(`/api/books/sessions/${sessionId}/books`);
  return res.data;
};

export const updateBook = async (bookId: string, updates: Partial<Book>) => {
  const res = await api.patch(`/api/books/${bookId}`, updates);
  return res.data;
};

export const deleteBook = async (bookId: string) => {
  const res = await api.delete(`/api/books/${bookId}`);
  return res.data;
};

export const getBookImage = async (bookId: string) => {
  const res = await api.get(`/api/books/${bookId}/image`);
  return res.data;
};

// ─── Export ──────────────────────────────────────────────────
export const exportCSV = (sessionId: string) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  window.open(`${BASE_URL}/api/export/sessions/${sessionId}/csv?token=${token}`, '_blank');
};

export const downloadCSV = async (sessionId: string) => {
  const res = await api.get(`/api/export/sessions/${sessionId}/csv`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  const filename = res.headers['content-disposition']?.match(/filename=(.+)/)?.[1] || 'export.csv';
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadExcel = async (sessionId: string) => {
  const res = await api.get(`/api/export/sessions/${sessionId}/xlsx`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  const filename = res.headers['content-disposition']?.match(/filename=(.+)/)?.[1] || 'export.xlsx';
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─── Types ───────────────────────────────────────────────────
export interface Book {
  id: string;
  session_id: string;
  title?: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publication_date?: string;
  edition?: string;
  language?: string;
  isbn_10?: string;
  isbn_13?: string;
  page_count?: number;
  categories: string[];
  description?: string;
  author_details?: {
    name?: string;
    birth_date?: string;
    work_count?: number;
    top_subjects?: string[];
  };
  demand_score?: number;
  demand_label?: string;
  ai_confidence?: number;
  verification_status: string;
  data_source?: string;
  has_image: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  name: string;
  location?: string;
  department?: string;
  created_at: string;
  book_count: number;
}

export default api;
