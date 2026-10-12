import { fechaDMA, fechaLeida, diaGuatemala, hoyGuatemala, urlValidadorOficial } from './utiles.js'
import { BotonCopiar } from './CampoCopia.jsx'

// Indicadores de la verificación automática (adenda §6). Es una ayuda para
// Recepción: la revisión visual es la que decide.

export const AYUDA_VERIFICACION =
  'Verificación automática: es una ayuda; la revisión visual de Recepción es la que decide.'

const METODOS = {
  texto: 'leído del texto',
  ocr: 'leído por OCR',
  imagen: 'análisis de la imagen',
}

// Documentos de antecedentes cuyo resultado se resume en una frase leída
// (tanda 7): penales, policiacos y RENAS.
const CLAVES_CON_RESULTADO = ['antecedentes_penales', 'antecedentes_policiacos', 'renas']

// «Resultado leído» (tanda 7): la frase que la lectura automática buscó en el
// documento de antecedentes. `resultado` solo existe en el panel; el
// solicitante jamás lo recibe.
const RESULTADO_LEIDO = {
  SIN_ANTECEDENTES: {
    texto: 'sin antecedentes',
    clases: 'text-igss-700 font-semibold',
  },
  REVISAR: {
    texto: 'no se encontró la frase de “sin antecedentes”: lea el documento',
    clases: 'text-red-700 font-semibold',
  },
  NO_LEIDO: {
    texto: 'no se pudo leer',
    clases: 'text-gray-500',
  },
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
    trayecto: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
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

// «Leído del documento» (verificación v2): lo que el servidor extrajo del
// archivo — fechas, código de validación y tipo detectado — para cotejar con
// lo declarado. `fechaDeclarada` es la fecha que escribió la persona y
// `tituloDe` resuelve el título de otra clave de documento (para
// `tipo_detectado`). Todo dato ausente simplemente no se muestra.
function LeidoDelDocumento({ verificacion, fechaDeclarada, tituloDe }) {
  const emision = fechaLeida(verificacion.fecha_emision)
  const vence = fechaLeida(verificacion.fecha_vence)
  const declarada = diaGuatemala(fechaDeclarada)
  const difiere = Boolean(emision && declarada && diaGuatemala(verificacion.fecha_emision) !== declarada)
  const vencido = Boolean(vence && diaGuatemala(verificacion.fecha_vence) < hoyGuatemala())
  const codigo = verificacion.validacion?.codigo || null
  const url = typeof verificacion.validacion?.url === 'string' ? verificacion.validacion.url : ''
  // El enlace oficial solo se abre si pasa la lista de dominios; si no, texto plano.
  const urlSegura = urlValidadorOficial(url)
  const tituloDetectado = verificacion.tipo_detectado
    ? (tituloDe ? tituloDe(verificacion.tipo_detectado) : verificacion.tipo_detectado)
    : null

  if (!emision && !vence && !codigo && !url && !tituloDetectado) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/70 px-2.5 py-2 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
        Leído del documento
      </p>
      {emision && (
        <p className={`text-xs ${difiere ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
          Emisión: {emision}
          {difiere && <> ≠ declarada {fechaDMA(declarada)}</>}
        </p>
      )}
      {vence && (
        <p className={`text-xs ${vencido ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
          Vence: {vence}
          {vencido && ' (ya pasó)'}
        </p>
      )}
      {tituloDetectado && (
        <p className="text-xs text-red-700 font-semibold">Parece ser: {tituloDetectado}</p>
      )}
      {(codigo || url) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
          {codigo && (
            <span className="inline-flex items-center gap-1.5">
              Código de validación: <strong className="font-bold">{codigo}</strong>
              <BotonCopiar texto={codigo} etiqueta="código de validación" />
            </span>
          )}
          {url &&
            (urlSegura ? (
              <a
                href={urlSegura}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-igss-700 hover:text-igss-900 underline underline-offset-2"
              >
                Abrir validador oficial
              </a>
            ) : (
              // URL que no pasa la lista de dominios: se muestra, no se enlaza.
              <span className="break-all text-gray-500">{url}</span>
            ))}
        </div>
      )}
    </div>
  )
}

// Mientras la verificación está EN_PROCESO se muestra «Verificando…» y el
// expediente se vuelve a pedir cada 5 s (máximo 2 minutos). `claveDocumento`
// (la clave del casillero que se muestra) activa lo específico de la tanda 7:
// el chip de colegiado en la constancia activa y el «Resultado leído» en los
// documentos de antecedentes.
export default function IndicadorVerificacion({
  verificacion,
  fechaDeclarada,
  tituloDe,
  claveDocumento = null,
}) {
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
  // La lista de fechas crudas solo ayuda cuando no se pudo fijar la emisión:
  // si hay `fecha_emision`, esa línea ya lo cuenta.
  const mostrarFechas = !verificacion.fecha_emision && verificacion.fecha === 'NO_COINCIDE' && fechas.length > 0

  const esColegiadoActivo = claveDocumento === 'colegiado_activo'
  const resultadoLeido = CLAVES_CON_RESULTADO.includes(claveDocumento)
    ? RESULTADO_LEIDO[verificacion.resultado] || null
    : null

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <Chip etiqueta="Fecha" resultado={verificacion.fecha} />
        <Chip etiqueta="Persona" resultado={verificacion.identidad} />
        <Chip etiqueta="Tipo de documento" resultado={verificacion.tipo} />
        {esColegiadoActivo && <Chip etiqueta="N.º de colegiado" resultado={verificacion.colegiado} />}
      </div>
      {resultadoLeido && (
        <p className={`text-xs ${resultadoLeido.clases}`}>
          Resultado leído: {resultadoLeido.texto}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-2">
        {metodo}
        {verificacion.legible === false && (
          <span className="text-[10px] text-gray-500">
            Lectura automática poco fiable: el documento no se lee bien
          </span>
        )}
        {mostrarFechas && (
          <span className="text-[10px] text-red-700">
            Fechas encontradas en el documento: {fechas.join(', ')}
          </span>
        )}
      </div>
      <LeidoDelDocumento
        verificacion={verificacion}
        fechaDeclarada={fechaDeclarada}
        tituloDe={tituloDe}
      />
    </div>
  )
}
