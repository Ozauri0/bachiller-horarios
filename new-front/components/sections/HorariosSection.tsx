import React from 'react';
import ScheduleGrid from '@/components/ScheduleGrid';
import { Course, CourseOption, ScheduleResult } from '@/lib/types';

export type HorariosSectionProps = {
  displayedCourses: Course[];
  selectedCourses: CourseOption[];
  coursesLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAddCourse: (course: Course) => void;
  onRemoveCourse: (code: string) => void;
  generating: boolean;
  generate: () => void;
  schedule?: ScheduleResult;
  scheduleIndex: number;
  schedulesCount: number;
  onPrevSchedule: () => void;
  onNextSchedule: () => void;
  scheduleMessage: string;
};

export function HorariosSection({
  displayedCourses,
  selectedCourses,
  coursesLoading,
  search,
  onSearchChange,
  onAddCourse,
  onRemoveCourse,
  generating,
  generate,
  schedule,
  scheduleIndex,
  schedulesCount,
  onPrevSchedule,
  onNextSchedule,
  scheduleMessage
}: HorariosSectionProps) {
  return (
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
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar curso..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <div className="grid md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
            {displayedCourses.map(course => {
              const selected = selectedCourses.some(c => c.code === course.asig_codigo);
              return (
                <div
                  key={course.asig_codigo}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    selected ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm text-white">{course.asig_codigo}</p>
                    <p className="text-xs text-slate-400">{course.asig_nombre}</p>
                  </div>
                  <button
                    className="text-xs font-semibold px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
                    onClick={() => onAddCourse(course)}
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
                    <button className="text-xs text-rose-300 hover:text-rose-200" onClick={() => onRemoveCourse(course.code)}>
                      Quitar
                    </button>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Horario generado</h2>
                <p className="text-slate-400 text-xs">Alumno actual</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors" disabled={scheduleIndex === 0} onClick={onPrevSchedule}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">{scheduleIndex + 1} / {schedulesCount}</span>
              <button
                className="p-2 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
                disabled={scheduleIndex >= schedulesCount - 1}
                onClick={onNextSchedule}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <ScheduleGrid schedule={schedule} courses={selectedCourses} />
        </div>
      )}
    </section>
  );
}

export default HorariosSection;
