// `estados`: por paso, 'completo' (verde con ✓), 'incompleto' (ámbar con «!»,
// se visitó y le falta algo) o 'pendiente' (aún sin visitar). Sin `estados` se
// deduce del avance: los pasos pasados se ven completos.
export default function ProgressBar({ pasoActual, totalPasos, etiquetas, onIrA, estados = [] }) {
  return (
    <div className="mb-8">
      {/* Puntos con línea conectora */}
      <div className="relative flex justify-between items-start">
        {/* Línea de fondo */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
        {/* Línea de avance */}
        <div
          className="absolute top-4 left-4 h-0.5 transition-all duration-700 ease-out"
          style={{
            width: `calc(${((pasoActual - 1) / (totalPasos - 1)) * 100}% - 32px + ${(pasoActual - 1) / (totalPasos - 1) * 32}px)`,
            background: 'linear-gradient(90deg, #1B5E20, #2E7D32)',
          }}
        />

        {Array.from({ length: totalPasos }, (_, idx) => idx + 1).map((numero) => {
          const estado = estados[numero - 1] || (numero < pasoActual ? 'completo' : 'pendiente')
          const esActual = numero === pasoActual
          const esClicable = typeof onIrA === 'function' && numero < pasoActual && estado !== 'pendiente'
          const etiqueta = etiquetas[numero - 1] || ''

          const clasesCirculo = `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
            estado === 'completo'
              ? `bg-igss-700 text-white shadow-sm ${esClicable ? 'hover:bg-igss-800 hover:shadow-md' : ''}`
              : estado === 'incompleto'
                ? `bg-amber-400 text-amber-950 shadow-sm ${esClicable ? 'hover:bg-amber-500 hover:text-white' : ''}`
                : esActual
                  ? 'bg-igss-gold text-white shadow-md ring-[3px] ring-igss-gold/25'
                  : 'bg-white text-gray-400 border-2 border-gray-200'
          }`

          const clasesEtiqueta = `text-[9px] mt-1.5 text-center leading-tight hidden sm:block max-w-[64px] ${
            esActual
              ? 'text-igss-800 font-bold'
              : estado === 'completo'
                ? 'text-igss-600 font-medium'
                : estado === 'incompleto'
                  ? 'text-amber-700 font-bold'
                  : 'text-gray-400'
          }`

          const interior = (
            <>
              <div className={clasesCirculo}>
                {estado === 'completo' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : estado === 'incompleto' ? (
                  '!'
                ) : (
                  numero
                )}
              </div>
              <span className={clasesEtiqueta}>{etiqueta}</span>
            </>
          )

          return (
            <div
              key={numero}
              aria-label={estado === 'incompleto' ? `Paso ${numero}, incompleto` : undefined}
              className="relative flex flex-col items-center z-10"
              style={{ width: `${100 / totalPasos}%` }}
            >
              {esClicable ? (
                <button
                  type="button"
                  onClick={() => onIrA(numero)}
                  title={`Volver al paso ${numero}: ${etiqueta}`}
                  aria-label={`Volver al paso ${numero}: ${etiqueta}`}
                  className="flex flex-col items-center bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-igss-gold/50 rounded-full"
                >
                  {interior}
                </button>
              ) : (
                <div className="flex flex-col items-center" aria-current={esActual ? 'step' : undefined}>
                  {interior}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Etiqueta del paso actual en pantallas pequeñas */}
      <div className="flex items-center justify-between mt-4 sm:hidden">
        <span className="text-xs font-bold text-igss-800">
          Paso {pasoActual}/{totalPasos}
        </span>
        <span className="text-xs font-semibold text-igss-gold-dark">
          {etiquetas[pasoActual - 1]}
        </span>
      </div>
    </div>
  )
}
