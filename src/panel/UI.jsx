// Piezas compartidas del panel: píldora de estado, paginación y aviso de carga.
import { ETIQUETAS_ESTADO } from '../lib/formato.js'

const ESTILOS_ESTADO = {
  SIN_INICIAR: 'bg-gray-100 text-gray-600 border-gray-300',
  BORRADOR: 'bg-amber-50 text-amber-800 border-amber-300',
  ENVIADO: 'bg-blue-50 text-blue-800 border-blue-300',
  OBSERVADO: 'bg-orange-50 text-orange-800 border-orange-300',
  APROBADO: 'bg-igss-100 text-igss-800 border-igss-300',
}

export function PildoraEstado({ estado, pequeña = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide ${
        pequeña ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
      } ${ESTILOS_ESTADO[estado] || ESTILOS_ESTADO.SIN_INICIAR}`}
    >
      {ETIQUETAS_ESTADO[estado] || estado}
    </span>
  )
}

export function Paginacion({ page, total, limit, alCambiar }) {
  const paginas = Math.max(1, Math.ceil((total || 0) / (limit || 1)))
  const desde = total === 0 ? 0 : (page - 1) * limit + 1
  const hasta = Math.min(page * limit, total || 0)
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 mt-3"
    >
      <p className="text-xs text-gray-500">
        Mostrando {desde}–{hasta} de {total ?? 0}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => alCambiar(page - 1)}
          disabled={page <= 1}
          className="py-1.5 px-3 rounded-lg border-2 border-gray-200 text-gray-600 text-xs font-semibold hover:border-igss-400 hover:text-igss-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
        >
          ← Anterior
        </button>
        <span className="text-xs text-gray-500 tabular-nums" aria-live="polite">
          Página {page} de {paginas}
        </span>
        <button
          type="button"
          onClick={() => alCambiar(page + 1)}
          disabled={page >= paginas}
          className="py-1.5 px-3 rounded-lg border-2 border-gray-200 text-gray-600 text-xs font-semibold hover:border-igss-400 hover:text-igss-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
        >
          Siguiente →
        </button>
      </div>
    </nav>
  )
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="text-center py-12" role="status">
      <div className="inline-block w-8 h-8 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500 mt-3">{texto}</p>
    </div>
  )
}
