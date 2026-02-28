'use client';

import React, { useMemo } from 'react';
import { ExcelRow } from '@/lib/types';
import { exportExcel } from '@/lib/api';

interface DatosTabProps {
  excelData: ExcelRow[];
  excelLoading: boolean;
  excelSaving: boolean;
  updateExcelCell: (index: number, field: keyof ExcelRow, value: any) => void;
  addExcelRow: () => void;
  deleteExcelRow: (index: number) => void;
  saveExcel: () => void;
  handleImport: (file: File) => void;
  showBanner: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DatosTab({
  excelData,
  excelLoading,
  excelSaving,
  updateExcelCell,
  addExcelRow,
  deleteExcelRow,
  saveExcel,
  handleImport,
  showBanner,
}: DatosTabProps) {
  const stats = useMemo(() => {
    const total = excelData.length;
    const siglas = new Set(excelData.map(r => (r.asig_codigo || '').trim()).filter(Boolean)).size;
    const periodos = new Set(excelData.map(r => `${r.sare_anho || ''}-${r.sare_semestre || ''}`.trim()).filter(Boolean)).size;
    const diasCount: Record<string, number> = {};
    excelData.forEach(r => {
      const d = (r.sdia_descripcion || '').trim();
      if (!d) return;
      diasCount[d] = (diasCount[d] || 0) + 1;
    });
    const topDia = Object.entries(diasCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { total, siglas, periodos, topDia };
  }, [excelData]);

  const actionBtn = (label: string, onClick: () => void, variant: 'primary' | 'ghost' | 'solid' = 'solid') => {
    const base = 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2';
    const variants: Record<typeof variant, string> = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      solid: 'bg-slate-800 hover:bg-slate-700 text-white',
      ghost: 'bg-slate-900/40 hover:bg-slate-800 text-slate-200 border border-slate-800'
    };
    return (
      <button className={`${base} ${variants[variant]}`} onClick={onClick}>
        {label}
      </button>
    );
  };

  return (
    <section className="space-y-6">
      <div className="glass rounded-2xl p-5 flex flex-col gap-4 border border-slate-800/60">
        <div className="flex flex-wrap justify-between gap-3 items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Consolidado</p>
            <h2 className="text-xl font-semibold text-white">Curaduría y edición de bloques</h2>
            <p className="text-sm text-slate-400">Importa, corrige y exporta el Excel maestro sin salir de aquí.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionBtn('Exportar Excel', () => exportExcel().catch(err => showBanner(err.message || 'Error exportando', 'error')), 'primary')}
            <label className="cursor-pointer">
              <div className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2">
                Importar Excel
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
              </div>
            </label>
            {actionBtn('Agregar registro', addExcelRow, 'solid')}
            <button
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
              disabled={excelSaving}
              onClick={saveExcel}
            >
              {excelSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass border border-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-400">Registros</p>
            <p className="text-2xl font-semibold text-white">{stats.total.toLocaleString('es-CL')}</p>
          </div>
          <div className="glass border border-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-400">Siglas únicas</p>
            <p className="text-2xl font-semibold text-amber-300">{stats.siglas}</p>
          </div>
          <div className="glass border border-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-400">Períodos</p>
            <p className="text-2xl font-semibold text-indigo-300">{stats.periodos}</p>
          </div>
          <div className="glass border border-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-400">Día más frecuente</p>
            <p className="text-lg font-semibold text-emerald-300">{stats.topDia}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden border border-slate-800/60">
        <div className="px-4 py-3 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" aria-hidden />
            <p className="text-sm text-slate-300">Editor en línea de consolidado.xlsx</p>
          </div>
          {excelLoading && <span className="text-xs text-slate-400">Cargando datos...</span>}
        </div>

        <div className="overflow-auto scrollbar-thin max-h-[70vh] hidden md:block">
          <table className="w-full text-left text-sm min-w-[1100px]">
            <thead className="bg-gradient-to-r from-slate-900 to-slate-900/70 border-b border-slate-800 text-xs text-slate-200 sticky top-0 z-10 shadow-md shadow-slate-900/40">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Año</th>
                <th className="px-3 py-2">Sem</th>
                <th className="px-3 py-2">Sigla</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Sección</th>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Día</th>
                <th className="px-3 py-2">Horas</th>
                <th className="px-3 py-2">Campus</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {excelData.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-6 text-center text-slate-400">{excelLoading ? 'Cargando...' : 'Sin datos'}</td></tr>
              ) : (
                excelData.map((row, idx) => (
                  <tr key={idx} className="align-top hover:bg-slate-900/50 transition-colors">
                    <td className="px-3 py-3 text-slate-500 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3"><input type="number" value={row.sare_anho ?? ''} onChange={e => updateExcelCell(idx, 'sare_anho', Number(e.target.value))} className="w-24 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3"><input type="number" value={row.sare_semestre ?? ''} onChange={e => updateExcelCell(idx, 'sare_semestre', Number(e.target.value))} className="w-16 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3"><input type="text" value={row.asig_codigo ?? ''} onChange={e => updateExcelCell(idx, 'asig_codigo', e.target.value)} className="w-28 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm uppercase tracking-wide focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3"><input type="text" value={row.asig_nombre ?? ''} onChange={e => updateExcelCell(idx, 'asig_nombre', e.target.value)} className="w-64 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3"><input type="number" value={row.psec_codigo ?? ''} onChange={e => updateExcelCell(idx, 'psec_codigo', Number(e.target.value))} className="w-16 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3"><input type="number" value={row.pgru_codigo ?? ''} onChange={e => updateExcelCell(idx, 'pgru_codigo', Number(e.target.value))} className="w-16 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3">
                      <div className="inline-flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" aria-hidden />
                        <select value={row.sdia_descripcion ?? 'Lunes'} onChange={e => updateExcelCell(idx, 'sdia_descripcion', e.target.value)} className="bg-transparent text-sm focus:outline-none">
                          {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'].map(d => (
                            <option key={d} value={d} className="bg-slate-900">{d}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-300">
                        <label className="flex items-center gap-2">
                          <span className="text-slate-500 w-12">Inicio</span>
                          <input type="time" value={row.sper_hora_ini ?? ''} onChange={e => updateExcelCell(idx, 'sper_hora_ini', e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-slate-500 w-12">Fin</span>
                          <input type="time" value={row.sper_hora_fin ?? ''} onChange={e => updateExcelCell(idx, 'sper_hora_fin', e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-3"><input type="text" value={row.camp_campus ?? ''} onChange={e => updateExcelCell(idx, 'camp_campus', e.target.value)} className="w-32 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner shadow-slate-900/40" /></td>
                    <td className="px-3 py-3 text-right">
                      <button className="text-rose-300 text-xs hover:text-rose-200 flex items-center gap-1" onClick={() => deleteExcelRow(idx)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h.293l.853 10.238A2 2 0 007.14 18h5.72a2 2 0 001.994-1.762L15.707 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-1 6a1 1 011 1v6a1 1 11-2 0V9a1 1 011-1zm4 0a1 1 011 1v6a1 1 11-2 0V9a1 1 011-1z" clipRule="evenodd" /></svg>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet stacked cards */}
        <div className="md:hidden space-y-3 max-h-[70vh] overflow-auto scrollbar-thin px-2 pb-3">
          {excelData.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-6">{excelLoading ? 'Cargando...' : 'Sin datos'}</div>
          ) : (
            excelData.map((row, idx) => (
              <div key={idx} className="border border-slate-800 rounded-xl p-3 bg-slate-950/60 shadow-lg shadow-slate-950/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Fila {idx + 1}</span>
                  <button className="text-rose-300 hover:text-rose-200 flex items-center gap-1" onClick={() => deleteExcelRow(idx)}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 100 2h.293l.853 10.238A2 2 0 007.14 18h5.72a2 2 0 001.994-1.762L15.707 6H16a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-1 6a1 1 011 1v6a1 1 11-2 0V9a1 1 011-1zm4 0a1 1 011 1v6a1 1 11-2 0V9a1 1 011-1z" clipRule="evenodd" /></svg>
                    Eliminar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-400">Año
                    <input type="number" value={row.sare_anho ?? ''} onChange={e => updateExcelCell(idx, 'sare_anho', Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-slate-400">Sem
                    <input type="number" value={row.sare_semestre ?? ''} onChange={e => updateExcelCell(idx, 'sare_semestre', Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-slate-400 col-span-2">Sigla
                    <input type="text" value={row.asig_codigo ?? ''} onChange={e => updateExcelCell(idx, 'asig_codigo', e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm uppercase tracking-wide" />
                  </label>
                  <label className="text-xs text-slate-400 col-span-2">Nombre
                    <input type="text" value={row.asig_nombre ?? ''} onChange={e => updateExcelCell(idx, 'asig_nombre', e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-slate-400">Sección
                    <input type="number" value={row.psec_codigo ?? ''} onChange={e => updateExcelCell(idx, 'psec_codigo', Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-slate-400">Grupo
                    <input type="number" value={row.pgru_codigo ?? ''} onChange={e => updateExcelCell(idx, 'pgru_codigo', Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-slate-400">Día
                    <select value={row.sdia_descripcion ?? 'Lunes'} onChange={e => updateExcelCell(idx, 'sdia_descripcion', e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm">
                      {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <div className="col-span-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <label>Inicio
                      <input type="time" value={row.sper_hora_ini ?? ''} onChange={e => updateExcelCell(idx, 'sper_hora_ini', e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                    </label>
                    <label>Fin
                      <input type="time" value={row.sper_hora_fin ?? ''} onChange={e => updateExcelCell(idx, 'sper_hora_fin', e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                    </label>
                  </div>
                  <label className="text-xs text-slate-400 col-span-2">Campus
                    <input type="text" value={row.camp_campus ?? ''} onChange={e => updateExcelCell(idx, 'camp_campus', e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm" />
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
