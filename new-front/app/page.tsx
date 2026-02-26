'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ScheduleGrid from '@/components/ScheduleGrid';
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
  runMassiveGeneration,
  saveConfig,
  saveExcelData
} from '@/lib/api';

type TabKey = 'horarios' | 'config' | 'datos' | 'carga';

type Banner = { text: string; type?: 'success' | 'error' | 'info' } | null;

type ModalPos = { x: number; y: number };

type DragOffset = { x: number; y: number };

export default function HomePage() {
  const [tab, setTab] = useState<TabKey>('horarios');
  const [banner, setBanner] = useState<Banner>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<CourseOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResult[]>([]);
  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  const [groupConfigs, setGroupConfigs] = useState<GroupConfigMap>({});
  const [toponConfigs, setToponConfigs] = useState<ToponConfigMap>({});
  const [courseStructures, setCourseStructures] = useState<Record<string, CourseStructure[]>>({});
  const [bachSchedules, setBachSchedules] = useState<BachSchedule[]>([]);
  const [configCourse, setConfigCourse] = useState('');
  const [configSection, setConfigSection] = useState('');
  const [configGroups, setConfigGroups] = useState<number[]>([]);
  const [toponSelected, setToponSelected] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelSaving, setExcelSaving] = useState(false);

  const [massLoading, setMassLoading] = useState(false);
  const [massSummary, setMassSummary] = useState<MassSummary | null>(null);
  const [massResults, setMassResults] = useState<MassResult[]>([]);
  const [massFiltered, setMassFiltered] = useState<MassResult[] | null>(null);
  const [massState, setMassState] = useState<any>(null);
  const [massScheduleIndex, setMassScheduleIndex] = useState(0);
  const [massFilterText, setMassFilterText] = useState('');
  const [massFilterStatus, setMassFilterStatus] = useState('');
  const [capacityReport, setCapacityReport] = useState<CapacityEntry[] | null>(null);
  const [capacityStats, setCapacityStats] = useState<CapacityStats | null>(null);
  const [overCapacitySort, setOverCapacitySort] = useState<'remaining_desc' | 'remaining_asc' | 'course_asc'>('remaining_desc');
  const [mostEmptySort, setMostEmptySort] = useState<'remaining_desc' | 'remaining_asc' | 'course_asc'>('remaining_desc');

  const [massModalOpen, setMassModalOpen] = useState(false);
  const [massModalPos, setMassModalPos] = useState<ModalPos>({ x: 32, y: 32 });

  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef<DragOffset>({ x: 0, y: 0 });

  const schedule = schedules[scheduleIndex];

  const displayedCourses = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter(c => c.asig_codigo.toLowerCase().includes(q) || c.asig_nombre.toLowerCase().includes(q));
  }, [courses, search]);

  const massSchedulesList = useMemo(() => {
    return (massFiltered ?? massResults).filter(r => r.status !== 'sin_horario' && r.blocks && r.blocks.length > 0);
  }, [massFiltered, massResults]);

  const sortedOverCapacity = useMemo(() => {
    if (!capacityStats) return [];
    const items = [...(capacityStats.over_capacity || [])];
    return items.sort((a, b) => {
      if (overCapacitySort === 'course_asc') return a.course.localeCompare(b.course);
      if (overCapacitySort === 'remaining_asc') return (a.remaining ?? 0) - (b.remaining ?? 0);
      // default: remaining_desc -> más sobrecupo arriba (más negativo primero)
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

  useEffect(() => {
    const load = async () => {
      try {
        setCoursesLoading(true);
        const data = await fetchCourses();
        setCourses(data);
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
      .then(setBachSchedules)
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
      } catch (err) {
        console.error(err);
        setBanner({ text: 'Error cargando datos del Excel', type: 'error' });
      } finally {
        setExcelLoading(false);
      }
    })();
  }, [tab, excelData.length, excelLoading]);

  useEffect(() => {
    return () => {
      stopPolling();
      stopDrag();
    };
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const report = await fetchMassReport();
        if (report) {
          setMassSummary(report.summary || null);
          setCapacityReport(report.capacity_report || null);
          setCapacityStats(report.capacity_stats || null);
        }
      } catch (err) {
        console.error('No se pudo cargar reporte previo', err);
      }
    };
    loadReport();
  }, []);

  const showBanner = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setBanner({ text, type });
    setTimeout(() => setBanner(null), 3200);
  };

  const addCourse = (course: Course) => {
    if (selectedCourses.length >= 6) {
      showBanner('Máximo 6 cursos permitidos', 'error');
      return;
    }
    if (selectedCourses.find(c => c.code === course.asig_codigo)) {
      showBanner('Este curso ya está seleccionado', 'info');
      return;
    }
    setSelectedCourses(prev => [...prev, { code: course.asig_codigo, name: course.asig_nombre }]);
  };

  const removeCourse = (code: string) => {
    setSelectedCourses(prev => prev.filter(c => c.code !== code));
  };

  const generate = async () => {
    if (selectedCourses.length === 0) return;
    try {
      setGenerating(true);
      const { schedules: generated, message } = await generateSchedules({
        courses: selectedCourses.map(c => c.code),
        groupConfigs,
        validTopones: toponConfigs
      });
      setSchedules(generated || []);
      setScheduleIndex(0);
      setScheduleMessage(message || '');
      if (generated && generated.length > 0) {
        showBanner('Horario generado', 'success');
      }
      if (!generated || generated.length === 0) {
        showBanner('No se encontraron combinaciones de horarios', 'info');
      }
    } catch (err: any) {
      console.error(err);
      showBanner('Error al generar horarios', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const addGroupConfig = () => {
    if (!configCourse) return showBanner('Selecciona un curso', 'info');
    if (!configSection) return showBanner('Selecciona una sección', 'info');
    if (configGroups.length < 2) return showBanner('Selecciona al menos 2 grupos', 'info');

    const key = `${configCourse}_${configSection}_${configGroups.sort((a, b) => a - b).join('-')}`;
    if (groupConfigs[key]) {
      showBanner('Esta combinación ya existe', 'info');
      return;
    }
    const entry: GroupConfig = {
      course: configCourse,
      section: Number(configSection),
      groups: [...configGroups].sort((a, b) => a - b),
      display: `${configCourse} Sec ${configSection} Grupos ${configGroups.join('+')}`
    };
    setGroupConfigs(prev => ({ ...prev, [key]: entry }));
    setConfigCourse('');
    setConfigSection('');
    setConfigGroups([]);
    showBanner('Configuración agregada', 'success');
  };

  const removeGroupConfig = (key: string) => {
    setGroupConfigs(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const addToponConfig = () => {
    if (!toponSelected) return showBanner('Selecciona un horario', 'info');
    const horario = bachSchedules.find(h => h.id === toponSelected);
    if (!horario) return;
    if (toponConfigs[horario.id]) {
      showBanner('Ya existe este topón', 'info');
      return;
    }
    const entry: ToponConfig = {
      ...horario,
      display: horario.display
    };
    setToponConfigs(prev => ({ ...prev, [horario.id]: entry }));
    setToponSelected('');
    showBanner('Topón agregado', 'success');
  };

  const removeToponConfig = (key: string) => {
    setToponConfigs(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const saveConfigHandler = async () => {
    try {
      setSavingConfig(true);
      await saveConfig({ groupConfigs, toponesConfigs: toponConfigs });
      showBanner('Configuración guardada', 'success');
    } catch (err) {
      console.error(err);
      showBanner('Error al guardar configuración', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const onCourseChange = async (code: string) => {
    setConfigCourse(code);
    setConfigSection('');
    setConfigGroups([]);
    if (!code) return;
    if (courseStructures[code]) return;
    try {
      const struct = await fetchCourseStructure(code);
      setCourseStructures(prev => ({ ...prev, [code]: struct }));
    } catch (err) {
      console.error(err);
      showBanner('Error cargando secciones', 'error');
    }
  };

  const courseStruct = configCourse ? courseStructures[configCourse] || [] : [];
  const availableGroups = courseStruct.find(s => `${s.section}` === configSection)?.groups || [];

  const updateExcelCell = (index: number, field: keyof ExcelRow, value: any) => {
    setExcelData(prev => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
  };

  const addExcelRow = () => {
    setExcelData(prev => [
      ...prev,
      {
        sare_anho: 2024,
        sare_semestre: 1,
        asig_codigo: '',
        asig_nombre: '',
        psec_codigo: 1,
        pgru_codigo: 1,
        sdia_descripcion: 'Lunes',
        sper_hora_ini: '08:00',
        sper_hora_fin: '09:00',
        camp_campus: ''
      }
    ]);
  };

  const deleteExcelRow = (index: number) => {
    setExcelData(prev => prev.filter((_, idx) => idx !== index));
  };

  const saveExcel = async () => {
    try {
      setExcelSaving(true);
      await saveExcelData(excelData);
      showBanner('Datos guardados en consolidado.xlsx', 'success');
    } catch (err) {
      console.error(err);
      showBanner('Error guardando datos', 'error');
    } finally {
      setExcelSaving(false);
    }
  };

  const handleImport = async (file: File) => {
    try {
      await importExcel(file);
      const rows = await fetchExcelData();
      setExcelData(rows);
      showBanner('Archivo importado correctamente', 'success');
    } catch (err) {
      console.error(err);
      showBanner('Error importando Excel', 'error');
    }
  };

  const stopPolling = () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  };

  const pollMassiveState = async () => {
    try {
      const data = await pollMassive();
      const state = data.state || {};
      const phase = state.phase || '';
      let stateLabel = state.running ? 'Procesando...' : state.error ? 'Error' : 'Listo';
      if (phase === 'ajustando') stateLabel = 'Calculando sobre cupos';
      if (phase === 'generando') stateLabel = 'Procesando...';
      if (phase === 'completado') stateLabel = 'Completado';
      const normalized = {
        ...state,
        remaining: state.remaining ?? Math.max((state.total || 0) - (state.current || 0), 0),
        stateLabel
      };
      setMassState(normalized);

      if (state.error) {
        stopPolling();
        setMassLoading(false);
        showBanner(`Error en carga masiva: ${state.error}`, 'error');
      }
      if (state.done) {
        stopPolling();
        setMassLoading(false);
        setMassSummary(state.summary || null);
        setMassResults(state.results || []);
        setCapacityReport(state.capacity_report || null);
        setCapacityStats(state.capacity_stats || null);
        setMassFiltered(null);
        showBanner('Carga masiva completada', 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startPolling = () => {
    stopPolling();
    pollMassiveState();
    pollerRef.current = setInterval(pollMassiveState, 900);
  };

  const runMassive = async (file?: File) => {
    try {
      setMassLoading(true);
      setMassSummary(null);
      setMassResults([]);
      setCapacityReport(null);
      setCapacityStats(null);
      setMassFiltered(null);
      setMassState(null);
      const resp = await runMassiveGeneration(file);
      if (!resp.success) throw new Error('No se pudo iniciar la carga masiva');
      startPolling();
    } catch (err: any) {
      console.error(err);
      setMassLoading(false);
      showBanner(err.message || 'Error en carga masiva', 'error');
    }
  };

  const applyMassFilters = (text: string, status: string) => {
    setMassFilterText(text);
    setMassFilterStatus(status);
    const q = text.toLowerCase();
    if (!q && !status) {
      setMassFiltered(null);
      return;
    }
    const filtered = massResults.filter(r => {
      const matchText = !q ||
        (r.nombre && r.nombre.toLowerCase().includes(q)) ||
        (r.rut && r.rut.toLowerCase().includes(q)) ||
        (r.registro && r.registro.toLowerCase().includes(q));
      const matchStatus = !status || r.status === status;
      return matchText && matchStatus;
    });
    setMassFiltered(filtered);
  };

  const selectMassSchedule = (registro?: string) => {
    if (!registro) return;
    const list = massResults.filter(r => r.status !== 'sin_horario' && r.blocks && r.blocks.length > 0);
    const idx = list.findIndex(r => r.registro === registro);
    if (idx >= 0) {
      setMassScheduleIndex(idx);
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      setMassModalPos({ x: Math.max(24, vw / 2 - 520), y: Math.max(24, vh / 2 - 300) });
      setMassModalOpen(true);
    }
  };

  const massSchedule = massSchedulesList[massScheduleIndex];

  const stopDrag = () => {
    draggingRef.current = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
    }
  };

  const handleDrag = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    setMassModalPos({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y });
  };

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - massModalPos.x, y: e.clientY - massModalPos.y };
    if (typeof document !== 'undefined') {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
    }
  };

  const TabButton = ({ value, label }: { value: TabKey; label: string }) => (
    <button
      onClick={() => setTab(value)}
      className={
        tab === value
          ? 'px-6 py-2 text-sm font-medium rounded-md bg-slate-800 text-white shadow-sm'
          : 'px-6 py-2 text-sm font-medium rounded-md text-slate-400 hover:text-white'
      }
    >
      {label}
    </button>
  );

  const Badge = ({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'rose' | 'amber' }) => {
    const map: Record<string, string> = {
      indigo: 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/30',
      emerald: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
      rose: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
      amber: 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
    };
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[tone]}`}>{children}</span>;
  };

  return (
    <>
      <main className="min-h-screen p-4 md:p-8 bg-slate-950">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="flex flex-col items-center space-y-2">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm0 0v6.5" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Generador de Horarios</h1>
            <p className="text-slate-400 text-sm">Next.js + Tailwind siguiendo el diseño del ejemplo y la lógica actual.</p>
          </header>

          <nav className="flex justify-center">
            <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner gap-1">
              <TabButton value="horarios" label="Horarios" />
              <TabButton value="config" label="Configuración" />
              <TabButton value="datos" label="Datos" />
              <TabButton value="carga" label="Carga Masiva" />
            </div>
          </nav>

          {banner && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
                banner.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : banner.type === 'error'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                    : 'border-slate-700 bg-slate-800/80 text-slate-100'
              }`}
            >
              {banner.text}
            </div>
          )}

          {tab === 'carga' && (
            <section className="space-y-6">
              <div className="glass rounded-2xl p-6 border-l-4 border-l-indigo-500">
                <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 self-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-3">
                    <h2 className="text-xl font-semibold">Carga masiva de horarios</h2>
                    <p className="text-slate-400 text-sm">Sube alumnos.xlsx para calcular el horario óptimo automáticamente.</p>
                    <div className="flex flex-wrap gap-3">
                      <label className="bg-indigo-600 hover:bg-indigo-500 cursor-pointer text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        <span>Subir alumnos.xlsx</span>
                        <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && runMassive(e.target.files[0])} />
                      </label>
                      <button
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                        onClick={() => runMassive()}
                        disabled={massLoading}
                      >
                        {massLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full" />
                            Procesando...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM10 3a1 1 0 011 1v8.586l1.707-1.707a1 1 0 111.414 1.414l-3.5 3.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            <span>Generar para todos</span>
                          </>
                        )}
                      </button>
                      <button
                        className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                        onClick={async () => {
                          try {
                            await downloadMassXlsx();
                          } catch (err: any) {
                            showBanner(err.message || 'Sin resultados para descargar', 'info');
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM10 3a1 1 0 011 1v8.586l1.707-1.707a1 1 0 111.414 1.414l-3.5 3.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        <span>Descargar XLSX</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Procesando</span>
                    <h3 className="text-lg font-medium">{massState?.current_name || '—'}</h3>
                    <p className="text-slate-500 text-xs">{massState ? `${massState.current || 0} de ${massState.total || 0} alumnos • Restantes ${massState.remaining || 0}` : 'Sin ejecución'}</p>
                  </div>
                  <div className="flex items-center space-x-2 text-indigo-400">
                    {massLoading ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : null}
                    <span className="text-sm font-medium">{massState?.stateLabel || (massLoading ? 'Procesando...' : 'Listo')}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-violet-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${massState?.total ? Math.min(Math.round(((massState.current || 0) / massState.total) * 100), 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-4 rounded-xl"><p className="text-slate-400 text-xs font-medium uppercase mb-1">Total Alumnos</p><p className="text-2xl font-bold">{massSummary?.total_alumnos ?? '—'}</p></div>
                <div className="glass p-4 rounded-xl border-b-2 border-emerald-500/50"><p className="text-slate-400 text-xs font-medium uppercase mb-1">Con Horario</p><p className="text-2xl font-bold text-emerald-400">{massSummary?.con_horario ?? '—'}</p></div>
                <div className="glass p-4 rounded-xl border-b-2 border-rose-500/50"><p className="text-slate-400 text-xs font-medium uppercase mb-1">Sin Horario</p><p className="text-2xl font-bold text-rose-400">{massSummary?.sin_horario ?? '—'}</p></div>
                <div className="glass p-4 rounded-xl border-b-2 border-amber-500/50"><p className="text-slate-400 text-xs font-medium uppercase mb-1">Topón Válido</p><p className="text-2xl font-bold text-amber-400">{massSummary?.con_topon_valido ?? '—'}</p></div>
              </div>

              {capacityStats && (
                <div className="glass rounded-2xl p-4 space-y-4 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-xs font-medium uppercase mb-1">Reporte de cupos</p>
                      <h3 className="text-lg font-semibold text-white">Sobrecupo y secciones con más vacantes</h3>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/40 rounded-xl border border-slate-800">
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Con sobrecupo</p>
                        <div className="flex items-center gap-2">
                          <select
                            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1"
                            value={overCapacitySort}
                            onChange={e => setOverCapacitySort(e.target.value as any)}
                          >
                            <option value="remaining_desc">Más sobrecupo primero</option>
                            <option value="remaining_asc">Menos sobrecupo primero</option>
                            <option value="course_asc">Curso (A→Z)</option>
                          </select>
                          <span className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">{capacityStats.over_capacity?.length || 0}</span>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-slate-400">
                            <tr>
                              <th className="px-4 py-2">Curso</th>
                              <th className="px-4 py-2">Sección</th>
                              <th className="px-4 py-2">Capacidad</th>
                              <th className="px-4 py-2">Asignados</th>
                              <th className="px-4 py-2">Restantes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {sortedOverCapacity.length === 0 ? (
                              <tr><td className="px-4 py-3 text-slate-500" colSpan={5}>Sin sobrecupo</td></tr>
                            ) : (
                              sortedOverCapacity.map((c, idx) => (
                                <tr key={`oc-${c.course}-${c.section}-${idx}`} className="bg-rose-500/5">
                                  <td className="px-4 py-2 font-medium text-white">{c.course}</td>
                                  <td className="px-4 py-2 text-slate-200">{c.section}</td>
                                  <td className="px-4 py-2 text-slate-200">{c.capacity}</td>
                                  <td className="px-4 py-2 text-slate-200">{c.assigned}</td>
                                  <td className="px-4 py-2 text-rose-300">{c.remaining}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 rounded-xl border border-slate-800">
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Secciones con más vacantes</p>
                        <div className="flex items-center gap-2">
                          <select
                            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1"
                            value={mostEmptySort}
                            onChange={e => setMostEmptySort(e.target.value as any)}
                          >
                            <option value="remaining_desc">Restantes (↑ vacantes)</option>
                            <option value="remaining_asc">Restantes (↓ vacantes)</option>
                            <option value="course_asc">Curso (A→Z)</option>
                          </select>
                          <span className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">{capacityStats.most_empty?.length || 0}</span>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-slate-400">
                            <tr>
                              <th className="px-4 py-2">Curso</th>
                              <th className="px-4 py-2">Sección</th>
                              <th className="px-4 py-2">Capacidad</th>
                              <th className="px-4 py-2">Asignados</th>
                              <th className="px-4 py-2">Restantes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {sortedMostEmpty.map((c, idx) => (
                              <tr key={`vac-${c.course}-${c.section}-${idx}`}>
                                <td className="px-4 py-2 font-medium text-white">{c.course}</td>
                                <td className="px-4 py-2 text-slate-200">{c.section}</td>
                                <td className="px-4 py-2 text-slate-200">{c.capacity}</td>
                                <td className="px-4 py-2 text-slate-200">{c.assigned}</td>
                                <td className="px-4 py-2 text-emerald-300">{c.remaining}</td>
                              </tr>
                            ))}
                            {sortedMostEmpty.length === 0 && (
                              <tr><td className="px-4 py-3 text-slate-500" colSpan={5}>Sin datos</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    id="massFilterText"
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-slate-800 bg-slate-900 rounded-lg text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Buscar por alumno, RUT o registro..."
                    value={massFilterText}
                    onChange={e => applyMassFilters(e.target.value, massFilterStatus)}
                  />
                </div>
                <select
                  id="massFilterStatus"
                  className="bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-48 p-2.5"
                  value={massFilterStatus}
                  onChange={e => applyMassFilters(massFilterText, e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="con_horario">Con horario</option>
                  <option value="no_valido">No válido</option>
                  <option value="sin_horario">Sin horario</option>
                </select>
              </div>

              <div className="glass rounded-2xl overflow-hidden overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Registro</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase">RUT</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Nombre</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Cursos</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Estado</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase text-center">Acciones</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(massFiltered ?? massResults).length === 0 ? (
                      <tr><td className="px-6 py-4 text-sm text-slate-300" colSpan={7}>Sin resultados</td></tr>
                    ) : (
                      (massFiltered ?? massResults).map(r => {
                        const isCritical = (r as any).over_capacity || r.has_conflicts;
                        const statusBadge = isCritical
                          ? <Badge tone="rose">Conflicto</Badge>
                          : r.status === 'con_horario'
                            ? <Badge tone="emerald">Generado</Badge>
                            : r.status === 'no_valido'
                              ? <Badge tone="amber">No válido</Badge>
                              : <Badge tone="rose">Sin horario</Badge>;
                        const hasSchedule = r.status === 'con_horario' && r.blocks && r.blocks.length > 0;
                        return (
                          <tr key={r.registro} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-300">{r.registro}</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{r.rut}</td>
                            <td className="px-6 py-4 text-sm font-medium text-white">{r.nombre}</td>
                            <td className="px-6 py-4 text-sm text-slate-300">{(r.cursos || []).join(', ')}</td>
                            <td className="px-6 py-4">{statusBadge}</td>
                            <td className="px-6 py-4 text-center">
                              {hasSchedule ? (
                                <button onClick={() => selectMassSchedule(r.registro)} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Ver horario</button>
                              ) : (
                                <span className="text-slate-600 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-300">{r.message || '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {massSchedule && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between glass rounded-2xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-500 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Horario generado</h2>
                        <p className="text-slate-400 text-xs">Alumno: {massSchedule.nombre || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={massScheduleIndex === 0} onClick={() => setMassScheduleIndex(i => Math.max(i - 1, 0))}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="text-sm font-medium px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">{massScheduleIndex + 1} / {massSchedulesList.length}</span>
                      <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={massScheduleIndex >= massSchedulesList.length - 1} onClick={() => setMassScheduleIndex(i => Math.min(i + 1, massSchedulesList.length - 1))}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                  <ScheduleGrid
                    schedule={{
                      ...massSchedule,
                      has_conflicts: massSchedule.has_conflicts,
                      conflict_types: massSchedule.conflict_types,
                      conflicts: massSchedule.conflicts,
                      has_valid_topones: massSchedule.has_valid_topones,
                      valid_topones: massSchedule.valid_topones,
                      valid_topon_types: massSchedule.valid_topon_types,
                      blocks: massSchedule.blocks || [],
                      sections: massSchedule.sections || massSchedule.courses_detail || []
                    }}
                    courses={(massSchedule.sections || []).map(s => ({ code: s.course }))}
                    header={<div className="flex flex-wrap gap-2">{(massSchedule.courses_detail || massSchedule.sections || []).map((c, idx) => <Badge key={`${c.course}-${idx}`} tone="indigo">{c.course} • Sec {c.section} Grp {c.group}</Badge>)}</div>}
                  />
                </div>
              )}
            </section>
          )}

          {tab === 'horarios' && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-4 space-y-3 lg:col-span-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold">Cursos Disponibles</h2>
                      <p className="text-slate-400 text-sm">Busca por sigla o nombre</p>
                    </div>
                    {coursesLoading && <span className="text-xs text-slate-400">Cargando...</span>}
                  </div>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar curso..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <div className="grid md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
                    {displayedCourses.map(course => {
                      const selected = selectedCourses.some(c => c.code === course.asig_codigo);
                      return (
                        <div key={course.asig_codigo} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${selected ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                          <div>
                            <p className="font-semibold text-sm text-white">{course.asig_codigo}</p>
                            <p className="text-xs text-slate-400">{course.asig_nombre}</p>
                          </div>
                          <button
                            className="text-xs font-semibold px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
                            onClick={() => addCourse(course)}
                            disabled={selected}
                          >
                            {selected ? 'Agregado' : 'Agregar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="glass rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Cursos Seleccionados</h3>
                      <span className="text-sm text-slate-400">{selectedCourses.length}/6</span>
                    </div>
                    {selectedCourses.length === 0 ? (
                      <p className="text-slate-500 text-sm">No hay cursos seleccionados</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedCourses.map(course => (
                          <div key={course.code} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold">{course.code}</p>
                              <p className="text-xs text-slate-400">{course.name}</p>
                            </div>
                            <button className="text-xs text-rose-300 hover:text-rose-200" onClick={() => removeCourse(course.code)}>Quitar</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      onClick={generate}
                      disabled={selectedCourses.length === 0 || generating}
                    >
                      {generating && <span className="animate-spin h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full" />}
                      Generar horarios
                    </button>
                    {scheduleMessage && <p className="text-xs text-slate-400">{scheduleMessage}</p>}
                  </div>
                </div>
              </div>

              {schedule && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between glass rounded-2xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-500 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Horario generado</h2>
                        <p className="text-slate-400 text-xs">Alumno actual</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={scheduleIndex === 0} onClick={() => setScheduleIndex(i => Math.max(i - 1, 0))}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="text-sm font-medium px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">{scheduleIndex + 1} / {schedules.length}</span>
                      <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={scheduleIndex >= schedules.length - 1} onClick={() => setScheduleIndex(i => Math.min(i + 1, schedules.length - 1))}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                  <ScheduleGrid schedule={schedule} courses={selectedCourses} />
                </div>
              )}
            </section>
          )}

          {tab === 'config' && (
            <section className="grid lg:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Configuración de Grupos Obligatorios</h2>
                  <p className="text-sm text-slate-400">Algunos cursos requieren estar inscritos en múltiples grupos simultáneamente.</p>
                </div>
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Curso</label>
                      <select value={configCourse} onChange={e => onCourseChange(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                        <option value="">Selecciona un curso...</option>
                        {courses.map(c => (
                          <option key={c.asig_codigo} value={c.asig_codigo}>{c.asig_codigo} - {c.asig_nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Sección</label>
                      <select value={configSection} onChange={e => setConfigSection(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                        <option value="">Selecciona...</option>
                        {courseStruct.map(sec => (
                          <option key={sec.section} value={sec.section}>Sección {sec.section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Grupos obligatorios</label>
                    <div className="flex flex-wrap gap-2">
                      {availableGroups.length === 0 && <span className="text-sm text-slate-500">Selecciona curso y sección</span>}
                      {availableGroups.map(g => {
                        const active = configGroups.includes(g);
                        return (
                          <button key={g} onClick={() => setConfigGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} className={`px-3 py-1 rounded-md border text-sm ${active ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-900 text-slate-200 border-slate-700'}`}>
                            Grupo {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold" onClick={addGroupConfig}>Agregar</button>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Cursos Configurados</h3>
                  {Object.keys(groupConfigs).length === 0 ? (
                    <p className="text-sm text-slate-500">No hay configuraciones</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                      {Object.entries(groupConfigs).map(([key, cfg]) => (
                        <div key={key} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
                          <div className="text-sm">
                            <p className="font-semibold">{cfg.course} • Sec {cfg.section}</p>
                            <p className="text-slate-400 text-xs">Grupos: {cfg.groups.join(', ')}</p>
                          </div>
                          <button className="text-xs text-rose-300" onClick={() => removeGroupConfig(key)}>Eliminar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={saveConfigHandler} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" disabled={savingConfig}>
                  {savingConfig ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>

              <div className="glass rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Topones válidos (BACH1121)</h2>
                  <p className="text-sm text-slate-400">Selecciona horarios de BACH1121 que permiten topones con otros cursos.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400">Horario</label>
                    <select value={toponSelected} onChange={e => setToponSelected(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="">Selecciona un horario...</option>
                      {bachSchedules.map(h => (
                        <option key={h.id} value={h.id}>{h.display}</option>
                      ))}
                    </select>
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold" onClick={addToponConfig}>Agregar topón</button>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Topones configurados</h3>
                  {Object.keys(toponConfigs).length === 0 ? (
                    <p className="text-sm text-slate-500">No hay topones configurados</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                      {Object.entries(toponConfigs).map(([key, cfg]) => (
                        <div key={key} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
                          <div className="text-sm">
                            <p className="font-semibold">BACH1121 • Sec {cfg.section} • Grp {cfg.group}</p>
                            <p className="text-slate-400 text-xs">{cfg.dia} {cfg.hora_ini} - {cfg.hora_fin} ({cfg.tapon_type})</p>
                          </div>
                          <button className="text-xs text-rose-300" onClick={() => removeToponConfig(key)}>Eliminar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={saveConfigHandler} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" disabled={savingConfig}>
                  {savingConfig ? 'Guardando...' : 'Guardar topones'}
                </button>
              </div>
            </section>
          )}

          {tab === 'datos' && (
            <section className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold" onClick={() => exportExcel().catch(err => showBanner(err.message || 'Error exportando', 'error'))}>Exportar Excel</button>
                <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer">
                  Importar Excel
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
                </label>
                <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onClick={addExcelRow}>Agregar Registro</button>
                <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" disabled={excelSaving} onClick={saveExcel}>{excelSaving ? 'Guardando...' : 'Guardar Cambios'}</button>
                {excelLoading && <span className="text-xs text-slate-400">Cargando datos...</span>}
              </div>
              <div className="glass rounded-2xl overflow-hidden overflow-x-auto scrollbar-thin">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/80 border-b border-slate-800 text-xs text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Año</th>
                      <th className="px-3 py-2">Semestre</th>
                      <th className="px-3 py-2">Sigla</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Sección</th>
                      <th className="px-3 py-2">Grupo</th>
                      <th className="px-3 py-2">Día</th>
                      <th className="px-3 py-2">Hora Inicio</th>
                      <th className="px-3 py-2">Hora Fin</th>
                      <th className="px-3 py-2">Campus</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {excelData.length === 0 ? (
                      <tr><td colSpan={11} className="px-3 py-4 text-center text-slate-400">{excelLoading ? 'Cargando...' : 'Sin datos'}</td></tr>
                    ) : (
                      excelData.map((row, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="px-3 py-2"><input type="number" value={row.sare_anho ?? ''} onChange={e => updateExcelCell(idx, 'sare_anho', Number(e.target.value))} className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="number" value={row.sare_semestre ?? ''} onChange={e => updateExcelCell(idx, 'sare_semestre', Number(e.target.value))} className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="text" value={row.asig_codigo ?? ''} onChange={e => updateExcelCell(idx, 'asig_codigo', e.target.value)} className="w-28 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="text" value={row.asig_nombre ?? ''} onChange={e => updateExcelCell(idx, 'asig_nombre', e.target.value)} className="w-56 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="number" value={row.psec_codigo ?? ''} onChange={e => updateExcelCell(idx, 'psec_codigo', Number(e.target.value))} className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="number" value={row.pgru_codigo ?? ''} onChange={e => updateExcelCell(idx, 'pgru_codigo', Number(e.target.value))} className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2">
                            <select value={row.sdia_descripcion ?? 'Lunes'} onChange={e => updateExcelCell(idx, 'sdia_descripcion', e.target.value)} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm">
                              {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'].map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2"><input type="time" value={row.sper_hora_ini ?? ''} onChange={e => updateExcelCell(idx, 'sper_hora_ini', e.target.value)} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="time" value={row.sper_hora_fin ?? ''} onChange={e => updateExcelCell(idx, 'sper_hora_fin', e.target.value)} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><input type="text" value={row.camp_campus ?? ''} onChange={e => updateExcelCell(idx, 'camp_campus', e.target.value)} className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm" /></td>
                          <td className="px-3 py-2"><button className="text-rose-300 text-xs" onClick={() => deleteExcelRow(idx)}>Eliminar</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>

      {massModalOpen && massSchedule && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => { stopDrag(); setMassModalOpen(false); }} />
          <div
            className="absolute w-[min(1100px,calc(100%-32px))] max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl"
            style={{ left: massModalPos.x, top: massModalPos.y }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-slate-800 cursor-move select-none"
              onMouseDown={startDrag}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Alumno</p>
                  <h2 className="text-lg font-semibold text-white">{massSchedule.nombre || '—'}</h2>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={massScheduleIndex === 0} onClick={() => setMassScheduleIndex(i => Math.max(i - 1, 0))}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-sm font-medium px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">{massScheduleIndex + 1} / {massSchedulesList.length}</span>
                <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={massScheduleIndex >= massSchedulesList.length - 1} onClick={() => setMassScheduleIndex(i => Math.min(i + 1, massSchedulesList.length - 1))}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" onClick={() => { stopDrag(); setMassModalOpen(false); }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(90vh-64px)]">
              <ScheduleGrid
                schedule={{
                  ...massSchedule,
                  has_conflicts: massSchedule.has_conflicts,
                  conflict_types: massSchedule.conflict_types,
                  conflicts: massSchedule.conflicts,
                  has_valid_topones: massSchedule.has_valid_topones,
                  valid_topones: massSchedule.valid_topones,
                  valid_topon_types: massSchedule.valid_topon_types,
                  blocks: massSchedule.blocks || [],
                  sections: massSchedule.sections || massSchedule.courses_detail || []
                }}
                courses={(massSchedule.sections || []).map(s => ({ code: s.course }))}
                header={<div className="flex flex-wrap gap-2">{(massSchedule.courses_detail || massSchedule.sections || []).map((c, idx) => <Badge key={`${c.course}-${idx}`} tone="indigo">{c.course} • Sec {c.section} Grp {c.group}</Badge>)}</div>}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
