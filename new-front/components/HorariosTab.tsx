'use client';

import type React from 'react';
import ScheduleGrid from '@/components/ScheduleGrid';
import { Course, CourseOption, ScheduleResult } from '@/lib/types';

interface HorariosTabProps {
  courses: Course[];
  coursesLoading: boolean;
  search: string;
  setSearch: (s: string) => void;
  displayedCourses: Course[];
  selectedCourses: CourseOption[];
  addCourse: (c: Course) => void;
  removeCourse: (code: string) => void;
  generate: () => void;
  generating: boolean;
  schedules: ScheduleResult[];
  scheduleIndex: number;
  setScheduleIndex: React.Dispatch<React.SetStateAction<number>>;
  scheduleMessage: string;
}

export default function HorariosTab({
  courses,
  coursesLoading,
  search,
  setSearch,
  displayedCourses,
  selectedCourses,
  addCourse,
  removeCourse,
  generate,
  generating,
  schedules,
  scheduleIndex,
  setScheduleIndex,
  scheduleMessage,
}: HorariosTabProps) {
  const schedule = schedules[scheduleIndex];

  return (
    <section className="space-y-8 max-w-6xl mx-auto w-full">
      <div className="max-w-5xl mx-auto px-1">
        <div className="flex flex-col gap-3 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-emerald-300 text-[10px] font-bold uppercase tracking-wider self-center lg:self-start">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Selecciona hasta 6 cursos
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Generación de Horarios</h2>
          <p className="text-slate-400 max-w-xl text-sm md:text-base leading-relaxed mx-auto lg:mx-0">
            Busca cursos, añádelos y genera combinaciones óptimas. Cada horario respeta topones y configuraciones previas.
          </p>
          {scheduleMessage && <p className="text-xs text-slate-400">{scheduleMessage}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-5 space-y-4 lg:col-span-2 border border-slate-800/60 min-h-[460px] flex flex-col">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Cursos Disponibles</h2>
              <p className="text-slate-400 text-sm">Busca por sigla o nombre</p>
            </div>
            {coursesLoading && <span className="text-xs text-slate-400">Cargando...</span>}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar curso..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1 items-start">
            {displayedCourses.map(course => {
              const selected = selectedCourses.some(c => c.code === course.asig_codigo);
              return (
                <div
                  key={course.asig_codigo}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-3 rounded-lg border ${selected ? 'border-indigo-400/60 bg-indigo-500/10 shadow-inner shadow-indigo-900/40' : 'border-slate-800 bg-slate-900/40'}`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-sm text-white truncate">{course.asig_codigo}</p>
                    <p className="text-xs text-slate-400 truncate">{course.asig_nombre}</p>
                  </div>
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 w-full sm:w-auto"
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
          <div className="glass rounded-2xl p-5 space-y-3 border border-slate-800/60 min-h-[220px]">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Cursos Seleccionados</h3>
              <span className="text-sm text-slate-400">{selectedCourses.length}/6</span>
            </div>
            {selectedCourses.length === 0 ? (
              <p className="text-slate-500 text-sm">No hay cursos seleccionados</p>
            ) : (
              <div className="space-y-2 pr-1 scrollbar-thin">
                {selectedCourses.map(course => (
                  <div key={course.code} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
                    <div className="truncate">
                      <p className="text-sm font-semibold">{course.code}</p>
                      <p className="text-xs text-slate-400 truncate">{course.name}</p>
                    </div>
                    <button className="text-xs text-rose-300 hover:text-rose-200" onClick={() => removeCourse(course.code)}>Quitar</button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={generate}
              disabled={selectedCourses.length === 0 || generating}
            >
              {generating && <span className="animate-spin h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full" />}
              Generar horarios
            </button>
          </div>
        </div>
      </div>

      {schedule && (
        <div className="space-y-4">
          <div className="flex items-center justify-between glass rounded-2xl p-4 border border-slate-800/60">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-500 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Horario generado</h2>
                <p className="text-slate-400 text-xs">Vista del alumno</p>
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
  );
}
