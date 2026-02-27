export default function AppFooter() {
  return (
    <footer className="w-full border-t border-slate-800/60 bg-slate-950 py-6 mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Desarrollado por{' '}
          <a
            href="https://christianferrer.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            Christian Ferrer
          </a>{' '}
          &copy; 2026
        </span>
        <span>Universidad Católica de Temuco</span>
      </div>
    </footer>
  );
}
