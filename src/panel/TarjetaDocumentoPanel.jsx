import { useEffect, useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import { ETIQUETAS_REVISION, formatoTamano } from '../lib/formato.js'
import { obtenerArchivoDocumento, obtenerVistaDocumento } from '../api/panel.js'
import { descargarBlob, fechaDMA } from './utiles.js'
import IndicadorVerificacion, { AYUDA_VERIFICACION } from './Verificacion.jsx'
import { ModalTexto } from './Modal.jsx'

// Textos de alerta para Recepción (los ve quien revisa, con la fecha que
// declaró la persona).
export const TEXTOS_ALERTAS_PANEL = {
  FUERA_DE_VIGENCIA: 'La fecha declarada está fuera del período pedido.',
  NO_CUBRE_2027: 'No cubre todo el año 2027.',
}

// Títulos y etiquetas del CONTRATO §4, por si /config no está disponible.
const FALLBACK_DOCS = {
  foto: { titulo: 'Fotografía reciente tipo cédula', etiqueta_fecha: null },
  antecedentes_penales: { titulo: 'Antecedentes penales', etiqueta_fecha: 'Fecha de emisión' },
  antecedentes_policiacos: { titulo: 'Antecedentes policíacos', etiqueta_fecha: 'Fecha de emisión' },
  rtu: { titulo: 'RTU emitido por la SAT (ratificado)', etiqueta_fecha: 'Fecha de ratificación' },
  renas: { titulo: 'Constancia RENAS', etiqueta_fecha: 'Fecha de generación' },
  colegiado_activo: { titulo: 'Constancia de colegiado activo', etiqueta_fecha: 'Activo hasta' },
  banrural: { titulo: 'Consulta no monetaria de Banrural', etiqueta_fecha: 'Fecha de la consulta' },
  carta_recomendacion: { titulo: 'Carta de recomendación personal', etiqueta_fecha: 'Fecha de la carta' },
}

export function definicionPara(clave, config) {
  const deConfig = (config?.documentos || []).find((d) => d.clave === clave)
  return deConfig || FALLBACK_DOCS[clave] || { titulo: clave, etiqueta_fecha: 'Fecha' }
}

const ESTILOS_REVISION = {
  ACEPTADO: 'bg-igss-100 text-igss-800 border-igss-300',
  RECHAZADO: 'bg-red-100 text-igss-red-dark border-igss-red/40',
  PENDIENTE: 'bg-gray-100 text-gray-600 border-gray-300',
}

export default function TarjetaDocumentoPanel({
  expedienteId,
  documento,
  definicion,
  alRevisar,
  alAbrirVisor,
  puedeRevisar = false,
}) {
  const [miniatura, setMiniatura] = useState(null)
  const [cargandoMiniatura, setCargandoMiniatura] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [error, setError] = useState(null)

  // Miniatura de la página 1: se pide con el token y se muestra como blob:,
  // que se revoca al cambiar o desmontar.
  useEffect(() => {
    let vivo = true
    let urlCreada = null
    if (documento.cargado) {
      setCargandoMiniatura(true)
      obtenerVistaDocumento(expedienteId, documento.clave, 1)
        .then(({ blob }) => {
          if (!vivo) return
          urlCreada = URL.createObjectURL(blob)
          setMiniatura(urlCreada)
        })
        .catch(() => {
          if (vivo) setMiniatura(null)
        })
        .finally(() => {
          if (vivo) setCargandoMiniatura(false)
        })
    } else {
      setMiniatura(null)
    }
    return () => {
      vivo = false
      if (urlCreada) URL.revokeObjectURL(urlCreada)
    }
  }, [expedienteId, documento.clave, documento.cargado, documento.cargado_at])

  const revision = documento.revision?.estado

  const descargar = async () => {
    setDescargando(true)
    setError(null)
    try {
      const { blob, nombre } = await obtenerArchivoDocumento(expedienteId, documento.clave)
      descargarBlob(blob, nombre || `${documento.clave}.${documento.tipo === 'jpg' ? 'jpg' : 'pdf'}`)
    } catch (e) {
      if (e?.status !== 401) setError(e?.detail || 'No se pudo descargar el archivo.')
    } finally {
      setDescargando(false)
    }
  }

  const aceptar = () => alRevisar(documento.clave, 'ACEPTADO')
  const deshacer = () => alRevisar(documento.clave, 'PENDIENTE')
  // ACEPTADO/RECHAZADO ya tienen decisión: solo se ofrece deshacerla.
  const conDecision = revision === 'ACEPTADO' || revision === 'RECHAZADO'

  return (
    <div
      className={`rounded-2xl border-2 p-4 bg-white transition-colors ${
        revision === 'RECHAZADO'
          ? 'border-igss-red/50 bg-red-50/30'
          : documento.cargado
            ? 'border-igss-600/30'
            : 'border-gray-200 opacity-80'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-igss-900 leading-snug">{definicion.titulo}</h3>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {!documento.requerido && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">
              No requerido
            </span>
          )}
          {revision && (
            <span
              className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ESTILOS_REVISION[revision] || ESTILOS_REVISION.PENDIENTE}`}
            >
              {revision === 'ACEPTADO' ? 'Aceptado ✓' : ETIQUETAS_REVISION[revision] || revision}
            </span>
          )}
          {!documento.cargado && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">
              Sin cargar
            </span>
          )}
        </div>
      </div>

      {!documento.cargado ? (
        <p className="text-xs text-gray-400 py-2">
          La persona todavía no cargó este documento.
        </p>
      ) : (
        <>
          {/* Miniatura (página 1) */}
          <div className="mb-3 flex items-start gap-3">
            <button
              type="button"
              onClick={() => alAbrirVisor(documento.clave)}
              aria-label={`Ver ${definicion.titulo} en pantalla completa`}
              className="w-24 h-32 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center hover:border-igss-400 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/15"
            >
              {cargandoMiniatura ? (
                <span className="w-5 h-5 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
              ) : miniatura ? (
                <img
                  src={miniatura}
                  alt={`Página 1 de ${definicion.titulo}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-gray-400 text-center px-1">Sin vista</span>
              )}
            </button>
            <div className="text-xs text-gray-600 space-y-1 min-w-0">
              {definicion.etiqueta_fecha && (
                <p>
                  <span className="font-semibold">{definicion.etiqueta_fecha}:</span>{' '}
                  {documento.fecha_documento ? (
                    <span className="font-bold text-igss-900">{fechaDMA(documento.fecha_documento)}</span>
                  ) : (
                    <span className="text-gray-400">no declarada</span>
                  )}
                </p>
              )}
              {documento.paginas > 0 && <p>Páginas: {documento.paginas}</p>}
              {documento.tamano > 0 && <p>Tamaño: {formatoTamano(documento.tamano)}</p>}
            </div>
          </div>

          {/* Alertas en ámbar */}
          {(documento.alertas || []).length > 0 && (
            <div className="mb-3 space-y-2">
              {documento.alertas.map((alerta) => (
                <Aviso key={alerta} tipo="alerta">
                  {TEXTOS_ALERTAS_PANEL[alerta] || alerta}
                </Aviso>
              ))}
            </div>
          )}

          {/* Verificación automática (ayuda; la revisión visual decide) */}
          {documento.verificacion && (
            <div className="mb-3 space-y-1">
              <IndicadorVerificacion verificacion={documento.verificacion} />
              <p className="text-[10px] text-gray-400">{AYUDA_VERIFICACION}</p>
            </div>
          )}

          {revision === 'RECHAZADO' && documento.revision?.motivo && (
            <div className="mb-3">
              <Aviso tipo="error" titulo="Motivo del rechazo">
                {documento.revision.motivo}
              </Aviso>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => alAbrirVisor(documento.clave)}
              className="py-2 px-4 rounded-xl border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
            >
              Ver
            </button>
            <button
              type="button"
              onClick={descargar}
              disabled={descargando}
              className="py-2 px-4 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-400 font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 disabled:opacity-50"
            >
              {descargando ? 'Descargando…' : 'Descargar'}
            </button>
            {/* La revisión solo existe con el expediente ENVIADO; en otros
                estados el servidor rechaza la acción. */}
            {puedeRevisar && !conDecision && (
              <>
                <button
                  type="button"
                  onClick={aceptar}
                  className="py-2 px-4 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-xs transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => setRechazando(true)}
                  className="py-2 px-4 rounded-xl border-2 border-igss-red/40 text-igss-red hover:bg-red-50 font-bold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/15"
                >
                  Rechazar
                </button>
              </>
            )}
            {puedeRevisar && conDecision && (
              <button
                type="button"
                onClick={deshacer}
                title="Devolver el documento a pendiente de revisión"
                className="py-2 px-3 text-xs font-semibold text-gray-500 hover:text-igss-800 underline underline-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
              >
                Deshacer
              </button>
            )}
          </div>

          {error && (
            <p aria-live="polite" className="mt-2 text-xs text-igss-red font-medium">
              {error}
            </p>
          )}
        </>
      )}

      {rechazando && (
        <ModalTexto
          titulo={`Rechazar: ${definicion.titulo}`}
          descripcion="Escriba el motivo que verá la persona. Debe ser claro y breve."
          min={5}
          max={300}
          placeholder="Motivo del rechazo (por ejemplo: el documento está ilegible)."
          textoBoton="Rechazar documento"
          alCancelar={() => setRechazando(false)}
          alConfirmar={async (motivo) => {
            try {
              await alRevisar(documento.clave, 'RECHAZADO', motivo)
            } finally {
              setRechazando(false)
            }
          }}
        />
      )}
    </div>
  )
}
