import React from 'react';

export type BadgeTone = 'indigo' | 'emerald' | 'rose' | 'amber';

const toneMap: Record<BadgeTone, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/30',
  emerald: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
  rose: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
  amber: 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
};

export function Badge({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${toneMap[tone]}`}>{children}</span>;
}

export default Badge;
