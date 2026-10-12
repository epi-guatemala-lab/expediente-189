import { useCallback, useEffect, useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import { obtenerDiagnostico } from '../api/panel.js'
import { definicionPara } from './TarjetaDocumentoPanel.jsx'
import { Cargando } from './UI.jsx'

// Pestaña «Lectura» (tanda 7): conteos de la lectura automática por tipo de
// documento — cuántos se leyeron del texto, por OCR o de la imagen, y cuántos
// coincidieron — para detectar qué documento se está leyendo mal. No hay
// datos de ninguna persona: son conteos agregados que envía el servidor.

const EXPLICACION =
  'Conteos de la lectura automática. Sirve para detectar qué tipo de documento se está leyendo mal; no muestra datos de ninguna persona.'

// Los campos nuevos pueden venir ausentes en datos viejos: ausente = 0.
function num(n) {
  return Number.isFinite(n) ? n : 0
}

// Celda numérica: los ceros van en gris claro, lo que importa es lo que falla.
function Celda({ n }) {
  return (
    <td
      className={`px-2 py-2.5 text-center tabular-nums whitespace-nowrap ${
        n > 0 ? 'text-gray-700' : 'text-gray-300'
      }`}
    >
      {n}
    </td>
  )
}

// Tres celdas (coincide / no coincide / no leída) de un mismo chequeo.
function CeldasChequeo({ conteo }) {
  return (
    <>
      <Celda n={num(conteo?.COINCIDE)} />
      <Celda n={num(conteo?.NO_COINCIDE)} />
      <Celda n={num(conteo?.NO_LEIDA)} />
    </>
  )
}

const CLASES_THEAD = 'text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-igss-50/60'

export default function Lectura({ config = null }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setDatos(await obtenerDiagnostico())
    } catch (e) {
      if (e?.status === 401) return
      setError(e?.detail || 'No se pudo cargar el diagnóstico.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const documentos = Array.isArray(datos?.documentos) ? datos.documentos : []
  const pendientes = num(datos?.pendientes)

  return (
    <div className="space-y-4 page-enter">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-igss-900">Lectura automática</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">{EXPLICACION}</p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="py-2 px-4 rounded-xl border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* Verificaciones en curso ahora mismo */}
      {datos && (
        <p
          className={`text-sm font-semibold flex items-center gap-2 ${
            pendientes > 0 ? 'text-amber-700' : 'text-gray-400'
          }`}
        >
          {pendientes > 0 && (
            <span
              className="w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
          {pendientes === 1
            ? '1 verificación en proceso'
            : `${pendientes} verificaciones en proceso`}
        </p>
      )}

      {error && (
        <Aviso tipo="error" titulo="No se pudo cargar">
          {error}
        </Aviso>
      )}

      {/* La tabla es ancha: en teléfono se desplaza a lo ancho dentro de su tarjeta. */}
      <div className="glass-card rounded-2xl shadow-igss overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <caption className="sr-only">
              Conteos de la lectura automática por tipo de documento: total, método de lectura y
              coincidencia de fecha, persona y tipo; en blanco e ilegibles
            </caption>
            <thead>
              <tr className={`text-left font-semibold ${CLASES_THEAD}`}>
                <th scope="col" rowSpan={2} className="px-4 py-3 text-left">
                  Documento
                </th>
                <th scope="col" rowSpan={2} className="px-2 py-3 text-center border-l border-gray-200">
                  Total
                </th>
                <th scope="colgroup" colSpan={4} className="px-2 py-2 text-center border-l border-gray-200">
                  Lectura
                </th>
                <th scope="colgroup" colSpan={3} className="px-2 py-2 text-center border-l border-gray-200">
                  Fecha
                </th>
                <th scope="colgroup" colSpan={3} className="px-2 py-2 text-center border-l border-gray-200">
                  Persona
                </th>
                <th scope="colgroup" colSpan={3} className="px-2 py-2 text-center border-l border-gray-200">
                  Tipo
                </th>
                <th scope="col" rowSpan={2} className="px-2 py-3 text-center border-l border-gray-200">
                  En blanco
                </th>
                <th scope="col" rowSpan={2} className="px-2 py-3 text-center border-l border-gray-200">
                  Ilegibles
                </th>
              </tr>
              <tr className={`font-semibold ${CLASES_THEAD}`}>
                {['Texto', 'OCR', 'Imagen', 'Sin lectura', 'Coincide', 'No coincide', 'No leída'].map(
                  (rotulo) => (
                    <th key={rotulo} scope="col" className="px-2 py-2 text-center border-l border-gray-100">
                      {rotulo}
                    </th>
                  )
                )}
                {['Persona', 'Tipo'].flatMap((grupo) =>
                  ['Coincide', 'No coincide', 'No leída'].map((rotulo) => (
                    <th
                      key={`${grupo}-${rotulo}`}
                      scope="col"
                      className="px-2 py-2 text-center border-l border-gray-100"
                    >
                      {rotulo}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody aria-busy={cargando || undefined}>
              {documentos.length === 0 && !cargando && (
                <tr>
                  <td colSpan={17} className="px-4 py-10 text-center text-sm text-gray-400">
                    Todavía no hay documentos verificados.
                  </td>
                </tr>
              )}
              {documentos.map((doc) => (
                <tr
                  key={doc.clave}
                  className="border-b border-gray-100 last:border-0 hover:bg-igss-50/40 transition-colors"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold text-gray-800">
                    {definicionPara(doc.clave, config).titulo}
                  </th>
                  <Celda n={num(doc.total)} />
                  <Celda n={num(doc.por_metodo?.texto)} />
                  <Celda n={num(doc.por_metodo?.ocr)} />
                  <Celda n={num(doc.por_metodo?.imagen)} />
                  <Celda n={num(doc.por_metodo?.ninguno)} />
                  <CeldasChequeo conteo={doc.fecha} />
                  <CeldasChequeo conteo={doc.identidad} />
                  <CeldasChequeo conteo={doc.tipo} />
                  <Celda n={num(doc.en_blanco)} />
                  <Celda n={num(doc.ilegibles)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cargando && documentos.length === 0 && <Cargando texto="Cargando el diagnóstico de lectura…" />}
    </div>
  )
}
