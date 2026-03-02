import {
  BachSchedule,
  CapacityStats,
  Course,
  CourseStructure,
  ExcelRow,
  GroupConfigMap,
  MassResult,
  MassState,
  MassSummary,
  ScheduleResult,
  ToponConfigMap
} from './types';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');

const withBase = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
};

async function parseError(res: Response) {
  try {
    const data = await res.json();
    return data?.error || data?.message || `Error ${res.status}`;
  } catch (_) {
    return `Error ${res.status}`;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withBase(path), init);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<T>;
}

async function downloadFile(path: string, filename: string) {
  const res = await fetch(withBase(path));
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  if (typeof window === 'undefined') return blob;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return blob;
}

export async function fetchCourses(): Promise<Course[]> {
  return fetchJson<Course[]>('/api/courses');
}

export async function fetchCourseStructure(code: string): Promise<CourseStructure[]> {
  return fetchJson<CourseStructure[]>(`/api/course/${encodeURIComponent(code)}/structure`);
}

export async function fetchBachSchedules(): Promise<BachSchedule[]> {
  return fetchJson<BachSchedule[]>('/api/bach1121/schedules');
}

export async function loadConfig(): Promise<{ groupConfigs: GroupConfigMap; toponesConfigs?: ToponConfigMap; toponeConfigs?: ToponConfigMap; toponConfigs?: ToponConfigMap; }> {
  return fetchJson('/api/config/load');
}

export async function saveConfig(payload: { groupConfigs: GroupConfigMap; toponesConfigs: ToponConfigMap }) {
  return fetchJson('/api/config/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function uploadAlumnos(file: File) {
  const form = new FormData();
  form.append('file', file);
  return fetchJson('/api/config/alumnos', { method: 'POST', body: form });
}

export async function fetchExcelData(): Promise<ExcelRow[]> {
  const resp = await fetchJson<{ success: boolean; data?: ExcelRow[] }>('/api/data/all');
  return resp.data || [];
}

export async function saveExcelData(data: ExcelRow[]) {
  return fetchJson('/api/data/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
}

export async function exportExcel() {
  return downloadFile('/api/data/export', 'consolidado_export.xlsx');
}

export async function importExcel(file: File) {
  const form = new FormData();
  form.append('file', file);
  return fetchJson('/api/data/import', { method: 'POST', body: form });
}

export async function generateSchedules(payload: { courses: string[]; groupConfigs: GroupConfigMap; validTopones: ToponConfigMap }): Promise<{ schedules: ScheduleResult[]; message?: string; stats?: any }> {
  return fetchJson('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courses: payload.courses,
      groupConfigs: payload.groupConfigs,
      validTopones: payload.validTopones
    })
  });
}

export async function runMassiveGeneration(file?: File): Promise<{ success: boolean; total?: number }> {
  const form = new FormData();
  if (file) form.append('file', file);
  return fetchJson('/api/mass/generate_async', { method: 'POST', body: form });
}

export async function pollMassive(): Promise<{ success: boolean; state: MassState }> {
  return fetchJson('/api/mass/progress');
}

export async function downloadMassXlsx() {
  return downloadFile('/api/mass/export', 'carga_masiva.xlsx');
}

export async function rebalanceMassive(): Promise<{ success: boolean; total?: number; target_count?: number }> {
  return fetchJson('/api/mass/rebalance', { method: 'POST' });
}

export async function fetchMassReport(): Promise<null | ({ summary?: MassSummary; capacity_report?: any; capacity_stats?: CapacityStats; results?: MassResult[] })> {
  const res = await fetch(withBase('/api/mass/report'));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data?.report || null;
}

export async function saveMassStudentSchedule(payload: { registro: string; rut?: string; nombre?: string; courses: string[]; schedule: ScheduleResult }) {
  return fetchJson('/api/mass/student/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
