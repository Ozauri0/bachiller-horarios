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
  replaceConsolidado: (file: File) => Promise<void>;
  uploadCursosDisponibles: (file: File) => Promise<void>;
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
  replaceConsolidado,
  uploadCursosDisponibles,
}: ConfigTabProps) {
  const [alumnosFile, setAlumnosFile] = useState<File | null>(null);
  const [uploadingAlumnos, setUploadingAlumnos] = useState(false);
  const [consolFile, setConsolFile] = useState<File | null>(null);
  const [uploadingConsol, setUploadingConsol] = useState(false);
  const [cursosFile, setCursosFile] = useState<File | null>(null);
  const [uploadingCursos, setUploadingCursos] = useState(false);

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

  const handleUploadConsol = async () => {
    if (!consolFile) return;
    try {
      setUploadingConsol(true);
      await replaceConsolidado(consolFile);
      setConsolFile(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingConsol(false);
    }
  };

  const handleUploadCursos = async () => {
    if (!cursosFile) return;
    try {
      setUploadingCursos(true);
      await uploadCursosDisponibles(cursosFile);
      setCursosFile(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingCursos(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Hero grid for uploads */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
          <div className="space-y-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">Base de datos</span>
            <div>
              <h2 className="text-lg font-semibold text-white">Sincroniza alumnos.xlsx</h2>
              <p className="text-sm text-slate-400">Cada subida reemplaza la versión en el servidor.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Archivo</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <div className="flex items-center h-11 px-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 shadow-inner shadow-black/30">
                  <span className="flex-1 truncate">{alumnosFile ? alumnosFile.name : 'Selecciona alumnos.xlsx'}</span>
                  <input type="file" accept=".xlsx,.xls" className="hidden" id="alumnos-upload" onChange={e => setAlumnosFile(e.target.files?.[0] || null)} />
                  <label htmlFor="alumnos-upload" className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wide cursor-pointer">Elegir</label>
                </div>
              </div>
              <button
                onClick={handleUploadAlumnos}
                disabled={!alumnosFile || uploadingAlumnos}
                className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold border border-indigo-500/60 shadow-lg shadow-indigo-500/20 disabled:opacity-60"
              >
                {uploadingAlumnos ? 'Subiendo…' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
          <div className="space-y-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-wide">cursos_disponibles.xlsx</span>
            <div>
              <h2 className="text-lg font-semibold text-white">Actualiza cupos y secciones</h2>
              <p className="text-sm text-slate-400">Reemplaza el archivo que define cupos por sección.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Archivo</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <div className="flex items-center h-11 px-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 shadow-inner shadow-black/30">
                  <span className="flex-1 truncate">{cursosFile ? cursosFile.name : 'Selecciona cursos_disponibles.xlsx'}</span>
                  <input type="file" accept=".xlsx,.xls" className="hidden" id="cursos-upload" onChange={e => setCursosFile(e.target.files?.[0] || null)} />
                  <label htmlFor="cursos-upload" className="text-[11px] font-semibold text-amber-200 uppercase tracking-wide cursor-pointer">Elegir</label>
                </div>
              </div>
              <button
                onClick={handleUploadCursos}
                disabled={!cursosFile || uploadingCursos}
                className="h-11 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold border border-amber-500/60 shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {uploadingCursos ? 'Subiendo…' : 'Reemplazar'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
          <div className="space-y-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wide">consolidado.xlsx</span>
            <div>
              <h2 className="text-lg font-semibold text-white">Reemplaza el consolidado maestro</h2>
              <p className="text-sm text-slate-400">Sustituye el archivo usado para Horarios y Carga Masiva.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Archivo</label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <div className="flex items-center h-11 px-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 shadow-inner shadow-black/30">
                  <span className="flex-1 truncate">{consolFile ? consolFile.name : 'Selecciona consolidado.xlsx'}</span>
                  <input type="file" accept=".xlsx,.xls" className="hidden" id="consol-upload" onChange={e => setConsolFile(e.target.files?.[0] || null)} />
                  <label htmlFor="consol-upload" className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wide cursor-pointer">Elegir</label>
                </div>
              </div>
              <button
                onClick={handleUploadConsol}
                disabled={!consolFile || uploadingConsol}
                className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold border border-indigo-500/60 shadow-lg shadow-indigo-500/20 disabled:opacity-60"
              >
                {uploadingConsol ? 'Subiendo…' : 'Reemplazar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grupos obligatorios */}
        <div className="bg-slate-950/85 border border-slate-900 rounded-2xl shadow-[0_18px_50px_-36px_rgba(0,0,0,0.8)] flex flex-col">
          <div className="p-5 border-b border-slate-900 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Grupos obligatorios</p>
              <h2 className="text-lg font-semibold text-white">Inscripción conjunta por sección</h2>
            </div>
            <span className="text-[12px] text-slate-400">{Object.keys(groupConfigs).length} configurados</span>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1.5 text-sm">
                <span className="text-[11px] font-semibold uppercase text-slate-500">Curso</span>
                <div className="relative">
                  <select value={configCourse} onChange={e => onCourseChange(e.target.value)} className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Selecciona…</option>
                    {courses.map(c => (
                      <option key={c.asig_codigo} value={c.asig_codigo}>{c.asig_codigo} • {c.asig_nombre}</option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-[11px] font-semibold uppercase text-slate-500">Sección</span>
                <div className="relative">
                  <select value={configSection} onChange={e => setConfigSection(e.target.value)} className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Selecciona…</option>
                    {courseStruct.map(sec => (
                      <option key={sec.section} value={sec.section}>Sección {sec.section}</option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Grupos</span>
              <div className="flex flex-wrap gap-2">
                {availableGroups.length === 0 && <span className="text-sm text-slate-500">Selecciona curso y sección</span>}
                {availableGroups.map(g => {
                  const active = configGroups.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => setConfigGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                      className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/20 shadow' : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-600'}`}
                    >
                      Grupo {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <button className="w-full h-10 border border-slate-700 hover:border-slate-500 text-slate-200 text-[12px] font-semibold rounded-lg transition-colors bg-slate-900/60" onClick={addGroupConfig}>
              Agregar a la lista
            </button>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Configurados</h3>
              {Object.keys(groupConfigs).length === 0 ? (
                <p className="text-sm text-slate-500">No hay configuraciones</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {Object.entries(groupConfigs).map(([key, cfg]) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-600 transition-colors">
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-sm text-white">{cfg.course} • Sec {cfg.section}</p>
                        <p className="text-[11px] text-slate-400">Grupos: {cfg.groups.join(', ')}</p>
                      </div>
                      <button className="text-[11px] text-rose-300 hover:text-rose-200" onClick={() => removeGroupConfig(key)}>Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-1">
              <button onClick={saveConfigHandler} className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold rounded-lg border border-emerald-500/70 shadow-lg shadow-emerald-600/20 disabled:opacity-60" disabled={savingConfig}>
                {savingConfig ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </div>
        </div>

        {/* Topones válidos */}
        <div className="bg-slate-950/85 border border-slate-900 rounded-2xl shadow-[0_18px_50px_-36px_rgba(0,0,0,0.8)] flex flex-col">
          <div className="p-5 border-b border-slate-900 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Topones (BACH1121)</p>
              <h2 className="text-lg font-semibold text-white">Horarios permitidos para combinar</h2>
            </div>
            <span className="text-[12px] text-slate-400">{Object.keys(toponConfigs).length} activos</span>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <label className="flex-1 space-y-1.5 text-sm">
                <span className="text-[11px] font-semibold uppercase text-slate-500">Horario permitido</span>
                <div className="relative">
                  <select value={toponSelected} onChange={e => setToponSelected(e.target.value)} className="w-full h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">Selecciona un horario…</option>
                    {bachSchedules.map(h => (
                      <option key={h.id} value={h.id}>{h.display}</option>
                    ))}
                  </select>
                </div>
              </label>
              <button className="h-10 px-4 bg-slate-900 border border-slate-700 hover:border-slate-500 text-[12px] font-semibold text-slate-200 rounded-lg" onClick={addToponConfig}>Añadir</button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Topones configurados</h3>
              {Object.keys(toponConfigs).length === 0 ? (
                <p className="text-sm text-slate-500">No hay topones configurados</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {Object.entries(toponConfigs).map(([key, cfg]) => (
                    <div key={key} className="flex items-center justify-between p-3 border-l-2 border-indigo-500 bg-slate-900/50 rounded-xl">
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-sm text-white">BACH1121 • Sec {cfg.section} • Grp {cfg.group}</p>
                        <p className="text-[11px] text-indigo-300">{cfg.dia} {cfg.hora_ini} - {cfg.hora_fin} <span className="text-slate-500 font-normal">({cfg.tapon_type})</span></p>
                      </div>
                      <button className="text-[11px] text-rose-300 hover:text-rose-200" onClick={() => removeToponConfig(key)}>Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-1">
              <button onClick={saveConfigHandler} className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold rounded-lg border border-emerald-500/70 shadow-lg shadow-emerald-600/20 disabled:opacity-60" disabled={savingConfig}>
                {savingConfig ? 'Guardando…' : 'Guardar topones'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
