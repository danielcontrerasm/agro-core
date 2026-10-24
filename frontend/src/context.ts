import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FarmData, Mode, Page, Profile, Role, Task } from './lib/types';

export interface AppState {
  mode: Mode; profile: Profile; data: FarmData; allData: FarmData; farmId: number; role: Role;
  tasks: Task[]; date: string; search: string; loading: boolean; fieldContextId: number;
  setDate: (date: string) => void; setFarmId: (id: number) => void; setFieldContextId: (id: number) => void;
  navigate: (page: Page) => void; notify: (message: string, error?: boolean) => void;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  createTask: (payload: Record<string, unknown>) => Promise<void>;
  updateTask: (task: Task, status: Task['status'], notes: string) => Promise<Task>;
  create: (resource: string, payload: Record<string, unknown>) => Promise<number>;
  remove: (resource: string, id: number) => Promise<void>;
  refresh: (quiet?: boolean) => Promise<void>; connect: () => void; setDemoRole: (role: Role) => void; resetDemo: () => void;
}

export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppContext is required');
  return context;
}
