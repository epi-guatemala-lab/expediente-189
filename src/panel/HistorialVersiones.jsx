import { useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import { obtenerArchivoRechazado, obtenerArchivoVersion, obtenerHistorial } from '../api/panel.js'
import { formatoTamano } from '../lib/formato.js'
import { definicionPara } from './TarjetaDocumentoPanel.jsx'
import { descargarBlob, fechaDMA, fechaHoraGuatemala } from './utiles.js'

const ESTADO_VERSION = {
  VIGENTE: { texto: 'Vigente', clases: 'bg-igss-100 text-igss-800' },
  SUSTITUIDA: { texto: 'Reemplazada', clases: 'bg-gray-100 text-gray-600' },
  RETIRADA: { texto: 'Quitada por la persona', clases: 'bg-amber-100 text-amber-800' },
}

const MOTIVO_RECHAZO = {
  tipo: 'No era PDF, JPG ni PNG',
  en_blanco: 'Hoja en blanco',
  vacio: 'Archivo vacío',
}

const ACCION_NOMINA = {
  EDITADA: 'Datos de nómina corregidos',
  DESACTIVADA: 'Persona desactivada',
  ACTIVADA: 'Persona reactivada',
  ELIMINADA: 'Persona eliminada de la nómina',
}

const CAMPO_NOMINA = {
  nombre: 'nombre',
  telefono: 'teléfono',
  seccion: 'sección',
  renglon: 'renglón',
  tipo_servicio: 'tipo de servicio',
}

function motivoDeRechazo(motivo) {
  if (!motivo) return 'Rechazado'
  if (motivo.startsWith('antivirus')) return 'El antivirus lo marcó (se conserva, no se entrega)'
  return MOTIVO_RECHAZO[motivo] || `Rechazado por la revisión del archivo (${motivo})`
}

function Boton({ children, onClick, ocupado }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      className="py-1 px-2.5 rounded-lg border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 text-[11px] font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 disabled:opacity-50"
    >
      {ocupado ? 'Descargando…' : children}
    </button>
  )
}

