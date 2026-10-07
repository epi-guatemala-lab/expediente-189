import { useCallback, useEffect, useRef, useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import { ETIQUETAS_ESTADO } from '../lib/formato.js'
import { formatoCUI } from '../lib/validaciones.js'
import { exportarExcel, obtenerExpedientes, obtenerResumen, desbloquearPersona } from '../api/panel.js'
import { descargarBlob, fechaHoraGuatemala } from './utiles.js'
import { Cargando, Paginacion, PildoraBloqueado, PildoraEstado, TextoIntentosFallidos } from './UI.jsx'
import DetalleExpediente from './DetalleExpediente.jsx'

const ESTADOS = ['SIN_INICIAR', 'BORRADOR', 'ENVIADO', 'OBSERVADO', 'APROBADO']

export function contarAlertas(alertas) {
  // La columna de alertas suma los NO_COINCIDE de la verificación (adenda §6).
  if (Array.isArray(alertas)) return alertas.length
  return Number.isFinite(alertas) ? alertas : 0
}

export default function Inicio({ config }) {
  const [resumen, setResumen] = useState(null)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [estado, setEstado] = useState('')
  const [seccion, setSeccion] = useState('')
  const [renglon, setRenglon] = useState('')
  const [q, setQ] = useState('')
  const [qAplicada, setQAplicada] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [detalleId, setDetalleId] = useState(null)
  const [desbloqueandoId, setDesbloqueandoId] = useState(null)
  const solicitud = useRef(0)

  // Buscador: espera 300 ms antes de aplicar la búsqueda.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setQAplicada(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(temporizador)
  }, [q])

  const cargarResumen = useCallback(async () => {
    try {
      setResumen(await obtenerResumen())
    } catch {
      // el resumen no bloquea el listado
    }
  }, [])

  const cargarItems = useCallback(async () => {
    const n = ++solicitud.current
    setCargando(true)
    setError(null)
    try {
      const r = await obtenerExpedientes({ estado, seccion, renglon, q: qAplicada, page, limit })
      if (n !== solicitud.current) return
      setItems(r.items || [])
      setTotal(r.total ?? 0)
    } catch (e) {
      if (e?.status === 401) return
      if (n === solicitud.current) setError(e?.detail || 'No se pudo cargar el listado.')
    } finally {
      if (n === solicitud.current) setCargando(false)
    }
  }, [estado, seccion, renglon, qAplicada, page, limit])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  useEffect(() => {
    cargarItems()
  }, [cargarItems])

  const exportar = async () => {
    setExportando(true)
    try {
      const { blob } = await exportarExcel()
      descargarBlob(blob, 'expedientes-contratacion-2027.xlsx')
    } catch (e) {
      if (e?.status !== 401) setError(e?.detail || 'No se pudo exportar el Excel.')
    } finally {
      setExportando(false)
    }
  }

  const elegirEstado = (nuevo) => {
    setEstado((actual) => (actual === nuevo ? '' : nuevo))
    setPage(1)
  }

  // Levanta el bloqueo por intentos fallidos de acceso (adenda §8).
  const desbloquear = async (item) => {
    if (
      !window.confirm(
        `¿Desbloquear a ${item.nombre}? Volverá a poder ingresar con su número de DPI y su nombre completo.`
      )
    ) {
      return
    }
    setDesbloqueandoId(item.id)
    try {
      await desbloquearPersona(item.id)
      await cargarItems()
    } catch {
      // si la sesión venció, el oyente ya llevó al ingreso; el listado se
      // recarga con el próximo ciclo
    } finally {
      setDesbloqueandoId(null)
    }
  }

  if (detalleId != null) {
    return (
      <DetalleExpediente
        id={detalleId}
        config={config}
        alVolver={() => {
          setDetalleId(null)
          cargarItems()
          cargarResumen()
        }}
      />
    )
  }

  const porEstado = resumen?.por_estado || {}

  const tarjetas = [
    { estadoId: '', etiqueta: 'Total', valor: resumen?.total, activa: estado === '' },
    ...ESTADOS.map((e) => ({
      estadoId: e,
      etiqueta: ETIQUETAS_ESTADO[e] || e,
      valor: porEstado[e] ?? 0,
      activa: estado === e,
    })),
  ]

  return (
    <div className="space-y-4 page-enter">
      {/* Tarjetas de resumen por estado (clic = filtra) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {tarjetas.map((t) => (
          <button
            key={t.etiqueta}
            type="button"
            onClick={() => elegirEstado(t.estadoId)}
            aria-pressed={t.activa}
            className={`rounded-xl border-2 px-2 py-3 text-center transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/15 ${
              t.activa
                ? 'border-igss-600 bg-igss-50 shadow-igss'
                : 'border-gray-200 bg-white hover:border-igss-300'
            }`}
          >
            <span className="block text-xl font-extrabold text-igss-900 tabular-nums">
              {t.valor ?? '—'}
            </span>
            <span className="block text-[10px] font-semibold text-gray-500 mt-0.5">
              {t.etiqueta}
            </span>
          </button>
        ))}
      </div>
      {resumen?.con_alertas > 0 && (
        <p className="text-xs text-gray-500 -mt-2">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.85-2.75L13.85 4a2 2 0 00-3.7 0L3.15 16.25A2 2 0 005 19z" />
            </svg>
            {resumen.con_alertas} {resumen.con_alertas === 1 ? 'expediente con alertas' : 'expedientes con alertas'}
          </span>
        </p>
      )}

      {/* Avance por sección (personas, enviados y aprobados de cada una) */}
      {Array.isArray(resumen?.por_seccion) && resumen.por_seccion.length > 0 && (
        <div className="glass-card rounded-2xl shadow-igss p-4">
          <h3 className="text-sm font-bold text-igss-900 mb-2">Avance por sección</h3>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Avance del trámite por sección: total de personas, enviados y aprobados
            </caption>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th scope="col" className="py-2 pr-3 font-semibold">Sección</th>
                <th scope="col" className="px-3 py-2 font-semibold text-center">Total</th>
                <th scope="col" className="px-3 py-2 font-semibold text-center">Enviados</th>
                <th scope="col" className="py-2 pl-3 font-semibold text-center">Aprobados</th>
              </tr>
            </thead>
            <tbody>
              {resumen.por_seccion.map((fila) => (
                <tr
                  key={fila.seccion ?? 'sin-seccion'}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-2 pr-3 text-gray-800">{fila.seccion ?? 'Sin sección'}</td>
                  <td className="px-3 py-2 text-center text-gray-700 tabular-nums">{fila.total}</td>
                  <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                    {fila.enviados}
                  </td>
                  <td className="py-2 pl-3 text-center text-gray-700 tabular-nums">
                    {fila.aprobados}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Buscador, filtro y exportación */}
      <div className="glass-card rounded-2xl shadow-igss p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <label htmlFor="panel-buscador" className="sr-only">
              Buscar por nombre o CUI
            </label>
            <input
              id="panel-buscador"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o CUI…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm shadow-sm hover:border-igss-300 focus:border-igss-600 focus:ring-4 focus:ring-igss-600/10 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="panel-estado" className="sr-only">
              Filtrar por estado
            </label>
            <select
              id="panel-estado"
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value)
                setPage(1)
              }}
              className="w-full sm:w-40 py-2.5 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm shadow-sm hover:border-igss-300 focus:border-igss-600 focus:ring-4 focus:ring-igss-600/10 focus:outline-none transition-colors"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETAS_ESTADO[e] || e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="panel-seccion" className="sr-only">
              Filtrar por sección
            </label>
            <select
              id="panel-seccion"
              value={seccion}
              onChange={(e) => {
                setSeccion(e.target.value)
                setPage(1)
              }}
              className="w-full sm:w-44 py-2.5 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm shadow-sm hover:border-igss-300 focus:border-igss-600 focus:ring-4 focus:ring-igss-600/10 focus:outline-none transition-colors"
            >
              <option value="">Todas las secciones</option>
              {(resumen?.secciones || []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="panel-renglon" className="sr-only">
              Filtrar por renglón
            </label>
            <select
              id="panel-renglon"
              value={renglon}
              onChange={(e) => {
                setRenglon(e.target.value)
                setPage(1)
              }}
              className="w-full sm:w-52 py-2.5 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm shadow-sm hover:border-igss-300 focus:border-igss-600 focus:ring-4 focus:ring-igss-600/10 focus:outline-none transition-colors"
            >
              <option value="">Todos los renglones</option>
              {(resumen?.renglones || []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={exportar}
            disabled={exportando}
            className="py-2.5 px-4 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20 disabled:opacity-50"
          >
            {exportando ? 'Exportando…' : 'Exportar a Excel'}
          </button>
        </div>

        {cargando && (
          <p className="text-xs text-gray-400 flex items-center gap-2" role="status">
            <span className="w-3 h-3 border-2 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
            Actualizando el listado…
          </p>
        )}
        {error && (
          <Aviso tipo="error" titulo="No se pudo cargar">
            {error}
          </Aviso>
        )}
      </div>

      {/* Tabla (escritorio) */}
      <div className="glass-card rounded-2xl shadow-igss overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Expedientes del trámite de contratación: nombre, CUI, sección, estado, documentos y
            alertas
          </caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-igss-50/60">
              <th scope="col" className="px-4 py-3 font-semibold">Nombre</th>
              <th scope="col" className="px-3 py-3 font-semibold">CUI</th>
              <th scope="col" className="px-3 py-3 font-semibold">Sección</th>
              <th scope="col" className="px-3 py-3 font-semibold">Estado</th>
              <th scope="col" className="px-3 py-3 font-semibold text-center">Docs</th>
              <th scope="col" className="px-3 py-3 font-semibold text-center">Aceptados</th>
              <th scope="col" className="px-3 py-3 font-semibold text-center">Alertas</th>
              <th scope="col" className="px-4 py-3 font-semibold">Actualizada</th>
            </tr>
          </thead>
          <tbody aria-busy={cargando || undefined}>
            {items.length === 0 && !cargando && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  No hay expedientes que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const alertas = contarAlertas(item.alertas)
              return (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-igss-50/40 transition-colors"
                >
                  <td className="px-4 py-3 max-w-[14rem]">
                    <button
                      type="button"
                      onClick={() => setDetalleId(item.id)}
                      className="font-semibold text-igss-900 hover:text-igss-700 text-left truncate block max-w-full focus:outline-none focus:ring-4 focus:ring-igss-600/15 rounded px-1 -mx-1"
                      title={item.nombre}
                    >
                      {item.nombre}
                      {item.activo === false && (
                        <span className="ml-2 text-[9px] font-bold uppercase text-gray-400">
                          inactiva
                        </span>
                      )}
                    </button>
                    {item.bloqueado ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <PildoraBloqueado pequeña />
                        <button
                          type="button"
                          onClick={() => desbloquear(item)}
                          disabled={desbloqueandoId === item.id}
                          className="py-1 px-2 rounded-lg border-2 border-igss-red/40 text-igss-red hover:bg-red-50 text-[10px] font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Desbloquear
                        </button>
                      </div>
                    ) : (
                      <TextoIntentosFallidos cantidad={item.accesos_fallidos_recientes} />
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600 tabular-nums whitespace-nowrap">
                    {formatoCUI(item.cui)}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600 max-w-[10rem] truncate" title={item.seccion || undefined}>
                    {item.seccion || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <PildoraEstado estado={item.estado} pequeña />
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-600 tabular-nums whitespace-nowrap">
                    {item.docs_cargados ?? 0}/{item.docs_requeridos ?? 0}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-600 tabular-nums">
                    {item.docs_aceptados ?? 0}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {alertas > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold border border-red-300 tabular-nums">
                        {alertas}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 tabular-nums">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {fechaHoraGuatemala(item.actualizado_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas (teléfono) */}
      <div className="space-y-2 md:hidden">
        {items.length === 0 && !cargando && (
          <div className="glass-card rounded-2xl shadow-igss p-6 text-center text-sm text-gray-400">
            No hay expedientes que coincidan con la búsqueda.
          </div>
        )}
        {items.map((item) => {
          const alertas = contarAlertas(item.alertas)
          return (
            <div key={item.id} className="glass-card rounded-2xl shadow-igss p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDetalleId(item.id)}
                  className="min-w-0 text-left font-bold text-igss-900 text-sm break-words focus:outline-none focus:ring-4 focus:ring-igss-600/15 rounded-lg px-1 -mx-1"
                >
                  {item.nombre}
                  {item.activo === false && (
                    <span className="ml-2 text-[9px] font-bold uppercase text-gray-400">
                      inactiva
                    </span>
                  )}
                </button>
                <PildoraEstado estado={item.estado} pequeña />
              </div>
              <button
                type="button"
                onClick={() => setDetalleId(item.id)}
                className="w-full text-left focus:outline-none focus:ring-4 focus:ring-igss-600/15 rounded-lg px-1 -mx-1"
              >
                <p className="text-xs text-gray-500 tabular-nums mt-1">
                  CUI {formatoCUI(item.cui)}
                </p>
                {item.seccion && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.seccion}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 mt-2">
                  <span>
                    Documentos: <strong className="text-gray-700">{item.docs_cargados ?? 0}/{item.docs_requeridos ?? 0}</strong>
                  </span>
                  <span>
                    Aceptados: <strong className="text-gray-700">{item.docs_aceptados ?? 0}</strong>
                  </span>
                  {alertas > 0 && (
                    <span className="text-red-700 font-bold">
                      Alertas: <strong className="tabular-nums">{alertas}</strong>
                    </span>
                  )}
                  <span>{fechaHoraGuatemala(item.actualizado_at)}</span>
                </div>
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.bloqueado ? (
                  <>
                    <PildoraBloqueado pequeña />
                    <button
                      type="button"
                      onClick={() => desbloquear(item)}
                      disabled={desbloqueandoId === item.id}
                      className="py-1 px-2 rounded-lg border-2 border-igss-red/40 text-igss-red hover:bg-red-50 text-[10px] font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Desbloquear
                    </button>
                  </>
                ) : (
                  <TextoIntentosFallidos cantidad={item.accesos_fallidos_recientes} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Paginacion page={page} total={total} limit={limit} alCambiar={setPage} />

      {cargando && items.length === 0 && <Cargando texto="Cargando los expedientes…" />}
    </div>
  )
}
