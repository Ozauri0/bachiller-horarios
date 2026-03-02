'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BachSchedule,
  CapacityEntry,
  CapacityStats,
  ExcelRow,
  Course,
  CourseOption,
  CourseStructure,
  GroupConfig,
  GroupConfigMap,
  MassResult,
  MassSummary,
  MassState,
  ScheduleResult,
  ToponConfig,
  ToponConfigMap
} from '@/lib/types';
import {
  downloadMassXlsx,
  exportExcel,
  fetchBachSchedules,
  fetchCourseStructure,
  fetchCourses,
  fetchExcelData,
  fetchMassReport,
  generateSchedules,
  importExcel,
  loadConfig,
  pollMassive,
  rebalanceMassive,
  runMassiveGeneration,
  saveConfig,
  uploadAlumnos,
  uploadCursosDisponibles,
  saveExcelData,
  saveMassStudentSchedule
} from '@/lib/api';

import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import Banner from '@/components/Banner';
import type { BannerData } from '@/components/Banner';
import HorariosTab from '@/components/HorariosTab';
import ConfigTab from '@/components/ConfigTab';
import DatosTab from '@/components/DatosTab';
import CargaMasivaTab from '@/components/CargaMasivaTab';
import MassModal from '@/components/MassModal';

type TabKey = 'horarios' | 'config' | 'datos' | 'carga';

type ModalPos = { x: number; y: number };
type DragOffset = { x: number; y: number };

const sharedState = {
  tab: 'horarios' as TabKey,
  courses: [] as Course[],
  groupConfigs: {} as GroupConfigMap,
  toponConfigs: {} as ToponConfigMap,
  courseStructures: {} as Record<string, CourseStructure[]>,
  bachSchedules: [] as BachSchedule[],
  excelData: [] as ExcelRow[],
  massSummary: null as MassSummary | null,
  massResults: [] as MassResult[],
  massFiltered: null as MassResult[] | null,
  capacityStats: null as CapacityStats | null,
  massState: null as MassState | null,
  selectedCourses: [] as CourseOption[],
  schedules: [] as ScheduleResult[],
  scheduleIndex: 0,
  scheduleMessage: '',
};

const tabToPath = (tab: TabKey) => {
  if (tab === 'config') return '/configuracion';
  if (tab === 'datos') return '/datos';
  if (tab === 'carga') return '/carga-masiva';
  return '/horarios';
};

