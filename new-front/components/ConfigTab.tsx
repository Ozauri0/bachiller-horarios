'use client';

import { Course, CourseStructure, GroupConfigMap, ToponConfigMap, BachSchedule } from '@/lib/types';

interface ConfigTabProps {
  courses: Course[];
  groupConfigs: GroupConfigMap;
  toponConfigs: ToponConfigMap;
  bachSchedules: BachSchedule[];
  configCourse: string;
  configSection: string;
  configGroups: number[];
  toponSelected: string;
  savingConfig: boolean;
  courseStructures: Record<string, CourseStructure[]>;
  onCourseChange: (code: string) => void;
  setConfigSection: (s: string) => void;
  setConfigGroups: React.Dispatch<React.SetStateAction<number[]>>;
  setToponSelected: (s: string) => void;
  addGroupConfig: () => void;
  removeGroupConfig: (key: string) => void;
  addToponConfig: () => void;
  removeToponConfig: (key: string) => void;
  saveConfigHandler: () => void;
}

export default function ConfigTab({
  courses,
  groupConfigs,
  toponConfigs,
  bachSchedules,
  configCourse,
  configSection,
  configGroups,
  toponSelected,
  savingConfig,
  courseStructures,
  onCourseChange,
  setConfigSection,
  setConfigGroups,
  setToponSelected,
  addGroupConfig,
  removeGroupConfig,
  addToponConfig,
  removeToponConfig,
  saveConfigHandler,
}: ConfigTabProps) {
  const courseStruct = configCourse ? courseStructures[configCourse] || [] : [];
  const availableGroups = courseStruct.find(s => `${s.section}` === configSection)?.groups || [];

  return (
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
  );
}
