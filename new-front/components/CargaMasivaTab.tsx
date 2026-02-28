'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CapacityEntry, CapacityStats, MassResult, MassSummary } from '@/lib/types';
import { downloadMassXlsx } from '@/lib/api';

function Badge({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'rose' | 'amber' }) {
  const map: Record<string, string> = {
    indigo: 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/30',
    emerald: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
    rose: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
    amber: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
  };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const start = prevValue.current;
    const delta = value - start;
    if (delta === 0) return;
    const startAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        prevValue.current = value;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value, duration]);

  useEffect(() => { prevValue.current = value; setDisplay(value); }, []);

  return <span>{display.toLocaleString('es-CL')}</span>;
}

interface CargaMasivaTabProps {
  massLoading: boolean;
  massSummary: MassSummary | null;
  liveSummary: MassSummary | null;
  massHasRun: boolean;
  massResults: MassResult[];
  massFiltered: MassResult[] | null;
  massState: any;
  massFilterText: string;
  massFilterStatus: string;
  capacityReport: CapacityEntry[] | null;
  capacityStats: CapacityStats | null;
  overCapacitySort: 'remaining_desc' | 'remaining_asc' | 'course_asc';
  mostEmptySort: 'remaining_desc' | 'remaining_asc' | 'course_asc';
  sortedOverCapacity: CapacityEntry[];
  sortedMostEmpty: CapacityEntry[];
  massRebalancing: boolean;
  setOverCapacitySort: (s: any) => void;
  setMostEmptySort: (s: any) => void;
  runMassive: (file?: File) => void;
  rebalanceOvercapacity: () => void;
  applyMassFilters: (text: string, status: string) => void;
  selectMassSchedule: (registro?: string) => void;
  showBanner: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CargaMasivaTab({
  massLoading,
  massSummary,
  liveSummary,
  massResults,
  massFiltered,
  massState,
  massFilterText,
  massFilterStatus,
  capacityStats,
  sortedOverCapacity,
  sortedMostEmpty,
  overCapacitySort,
  mostEmptySort,
  massRebalancing,
  setOverCapacitySort,
  setMostEmptySort,
  runMassive,
  rebalanceOvercapacity,
  applyMassFilters,
  selectMassSchedule,
  showBanner,
  massHasRun,
}: CargaMasivaTabProps) {
  const summary = liveSummary || massSummary;
  const hasFinalResults = massResults.length > 0;
  const showResultsTable = massHasRun && !massLoading && hasFinalResults;
  const showCapacityReport = massHasRun && !massLoading && Boolean(capacityStats) && (hasFinalResults || summary);
  const showSummaryCards = massHasRun && (Boolean(summary) || massLoading);
  const showEmptyState = (!massHasRun && !massLoading) || (massHasRun && !massLoading && !hasFinalResults && !summary);

  return (
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
              {massHasRun && (
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
              )}
              {massHasRun && capacityStats?.over_capacity?.length ? (
                <button
                  className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 disabled:opacity-60"
                  disabled={massRebalancing}
                  onClick={rebalanceOvercapacity}
                >
                  {massRebalancing ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full" />
                      Recalculando...
                    </span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a1 1 0 011-1h10a1 1 0 011 1v4.382a1 1 0 01-.553.894l-4.894 2.447a1 1 0 00-.553.894V17a1 1 0 01-1.447.894l-4-2A1 1 0 013 15V4z" clipRule="evenodd" /></svg>
                      <span>Recalcular sobrecupo</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass rounded-2xl p-6">
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Procesando</span>
            <h3 className="text-lg font-medium">{massState?.phase === 'recalculando' ? 'Recalculando cupos' : (massState?.current_name || '—')}</h3>
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

      {showSummaryCards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-4 rounded-xl">
            <p className="text-slate-400 text-xs font-medium uppercase mb-1">Total Alumnos</p>
            <p className="text-2xl font-bold"><AnimatedNumber value={summary?.total_alumnos ?? 0} /></p>
          </div>
          <div className="glass p-4 rounded-xl border-b-2 border-emerald-500/50">
            <p className="text-slate-400 text-xs font-medium uppercase mb-1">Con Horario</p>
            <p className="text-2xl font-bold text-emerald-400"><AnimatedNumber value={summary?.con_horario ?? 0} /></p>
          </div>
          <div className="glass p-4 rounded-xl border-b-2 border-rose-500/50">
            <p className="text-slate-400 text-xs font-medium uppercase mb-1">Sin Horario</p>
            <p className="text-2xl font-bold text-rose-400"><AnimatedNumber value={summary?.sin_horario ?? 0} /></p>
          </div>
          <div className="glass p-4 rounded-xl border-b-2 border-amber-500/50">
            <p className="text-slate-400 text-xs font-medium uppercase mb-1">Topón Válido</p>
            <p className="text-2xl font-bold text-amber-400"><AnimatedNumber value={summary?.con_topon_valido ?? 0} /></p>
          </div>
        </div>
      )}

      {showEmptyState && (
        <div className="glass rounded-2xl p-6 flex items-center justify-between border border-dashed border-slate-800">
          <div>
            <p className="text-sm text-slate-300 font-semibold">Aún no hay una carga masiva procesada.</p>
            <p className="text-xs text-slate-500">Sube el Excel o ejecuta “Generar para todos” para ver resultados y reportes.</p>
          </div>
          <div className="hidden md:block text-indigo-300 text-sm">Esperando datos…</div>
        </div>
      )}

      {/* Capacity report */}
      {showCapacityReport && capacityStats && (
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
                    onChange={e => setOverCapacitySort(e.target.value)}
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
                    onChange={e => setMostEmptySort(e.target.value)}
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

      {showResultsTable ? (
        <>
          {/* Filters */}
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
              <option value="topon_valido">Topón válido</option>
            </select>
          </div>

          {/* Results table */}
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
                    const badge = (() => {
                      // Primero verificar conflictos: cualquier horario con conflictos es inválido
                      if (r.has_conflicts || r.status === 'no_valido') return <Badge tone="rose">No válido</Badge>;
                      if (r.status === 'con_horario' && r.has_valid_topones) return <Badge tone="amber">Topón válido</Badge>;
                      if (r.status === 'con_horario') return <Badge tone="emerald">Generado</Badge>;
                      return <Badge tone="rose">Sin horario</Badge>;
                    })();
                    const hasSchedule = r.blocks && r.blocks.length > 0;
                    return (
                      <tr key={r.registro} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-300">{r.registro}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{r.rut}</td>
                        <td className="px-6 py-4 text-sm font-medium text-white">{r.nombre}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{(r.cursos || []).join(', ')}</td>
                        <td className="px-6 py-4">{badge}</td>
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
        </>
      ) : massLoading ? (
        <div className="glass rounded-2xl p-6 text-sm text-slate-300 border border-slate-800">
          Procesando alumnos… pronto verás los resultados aquí.
        </div>
      ) : null}
    </section>
  );
}