const pathToTab = (path: string): TabKey => {
  if (path.startsWith('/configuracion')) return 'config';
  if (path.startsWith('/datos')) return 'datos';
  if (path.startsWith('/carga-masiva')) return 'carga';
  return 'horarios';
};

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = useState<TabKey>(() => {
    if (pathname) return pathToTab(pathname);
    return sharedState.tab || 'horarios';
  });
  const [banner, setBanner] = useState<BannerData>(null);

  const [courses, setCourses] = useState<Course[]>(sharedState.courses);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<CourseOption[]>(sharedState.selectedCourses);
  const [schedules, setSchedules] = useState<ScheduleResult[]>(sharedState.schedules);
  const [scheduleIndex, setScheduleIndex] = useState(sharedState.scheduleIndex);
  const [scheduleMessage, setScheduleMessage] = useState(sharedState.scheduleMessage);
  const [generating, setGenerating] = useState(false);

  const [groupConfigs, setGroupConfigs] = useState<GroupConfigMap>(sharedState.groupConfigs);
  const [toponConfigs, setToponConfigs] = useState<ToponConfigMap>(sharedState.toponConfigs);
  const [courseStructures, setCourseStructures] = useState<Record<string, CourseStructure[]>>(sharedState.courseStructures);
  const [bachSchedules, setBachSchedules] = useState<BachSchedule[]>(sharedState.bachSchedules);
  const [configCourse, setConfigCourse] = useState('');
  const [configSection, setConfigSection] = useState('');
  const [configGroups, setConfigGroups] = useState<number[]>([]);
  const [toponSelected, setToponSelected] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const [excelData, setExcelData] = useState<ExcelRow[]>(sharedState.excelData);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelSaving, setExcelSaving] = useState(false);

  const [massLoading, setMassLoading] = useState(false);
  const [massSummary, setMassSummary] = useState<MassSummary | null>(sharedState.massSummary);
  const [massHasRun, setMassHasRun] = useState(Boolean(sharedState.massSummary));
  const [massResults, setMassResults] = useState<MassResult[]>(sharedState.massResults);
  const [massFiltered, setMassFiltered] = useState<MassResult[] | null>(sharedState.massFiltered);
  const [massState, setMassState] = useState<MassState | null>(sharedState.massState);
  const [massScheduleIndex, setMassScheduleIndex] = useState(0);
  const [massFilterText, setMassFilterText] = useState('');
  const [massFilterStatus, setMassFilterStatus] = useState('');
  const [capacityReport, setCapacityReport] = useState<CapacityEntry[] | null>(null);
  const [capacityStats, setCapacityStats] = useState<CapacityStats | null>(sharedState.capacityStats);
  const [overCapacitySort, setOverCapacitySort] = useState<'remaining_desc' | 'remaining_asc' | 'course_asc'>('remaining_desc');
  const [mostEmptySort, setMostEmptySort] = useState<'remaining_desc' | 'remaining_asc' | 'course_asc'>('remaining_desc');
  const [massRebalancing, setMassRebalancing] = useState(false);
  const massTargetCount = useMemo(() => {
    if (!massResults || massResults.length === 0) return 0;
    const over = new Set((capacityStats?.over_capacity || []).map(c => `${c.course}|${c.section}`));
    const regs = new Set<string>();
    massResults.forEach(r => {
      const reg = r.registro || '';
      if (!reg) return;
      if (r.status === 'sin_horario') { regs.add(reg); return; }
      (r.sections || []).forEach(sec => {
        const key = `${sec.course}|${sec.section}`;
        if (over.has(key)) regs.add(reg);
      });
    });
    return regs.size;
  }, [massResults, capacityStats]);

  const [massModalOpen, setMassModalOpen] = useState(false);
  const [massModalPos, setMassModalPos] = useState<ModalPos>({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 600, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400 });

  const [massEditCourses, setMassEditCourses] = useState<CourseOption[]>([]);
  const [massEditSchedules, setMassEditSchedules] = useState<ScheduleResult[]>([]);
  const [massEditScheduleIndex, setMassEditScheduleIndex] = useState(0);
  const [massEditMessage, setMassEditMessage] = useState('');
  const [massEditPanelOpen, setMassEditPanelOpen] = useState(false);
  const [massEditSaving, setMassEditSaving] = useState(false);
  const [massEditDirty, setMassEditDirty] = useState(false);

  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef<DragOffset>({ x: 0, y: 0 });

  useEffect(() => {
    if (!pathname) return;
    const nextTab = pathToTab(pathname);
    setTab(nextTab);
    sharedState.tab = nextTab;
    if (pathname === '/') {
      router.replace(tabToPath(nextTab));
    }
  }, [pathname, router]);

  const handleTabChange = (next: TabKey) => {
    setTab(next);
    sharedState.tab = next;
    const target = tabToPath(next);
    if (pathname !== target) router.push(target);
  };

  // ── Computed ─────────────────────────────────────────

  const displayedCourses = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter(c => c.asig_codigo.toLowerCase().includes(q) || c.asig_nombre.toLowerCase().includes(q));
  }, [courses, search]);

  const massSchedulesList = useMemo(() => {
    return (massFiltered ?? massResults).filter(r => r.blocks && r.blocks.length > 0);
  }, [massFiltered, massResults]);

  const sortedOverCapacity = useMemo(() => {
    if (!capacityStats) return [];
    const items = [...(capacityStats.over_capacity || [])];
    return items.sort((a, b) => {
      if (overCapacitySort === 'course_asc') return a.course.localeCompare(b.course);
      if (overCapacitySort === 'remaining_asc') return (a.remaining ?? 0) - (b.remaining ?? 0);
      return (a.remaining ?? 0) - (b.remaining ?? 0);
    });
  }, [capacityStats, overCapacitySort]);

  const sortedMostEmpty = useMemo(() => {
    if (!capacityStats) return [];
    const items = [...(capacityStats.most_empty || [])].filter(c => (c.remaining ?? 0) > 0);
    return items.sort((a, b) => {
      if (mostEmptySort === 'course_asc') return a.course.localeCompare(b.course);
      if (mostEmptySort === 'remaining_asc') return (a.remaining ?? 0) - (b.remaining ?? 0);
      return (b.remaining ?? 0) - (a.remaining ?? 0);
    });
  }, [capacityStats, mostEmptySort]);

  const liveSummary = useMemo(() => {
    if (massSummary) return massSummary;
    if (massState?.summary_progress) return massState.summary_progress as MassSummary;
    return null;
  }, [massSummary, massState]);

  // ── Effects ──────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        setCoursesLoading(true);
        const data = await fetchCourses();
        setCourses(data);
        sharedState.courses = data;
      } catch (err) {
        console.error(err);
        setBanner({ text: 'Error cargando cursos', type: 'error' });
      } finally {
        setCoursesLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await loadConfig();
        setGroupConfigs(config.groupConfigs || {});
        setToponConfigs(config.toponesConfigs || {});
        sharedState.groupConfigs = config.groupConfigs || {};
        sharedState.toponConfigs = config.toponesConfigs || {};
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (tab !== 'config') return;
    if (bachSchedules.length > 0) return;
    fetchBachSchedules()
      .then(data => { setBachSchedules(data); sharedState.bachSchedules = data; })
      .catch(err => {
        console.error(err);
        setBanner({ text: 'No se pudieron cargar los horarios BACH1121', type: 'error' });
      });
  }, [tab, bachSchedules.length]);

  useEffect(() => {
    if (tab !== 'datos' || excelData.length > 0 || excelLoading) return;
    (async () => {
      try {
        setExcelLoading(true);
        const rows = await fetchExcelData();
        setExcelData(rows);
        sharedState.excelData = rows;
      } catch (err) {
        console.error(err);
        setBanner({ text: 'Error cargando datos del Excel', type: 'error' });
      } finally {
        setExcelLoading(false);
      }
    })();
  }, [tab, excelData.length, excelLoading]);

  // No cargar reportes previos al montar: se muestra el estado vacío hasta que el usuario ejecute una nueva generación.

  // ── Handlers ─────────────────────────────────────────

  const showBanner = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setBanner({ text, type });
    setTimeout(() => setBanner(null), 3200);
  };

  const uploadAlumnosFile = async (file: File) => {
    try {
      const res = await uploadAlumnos(file);
      showBanner(res?.message || 'Excel de alumnos actualizado', 'success');
    } catch (err: any) {
      console.error(err);
      showBanner(err?.message || 'Error subiendo alumnos', 'error');
      throw err;
    }
  };

  const uploadCursosFile = async (file: File) => {
    try {
      const res = await uploadCursosDisponibles(file);
      const suffix = res?.rows ? ` (${res.rows} filas, ${res.unique_courses ?? 0} cursos)` : '';
      showBanner((res?.message || 'cursos_disponibles.xlsx actualizado') + suffix, 'success');
    } catch (err: any) {
      console.error(err);
      showBanner(err?.message || 'Error subiendo cursos_disponibles.xlsx', 'error');
      throw err;
    }
  };

  const replaceConsolidado = async (file: File) => {
    try {
      setExcelLoading(true);
      await importExcel(file);
      const rows = await fetchExcelData();
      setExcelData(rows);
      sharedState.excelData = rows;
      showBanner('consolidado.xlsx reemplazado', 'success');
    } catch (err: any) {
      console.error(err);
      showBanner(err?.message || 'Error reemplazando consolidado', 'error');
      throw err;
    } finally {
      setExcelLoading(false);
    }
  };

  const addCourse = (course: Course) => {
    if (selectedCourses.length >= 6) { showBanner('Máximo 6 cursos permitidos', 'error'); return; }
    if (selectedCourses.find(c => c.code === course.asig_codigo)) { showBanner('Este curso ya está seleccionado', 'info'); return; }
    setSelectedCourses(prev => {
      const next = [...prev, { code: course.asig_codigo, name: course.asig_nombre }];
      sharedState.selectedCourses = next;
      return next;
    });
  };

  const removeCourse = (code: string) => {
    setSelectedCourses(prev => {
      const next = prev.filter(c => c.code !== code);
      sharedState.selectedCourses = next;
      return next;
    });
  };

  const generate = async () => {
    if (selectedCourses.length === 0) return;
    try {
      setGenerating(true);
      const { schedules: generated, message } = await generateSchedules({
        courses: selectedCourses.map(c => c.code), groupConfigs, validTopones: toponConfigs
      });
      setSchedules(generated || []); setScheduleIndex(0); setScheduleMessage(message || '');
      sharedState.schedules = generated || [];
      sharedState.scheduleIndex = 0;
      sharedState.scheduleMessage = message || '';
      if (generated && generated.length > 0) showBanner('Horario generado', 'success');
      if (!generated || generated.length === 0) showBanner('No se encontraron combinaciones de horarios', 'info');
    } catch (err: any) {
      console.error(err); showBanner('Error al generar horarios', 'error');
    } finally { setGenerating(false); }
  };

  const addGroupConfig = () => {
    if (!configCourse) return showBanner('Selecciona un curso', 'info');
    if (!configSection) return showBanner('Selecciona una sección', 'info');
    if (configGroups.length < 2) return showBanner('Selecciona al menos 2 grupos', 'info');
    const key = `${configCourse}_${configSection}_${configGroups.sort((a, b) => a - b).join('-')}`;
    if (groupConfigs[key]) { showBanner('Esta combinación ya existe', 'info'); return; }
    const entry: GroupConfig = {
      course: configCourse, section: Number(configSection),
      groups: [...configGroups].sort((a, b) => a - b),
      display: `${configCourse} Sec ${configSection} Grupos ${configGroups.join('+')}`
    };
    setGroupConfigs(prev => {
      const next = { ...prev, [key]: entry };
      sharedState.groupConfigs = next;
      return next;
    });
    setConfigCourse(''); setConfigSection(''); setConfigGroups([]);
    showBanner('Configuración agregada', 'success');
  };

  const removeGroupConfig = (key: string) => {
    setGroupConfigs(prev => {
      const copy = { ...prev }; delete copy[key]; sharedState.groupConfigs = copy; return copy;
    });
  };

  const addToponConfig = () => {
    if (!toponSelected) return showBanner('Selecciona un horario', 'info');
    const horario = bachSchedules.find(h => h.id === toponSelected);
    if (!horario) return;
    if (toponConfigs[horario.id]) { showBanner('Ya existe este topón', 'info'); return; }
    const entry: ToponConfig = { ...horario, display: horario.display };
    setToponConfigs(prev => {
      const next = { ...prev, [horario.id]: entry };
      sharedState.toponConfigs = next;
      return next;
    });
    setToponSelected(''); showBanner('Topón agregado', 'success');
  };

  const removeToponConfig = (key: string) => {
    setToponConfigs(prev => { const copy = { ...prev }; delete copy[key]; sharedState.toponConfigs = copy; return copy; });
  };

  const saveConfigHandler = async () => {
    try {
      setSavingConfig(true);
      await saveConfig({ groupConfigs, toponesConfigs: toponConfigs });
      showBanner('Configuración guardada', 'success');
    } catch (err) {
      console.error(err); showBanner('Error al guardar configuración', 'error');
    } finally { setSavingConfig(false); }
  };

  const onCourseChange = async (code: string) => {
    setConfigCourse(code); setConfigSection(''); setConfigGroups([]);
    if (!code) return;
    if (courseStructures[code]) return;
    try {
      const struct = await fetchCourseStructure(code);
      setCourseStructures(prev => {
        const next = { ...prev, [code]: struct };
        sharedState.courseStructures = next;
        return next;
      });
    } catch (err) { console.error(err); showBanner('Error cargando secciones', 'error'); }
  };

  const updateExcelCell = (index: number, field: keyof ExcelRow, value: any) => {
    setExcelData(prev => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
  };

  const addExcelRow = () => {
    setExcelData(prev => {
      const next = [...prev, {
      sare_anho: 2024, sare_semestre: 1, asig_codigo: '', asig_nombre: '',
      psec_codigo: 1, pgru_codigo: 1, sdia_descripcion: 'Lunes',
      sper_hora_ini: '08:00', sper_hora_fin: '09:00', camp_campus: ''
      }];
      sharedState.excelData = next;
      return next;
    });
  };

  const deleteExcelRow = (index: number) => {
    setExcelData(prev => {
      const next = prev.filter((_, idx) => idx !== index);
      sharedState.excelData = next;
      return next;
    });
  };

  const saveExcel = async () => {
    try {
      setExcelSaving(true);
      await saveExcelData(excelData);
      showBanner('Datos guardados en consolidado.xlsx', 'success');
    } catch (err) { console.error(err); showBanner('Error guardando datos', 'error'); }
    finally { setExcelSaving(false); }
  };

  const handleImport = async (file: File) => {
    try {
      await importExcel(file);
      const rows = await fetchExcelData();
      setExcelData(rows);
      sharedState.excelData = rows;
      showBanner('Archivo importado correctamente', 'success');
    } catch (err) { console.error(err); showBanner('Error importando Excel', 'error'); }
  };

  // ── Mass handlers ────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollerRef.current) { clearInterval(pollerRef.current); pollerRef.current = null; }
  }, []);

  const pollMassiveState = async () => {
    try {
      const data = await pollMassive();
      const state = data.state || {};
      const phase = state.phase || '';
      let stateLabel = state.running ? 'Procesando...' : state.error ? 'Error' : 'Listo';
      if (phase === 'ajustando') stateLabel = 'Calculando sobre cupos';
      if (phase === 'generando') stateLabel = 'Procesando...';
      if (phase === 'recalculando') stateLabel = 'Recalculando cupos';
      if (phase === 'completado') stateLabel = 'Completado';
      const normalized = { ...state, remaining: state.remaining ?? Math.max((state.total || 0) - (state.current || 0), 0), stateLabel };
      setMassState(normalized);
      sharedState.massState = normalized;
      if (state.error) { stopPolling(); setMassLoading(false); showBanner(`Error en carga masiva: ${state.error}`, 'error'); }
      if (state.done) {
        stopPolling(); setMassLoading(false);
        const summary = state.summary || null;
        const results = state.results || [];
        const capStats = state.capacity_stats || null;
        setMassSummary(summary); setMassResults(results);
        setCapacityReport(state.capacity_report || null); setCapacityStats(capStats);
        setMassFiltered(null);
        setMassHasRun(Boolean(summary));
        sharedState.massSummary = summary;
        sharedState.massResults = results;
        sharedState.capacityStats = capStats;
        sharedState.massFiltered = null;
        const rebalanced = state.rebalanced_count || 0;
        showBanner(rebalanced > 0 ? `Reajustados ${rebalanced} alumnos` : 'Carga masiva completada', 'success');
      }
    } catch (err) { console.error(err); }
  };

  const startPolling = () => {
    stopPolling(); pollMassiveState();
    pollerRef.current = setInterval(pollMassiveState, 900);
  };

  const runMassive = async (file?: File) => {
    try {
      setMassLoading(true); setMassRebalancing(false); setMassSummary(null); setMassResults([]);
      setCapacityReport(null); setCapacityStats(null); setMassFiltered(null); setMassState(null);
      setMassHasRun(false);
      sharedState.massSummary = null;
      sharedState.massResults = [];
      sharedState.capacityStats = null;
      sharedState.massFiltered = null;
      const resp = await runMassiveGeneration(file);
      if (!resp.success) throw new Error('No se pudo iniciar la carga masiva');
      setMassHasRun(true);
      startPolling();
    } catch (err: any) {
      console.error(err); setMassLoading(false); setMassHasRun(false); showBanner(err.message || 'Error en carga masiva', 'error');
    }
  };

  const rebalanceOvercapacity = async () => {
    try {
      setMassRebalancing(true);
      setMassHasRun(true);
      setMassState({ running: true, phase: 'recalculando', current: 0, total: massTargetCount, current_name: '', remaining: massTargetCount, stateLabel: 'Recalculando cupos' });
      const resp = await rebalanceMassive();
      if (!resp.success) throw new Error((resp as any).error || 'No se pudo recalcular sobrecupo');
      const total = resp.total ?? resp.target_count ?? massTargetCount;
      startPolling();
      if (total) setMassState((prev: any) => ({ ...(prev || {}), running: true, phase: 'recalculando', total, remaining: total, stateLabel: 'Recalculando cupos' }));
    } catch (err: any) {
      console.error(err); showBanner(err.message || 'Error recalculando sobrecupo', 'error'); setMassState(null);
    } finally { setMassRebalancing(false); }
  };

  const applyMassFilters = (text: string, status: string) => {
    setMassFilterText(text); setMassFilterStatus(status);
    const filtered = filterMassResults(massResults, text, status);
    setMassFiltered(filtered);
    sharedState.massFiltered = filtered;
  };

  const selectMassSchedule = (registro?: string) => {
    if (!registro) return;
    const idx = massSchedulesList.findIndex(r => r.registro === registro);
    if (idx >= 0) {
      setMassScheduleIndex(idx);
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      setMassModalPos({ x: vw / 2, y: vh / 2 });
      setMassModalOpen(true);
      const current = massSchedulesList[idx];
      const editCourses = (current.sections || current.courses_detail || []).map(sec => {
        const found = courses.find(c => c.asig_codigo === sec.course);
        return { code: sec.course, name: found?.asig_nombre || sec.name };
      });
      setMassEditCourses(editCourses);
      setMassEditSchedules([]); setMassEditScheduleIndex(0); setMassEditMessage(''); setMassEditDirty(false); setMassEditPanelOpen(false);
    }
  };

  const massSchedule = massSchedulesList[massScheduleIndex];
  const massModalSchedule = massEditSchedules[massEditScheduleIndex] || (massSchedule
    ? { ...massSchedule, blocks: massSchedule.blocks || [], sections: massSchedule.sections || massSchedule.courses_detail || [] }
    : undefined);

  const recomputeMassSummary = (results: MassResult[]): MassSummary => {
    const total = results.length;
    const valid = results.filter(r => r.status === 'con_horario').length;
    // Solo contar topón válido si el horario es válido y no tiene conflictos
    const topon = results.filter(r => r.has_valid_topones && r.status === 'con_horario' && !r.has_conflicts).length;
    return { total_alumnos: total, con_horario: valid, sin_horario: total - valid, con_topon_valido: topon };
  };

  const filterMassResults = (list: MassResult[], text: string, status: string) => {
    const q = (text || '').toLowerCase();
    if (!q && !status) return null;
    return list.filter(r => {
      const matchText = !q || (r.nombre && r.nombre.toLowerCase().includes(q)) || (r.rut && r.rut.toLowerCase().includes(q)) || (r.registro && r.registro.toLowerCase().includes(q));
      const matchStatus = (() => {
        if (!status) return true;
        if (status === 'topon_valido') return r.status === 'con_horario' && Boolean(r.has_valid_topones);
        return r.status === status;
      })();
      return matchText && matchStatus;
    });
  };

  // ── Drag ─────────────────────────────────────────────

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!draggingRef.current) return;
    setMassModalPos({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y });
  }, []);

  const stopDrag = useCallback(() => {
    draggingRef.current = false;
    if (typeof document !== 'undefined') { document.removeEventListener('mousemove', handleDrag); document.removeEventListener('mouseup', stopDrag); }
  }, [handleDrag]);

  const startDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); draggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - massModalPos.x, y: e.clientY - massModalPos.y };
    if (typeof document !== 'undefined') { document.addEventListener('mousemove', handleDrag); document.addEventListener('mouseup', stopDrag); }
  }, [handleDrag, stopDrag, massModalPos]);

  useEffect(() => {
    return () => { stopPolling(); stopDrag(); };
  }, [stopPolling, stopDrag]);

  const massRecalc = async () => {
    if (!massSchedule) return;
    const codes = massEditCourses.map(c => c.code).filter(Boolean);
    if (codes.length === 0) { setMassEditMessage('Selecciona al menos un curso'); return; }
    try {
      setMassEditMessage('');
      const { schedules: generated, message } = await generateSchedules({ courses: codes, groupConfigs, validTopones: toponConfigs });
      setMassEditSchedules(generated || []); setMassEditScheduleIndex(0);
      setMassEditMessage(message || (generated && generated.length > 0 ? 'Horario recalculado' : 'Sin combinaciones válidas'));
      setMassEditDirty(true);
    } catch (err: any) { console.error(err); setMassEditMessage(err.message || 'Error recalculando horario'); }
  };

  const massSave = async () => {
    if (!massSchedule || !massModalSchedule) return;
    try {
      setMassEditSaving(true);
      await saveMassStudentSchedule({
        registro: massSchedule.registro || '', rut: massSchedule.rut, nombre: massSchedule.nombre,
        courses: massEditCourses.map(c => c.code), schedule: massModalSchedule
      });
      setMassResults(prev => {
        const updated = prev.map(r => {
          if (r.registro !== massSchedule.registro) return r;
          // Determinar status basado en si tiene conflictos reales
          const newStatus = massModalSchedule.has_conflicts ? 'no_valido' as const : 'con_horario' as const;
          return {
            ...r, status: newStatus, blocks: massModalSchedule.blocks, sections: massModalSchedule.sections,
            courses_detail: massModalSchedule.sections, cursos: massEditCourses.map(c => c.code),
            has_valid_topones: massModalSchedule.has_valid_topones, valid_topones: massModalSchedule.valid_topones,
            valid_topon_types: massModalSchedule.valid_topon_types, has_conflicts: massModalSchedule.has_conflicts,
            conflict_types: massModalSchedule.conflict_types, conflicts: massModalSchedule.conflicts
          };
        });
        const summary = recomputeMassSummary(updated);
        const filtered = filterMassResults(updated, massFilterText, massFilterStatus);
        setMassSummary(summary);
        setMassFiltered(filtered);
        sharedState.massSummary = summary;
        sharedState.massResults = updated;
        sharedState.massFiltered = filtered;
        return updated;
      });
      setMassEditDirty(false);
      showBanner('Horario guardado', 'success');
    } catch (err: any) {
      console.error(err); showBanner(err.message || 'Error guardando horario', 'error');
    } finally { setMassEditSaving(false); }
  };

  // ── Render ───────────────────────────────────────────

  return (
    <>
      <AppHeader tab={tab} onTabChange={handleTabChange} />

      <main className="min-h-screen p-3 sm:p-4 md:p-8 bg-slate-950 pt-6">
        <div className="w-full max-w-screen-2xl xl:max-w-[95vw] mx-auto space-y-6">
          <Banner banner={banner} />

          {tab === 'carga' && (
            <CargaMasivaTab
              massLoading={massLoading}
              massSummary={massSummary}
              liveSummary={liveSummary}
              massHasRun={massHasRun}
              massResults={massResults}
              massFiltered={massFiltered}
              massState={massState}
              massFilterText={massFilterText}
              massFilterStatus={massFilterStatus}
              capacityReport={capacityReport}
              capacityStats={capacityStats}
              overCapacitySort={overCapacitySort}
              mostEmptySort={mostEmptySort}
              sortedOverCapacity={sortedOverCapacity}
              sortedMostEmpty={sortedMostEmpty}
              massRebalancing={massRebalancing}
              setOverCapacitySort={setOverCapacitySort}
              setMostEmptySort={setMostEmptySort}
              runMassive={runMassive}
              rebalanceOvercapacity={rebalanceOvercapacity}
              applyMassFilters={applyMassFilters}
              selectMassSchedule={selectMassSchedule}
              showBanner={showBanner}
            />
          )}

          {tab === 'horarios' && (
            <HorariosTab
              courses={courses}
              coursesLoading={coursesLoading}
              search={search}
              setSearch={setSearch}
              displayedCourses={displayedCourses}
              selectedCourses={selectedCourses}
              addCourse={addCourse}
              removeCourse={removeCourse}
              generate={generate}
              generating={generating}
              schedules={schedules}
              scheduleIndex={scheduleIndex}
              setScheduleIndex={setScheduleIndex}
              scheduleMessage={scheduleMessage}
            />
          )}

          {tab === 'config' && (
            <ConfigTab
              courses={courses}
              groupConfigs={groupConfigs}
              toponConfigs={toponConfigs}
              bachSchedules={bachSchedules}
              configCourse={configCourse}
              configSection={configSection}
              configGroups={configGroups}
              toponSelected={toponSelected}
              savingConfig={savingConfig}
              courseStructures={courseStructures}
              onCourseChange={onCourseChange}
              setConfigSection={setConfigSection}
              setConfigGroups={setConfigGroups}
              setToponSelected={setToponSelected}
              addGroupConfig={addGroupConfig}
              removeGroupConfig={removeGroupConfig}
              addToponConfig={addToponConfig}
              removeToponConfig={removeToponConfig}
              saveConfigHandler={saveConfigHandler}
              uploadAlumnos={uploadAlumnosFile}
              replaceConsolidado={replaceConsolidado}
              uploadCursosDisponibles={uploadCursosFile}
            />
          )}

          {tab === 'datos' && (
            <DatosTab
              excelData={excelData}
              excelLoading={excelLoading}
              excelSaving={excelSaving}
              updateExcelCell={updateExcelCell}
              addExcelRow={addExcelRow}
              deleteExcelRow={deleteExcelRow}
              saveExcel={saveExcel}
              handleImport={handleImport}
              showBanner={showBanner}
            />
          )}
        </div>
      </main>

      {massModalOpen && massSchedule && (
        <MassModal
          massSchedule={massSchedule}
          massScheduleIndex={massScheduleIndex}
          setMassScheduleIndex={setMassScheduleIndex}
          massSchedulesList={massSchedulesList}
          massModalPos={massModalPos}
          massModalSchedule={massModalSchedule}
          massEditCourses={massEditCourses}
          setMassEditCourses={setMassEditCourses}
          massEditSchedules={massEditSchedules}
          massEditScheduleIndex={massEditScheduleIndex}
          setMassEditScheduleIndex={setMassEditScheduleIndex}
          massEditMessage={massEditMessage}
          setMassEditMessage={setMassEditMessage}
          massEditPanelOpen={massEditPanelOpen}
          setMassEditPanelOpen={setMassEditPanelOpen}
          massEditSaving={massEditSaving}
          massEditDirty={massEditDirty}
          setMassEditDirty={setMassEditDirty}
          setMassEditSchedules={setMassEditSchedules}
          massRecalc={massRecalc}
          massSave={massSave}
          startDrag={startDrag}
          stopDrag={stopDrag}
          onClose={() => setMassModalOpen(false)}
          courses={courses}
          displayedCourses={displayedCourses}
          search={search}
          setSearch={setSearch}
        />
      )}

      <AppFooter />
    </>
  );
}
