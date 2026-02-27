'use client';

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
  return (
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
  );
}
