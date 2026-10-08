export interface TimeRecord {
  id: number;
  timestamp: string;
  punchType: 'IN' | 'OUT';
  origin: string;
  online: boolean;
  hash?: string;
  emailMessageId?: string;
}

export interface WorkDay {
  id: number;
  date: string;
  workedMinutes: number;
  contractMinutes: number;
  overtimeMinutes: number;
  overtimeValue: number;
  isSaturday: boolean;
  overtimeNotified: boolean;
  status: 'NORMAL' | 'OVERTIME' | 'INCOMPLETE' | 'DAY_OFF' | 'ABSENT';
}

export interface SalaryConfig {
  id?: number;
  baseSalary: number;
  overtimeRate: number;
  monthlyHoursDivisor: number;
  dailyContractHours: number;
  saturdayContractHours: number;
  active?: boolean;
}

export interface Expense {
  id?: number;
  name: string;
  amount: number;
  category: ExpenseCategory;
  dueDay?: number;
  recurring: boolean;
  month?: number;
  year?: number;
  active?: boolean;
}

export type ExpenseCategory =
  | 'MORADIA' | 'ALIMENTACAO' | 'TRANSPORTE' | 'SAUDE'
  | 'EDUCACAO' | 'LAZER' | 'ASSINATURAS' | 'OUTROS';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: 'MORADIA', label: 'Moradia', emoji: '🏠' },
  { value: 'ALIMENTACAO', label: 'Alimentação', emoji: '🍽️' },
  { value: 'TRANSPORTE', label: 'Transporte', emoji: '🚗' },
  { value: 'SAUDE', label: 'Saúde', emoji: '💊' },
  { value: 'EDUCACAO', label: 'Educação', emoji: '📚' },
  { value: 'LAZER', label: 'Lazer', emoji: '🎮' },
  { value: 'ASSINATURAS', label: 'Assinaturas', emoji: '📱' },
  { value: 'OUTROS', label: 'Outros', emoji: '💼' },
];

export interface MonthlySummary {
  id: number;
  month: number;
  year: number;
  baseSalary: number;
  totalOvertimeMinutes: number;
  overtimePay: number;
  totalExpenses: number;
  carriedOver: number;
  finalBalance: number;
  missingSaturdays?: number;
  closed: boolean;
}

export interface Dashboard {
  today: string;
  monthSummary: MonthlySummary;
  todayRecords: TimeRecord[];
  todayWorkDay: WorkDay | null;
  currentMonth: { month: number; year: number };
}

export interface GmailStatus {
  hasCredentials: boolean;
  status: string;
  email: string;
  syncFrom: string;
  lastSync: string;
}
