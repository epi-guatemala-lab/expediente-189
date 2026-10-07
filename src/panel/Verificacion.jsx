import { fechaDMA } from './utiles.js'

// Indicadores de la verificación automática (adenda §6). Es una ayuda para
// Recepción: la revisión visual es la que decide.

export const AYUDA_VERIFICACION =
  'Verificación automática: es una ayuda; la revisión visual de Recepción es la que decide.'

const METODOS = {
  texto: 'leído del texto',
  ocr: 'leído por OCR',
}

const RESULTADOS = {
  COINCIDE: {
    texto: 'Coincide',
    clases: 'bg-igss-50 border-igss-200 text-igss-800',
    trayecto:
      'M5 13l4 4L19 7',
  },
  NO_COINCIDE: {
    texto: 'No coincide',
    clases: 'bg-red-50 border-red-300 text-red-800',
    trayecto: 'M6 18L18 6M6 6l12 12',
  },
  NO_LEIDA: {
    texto: 'No se pudo leer',
    clases: 'bg-gray-100 border-gray-300 text-gray-500',
    trayecto: '8.228 9c.183-.183.38-.35.586-.506M12 8.25h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

function Chip({ etiqueta, resultado }) {
  const estilo = RESULTADOS[resultado] || RESULTADOS.NO_LEIDA
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estilo.clases}`}
      title={`${etiqueta}: ${estilo.texto}`}
    >
      <svg
        className={`w-3 h-3 ${resultado === 'NO_LEIDA' ? 'stroke-[1.5]' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={estilo.trayecto} />
      </svg>
      {etiqueta}: {estilo.texto}
    </span>
  )
}

// Mientras la verificación está EN_PROCESO se muestra «Verificando…» y el
// expediente se vuelve a pedir cada 5 s (máximo 2 minutos).
export default function IndicadorVerificacion({ verificacion }) {
  if (!verificacion || verificacion.estado === 'NO_DISPONIBLE') return null
  if (verificacion.estado === 'EN_PROCESO') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
        <svg className="w-3 h-3 border-2 border-gray-300 border-t-igss-600 rounded-full animate-spin" viewBox="0 0 24 24" />
        Verificando…
      </span>
    )
  }

  const metodo = METODOS[verificacion.metodo] ? (
    <span className="text-[10px] text-gray-400">
      Método: {METODOS[verificacion.metodo]}
    </span>
  ) : null

  const fechas = (verificacion.fechas_detectadas || []).filter(Boolean).map(fechaDMA)
  const mostrarFechas = verificacion.fecha === 'NO_COINCIDE' && fechas.length > 0

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <Chip etiqueta="Fecha" resultado={verificacion.fecha} />
        <Chip etiqueta="Persona" resultado={verificacion.identidad} />
        <Chip etiqueta="Tipo de documento" resultado={verificacion.tipo} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2">
        {metodo}
        {mostrarFechas && (
          <span className="text-[10px] text-red-700">
            Fechas encontradas en el documento: {fechas.join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
