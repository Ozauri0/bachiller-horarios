export type BannerData = { text: string; type?: 'success' | 'error' | 'info' } | null;

export default function Banner({ banner }: { banner: BannerData }) {
  if (!banner) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
        banner.type === 'success'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
          : banner.type === 'error'
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            : 'border-slate-700 bg-slate-800/80 text-slate-100'
      }`}
    >
      {banner.text}
    </div>
  );
}
