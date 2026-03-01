'use client';

import { useMemo } from 'react';
import clsx from 'classnames';
import { CourseOption, ScheduleBlock, ScheduleResult } from '@/lib/types';

const DAYS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const DAY_HEADER_HEIGHT = 34; // px, to align time labels with the start of blocks

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

function minutesToTime(min: number) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
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

type PositionedBlock = {
  block: ScheduleBlock;
  dayIndex: number;
  startMin: number;
  endMin: number;
  color: string;
  colIndex: number;
  colTotal: number;
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

  const { positionedBlocks, timeRange, hourMarkers, conflictAlert, validToponAlert, infoBadges } = useMemo(() => {
    const blocks = schedule.blocks || [];

    // Compute time range
    const starts = blocks.map(b => timeToMinutes(b.hora_ini)).filter(n => n > 0);
    const ends = blocks.map(b => timeToMinutes(b.hora_fin)).filter(n => n > 0);
    let rangeStart = starts.length ? Math.min(...starts) : 8 * 60;
    let rangeEnd = ends.length ? Math.max(...ends) : 21 * 60;
    // Pad and round to full hours
    rangeStart = Math.max(7 * 60, Math.floor(rangeStart / 60) * 60);
    rangeEnd = Math.min(22 * 60, Math.ceil(rangeEnd / 60) * 60);
    const duration = rangeEnd - rangeStart;
    const timeRange = { start: rangeStart, end: rangeEnd, duration: duration || 1 };

    // Hour markers
    const hourMarkers: number[] = [];
    for (let h = rangeStart; h <= rangeEnd; h += 60) {
      hourMarkers.push(h);
    }

    // Group blocks by day and deduplicate
    const dayBlocks: { block: ScheduleBlock; start: number; end: number; id: string }[][] = [[], [], [], [], []];
    blocks.forEach(b => {
      const dayKey = normalizeDayName(b.dia);
      const dayIndex = DAYS.indexOf(dayKey);
      if (dayIndex === -1) return;
      const start = timeToMinutes(b.hora_ini);
      const end = timeToMinutes(b.hora_fin);
      const id = `${b.curso}_${b.seccion}_${b.grupo}_${b.hora_ini}_${b.dia}`;
      if (!dayBlocks[dayIndex].find(x => x.id === id)) {
        dayBlocks[dayIndex].push({ block: b, start, end, id });
      }
    });

    // Detect overlaps per day and assign columns using greedy lane allocation
    const positionedBlocks: PositionedBlock[] = [];
    dayBlocks.forEach((dayItems, dayIndex) => {
      const sorted = dayItems.slice().sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

      const lanes: { end: number }[] = [];
      const assignments: { item: typeof sorted[0]; lane: number }[] = [];

      sorted.forEach(item => {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
          if (item.start >= lanes[i].end) {
            lanes[i].end = item.end;
            assignments.push({ item, lane: i });
            placed = true;
            break;
          }
        }
        if (!placed) {
          lanes.push({ end: item.end });
          assignments.push({ item, lane: lanes.length - 1 });
        }
      });

      // For each block, determine colTotal by finding max overlapping lanes
      assignments.forEach(a => {
        const overlapping = assignments.filter(o =>
          o.item.start < a.item.end && o.item.end > a.item.start
        );
        const maxLane = Math.max(...overlapping.map(o => o.lane)) + 1;
        const color = courseColorMap.get(a.item.block.curso) || courseColor(a.item.block.curso, a.lane);
        positionedBlocks.push({
          block: a.item.block,
          dayIndex,
          startMin: a.item.start,
          endMin: a.item.end,
          color,
          colIndex: a.lane,
          colTotal: maxLane
        });
      });
    });

    // Alerts
    const conflictAlert = (() => {
      if (!schedule.has_conflicts || !schedule.conflicts || schedule.conflicts.length === 0) return null;
      const uniqueConflicts = Array.from(new Set(schedule.conflicts));
      const hasOverlap = schedule.conflict_types?.includes('overlap');
      const hasTravel = schedule.conflict_types?.includes('travel_time');
      let title = '⚠️ Topones detectados';
      if (hasOverlap && hasTravel) title = '⚠️ Topón horario y de campus';
      else if (hasOverlap) title = '⚠️ Topón horario';
      else if (hasTravel) title = '⚠️ Topón de campus';
      return { title, items: uniqueConflicts };
    })();

    const validToponAlert = (() => {
      if (!schedule.has_valid_topones || !schedule.valid_topones || schedule.valid_topones.length === 0) return null;
      const uniqueValid = Array.from(new Set(schedule.valid_topones));
      const hasCompleto = schedule.valid_topon_types?.includes('completo');
      const hasParcial = schedule.valid_topon_types?.includes('parcial');
      let title = '✅ Topones válidos';
      if (hasCompleto && hasParcial) title = '✅ Topones válidos (completo y parcial)';
      else if (hasCompleto) title = '✅ Topón válido completo';
      else if (hasParcial) title = '✅ Topón válido parcial';
      return { title, items: uniqueValid };
    })();

    const infoBadges = (schedule.sections || []).map(sec => `${sec.course} • Sec ${sec.section} Grp ${sec.group}`);

    return { positionedBlocks, timeRange, hourMarkers, conflictAlert, validToponAlert, infoBadges };
  }, [courseColorMap, schedule]);

  // Responsive grid height: ~72vh capped at 660px
  const gridHeight = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.72, 660) : 560;

  const showInfoBadges = infoBadges.length > 0 && !header;

  return (
    <div className="glass rounded-2xl border border-slate-800 flex flex-col">
      {header ? <div className="p-3 border-b border-slate-800 bg-slate-900/40">{header}</div> : null}
      <div className="p-3 space-y-2 flex-1">
        {showInfoBadges && (
          <div className="flex flex-wrap gap-2">
            {infoBadges.map(txt => (
              <span key={txt} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200">
                {txt}
              </span>
            ))}
          </div>
        )}
        {conflictAlert && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-amber-100">
            <div className="font-semibold text-sm mb-1">{conflictAlert.title}</div>
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              {conflictAlert.items?.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {validToponAlert && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-2 text-emerald-100">
            <div className="font-semibold text-sm mb-1">{validToponAlert.title}</div>
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              {validToponAlert.items?.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Schedule grid with absolute positioning */}
        <div className="flex rounded-xl overflow-hidden border border-slate-800/40" style={{ height: gridHeight }}>
          {/* Time label column */}
          <div className="w-14 flex-shrink-0 relative bg-slate-900/50 border-r border-slate-800/30">
            {hourMarkers.map(min => {
              const pct = ((min - timeRange.start) / timeRange.duration) * 100;
              return (
                <div
                  key={`time-${min}`}
                  className="absolute text-[12px] text-slate-400 text-right pr-2 w-full leading-none"
                  style={{ top: `calc(${pct}% + ${DAY_HEADER_HEIGHT}px)`, transform: 'translateY(-50%)' }}
                >
                  {minutesToTime(min)}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex-1 flex flex-col min-w-0">
              {/* Day header */}
              <div className="text-center text-xs font-semibold text-indigo-300 py-1.5 bg-slate-900/60 border-b border-slate-800/30 flex-shrink-0 border-l border-slate-800/20" style={{ height: DAY_HEADER_HEIGHT }}>
                {day}
              </div>

              {/* Block container - relative for absolute children */}
              <div className="flex-1 relative border-l border-slate-800/20">
                {/* Hour guidelines */}
                {hourMarkers.map(min => {
                  const pct = ((min - timeRange.start) / timeRange.duration) * 100;
                  return (
                    <div
                      key={`guide-${dayIndex}-${min}`}
                      className="absolute w-full border-t border-slate-800/20"
                      style={{ top: `${pct}%` }}
                    />
                  );
                })}

                {/* Positioned blocks */}
                {positionedBlocks
                  .filter(pb => pb.dayIndex === dayIndex)
                  .map((pb, idx) => {
                    const topPct = ((pb.startMin - timeRange.start) / timeRange.duration) * 100;
                    const heightPct = ((pb.endMin - pb.startMin) / timeRange.duration) * 100;
                    const widthPct = 100 / pb.colTotal;
                    const leftPct = pb.colIndex * widthPct;
                    // Small gap between side-by-side blocks
                    const gapPx = pb.colTotal > 1 ? 1 : 0;

                    return (
                      <div
                        key={`${pb.block.curso}-${pb.block.seccion}-${pb.block.grupo}-${pb.block.hora_ini}-${idx}`}
                        className={clsx(
                          'absolute rounded-xl overflow-hidden text-center flex flex-col justify-center',
                          'shadow-[0_3px_12px_rgba(0,0,0,0.2)] outline outline-1 outline-white/10',
                          pb.color
                        )}
                        style={{
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                          left: `calc(${leftPct}% + ${gapPx}px)`,
                          width: `calc(${widthPct}% - ${gapPx * 2}px)`,
                          padding: '2px 4px',
                          zIndex: 5,
                          minHeight: 0
                        }}
                      >
                        <div className="text-[13px] font-bold leading-tight truncate">{pb.block.curso}</div>
                        <div className="text-[11px] opacity-90 leading-tight truncate">Sec {pb.block.seccion} • Grp {pb.block.grupo}</div>
                        <div className="text-[11px] opacity-90 leading-tight truncate">{pb.block.hora_ini} - {pb.block.hora_fin}</div>
                        <div className="text-[11px] opacity-80 leading-tight truncate">{getCampusShort(pb.block.campus)}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScheduleGrid;