// Todo lo que pasó por el expediente y no se pierde: cada versión de cada
// documento (también las reemplazadas y las que la persona quitó) con su archivo
// saneado y el ORIGINAL tal como llegó, las subidas que la revisión del archivo
// rechazó, cada decisión de Recepción, las observaciones enviadas y los cambios
// de nómina. Se carga al abrir la sección (y queda en la bitácora).
export default function HistorialVersiones({ id, config }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [descargando, setDescargando] = useState(null)

  const cargar = async () => {
    if (datos || cargando) return
    setCargando(true)
    setError(null)
    try {
      setDatos(await obtenerHistorial(id))
    } catch (e) {
      setError(e?.detail || 'No se pudo cargar el historial.')
    } finally {
      setCargando(false)
    }
  }

  const bajar = async (clave, pedir) => {
    setDescargando(clave)
    setError(null)
    try {
      const { blob, nombre } = await pedir()
      descargarBlob(blob, nombre)
    } catch (e) {
      setError(e?.detail || 'No se pudo descargar el archivo.')
    } finally {
      setDescargando(null)
    }
  }

  const porDocumento = new Map()
  for (const v of datos?.versiones || []) {
    if (!porDocumento.has(v.clave)) porDocumento.set(v.clave, [])
    porDocumento.get(v.clave).push(v)
  }

  return (
    <details
      className="glass-card rounded-2xl shadow-igss group lg:col-span-2"
      onToggle={(e) => e.currentTarget.open && cargar()}
    >
      <summary className="flex items-center justify-between gap-2 px-5 py-4 cursor-pointer text-sm font-bold text-igss-900 rounded-2xl list-none [&::-webkit-details-marker]:hidden focus:outline-none focus:ring-4 focus:ring-igss-600/10">
        Historial y versiones anteriores
        <svg
          className="w-4 h-4 text-igss-600 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 -mt-1 space-y-5 text-xs text-gray-700">
        <p className="text-gray-500">
          Nada de lo que la persona sube se borra: aquí están todas las versiones de cada documento
          (también las reemplazadas y las que quitó), el archivo original tal como llegó, lo que el
          sistema rechazó al subir y cada decisión de Recepción.
        </p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {cargando && <p className="text-gray-400">Cargando historial…</p>}

        {datos && (
          <>
            <section>
              <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                Versiones de documentos
              </h4>
              {porDocumento.size === 0 ? (
                <p className="text-gray-400">Todavía no se ha subido ningún documento.</p>
              ) : (
                <ul className="space-y-3">
                  {[...porDocumento.entries()].map(([clave, versiones]) => (
                    <li key={clave}>
                      <p className="font-bold text-igss-900">{definicionPara(clave, config).titulo}</p>
                      <ul className="mt-1 space-y-2">
                        {versiones.map((v) => {
                          const estado = ESTADO_VERSION[v.estado] || ESTADO_VERSION.SUSTITUIDA
                          return (
                            <li key={v.id} className="border-l-2 border-igss-200 pl-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">Versión {v.numero}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${estado.clases}`}>
                                  {estado.texto}
                                </span>
                                <span className="text-gray-500">
                                  subida {fechaHoraGuatemala(v.cargado_at)}
                                  {v.sustituida_at ? ` · reemplazada ${fechaHoraGuatemala(v.sustituida_at)}` : ''}
                                  {v.retirada_at ? ` · quitada ${fechaHoraGuatemala(v.retirada_at)}` : ''}
                                  {v.fecha_documento ? ` · fecha ${fechaDMA(v.fecha_documento)}` : ''}
                                  {` · ${v.tipo.toUpperCase()}, ${v.paginas} pág., ${formatoTamano(v.tamano)}`}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <Boton
                                  ocupado={descargando === `v${v.id}`}
                                  onClick={() => bajar(`v${v.id}`, () => obtenerArchivoVersion(id, v.id))}
                                >
                                  Descargar
                                </Boton>
                                {v.tiene_original && (
                                  <Boton
                                    ocupado={descargando === `o${v.id}`}
                                    onClick={() =>
                                      bajar(`o${v.id}`, () => obtenerArchivoVersion(id, v.id, { original: true }))
                                    }
                                  >
                                    Original tal como llegó
                                  </Boton>
                                )}
                              </div>
                              {v.revisiones.length > 0 && (
                                <ul className="mt-1 space-y-0.5 text-gray-600">
                                  {v.revisiones.map((r, i) => (
                                    <li key={i}>
                                      {fechaHoraGuatemala(r.cuando)} — {r.estado}
                                      {r.quien ? ` (${r.quien})` : ''}
                                      {r.motivo ? `: ${r.motivo}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {datos.rechazadas.length > 0 && (
              <section>
                <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                  Subidas que el sistema rechazó
                </h4>
                <ul className="space-y-1.5">
                  {datos.rechazadas.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 border-l-2 border-amber-300 pl-3">
                      <span>
                        {fechaHoraGuatemala(r.cuando)} — {definicionPara(r.clave, config).titulo}:{' '}
                        {motivoDeRechazo(r.motivo)}
                        {r.tamano ? ` (${formatoTamano(r.tamano)})` : ''}
                      </span>
                      {r.recuperable && (
                        <Boton
                          ocupado={descargando === `r${r.id}`}
                          onClick={() => bajar(`r${r.id}`, () => obtenerArchivoRechazado(id, r.id))}
                        >
                          Descargar
                        </Boton>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {datos.observaciones.length > 0 && (
              <section>
                <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                  Observaciones con que se devolvió
                </h4>
                <ul className="space-y-1.5">
                  {datos.observaciones.map((o, i) => (
                    <li key={i} className="border-l-2 border-igss-200 pl-3">
                      <span className="font-semibold">
                        {fechaHoraGuatemala(o.cuando)}
                        {o.quien ? ` (${o.quien})` : ''}:
                      </span>{' '}
                      {o.texto}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {datos.nomina.length > 0 && (
              <section>
                <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                  Cambios de nómina
                </h4>
                <ul className="space-y-1.5">
                  {datos.nomina.map((n, i) => (
                    <li key={i} className="border-l-2 border-igss-200 pl-3">
                      <span className="font-semibold">
                        {fechaHoraGuatemala(n.cuando)} — {ACCION_NOMINA[n.accion] || n.accion}
                        {n.quien ? ` (${n.quien})` : ''}
                      </span>
                      {n.antes &&
                        Object.keys(n.antes).map((c) => (
                          <p key={c} className="text-gray-600">
                            {CAMPO_NOMINA[c] || c}: «{n.antes[c] ?? '—'}» → «{n.despues?.[c] ?? '—'}»
                          </p>
                        ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </details>
  )
}
