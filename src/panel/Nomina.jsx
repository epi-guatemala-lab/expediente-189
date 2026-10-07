import { useCallback, useEffect, useMemo, useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import CampoTexto from '../components/fields/CampoTexto.jsx'
import {
  formatoCUI,
  formatoTelefono,
  soloDigitos,
  validarCUI,
  validarNombrePersona,
  validarTelefono,
} from '../lib/validaciones.js'
import {
  activarPersona,
  crearNomina,
  desactivarPersona,
  desbloquearPersona,
  eliminarPersona,
  obtenerExpedientes,
} from '../api/panel.js'
import { Cargando, Paginacion, PildoraBloqueado, PildoraEstado, TextoIntentosFallidos } from './UI.jsx'
import Modal from './Modal.jsx'
import { BotonCopiar } from './CampoCopia.jsx'
import { mensajeCompartir } from './utiles.js'
import { MAX_PERSONAS, parsearNomina } from './nomina.js'

const botonAccion =
  'py-1.5 px-2.5 rounded-lg border-2 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 disabled:opacity-40 disabled:cursor-not-allowed'

// Alta de personas: individual o pegando desde Excel con vista previa que
// marca las líneas inválidas antes de enviar.
function ModalAlta({ cuisExistentes, alCerrar, alAgregar }) {
  const [modo, setModo] = useState('individual')
  const [cui, setCui] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [errores, setErrores] = useState({})
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const analisis = useMemo(
    () => parsearNomina(texto, cuisExistentes),
    [texto, cuisExistentes]
  )
  const excede = analisis.validas.length > MAX_PERSONAS

  const enviarIndividual = async () => {
    const nuevosErrores = {}
    const veredictoCUI = validarCUI(cui)
    if (!veredictoCUI.valido) nuevosErrores.cui = veredictoCUI.error
    const veredictoNombre = validarNombrePersona(nombre)
    if (!veredictoNombre.valido) nuevosErrores.nombre = veredictoNombre.error
    if (telefono) {
      const veredictoTelefono = validarTelefono(telefono)
      if (!veredictoTelefono.valido) nuevosErrores.telefono = veredictoTelefono.error
    }
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length) return
    setEnviando(true)
    setError(null)
    try {
      // El nombre viaja tal como se escribió: el servidor lo normaliza
      // (adenda §7).
      await alAgregar([
        {
          cui: soloDigitos(cui),
          nombre: nombre.trim(),
          ...(telefono ? { telefono: soloDigitos(telefono) } : {}),
        },
      ])
    } catch (e) {
      setError(e?.detail || 'No se pudo agregar la persona.')
      setEnviando(false)
    }
  }

  const enviarMasiva = async () => {
    if (!analisis.validas.length || excede) return
    setEnviando(true)
    setError(null)
    try {
      await alAgregar(
        analisis.validas.map((l) => ({
          cui: l.cui,
          nombre: l.nombre,
          ...(l.telefono ? { telefono: l.telefono } : {}),
        }))
      )
    } catch (e) {
      setError(e?.detail || 'No se pudieron agregar las personas.')
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Agregar personas a la nómina" alCerrar={alCerrar} ancho="max-w-2xl">
      <div className="px-5 py-4 space-y-4">
        <div className="flex gap-2 p-1 rounded-xl bg-gray-100" role="group" aria-label="Modo de alta">
          {[
            ['individual', 'Individual'],
            ['masiva', 'Pegar desde Excel'],
          ].map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModo(id)}
              aria-pressed={modo === id}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/15 ${
                modo === id ? 'bg-white text-igss-800 shadow-sm' : 'text-gray-500 hover:text-igss-700'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {modo === 'individual' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              enviarIndividual()
            }}
            className="space-y-3"
          >
            <CampoTexto
              id="alta-cui"
              etiqueta="CUI (DPI)"
              valor={cui}
              onChange={(v) => setCui(formatoCUI(v))}
              error={errores.cui}
              obligatorio
              inputMode="numeric"
              placeholder="0000 00000 0000"
              ayuda="Trece dígitos; se valida el dígito verificador."
            />
            <CampoTexto
              id="alta-nombre"
              etiqueta="Nombre completo"
              valor={nombre}
              onChange={setNombre}
              error={errores.nombre}
              obligatorio
              mayusculas
              placeholder="NOMBRE COMPLETO"
            />
            <CampoTexto
              id="alta-telefono"
              etiqueta="Teléfono"
              valor={telefono}
              onChange={(v) => setTelefono(formatoTelefono(v))}
              error={errores.telefono}
              inputMode="numeric"
              placeholder="0000-0000"
              ayuda="Opcional. Ocho dígitos; el primero entre 2 y 7."
            />
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Pegue una persona por línea con sus columnas separadas por tabulación o coma:
              CUI, nombre completo y teléfono (opcional). Puede copiar el rango directamente
              desde Excel.
            </p>
            <div>
              <label htmlFor="alta-masiva" className="sr-only">
                Lista de personas
              </label>
              <textarea
                id="alta-masiva"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={7}
                spellCheck={false}
                placeholder={'1234 56789 0101\tNOMBRE COMPLETO\t55551234'}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white font-mono text-xs shadow-sm hover:border-igss-300 focus:border-igss-600 focus:ring-4 focus:ring-igss-600/10 focus:outline-none transition-colors"
              />
            </div>

            {analisis.lineas.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 mb-1.5">
                  <strong className="text-igss-800">{analisis.validas.length}</strong> válidas
                  {analisis.invalidas > 0 && (
                    <>
                      {' '}· <strong className="text-igss-red">{analisis.invalidas}</strong> con errores
                    </>
                  )}
                  {excede && (
                    <span className="text-igss-red font-semibold">
                      {' '}· Puede enviar hasta {MAX_PERSONAS} personas por vez
                    </span>
                  )}
                </p>
                <ul className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {analisis.lineas.map((linea) => (
                    <li
                      key={linea.numero}
                      className={`px-3 py-2 text-xs flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ${
                        linea.errores.length ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <span className="text-gray-400 tabular-nums w-6">#{linea.numero}</span>
                      {linea.errores.length === 0 ? (
                        <>
                          <span className="font-mono text-gray-700 tabular-nums">{formatoCUI(linea.cui)}</span>
                          <span className="font-semibold text-igss-900 flex-1">{linea.nombre}</span>
                          <span className="text-gray-500 tabular-nums">
                            {linea.telefono ? formatoTelefono(linea.telefono) : '—'}
                          </span>
                          <span className="text-igss-700 font-bold">Válida</span>
                        </>
                      ) : (
                        <span className="text-igss-red flex-1">
                          <span className="font-mono">{linea.cruda}</span>
                          <span className="block">— {linea.errores.join(' · ')}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <Aviso tipo="error" titulo="No se pudo completar">
            {error}
          </Aviso>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={alCerrar}
            className="py-2 px-4 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 font-semibold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
          >
            Cancelar
          </button>
          {modo === 'individual' ? (
            <button
              type="button"
              onClick={enviarIndividual}
              disabled={enviando}
              className="py-2 px-5 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20 disabled:opacity-50"
            >
              {enviando ? 'Agregando…' : 'Agregar persona'}
            </button>
          ) : (
            <button
              type="button"
              onClick={enviarMasiva}
              disabled={enviando || analisis.validas.length === 0 || excede}
              className="py-2 px-5 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20 disabled:opacity-50"
            >
              {enviando
                ? 'Agregando…'
                : analisis.validas.length > 0
                  ? `Agregar ${analisis.validas.length} ${analisis.validas.length === 1 ? 'persona' : 'personas'}`
                  : 'Agregar personas'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function Nomina() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [altaAbierta, setAltaAbierta] = useState(false)
  // Resumen del último alta (adenda §7): cuántas se crearon y cuáles se
  // rechazaron, con su motivo.
  const [resumenAlta, setResumenAlta] = useState(null)
  const [ocupadoId, setOcupadoId] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const r = await obtenerExpedientes({ page, limit })
      setItems(r.items || [])
      setTotal(r.total ?? 0)
    } catch (e) {
      if (e?.status === 401) return
      setError(e?.detail || 'No se pudo cargar la nómina.')
    } finally {
      setCargando(false)
    }
  }, [page, limit])

  useEffect(() => {
    cargar()
  }, [cargar])

  const conAviso = (e, texto) => {
    if (e?.status === 401) return
    setAviso({ tipo: 'error', texto: e?.detail || texto })
  }

  // Al agregar personas queda a la vista un resumen: cuántas se crearon y
  // cuáles rechazó el servidor con su motivo.
  const agregar = async (personas) => {
    const r = await crearNomina(personas)
    await cargar()
    if (r?.creadas?.length) {
      setAltaAbierta(false)
      setResumenAlta({ creadas: r.creadas.length, rechazadas: r.rechazadas || [] })
    } else if (r?.rechazadas?.length) {
      throw {
        status: 0,
        detail: `No se agregó ninguna persona: ${r.rechazadas
          .map((x) => `${x.nombre || x.cui} (${x.motivo})`)
          .join('; ')}.`,
      }
    }
  }

  // Levanta el bloqueo por intentos fallidos de acceso (adenda §8).
  const desbloquear = async (p) => {
    if (
      !window.confirm(
        `¿Desbloquear a ${p.nombre}? Volverá a poder ingresar con su número de DPI y su nombre completo.`
      )
    ) {
      return
    }
    setOcupadoId(p.id)
    setAviso(null)
    try {
      await desbloquearPersona(p.id)
      await cargar()
      setAviso({ tipo: 'exito', texto: 'Persona desbloqueada.' })
    } catch (e) {
      conAviso(e, 'No se pudo desbloquear a la persona.')
    } finally {
      setOcupadoId(null)
    }
  }

  const alternarActivo = async (p) => {
    const desactivar = p.activo !== false
    if (
      !window.confirm(
        desactivar
          ? `¿Desactivar a ${p.nombre}? No podrá ingresar al formulario hasta que la active de nuevo.`
          : `¿Activar a ${p.nombre}?`
      )
    ) {
      return
    }
    setOcupadoId(p.id)
    setAviso(null)
    try {
      if (desactivar) await desactivarPersona(p.id)
      else await activarPersona(p.id)
      await cargar()
    } catch (e) {
      conAviso(e, 'No se pudo cambiar el estado de la persona.')
    } finally {
      setOcupadoId(null)
    }
  }

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar a ${p.nombre} de la nómina? Esta acción no se puede deshacer.`)) {
      return
    }
    setOcupadoId(p.id)
    setAviso(null)
    try {
      await eliminarPersona(p.id)
      await cargar()
    } catch (e) {
      conAviso(e, 'No se pudo eliminar a la persona.')
    } finally {
      setOcupadoId(null)
    }
  }

  return (
    <div className="space-y-4 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Personas de la nómina del trámite. Cada persona ingresa al formulario con su número de
          DPI y su nombre completo.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BotonCopiar
            texto={mensajeCompartir()}
            etiqueta="el mensaje para las personas"
            rotulo="Copiar mensaje para compartir"
          />
          <button
            type="button"
            onClick={() => setAltaAbierta(true)}
            className="py-2 px-4 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
          >
            + Agregar personas
          </button>
        </div>
      </div>

      {aviso && (
        <Aviso
          tipo={aviso.tipo}
          titulo={aviso.tipo === 'exito' ? 'Listo' : aviso.tipo === 'alerta' ? 'Atención' : 'Error'}
        >
          {aviso.texto}
        </Aviso>
      )}
      {resumenAlta && (
        <Aviso tipo="exito" titulo="Alta de personas">
          <p>
            {resumenAlta.creadas === 1
              ? 'Se agregó 1 persona a la nómina.'
              : `Se agregaron ${resumenAlta.creadas} personas a la nómina.`}
          </p>
          {resumenAlta.rechazadas.length > 0 && (
            <p className="mt-1">
              No se agregaron:{' '}
              {resumenAlta.rechazadas
                .map((x) => `${x.nombre || x.cui} (${x.motivo})`)
                .join('; ')}
              .
            </p>
          )}
          <p className="mt-1 text-xs">
            Comparta con cada persona el mensaje para que ingrese con su número de DPI y su
            nombre completo.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <BotonCopiar
              texto={mensajeCompartir()}
              etiqueta="el mensaje para las personas"
              rotulo="Copiar mensaje para compartir"
            />
            <button
              type="button"
              onClick={() => setResumenAlta(null)}
              className="py-1 px-2.5 rounded-lg border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
            >
              Cerrar resumen
            </button>
          </div>
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" titulo="No se pudo cargar">
          {error}
        </Aviso>
      )}

      {/* Tabla (escritorio) */}
      <div className="glass-card rounded-2xl shadow-igss overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Nómina del trámite 189 con estado y acciones</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200 bg-igss-50/60">
              <th scope="col" className="px-4 py-3 font-semibold">Nombre</th>
              <th scope="col" className="px-3 py-3 font-semibold">CUI</th>
              <th scope="col" className="px-3 py-3 font-semibold">Estado</th>
              <th scope="col" className="px-3 py-3 font-semibold text-center">Activo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody aria-busy={cargando || undefined}>
            {items.length === 0 && !cargando && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  Todavía no hay personas en la nómina.
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-gray-100 last:border-0 hover:bg-igss-50/40 transition-colors ${
                  p.activo === false ? 'opacity-60' : ''
                }`}
              >
                <td className="px-4 py-3 font-semibold text-igss-900 max-w-[14rem] truncate" title={p.nombre}>
                  {p.nombre}
                </td>
                <td className="px-3 py-3 text-xs text-gray-600 tabular-nums whitespace-nowrap">
                  {formatoCUI(p.cui)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <PildoraEstado estado={p.estado} pequeña />
                    {p.bloqueado ? (
                      <PildoraBloqueado pequeña />
                    ) : (
                      <TextoIntentosFallidos cantidad={p.accesos_fallidos_recientes} />
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  {p.activo === false ? (
                    <span className="text-[10px] font-bold uppercase text-gray-400">No</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-igss-700">Sí</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {p.bloqueado && (
                      <button
                        type="button"
                        onClick={() => desbloquear(p)}
                        disabled={ocupadoId === p.id}
                        className={`${botonAccion} border-igss-red/40 text-igss-red hover:bg-red-50`}
                      >
                        Desbloquear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => alternarActivo(p)}
                      disabled={ocupadoId === p.id}
                      className={`${botonAccion} border-gray-200 text-gray-600 hover:border-gray-400`}
                    >
                      {p.activo === false ? 'Activar' : 'Desactivar'}
                    </button>
                    {p.estado === 'SIN_INICIAR' && (
                      <button
                        type="button"
                        onClick={() => eliminar(p)}
                        disabled={ocupadoId === p.id}
                        className={`${botonAccion} border-igss-red/40 text-igss-red hover:bg-red-50`}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas (teléfono) */}
      <div className="space-y-2 md:hidden">
        {items.length === 0 && !cargando && (
          <div className="glass-card rounded-2xl shadow-igss p-6 text-center text-sm text-gray-400">
            Todavía no hay personas en la nómina.
          </div>
        )}
        {items.map((p) => (
          <div
            key={p.id}
            className={`glass-card rounded-2xl shadow-igss p-4 ${p.activo === false ? 'opacity-70' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-igss-900 text-sm break-words">{p.nombre}</p>
                <p className="text-xs text-gray-500 tabular-nums">CUI {formatoCUI(p.cui)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <PildoraEstado estado={p.estado} pequeña />
                {p.bloqueado ? (
                  <PildoraBloqueado pequeña />
                ) : (
                  <TextoIntentosFallidos cantidad={p.accesos_fallidos_recientes} />
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {p.activo === false ? 'Inactiva' : 'Activa'}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.bloqueado && (
                <button
                  type="button"
                  onClick={() => desbloquear(p)}
                  disabled={ocupadoId === p.id}
                  className={`${botonAccion} border-igss-red/40 text-igss-red hover:bg-red-50`}
                >
                  Desbloquear
                </button>
              )}
              <button
                type="button"
                onClick={() => alternarActivo(p)}
                disabled={ocupadoId === p.id}
                className={`${botonAccion} border-gray-200 text-gray-600 hover:border-gray-400`}
              >
                {p.activo === false ? 'Activar' : 'Desactivar'}
              </button>
              {p.estado === 'SIN_INICIAR' && (
                <button
                  type="button"
                  onClick={() => eliminar(p)}
                  disabled={ocupadoId === p.id}
                  className={`${botonAccion} border-igss-red/40 text-igss-red hover:bg-red-50`}
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Paginacion page={page} total={total} limit={limit} alCambiar={setPage} />

      {cargando && items.length === 0 && <Cargando texto="Cargando la nómina…" />}

      {altaAbierta && (
        <ModalAlta
          cuisExistentes={items.map((p) => p.cui)}
          alCerrar={() => setAltaAbierta(false)}
          alAgregar={agregar}
        />
      )}
    </div>
  )
}
