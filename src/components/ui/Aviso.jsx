// Mensajes de la interfaz: error (rojo), exito (verde), alerta/observado (ámbar), info (azul).
const ESTILOS = {
  error: {
    caja: 'bg-red-50 border-igss-red/40',
    icono: 'text-igss-red',
    titulo: 'text-igss-red-dark',
    texto: 'text-red-800',
    svg: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" />
      </svg>
    ),
  },
  exito: {
    caja: 'bg-igss-50 border-igss-400/50',
    icono: 'text-igss-600',
    titulo: 'text-igss-800',
    texto: 'text-igss-900',
    svg: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  alerta: {
    caja: 'bg-amber-50 border-amber-400/60',
    icono: 'text-amber-600',
    titulo: 'text-amber-800',
    texto: 'text-amber-800',
    svg: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" />
      </svg>
    ),
  },
  info: {
    caja: 'bg-blue-50 border-blue-300/60',
    icono: 'text-blue-600',
    titulo: 'text-blue-900',
    texto: 'text-blue-900',
    svg: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

export default function Aviso({ tipo = 'info', titulo, children, rol = 'status' }) {
  const estilo = ESTILOS[tipo] || ESTILOS.info
  return (
    <div
      role={rol}
      aria-live={tipo === 'error' ? 'assertive' : 'polite'}
      className={`rounded-xl border-2 px-4 py-3 flex items-start gap-3 ${estilo.caja}`}
    >
      <div className={`flex-shrink-0 mt-0.5 ${estilo.icono}`}>{estilo.svg}</div>
      <div className="min-w-0 text-sm">
        {titulo && <p className={`font-bold ${estilo.titulo}`}>{titulo}</p>}
        <div className={estilo.texto}>{children}</div>
      </div>
    </div>
  )
}
