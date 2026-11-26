import { request } from './api';

export const financeCategoryLabels = {
  FERTILIZERS: 'Fertilizantes',
  PHYTOSANITARY: 'Fitosanitarios',
  LABOR: 'Mano de obra',
  IRRIGATION_ENERGY: 'Riego y energía',
  MAINTENANCE: 'Mantenimiento',
  OTHER_EXPENSE: 'Otros gastos',
  CROP_SALE: 'Venta de cosecha',
  OTHER_INCOME: 'Otros ingresos',
};

export type FinanceCategory = keyof typeof financeCategoryLabels;
export type FinanceEntryType = 'EXPENSE' | 'INCOME';

export const financeCategories: Record<FinanceEntryType, FinanceCategory[]> = {
  EXPENSE: ['FERTILIZERS', 'PHYTOSANITARY', 'LABOR', 'IRRIGATION_ENERGY', 'MAINTENANCE', 'OTHER_EXPENSE'],
  INCOME: ['CROP_SALE', 'OTHER_INCOME'],
};

export const financeTypeLabels: Record<FinanceEntryType, string> = { EXPENSE: 'Gasto', INCOME: 'Ingreso' };

export interface FinanceEntryData {
  entryDate: string;
  type: FinanceEntryType;
  category: FinanceCategory;
  amount: number;
  description: string;
  fieldId?: number | null;
  blockId?: number | null;
}

export interface FinanceEntry extends FinanceEntryData {
  id: number;
  farmId: number;
  fieldName: string | null;
  blockCode: string | null;
  version: number;
}

export interface FinanceBudget {
  amount: number;
  updatedAt: string;
}

export interface FinanceMonth {
  farmId: number;
  month: string;
  currency: 'COP';
  totals: { expenses: number; income: number; margin: number; entryCount: number };
  budget: FinanceBudget | null;
  expensesByCategory: { category: FinanceCategory; amount: number }[];
  blockMargins: { blockId: number; blockCode: string; fieldName: string; expenses: number; income: number; margin: number }[];
  entries: FinanceEntry[];
}

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const formatCop = (amount: number) => cop.format(amount);

export const financeApi = {
  async month(farmId: number, month: string) {
    const result = await request<FinanceMonth>(`/finances?farmId=${farmId}&month=${encodeURIComponent(month)}`);
    if (result?.farmId !== farmId || result.month !== month || result.currency !== 'COP') {
      throw new Error('El servidor no devolvió datos financieros para la finca y el mes solicitados.');
    }
    return result;
  },
  createEntry: (payload: { farmId: number; operationId: string; entry: FinanceEntryData }) => request<FinanceEntry>('/finances/entries', 'POST', payload),
  updateEntry: (id: number, payload: { farmId: number; version: number; entry: FinanceEntryData }) => request<FinanceEntry>(`/finances/entries/${id}`, 'PATCH', payload),
  saveBudget: (payload: { farmId: number; month: string; amount: number }) => request<FinanceBudget>('/finances/budget', 'PUT', payload),
};
