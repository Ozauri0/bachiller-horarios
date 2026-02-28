'use client';

import React, { useState } from 'react';
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
  uploadAlumnos: (file: File) => Promise<void>;
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
  uploadAlumnos,
}: ConfigTabProps) {
  const [alumnosFile, setAlumnosFile] = useState<File | null>(null);
  const [uploadingAlumnos, setUploadingAlumnos] = useState(false);

  const courseStruct = configCourse ? courseStructures[configCourse] || [] : [];
  const availableGroups = courseStruct.find(s => `${s.section}` === configSection)?.groups || [];

  const handleUploadAlumnos = async () => {
    if (!alumnosFile) return;
    try {
      setUploadingAlumnos(true);
      await uploadAlumnos(alumnosFile);
      setAlumnosFile(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAlumnos(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Excel alumnos - prioridad arriba */}
      <div className="glass rounded-2xl p-4 md:p-5 border border-slate-800/60">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-[11px] font-bold uppercase tracking-wider w-fit">
              alumnos.xlsx
            </div>
            <h2 className="text-xl font-semibold text-white">Excel de alumnos</h2>
            <p className="text-sm text-slate-400">Sube el archivo alumnos.xlsx que usa el servidor; cada subida reemplaza la anterior.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto md:items-end">
            <label className="flex-1 min-w-[240px]">
              <span className="text-xs text-slate-400">Archivo</span>
              <div className="mt-1 flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                <div className="flex-1 truncate text-sm text-slate-200">{alumnosFile ? alumnosFile.name : 'Selecciona alumnos.xlsx'}</div>
                <input type="file" accept=".xlsx,.xls" className="hidden" id="alumnos-upload" onChange={e => setAlumnosFile(e.target.files?.[0] || null)} />
                <label htmlFor="alumnos-upload" className="cursor-pointer text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">Elegir</label>
              </div>
            </label>
            <button
              onClick={handleUploadAlumnos}
              disabled={!alumnosFile || uploadingAlumnos}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 shadow-md shadow-indigo-600/15"
            >
              {uploadingAlumnos ? 'Subiendo...' : 'Subir y reemplazar'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">Se guarda como data/alumnos.xlsx y reemplaza cualquier versión anterior.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-4 md:p-5 space-y-3 border border-slate-800/60">
          <div>
            <h2 className="text-lg font-semibold text-white">Configuración de Grupos Obligatorios</h2>
            <p className="text-sm text-slate-400">Define cursos que requieren inscripción simultánea en múltiples grupos.</p>
          </div>
          <div className="space-y-2.5">
            <div className="grid md:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-400 uppercase tracking-wider">Curso</label>
                <select value={configCourse} onChange={e => onCourseChange(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecciona un curso...</option>
                  {courses.map(c => (
                    <option key={c.asig_codigo} value={c.asig_codigo}>{c.asig_codigo} - {c.asig_nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 uppercase tracking-wider">Sección</label>
                <select value={configSection} onChange={e => setConfigSection(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecciona...</option>
                  {courseStruct.map(sec => (
                    <option key={sec.section} value={sec.section}>Sección {sec.section}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">Grupos obligatorios</label>
              <div className="flex flex-wrap gap-1.5">
                {availableGroups.length === 0 && <span className="text-sm text-slate-500">Selecciona curso y sección</span>}
                {availableGroups.map(g => {
                  const active = configGroups.includes(g);
                  return (
                    <button key={g} onClick={() => setConfigGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-900/25' : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'}`}>
                      Grupo {g}
                    </button>
                  );
                })}
              </div>
            </div>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm shadow-indigo-600/15" onClick={addGroupConfig}>Agregar a la lista</button>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold text-white text-sm">Cursos configurados</h3>
            {Object.keys(groupConfigs).length === 0 ? (
              <p className="text-sm text-slate-500">No hay configuraciones</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                {Object.entries(groupConfigs).map(([key, cfg]) => (
                  <div key={key} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
                    <div className="text-xs">
                      <p className="font-semibold text-sm">{cfg.course} • Sec {cfg.section}</p>
                      <p className="text-slate-400 text-[11px]">Grupos: {cfg.groups.join(', ')}</p>
                    </div>
                    <button className="text-[11px] text-rose-300 hover:text-rose-200" onClick={() => removeGroupConfig(key)}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={saveConfigHandler} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60 shadow-sm shadow-emerald-700/15" disabled={savingConfig}>
            {savingConfig ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>

        <div className="glass rounded-2xl p-4 md:p-5 space-y-3 border border-slate-800/60">
          <div>
            <h2 className="text-lg font-semibold text-white">Topones válidos (BACH1121)</h2>
            <p className="text-sm text-slate-400">Selecciona horarios de BACH1121 que permiten topones con otros cursos.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">Horario</label>
              <select value={toponSelected} onChange={e => setToponSelected(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Selecciona un horario...</option>
                {bachSchedules.map(h => (
                  <option key={h.id} value={h.id}>{h.display}</option>
                ))}
              </select>
            </div>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm shadow-indigo-600/15" onClick={addToponConfig}>Agregar topón</button>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-white text-sm">Topones configurados</h3>
            {Object.keys(toponConfigs).length === 0 ? (
              <p className="text-sm text-slate-500">No hay topones configurados</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                {Object.entries(toponConfigs).map(([key, cfg]) => (
                  <div key={key} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
                    <div className="text-xs">
                      <p className="font-semibold text-sm">BACH1121 • Sec {cfg.section} • Grp {cfg.group}</p>
                      <p className="text-slate-400 text-[11px]">{cfg.dia} {cfg.hora_ini} - {cfg.hora_fin} ({cfg.tapon_type})</p>
                    </div>
                    <button className="text-[11px] text-rose-300 hover:text-rose-200" onClick={() => removeToponConfig(key)}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={saveConfigHandler} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60 shadow-sm shadow-emerald-700/15" disabled={savingConfig}>
            {savingConfig ? 'Guardando...' : 'Guardar topones'}
          </button>
        </div>
      </div>
    </section>
  );
}
