import axios from 'axios';
import type {
  Dashboard, TimeRecord, WorkDay, SalaryConfig,
  Expense, MonthlySummary, GmailStatus
} from '../types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 (token expirado ou backend reiniciado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: any) => api.post('/auth/login', data).then(r => r.data),
  register: (data: any) => api.post('/auth/register', data).then(r => r.data),
  getUsers: () => api.get<any[]>('/auth/users').then(r => r.data),
};
export const dashboardApi = {
  get: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    return api.get<Dashboard>(`/dashboard?${params.toString()}`).then(r => r.data);
  },
};

export const timeRecordApi = {
  getToday: () => api.get<TimeRecord[]>('/time-records/today').then(r => r.data),
  getByMonth: (year: number, month: number) =>
    api.get<TimeRecord[]>(`/time-records/${year}/${month}`).then(r => r.data),
  addManual: (timestamp: string) =>
    api.post('/time-records/manual', { timestamp }).then(r => r.data),
};

export const workDayApi = {
  getByMonth: (year: number, month: number) =>
    api.get<WorkDay[]>(`/work-days/${year}/${month}`).then(r => r.data),
  getToday: () => api.get<WorkDay>('/work-days/today').then(r => r.data).catch(() => null),
};

export const financeApi = {
  getSalary: () => api.get<SalaryConfig>('/salary').then(r => r.data).catch(() => null),
  saveSalary: (data: SalaryConfig) => api.post<SalaryConfig>('/salary', data).then(r => r.data),

  getExpenses: () => api.get<Expense[]>('/expenses').then(r => r.data),
  addExpense: (e: Expense) => api.post<Expense>('/expenses', e).then(r => r.data),
  updateExpense: (id: number, e: Expense) => api.put<Expense>(`/expenses/${id}`, e).then(r => r.data),
  deleteExpense: (id: number) => api.delete(`/expenses/${id}`),

  getSummaries: () => api.get<MonthlySummary[]>('/monthly-summary').then(r => r.data),
  getSummary: (year: number, month: number) =>
    api.get<MonthlySummary>(`/monthly-summary/${year}/${month}`).then(r => r.data),
  recalculate: (year: number, month: number) =>
    api.post<MonthlySummary>(`/monthly-summary/${year}/${month}/recalculate`).then(r => r.data),
};

export const whatsAppApi = {
  getStatus: () => api.get<string>('/whatsapp/status').then(r => r.data),
  createInstance: () => api.post('/whatsapp/instance/create').then(r => r.data),
  getQrCode: () => api.get<string>('/whatsapp/qrcode').then(r => r.data),
  sendTest: (message?: string) =>
    api.post('/whatsapp/test', { message }).then(r => r.data),
};

export const gmailApi = {
  getStatus: () => api.get<GmailStatus>('/gmail/status').then(r => r.data),
  sync: () => api.post<{ processed: number }>('/gmail/sync').then(r => r.data),
  syncHistory: (afterDate?: string) => api.post<{ processed: number }>('/gmail/sync-history', { afterDate }).then(r => r.data),
  syncAdvanced: (data: { startDate?: string, endDate?: string, userId?: number }) => api.post<{ processed: number }>('/gmail/sync-advanced', data).then(r => r.data),
  getAuthUrl: () => api.get<{ authUrl: string }>('/gmail/auth').then(r => r.data),
  submitCode: (code: string) => api.post<{ success: boolean }>('/gmail/code', { code }).then(r => r.data),
};
