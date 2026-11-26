import { request } from './api';

export const attendanceLabels = { PRESENT: 'Presente', ABSENT: 'Ausente', EXCUSED: 'Ausencia justificada' } as const;
export type AttendanceStatus = keyof typeof attendanceLabels;

export interface Crew {
  id: number;
  name: string;
  memberIds: number[];
  version: number;
}

export interface Attendance {
  id: number;
  userId: number;
  userName: string;
  date: string;
  status: AttendanceStatus;
  hours: number;
  notes: string | null;
  version: number;
}

export interface WorkforceData {
  crews: Crew[];
  attendance: Attendance[];
}

type CrewFields = Pick<Crew, 'name' | 'memberIds'>;
type AttendanceFields = Pick<Attendance, 'status' | 'hours' | 'notes'>;

export const workforceApi = {
  get: (farmId: number, date: string) => request<WorkforceData>(`/workforce?${new URLSearchParams({ farmId: String(farmId), date })}`),
  createCrew: (payload: CrewFields & { farmId: number }) => request<Crew>('/workforce/crews', 'POST', payload),
  updateCrew: (id: number, payload: CrewFields & { version: number }) => request<Crew>(`/workforce/crews/${id}`, 'PATCH', payload),
  createAttendance: (payload: AttendanceFields & Pick<Attendance, 'userId' | 'date'> & { farmId: number }) => request<Attendance>('/workforce/attendance', 'POST', payload),
  updateAttendance: (id: number, payload: AttendanceFields & { version: number }) => request<Attendance>(`/workforce/attendance/${id}`, 'PATCH', payload),
};
