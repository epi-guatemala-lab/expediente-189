import { useEffect, useRef, useState } from 'react'
import { ETIQUETAS_REVISION } from '../lib/formato.js'
import { obtenerVistaDocumento } from '../api/panel.js'
import { fechaDMA } from './utiles.js'
import IndicadorVerificacion, { AYUDA_VERIFICACION } from './Verificacion.jsx'
import Modal, { ModalTexto } from './Modal.jsx'

// Visor de documento a pantalla completa: páginas como imagen (nunca HTML),
// navegación con flechas del teclado, acercar/alejar, girar y cierre con Esc.
// Los botones Aceptar/Rechazar también están aquí, con la fecha declarada a
// la vista para cotejar. Todas las URL blob: se revocan al cerrar o cambiar
// de documento.
export default function VisorDocumento({
  expedienteId,
  documento,
  definicion,
  alRevisar,
  alCerrar,
}) {
  const [pagina, setPagina] = useState(1)
  const [url, setUrl] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [escala, setEscala] = useState(1)
  const [rotacion, setRotacion] = useState(0)
  const [dimensiones, setDimensiones] = useState(null)
  const [rechazando, setRechazando] = useState(false)
  const referencias = useRef(new Map())
  const dialogo = useRef(null)

  // Al cerrar o desmontar: revoca todas las páginas pedidas.
  useEffect(() => {
    const urls = referencias.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [expedienteId, documento.clave])

  // Página actual: usa la caché de blobs del documento.
  useEffect(() => {
    let vivo = true
    const llavePagina = `${documento.clave}:${pagina}`
    const enCache = referencias.current.get(llavePagina)
    if (enCache) {
      setUrl(enCache)
      setError(null)
      setCargando(false)
      return undefined
    }
    setCargando(true)
    setError(null)
    obtenerVistaDocumento(expedienteId, documento.clave, pagina)
      .then(({ blob }) => {
        if (!vivo) return
        const nueva = URL.createObjectURL(blob)
        referencias.current.set(llavePagina, nueva)
        setUrl(nueva)
      })
      .catch((e) => {
        if (!vivo) return
        if (e?.status === 401) return
        setError(e?.detail || 'No se pudo cargar la página.')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [expedienteId, documento.clave, pagina])

  const totalPaginas = documento.paginas || 1

  // Flechas del teclado: ← página anterior, → siguiente. Se ignoran mientras
  // se escribe en un campo o si hay otro diálogo encima (el motivo de rechazo).
  useEffect(() => {
    function dialogoTope() {
      const dialogos = Array.from(document.querySelectorAll('[role="dialog"]'))
      return dialogos[dialogos.length - 1] === dialogo.current?.closest('[role="dialog"]')
    }
    function alTeclear(e) {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')
      if (enCampo || !dialogoTope()) return
      if (e.key === 'ArrowLeft' && pagina > 1) {
        e.preventDefault()
        setPagina((p) => p - 1)
      } else if (e.key === 'ArrowRight' && pagina < totalPaginas) {
        e.preventDefault()
        setPagina((p) => p + 1)
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [pagina, totalPaginas])

  const girado = rotacion === 90 || rotacion === 270
  const anchoNatural = dimensiones ? (girado ? dimensiones.alto : dimensiones.ancho) : 0
  const altoNatural = dimensiones ? (girado ? dimensiones.ancho : dimensiones.alto) : 0

  const cambiarEscala = (cambio) => {
    setEscala((e) => Math.min(4, Math.max(0.25, Math.round((e + cambio) * 4) / 4)))
  }

  const revision = documento.revision?.estado

  const botonBase =
    'py-1.5 px-3 rounded-lg border-2 border-white/30 text-white text-xs font-semibold hover:bg-white/15 transition-colors focus:outline-none focus:ring-4 focus:ring-white/30 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <Modal titulo={definicion.titulo} alCerrar={alCerrar} pantallaCompleta>
      <div ref={dialogo} className="flex flex-col h-full">
        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-igss-900 text-white">
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar el visor"
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors focus:outline-none focus:ring-4 focus:ring-white/30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-sm font-bold flex-1 min-w-[10rem] truncate">{definicion.titulo}</h2>
          {definicion.etiqueta_fecha && (
            <span className="text-xs bg-white/10 rounded-full px-3 py-1">
              {definicion.etiqueta_fecha}:{' '}
              <strong>{documento.fecha_documento ? fechaDMA(documento.fecha_documento) : 'no declarada'}</strong>
            </span>
          )}
          {revision && (
            <span className="text-[10px] font-bold uppercase tracking-wide bg-white/10 rounded-full px-3 py-1">
              {ETIQUETAS_REVISION[revision] || revision}
            </span>
          )}
          <button
            type="button"
            onClick={() => alRevisar(documento.clave, 'ACEPTADO')}
            className="py-1.5 px-3 rounded-lg bg-igss-600 hover:bg-igss-500 text-white text-xs font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-white/30"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="py-1.5 px-3 rounded-lg bg-igss-red hover:bg-igss-red-dark text-white text-xs font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-white/30"
          >
            Rechazar
          </button>
        </div>

        {/* Verificación (ayuda; la revisión visual decide) */}
        {documento.verificacion && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 bg-igss-50 border-b border-igss-100">
            <IndicadorVerificacion verificacion={documento.verificacion} />
            <span className="text-[10px] text-gray-400">{AYUDA_VERIFICACION}</span>
          </div>
        )}

        {/* Página como imagen */}
        <div className="flex-1 min-h-0 overflow-auto bg-gray-800">
          <div className="min-w-full min-h-full flex items-center justify-center p-4">
            {cargando && !url ? (
              <div className="text-center" role="status">
                <div className="inline-block w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-gray-300 mt-3">Cargando la página…</p>
              </div>
            ) : url ? (
              <div
                style={
                  dimensiones
                    ? { width: anchoNatural * escala, height: altoNatural * escala }
                    : undefined
                }
                className="max-w-none"
              >
                <img
                  src={url}
                  alt={`Página ${pagina} de ${totalPaginas} — ${definicion.titulo}`}
                  onLoad={(e) =>
                    setDimensiones({
                      ancho: e.target.naturalWidth,
                      alto: e.target.naturalHeight,
                    })
                  }
                  onError={() => setError('No se pudo mostrar la página.')}
                  className="w-full h-full object-contain bg-white shadow-2xl select-none"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="text-center px-4">
                <p className="text-sm text-gray-300" role="alert">
                  {error || 'No hay vista disponible.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Barra inferior: páginas, zoom y giro */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-igss-900 text-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className={botonBase}
            >
              ← Anterior
            </button>
            <span className="text-xs tabular-nums flex items-center gap-1.5" aria-live="polite">
              {cargando && (
                <span
                  className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
              className={botonBase}
            >
              Siguiente →
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => cambiarEscala(-0.25)} className={botonBase} aria-label="Alejar">
              −
            </button>
            <span className="text-xs tabular-nums w-12 text-center">
              {Math.round(escala * 100)} %
            </span>
            <button type="button" onClick={() => cambiarEscala(0.25)} className={botonBase} aria-label="Acercar">
              +
            </button>
            <button
              type="button"
              onClick={() => setEscala(1)}
              className={botonBase}
            >
              Ajustar
            </button>
            <button
              type="button"
              onClick={() => setRotacion((r) => (r + 90) % 360)}
              className={botonBase}
            >
              Girar
            </button>
          </div>
        </div>
      </div>

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
    </Modal>
  )
}
