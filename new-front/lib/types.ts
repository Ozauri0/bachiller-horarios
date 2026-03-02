export type Course = {
  asig_codigo: string;
  asig_nombre: string;
};

export type CourseOption = {
  code: string;
  name?: string;
};

export type CourseStructure = {
  section: number;
  groups: number[];
};

export type GroupConfig = {
  course: string;
  section: number;
  groups: number[];
  display?: string;
};

export type GroupConfigMap = Record<string, GroupConfig>;

export type ToponConfig = {
  id: string;
  section: number;
  group: number;
  dia: string;
  hora_ini: string;
  hora_fin: string;
  tapon_type: string;
  campus?: string;
  display?: string;
};

export type ToponConfigMap = Record<string, ToponConfig>;

export type BachSchedule = ToponConfig & { display: string };

export type ScheduleBlock = {
  curso: string;
  nombre?: string;
  seccion: number;
  grupo: number | string;
  dia: string;
  hora_ini: string;
  hora_fin: string;
  campus?: string;
};

export type ScheduleSection = {
  course: string;
  section: number;
  group: number | string;
  name?: string;
  semestre?: number | string | null;
  plan?: string | null;
};

export type ScheduleResult = {
  sections: ScheduleSection[];
  blocks: ScheduleBlock[];
  score?: number;
  has_conflicts?: boolean;
  has_valid_topones?: boolean;
  conflicts?: string[];
  conflict_types?: string[];
  valid_topones?: string[];
  valid_topon_types?: string[];
};

export type ExcelRow = {
  sare_anho?: number | null;
  sare_semestre?: number | null;
  asig_codigo?: string;
  asig_nombre?: string;
  psec_codigo?: number | null;
  pgru_codigo?: number | null;
  sdia_descripcion?: string;
  sper_hora_ini?: string;
  sper_hora_fin?: string;
  camp_campus?: string;
  [key: string]: any;
};

export type MassSummary = {
  total_alumnos: number;
  con_horario: number;
  sin_horario: number;
  con_topon_valido: number;
};

export type CapacityEntry = {
  course: string;
  section: number;
  capacity?: number;
  assigned?: number;
  remaining?: number;
  over_capacity?: boolean;
};

export type CapacityStats = {
  over_capacity?: CapacityEntry[];
  most_empty?: CapacityEntry[];
};

export type MassResult = {
  registro: string;
  rut?: string;
  dv?: string;
  nombre?: string;
  status: 'con_horario' | 'sin_horario' | 'no_valido';
  cursos?: string[];
  blocks?: ScheduleBlock[];
  sections?: ScheduleSection[];
  courses_detail?: ScheduleSection[];
  has_conflicts?: boolean;
  conflict_types?: string[];
  conflicts?: string[];
  has_valid_topones?: boolean;
  valid_topones?: string[];
  valid_topon_types?: string[];
  message?: string;
  capacity_report?: CapacityEntry[];
  capacity_stats?: CapacityStats;
  [key: string]: any;
};

export type MassState = {
  running?: boolean;
  total?: number;
  current?: number;
  remaining?: number;
  current_name?: string;
  current_registro?: string;
  phase?: string;
  done?: boolean;
  stateLabel?: string;
  results?: MassResult[];
  summary?: MassSummary | null;
  summary_progress?: MassSummary | null;
  capacity_report?: CapacityEntry[];
  capacity_stats?: CapacityStats;
  error?: string | null;
  rebalanced_count?: number;
};
