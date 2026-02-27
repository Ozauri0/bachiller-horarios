'use client';

import type React from 'react';
import ScheduleGrid from '@/components/ScheduleGrid';
import { Course, CourseOption, MassResult, ScheduleResult } from '@/lib/types';

function Badge({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'rose' | 'amber' }) {
  const map: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/30',
    emerald: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
    rose: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
    amber: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
  };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

type ModalPos = { x: number; y: number };

interface MassModalProps {
  massSchedule: MassResult;
  massScheduleIndex: number;
  setMassScheduleIndex: React.Dispatch<React.SetStateAction<number>>;
  massSchedulesList: MassResult[];
  massModalPos: ModalPos;
  massModalSchedule: ScheduleResult | undefined;
  massEditCourses: CourseOption[];
  setMassEditCourses: React.Dispatch<React.SetStateAction<CourseOption[]>>;
  massEditSchedules: ScheduleResult[];
  massEditScheduleIndex: number;
  setMassEditScheduleIndex: React.Dispatch<React.SetStateAction<number>>;
  massEditMessage: string;
  setMassEditMessage: (msg: string) => void;
  massEditPanelOpen: boolean;
  setMassEditPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  massEditSaving: boolean;
  massEditDirty: boolean;
  setMassEditDirty: (d: boolean) => void;
  setMassEditSchedules: React.Dispatch<React.SetStateAction<ScheduleResult[]>>;
  massRecalc: () => void;
  massSave: () => void;
  startDrag: (e: React.MouseEvent<HTMLDivElement>) => void;
  stopDrag: () => void;
  onClose: () => void;
  courses: Course[];
  displayedCourses: Course[];
  search: string;
  setSearch: (s: string) => void;
}

export default function MassModal({
  massSchedule,
  massScheduleIndex,
  setMassScheduleIndex,
  massSchedulesList,
  massModalPos,
  massModalSchedule,
  massEditCourses,
  setMassEditCourses,
  massEditSchedules,
  massEditScheduleIndex,
  setMassEditScheduleIndex,
  massEditMessage,
  setMassEditMessage,
  massEditPanelOpen,
  setMassEditPanelOpen,
  massEditSaving,
  massEditDirty,
  setMassEditDirty,
  setMassEditSchedules,
  massRecalc,
  massSave,
  startDrag,
  stopDrag,
  onClose,
  courses,
  displayedCourses,
  search,
  setSearch,
}: MassModalProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => { stopDrag(); onClose(); }} />
      <div
        className="absolute w-[min(95vw,1400px)] max-h-[95vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl flex flex-col"
        style={{ left: massModalPos.x, top: massModalPos.y, transform: 'translate(-50%, -50%)' }}
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
            <button
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-white"
              onClick={() => setMassEditPanelOpen(p => !p)}
            >
              Modificar cursos
            </button>
            <button
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              onClick={massRecalc}
              disabled={massEditCourses.length === 0}
            >
              Recalcular horario
            </button>
            {massEditDirty && (
              <button
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                onClick={massSave}
                disabled={massEditSaving}
              >
                {massEditSaving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
            <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={massScheduleIndex === 0} onClick={() => setMassScheduleIndex(i => Math.max(i - 1, 0))}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">{massScheduleIndex + 1} / {massSchedulesList.length}</span>
            <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={massScheduleIndex >= massSchedulesList.length - 1} onClick={() => setMassScheduleIndex(i => Math.min(i + 1, massSchedulesList.length - 1))}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
            <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" onClick={() => { stopDrag(); onClose(); }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex">
          <div className="p-4 flex-1 overflow-auto">
            {massEditMessage && <p className="text-xs text-slate-400 mb-2">{massEditMessage}</p>}
            {massModalSchedule ? (
              <ScheduleGrid
                schedule={massModalSchedule}
                courses={(massModalSchedule.sections || []).map(s => ({ code: s.course }))}
                header={<div className="flex flex-wrap gap-2">{(massModalSchedule.sections || []).map((c, idx) => <Badge key={`${c.course}-${idx}`} tone="indigo">{c.course} • Sec {c.section} Grp {c.group}</Badge>)}</div>}
              />
            ) : (
              <p className="text-slate-400 text-sm">Sin horario disponible</p>
            )}
          </div>

          {massEditPanelOpen && (
            <div className="w-full max-w-sm border-l border-slate-800 bg-slate-900/80 p-4 overflow-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Cursos del alumno</h3>
                <button className="text-xs text-slate-400" onClick={() => setMassEditPanelOpen(false)}>Cerrar</button>
              </div>
              <input
                type="text"
                placeholder="Buscar curso..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="max-h-56 overflow-auto space-y-2 pr-1">
                {displayedCourses.map(course => {
                  const selected = massEditCourses.some(c => c.code === course.asig_codigo);
                  return (
                    <div key={course.asig_codigo} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${selected ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                      <div>
                        <p className="font-semibold text-white">{course.asig_codigo}</p>
                        <p className="text-xs text-slate-400">{course.asig_nombre}</p>
                      </div>
                      <button
                        className="text-xs font-semibold px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                        onClick={() => {
                          if (selected) return;
                          setMassEditCourses(prev => [...prev, { code: course.asig_codigo, name: course.asig_nombre }]);
                          setMassEditSchedules([]);
                          setMassEditScheduleIndex(0);
                          setMassEditDirty(false);
                          setMassEditMessage('Recalcula para aplicar los nuevos cursos');
                        }}
                        disabled={selected}
                      >
                        {selected ? 'Agregado' : 'Agregar'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Cursos seleccionados ({massEditCourses.length})</p>
                {massEditCourses.length === 0 ? (
                  <p className="text-slate-500 text-sm">Sin cursos</p>
                ) : (
                  massEditCourses.map(course => (
                    <div key={course.code} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">{course.code}</p>
                        <p className="text-xs text-slate-400">{course.name}</p>
                      </div>
                      <button
                        className="text-xs text-rose-300 hover:text-rose-200"
                        onClick={() => {
                          setMassEditCourses(prev => prev.filter(c => c.code !== course.code));
                          setMassEditSchedules([]);
                          setMassEditScheduleIndex(0);
                          setMassEditDirty(false);
                          setMassEditMessage('Recalcula para aplicar los nuevos cursos');
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                  onClick={massRecalc}
                  disabled={massEditCourses.length === 0}
                >
                  Recalcular con cursos
                </button>
                {massEditSchedules.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                    <span>{massEditScheduleIndex + 1} / {massEditSchedules.length}</span>
                    <div className="space-x-2">
                      <button
                        className="px-2 py-1 bg-slate-700 rounded disabled:opacity-40"
                        disabled={massEditScheduleIndex === 0}
                        onClick={() => setMassEditScheduleIndex(i => Math.max(i - 1, 0))}
                      >
                        Prev
                      </button>
                      <button
                        className="px-2 py-1 bg-slate-700 rounded disabled:opacity-40"
                        disabled={massEditScheduleIndex >= massEditSchedules.length - 1}
                        onClick={() => setMassEditScheduleIndex(i => Math.min(i + 1, massEditSchedules.length - 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
