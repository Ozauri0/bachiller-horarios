'use client';

import { useMemo } from 'react';
import clsx from 'classnames';
import { CourseOption, ScheduleBlock, ScheduleResult } from '@/lib/types';

const DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 21 && m > 0) break;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return slots;
})();

const COLOR_CLASSES = [
  'bg-indigo-600/90 border border-indigo-300/40 text-white',
  'bg-emerald-600/90 border border-emerald-300/40 text-white',
  'bg-rose-600/90 border border-rose-300/40 text-white',
  'bg-amber-500/90 border border-amber-200/50 text-slate-950',
  'bg-cyan-600/90 border border-cyan-300/40 text-white',
  'bg-fuchsia-600/90 border border-fuchsia-300/40 text-white'
];

function timeToMinutes(timeStr: string | undefined) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(v => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

function normalizeDayName(day?: string) {
  if (!day) return 'Lunes';
  const mapping: Record<string, string> = {
    Lunes: 'Lunes',
    Martes: 'Martes',
    Miercoles: 'Miercoles',
    'Miércoles': 'Miercoles',
    Jueves: 'Jueves',
    Viernes: 'Viernes',
    Sabado: 'Sabado',
    'Sábado': 'Sabado'
  };
  const key = Object.keys(mapping).find(k => day.toLowerCase().includes(k.toLowerCase()));
  return key ? mapping[key] : day;
}

function getCampusShort(campus?: string) {
  if (!campus) return '';
  const upper = campus.toUpperCase();
  if (upper.includes('ALEMANIA') || upper.includes('RIVAS')) return 'ALEMANIA';
  if (upper.includes('NORTE') || upper.includes('PABLO')) return 'NORTE';
  if (upper.includes('VIRTUAL') || upper.includes('ONLINE')) return 'VIRTUAL';
  if (upper.includes('FRANCISCO')) return 'S.FCO';
  return upper.substring(0, 10);
}

function courseColor(code: string, indexFallback: number) {
  const idx = Math.abs(code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % COLOR_CLASSES.length;
  return COLOR_CLASSES[idx ?? indexFallback];
}

type GridCell = {
  key: string;
  type: 'empty' | 'block' | 'collision';
  rowSpan?: number;
  blocks?: ScheduleBlock[];
  block?: ScheduleBlock;
  className?: string;
};

type Props = {
  schedule: ScheduleResult;
  courses?: CourseOption[];
  header?: React.ReactNode;
};

export function ScheduleGrid({ schedule, courses = [], header }: Props) {
  const courseColorMap = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((c, idx) => map.set(c.code, COLOR_CLASSES[idx % COLOR_CLASSES.length]));
    return map;
  }, [courses]);

  const { rows, conflictAlert, validToponAlert, infoBadges } = useMemo(() => {
    const matriz: { block: ScheduleBlock; isStart: boolean; start: number; end: number }[][][] = [];
    TIME_SLOTS.forEach(() => {
      matriz.push([[], [], [], [], []]);
    });

    (schedule.blocks || []).forEach(block => {
      const startMinutes = timeToMinutes(block.hora_ini);
      const endMinutes = timeToMinutes(block.hora_fin);
      const dayKey = normalizeDayName(block.dia);
      const dayIndex = DAYS.indexOf(dayKey);
      if (dayIndex === -1) return;
      let isFirst = true;
      TIME_SLOTS.forEach((time, timeIndex) => {
        const slotMinutes = timeToMinutes(time);
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          matriz[timeIndex][dayIndex].push({ block, isStart: isFirst, start: startMinutes, end: endMinutes });
          isFirst = false;
        }
      });
    });

    const collisionGroups = new Map<number, { blocks: { block: ScheduleBlock; start: number; end: number }[]; start: number; end: number }[]>();
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const dayBlocks: { id: string; block: ScheduleBlock; start: number; end: number }[] = [];
      TIME_SLOTS.forEach((_, timeIndex) => {
        matriz[timeIndex][dayIndex].forEach(item => {
          const id = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
          if (!dayBlocks.find(b => b.id === id)) {
            dayBlocks.push({ id, block: item.block, start: item.start, end: item.end });
          }
        });
      });

      const groups: { id: string; block: ScheduleBlock; start: number; end: number }[][] = [];
      dayBlocks.forEach(b => {
        let target: { id: string; block: ScheduleBlock; start: number; end: number }[] | null = null;
        for (const g of groups) {
          if (g.some(existing => b.start < existing.end && b.end > existing.start)) {
            target = g;
            break;
          }
        }
        if (target) target.push(b);
        else groups.push([b]);
      });

      const dayCollisions = groups
        .filter(g => g.length > 1)
        .map(group => ({
          blocks: group.map(item => ({ block: item.block, start: item.start, end: item.end })),
          start: Math.min(...group.map(b => b.start)),
          end: Math.max(...group.map(b => b.end))
        }));
      collisionGroups.set(dayIndex, dayCollisions);
    }

    const renderedBlocks = new Set<string>();
    const renderedCollisions = new Set<string>();
    const rows: GridCell[][] = [];

    TIME_SLOTS.forEach((time, timeIndex) => {
      const currentMinutes = timeToMinutes(time);
      const rowCells: GridCell[] = [];
      DAYS.forEach((_, dayIndex) => {
        const cellBlocks = matriz[timeIndex][dayIndex];
        const dayCollisions = collisionGroups.get(dayIndex) || [];
        const collisionGroup = dayCollisions.find(g => g.start === currentMinutes && !renderedCollisions.has(`${dayIndex}_${g.start}_${g.end}`));
        if (collisionGroup) {
          const key = `${dayIndex}_${collisionGroup.start}_${collisionGroup.end}`;
          renderedCollisions.add(key);
          collisionGroup.blocks.forEach(b => renderedBlocks.add(`${b.block.curso}_${b.block.seccion}_${b.block.grupo}_${b.block.hora_ini}_${b.block.dia}`));
          const rowSpan = Math.ceil((collisionGroup.end - collisionGroup.start) / 10);
          rowCells.push({
            key: `collision-${key}`,
            type: 'collision',
            rowSpan,
            blocks: collisionGroup.blocks.map(c => c.block)
          });
          return;
        }

        const startingBlocks = cellBlocks.filter(item => {
          const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
          return item.isStart && !renderedBlocks.has(blockId);
        });

        const continuingBlocks = cellBlocks.filter(item => {
          const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
          return renderedBlocks.has(blockId);
        });

        if (startingBlocks.length === 0 && continuingBlocks.length > 0) {
          return;
        }

        if (startingBlocks.length === 0 && continuingBlocks.length === 0) {
          rowCells.push({ key: `empty-${timeIndex}-${dayIndex}`, type: 'empty' });
          return;
        }

        startingBlocks.forEach(item => {
          const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
          renderedBlocks.add(blockId);
          const duration = item.end - item.start;
          const rowSpan = Math.ceil(duration / 10);
          rowCells.push({
            key: `block-${blockId}`,
            type: 'block',
            rowSpan,
            block: item.block,
            className: courseColorMap.get(item.block.curso) || courseColor(item.block.curso, rowCells.length)
          });
        });
      });
      rows.push(rowCells);
    });

    const conflictAlert = (() => {
      if (!schedule.has_conflicts || !schedule.conflicts || schedule.conflicts.length === 0) return null;
      const hasOverlap = schedule.conflict_types?.includes('overlap');
      const hasTravel = schedule.conflict_types?.includes('travel_time');
      let title = '⚠️ Topones detectados';
      if (hasOverlap && hasTravel) title = '⚠️ Topón horario y de campus';
      else if (hasOverlap) title = '⚠️ Topón horario';
      else if (hasTravel) title = '⚠️ Topón de campus';
      return { title, items: schedule.conflicts };
    })();

    const validToponAlert = (() => {
      if (!schedule.has_valid_topones || !schedule.valid_topones || schedule.valid_topones.length === 0) return null;
      const hasCompleto = schedule.valid_topon_types?.includes('completo');
      const hasParcial = schedule.valid_topon_types?.includes('parcial');
      let title = '✅ Topones válidos';
      if (hasCompleto && hasParcial) title = '✅ Topones válidos (completo y parcial)';
      else if (hasCompleto) title = '✅ Topón válido completo';
      else if (hasParcial) title = '✅ Topón válido parcial';
      return { title, items: schedule.valid_topones };
    })();

    const infoBadges = (schedule.sections || []).map(sec => `${sec.course} • Sec ${sec.section} Grp ${sec.group}`);

    return { rows, conflictAlert, validToponAlert, infoBadges };
  }, [courseColorMap, schedule]);

  return (
    <div className="glass rounded-2xl border border-slate-800">
      {header ? <div className="p-4 border-b border-slate-800 bg-slate-900/40">{header}</div> : null}
      <div className="p-4 space-y-3">
        {infoBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {infoBadges.map(txt => (
              <span key={txt} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200">
                {txt}
              </span>
            ))}
          </div>
        )}
        {conflictAlert && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">
            <div className="font-semibold text-sm mb-1">{conflictAlert.title}</div>
            <ul className="text-xs space-y-1 list-disc pl-4">
              {conflictAlert.items?.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {validToponAlert && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-emerald-100">
            <div className="font-semibold text-sm mb-1">{validToponAlert.title}</div>
            <ul className="text-xs space-y-1 list-disc pl-4">
              {validToponAlert.items?.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="overflow-auto scrollbar-thin border border-slate-800 rounded-xl">
          <table className="w-full text-sm text-slate-100 table-fixed">
            <thead className="bg-slate-900/70">
              <tr>
                <th className="w-16 px-3 py-2 text-left text-xs font-semibold text-slate-400 border-b border-slate-800">Hora</th>
                {DAYS.map(day => (
                  <th key={day} className="px-3 py-2 text-left text-xs font-semibold text-indigo-300 border-b border-slate-800">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, rowIndex) => {
                const time = TIME_SLOTS[rowIndex];
                const showTime = time.endsWith(':00') || time.endsWith(':30');
                return (
                  <tr key={`row-${rowIndex}`} className={rowIndex % 6 === 0 ? 'bg-slate-900/30' : ''}>
                    <td className="align-top text-[11px] text-right text-slate-500 px-2 border-b border-slate-900 w-16">
                      {showTime ? time : ''}
                    </td>
                    {cells.map(cell => {
                      if (cell.type === 'empty') {
                        return <td key={cell.key} className="h-3 border-b border-slate-900" />;
                      }
                      if (cell.type === 'collision') {
                        return (
                          <td key={cell.key} rowSpan={cell.rowSpan} className="border border-slate-800 bg-slate-800/60 align-top">
                            <div className="flex flex-col gap-2">
                              {cell.blocks?.map(b => {
                                const color = courseColorMap.get(b.curso) || courseColor(b.curso, 0);
                                return (
                                  <div key={`${b.curso}-${b.seccion}-${b.grupo}-${b.hora_ini}`} className={clsx('rounded-lg p-2 shadow-lg', color)}>
                                    <div className="text-xs font-bold">{b.curso}</div>
                                    <div className="text-[11px] opacity-90">Sec {b.seccion} • Grp {b.grupo}</div>
                                    <div className="text-[11px] opacity-90">{b.hora_ini} - {b.hora_fin}</div>
                                    <div className="text-[11px] opacity-80">{getCampusShort(b.campus)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      }
                      if (cell.type === 'block' && cell.block) {
                        const b = cell.block;
                        return (
                          <td key={cell.key} rowSpan={cell.rowSpan} className={clsx('border border-slate-800 align-top', cell.className)}>
                            <div className="p-2 leading-tight">
                              <div className="text-xs font-bold">{b.curso}</div>
                              <div className="text-[11px] opacity-90">Sec {b.seccion} • Grp {b.grupo}</div>
                              <div className="text-[11px] opacity-90">{b.hora_ini} - {b.hora_fin}</div>
                              <div className="text-[11px] opacity-80">{getCampusShort(b.campus)}</div>
                            </div>
                          </td>
                        );
                      }
                      return null;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ScheduleGrid;
