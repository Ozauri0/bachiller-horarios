'use client';

type TabKey = 'horarios' | 'config' | 'datos' | 'carga';

interface AppHeaderProps {
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

function TabButton({ value, label, active, onClick }: { value: TabKey; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-4 py-1.5 text-sm font-medium rounded-md bg-slate-800 text-white shadow-sm'
          : 'px-4 py-1.5 text-sm font-medium rounded-md text-slate-400 hover:text-white'
      }
    >
      {label}
    </button>
  );
}

export default function AppHeader({ tab, onTabChange }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      {/* Contenedor relativo para posicionar menú centrado absoluto */}
      <div className="relative max-w-7xl mx-auto flex items-center h-14 px-2 sm:px-4">
        {/* Logo y título – pegados a la izquierda */}
        <div className="flex items-center gap-2 sm:gap-3 z-10">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 sm:p-2 rounded-lg shadow-lg shadow-indigo-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm0 0v6.5" />
            </svg>
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">Generador de Horarios</h1>
        </div>

        {/* Menú de navegación – centrado absoluto en pantallas md+, debajo en móvil */}
        <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
          <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner gap-1 pointer-events-auto">
            <TabButton value="horarios" label="Horarios" active={tab === 'horarios'} onClick={() => onTabChange('horarios')} />
            <TabButton value="config" label="Configuración" active={tab === 'config'} onClick={() => onTabChange('config')} />
            <TabButton value="datos" label="Datos" active={tab === 'datos'} onClick={() => onTabChange('datos')} />
            <TabButton value="carga" label="Carga Masiva" active={tab === 'carga'} onClick={() => onTabChange('carga')} />
          </div>
        </div>
      </div>

      {/* Menú en móvil: debajo del header en su propia fila */}
      <div className="md:hidden flex justify-center pb-2 px-2">
        <div className="inline-flex flex-wrap justify-center p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner gap-1">
          <TabButton value="horarios" label="Horarios" active={tab === 'horarios'} onClick={() => onTabChange('horarios')} />
          <TabButton value="config" label="Configuración" active={tab === 'config'} onClick={() => onTabChange('config')} />
          <TabButton value="datos" label="Datos" active={tab === 'datos'} onClick={() => onTabChange('datos')} />
          <TabButton value="carga" label="Carga Masiva" active={tab === 'carga'} onClick={() => onTabChange('carga')} />
        </div>
      </div>
    </header>
  );
}
