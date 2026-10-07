import { useCallback, useEffect, useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import {
  formatoCUI,
  formatoNIT,
  formatoTelefono,
  nitPlano,
  soloDigitos,
} from '../lib/validaciones.js'
import {
  aprobarExpediente,
  desbloquearPersona,
  devolverExpediente,
  obtenerExpediente,
  obtenerVistaDocumento,
  obtenerZipExpediente,
  revisionDocumento,
} from '../api/panel.js'
import { descargarBlob, fechaDMA, fechaHoraGuatemala } from './utiles.js'
import { mesAnio } from '../lib/formato.js'
import { departamentoParaMostrar } from '../config/geografia.js'
import CampoCopia, { BotonCopiar } from './CampoCopia.jsx'
import TarjetaDocumentoPanel, { definicionPara } from './TarjetaDocumentoPanel.jsx'
import VisorDocumento from './VisorDocumento.jsx'
import { Cargando, PildoraBloqueado, PildoraEstado, TextoIntentosFallidos } from './UI.jsx'
import { ModalTexto } from './Modal.jsx'

// Etiquetas legibles de los campos de `datos` para el historial de cambios
// (adenda §8); un campo desconocido se muestra tal cual.
const ETIQUETAS_CAMPOS = {
  nombres: 'nombres',
  apellidos: 'apellidos',
  apellido_casada: 'apellido de casada',
  fecha_nacimiento: 'fecha de nacimiento',
  estado_civil: 'estado civil',
  direccion: 'dirección',
  departamento: 'departamento',
  municipio: 'municipio',
  telefono: 'teléfono',
  correo: 'correo',
  nacionalidad: 'nacionalidad',
  profesion: 'profesión',
  es_colegiado: 'colegiado',
  colegio_profesional: 'colegio profesional',
  numero_colegiado: 'número de colegiado',
  nit: 'NIT',
  area_contratada: 'área contratada',
  estudios: 'estudios',
  actividades: 'actividades',
}

function etiquetasCampos(campos) {
  return (Array.isArray(campos) ? campos : [])
    .filter(Boolean)
    .map((c) => ETIQUETAS_CAMPOS[c] || c)
}

// Foto de la persona (documento `foto`): miniatura como imagen blob: que se
// revoca al desmontar.
function Foto({ expedienteId, documento }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let vivo = true
    let urlCreada = null
    if (documento?.cargado) {
      obtenerVistaDocumento(expedienteId, 'foto', 1)
        .then(({ blob }) => {
          if (!vivo) return
          urlCreada = URL.createObjectURL(blob)
          setUrl(urlCreada)
        })
        .catch(() => {
          if (vivo) setUrl(null)
        })
    }
    return () => {
      vivo = false
      if (urlCreada) URL.revokeObjectURL(urlCreada)
    }
  }, [expedienteId, documento?.cargado, documento?.cargado_at])

  if (!documento?.cargado) return null
  return url ? (
    <img
      src={url}
      alt="Fotografía de la persona"
      className="w-16 h-20 object-cover rounded-xl border-2 border-igss-200 flex-shrink-0"
    />
  ) : (
    <div className="w-16 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-[9px] text-gray-400 text-center px-1 flex-shrink-0">
      Sin foto
    </div>
  )
}

export default function DetalleExpediente({ id, config, alVolver }) {
  const [expediente, setExpediente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [visorClave, setVisorClave] = useState(null)
  const [devolviendo, setDevolviendo] = useState(false)
  const [descargandoZip, setDescargandoZip] = useState(false)

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true)
      setErrorCarga(null)
      try {
        const datos = await obtenerExpediente(id)
        setExpediente(datos)
      } catch (e) {
        if (e?.status === 401) return
        setErrorCarga(e?.detail || 'No se pudo cargar el expediente.')
      } finally {
        if (!silencioso) setCargando(false)
      }
    },
    [id]
  )

  useEffect(() => {
    setExpediente(null)
    setVisorClave(null)
    setAviso(null)
    cargar()
  }, [cargar])

  // Mientras algún documento esté EN_PROCESO se vuelve a pedir el expediente
  // cada 5 s, máximo 2 minutos (adenda §6).
  const verificando = (expediente?.documentos || []).some(
    (d) => d.verificacion?.estado === 'EN_PROCESO'
  )
  useEffect(() => {
    if (!verificando) return undefined
    const inicio = Date.now()
    const temporizador = setInterval(async () => {
      if (Date.now() - inicio > 120000) {
        clearInterval(temporizador)
        return
      }
      try {
        setExpediente(await obtenerExpediente(id))
      } catch {
        // se reintenta en el próximo ciclo
      }
    }, 5000)
    return () => clearInterval(temporizador)
  }, [verificando, id])

  // Ante un 409 de versión (adendas §6 y §8) se recarga el expediente y se
  // avisa; el resto de errores solo muestra su mensaje.
  const manejarError = async (e) => {
    if (e?.status === 401) return
    if (e?.codigo === 'VERSION' || (e?.status === 409 && !e?.codigo)) {
      setAviso({
        tipo: 'alerta',
        texto: `${e?.detail || 'Alguien más modificó este expediente; recargue.'} Se recargó la versión vigente.`,
      })
      await cargar(true)
    } else {
      setAviso({ tipo: 'error', texto: e?.detail || 'No se pudo completar la acción.' })
    }
  }

  // Levanta el bloqueo por intentos fallidos de acceso (adenda §8).
  const desbloquear = async () => {
    if (
      !window.confirm(
        `¿Desbloquear a ${expediente.nombre_completo || expediente.nombre_nomina}? Volverá a poder ingresar con su número de DPI y su nombre completo.`
      )
    ) {
      return
    }
    setAviso(null)
    try {
      await desbloquearPersona(id)
      await cargar(true)
      setAviso({ tipo: 'exito', texto: 'Persona desbloqueada.' })
    } catch (e) {
      await manejarError(e)
    }
  }

  const revisar = async (clave, estado, motivo) => {
    try {
      await revisionDocumento(id, clave, estado, motivo, expediente.version)
      await cargar(true)
      setAviso(
        estado === 'ACEPTADO'
          ? { tipo: 'exito', texto: 'Documento aceptado.' }
          : estado === 'PENDIENTE'
            ? { tipo: 'exito', texto: 'Documento devuelto a pendiente de revisión.' }
            : { tipo: 'exito', texto: 'Documento rechazado.' }
      )
    } catch (e) {
      await manejarError(e)
    }
  }

  const aprobar = async () => {
    setAviso(null)
    try {
      await aprobarExpediente(id, expediente.version)
      await cargar(true)
      setAviso({ tipo: 'exito', texto: 'Expediente aprobado.' })
    } catch (e) {
      manejarError(e)
    }
  }

  const descargarZip = async () => {
    setDescargandoZip(true)
    try {
      const { blob, nombre } = await obtenerZipExpediente(id)
      descargarBlob(blob, nombre || `expediente-${soloDigitos(expediente.cui)}.zip`)
    } catch (e) {
      if (e?.status !== 401) {
        setAviso({ tipo: 'error', texto: e?.detail || 'No se pudo descargar el ZIP.' })
      }
    } finally {
      setDescargandoZip(false)
    }
  }

  if (cargando && !expediente) return <Cargando texto="Cargando el expediente…" />

  if (errorCarga && !expediente) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={alVolver}
          className="text-sm font-semibold text-igss-700 hover:text-igss-900 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 rounded-lg px-2 py-1 -ml-2"
        >
          ← Volver al listado
        </button>
        <Aviso tipo="error" titulo="No se pudo continuar">
          {errorCarga}
        </Aviso>
        <div className="text-center">
          <button
            type="button"
            onClick={() => cargar()}
            className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const d = expediente.datos || {}
  const estudios = Array.isArray(d.estudios) ? d.estudios : []
  const actividades = (Array.isArray(d.actividades) ? d.actividades : []).filter(Boolean)

  const fechaNac = d.fecha_nacimiento ? fechaDMA(d.fecha_nacimiento) : ''
  const edad = expediente.edad != null ? String(expediente.edad) : ''
  const direccionCompleta = [d.direccion, d.municipio, departamentoParaMostrar(d.departamento)]
    .filter(Boolean)
    .join(', ')
  const colegiatura =
    d.es_colegiado === true
      ? [d.colegio_profesional, d.numero_colegiado ? `No. ${d.numero_colegiado}` : '']
          .filter(Boolean)
          .join(' — ')
      : ''

  const lineaEstudio = (e) =>
    [e.titulo, e.centro].filter(Boolean).join(' — ') +
    (e.inicio || e.fin ? ` (${[mesAnio(e.inicio), mesAnio(e.fin)].filter(Boolean).join(' – ')})` : '')

  // «Copiar todo»: Etiqueta: valor por línea, solo lo que tiene valor.
  const textoTodo = [
    ['Nombre completo', expediente.nombre_completo],
    ['Nombres', d.nombres],
    ['Apellidos', d.apellidos],
    ['Apellido de casada', d.apellido_casada],
    ['Edad', edad],
    ['Fecha de nacimiento', fechaNac],
    ['Estado civil', d.estado_civil],
    ['DPI', formatoCUI(expediente.cui)],
    ['Dirección', d.direccion],
    ['Municipio', d.municipio],
    ['Departamento', departamentoParaMostrar(d.departamento)],
    ['Dirección completa', direccionCompleta],
    ['Teléfono', d.telefono ? formatoTelefono(d.telefono) : ''],
    ['Correo', d.correo],
    ['Nacionalidad', d.nacionalidad],
    ['Profesión', d.profesion],
    ['Colegio y número de colegiado', colegiatura],
    ['NIT', d.nit ? formatoNIT(d.nit) : ''],
    ['Área contratada', d.area_contratada],
    ...estudios.map((e, i) => [`Estudio ${i + 1}`, lineaEstudio(e)]),
    ...actividades.map((a, i) => [`Actividad ${i + 1}`, a]),
  ]
    .filter(([, valor]) => valor)
    .map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)
    .join('\n')

  const documentos = expediente.documentos || []
  const porClave = new Map(documentos.map((doc) => [doc.clave, doc]))
  const visorDocumento = visorClave ? porClave.get(visorClave) : null
  const hayDocumentos = documentos.some((doc) => doc.cargado)
  const puedeAprobar = expediente.estado === 'ENVIADO'
  const puedeDevolver = expediente.estado === 'ENVIADO' || expediente.estado === 'APROBADO'
  // Las acciones de revisión de documentos solo valen con el expediente ENVIADO.
  const puedeRevisar = expediente.estado === 'ENVIADO'

  return (
    <div className="grid gap-4 page-enter lg:grid-cols-2">
      <button
        type="button"
        onClick={alVolver}
        className="lg:col-span-2 justify-self-start text-sm font-semibold text-igss-700 hover:text-igss-900 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 rounded-lg px-2 py-1 -ml-2"
      >
        ← Volver al listado
      </button>

      {aviso && (
        <div className="lg:col-span-2">
          <Aviso tipo={aviso.tipo} titulo={aviso.tipo === 'exito' ? 'Listo' : 'Atención'}>
            {aviso.texto}
          </Aviso>
        </div>
      )}

      {/* Encabezado del expediente */}
      <div className="glass-card rounded-2xl shadow-igss p-5 lg:col-span-2">
        <div className="flex items-start gap-4">
          <Foto expedienteId={id} documento={porClave.get('foto')} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PildoraEstado estado={expediente.estado} />
              {expediente.activo === false && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">
                  Inactiva en nómina
                </span>
              )}
              {expediente.bloqueado ? (
                <PildoraBloqueado />
              ) : (
                <TextoIntentosFallidos cantidad={expediente.accesos_fallidos_recientes} />
              )}
            </div>
            <h2 className="text-lg font-extrabold text-igss-900 leading-tight mt-1 break-words">
              {expediente.nombre_completo || expediente.nombre_nomina}
            </h2>
            <p className="text-sm text-gray-500 font-semibold tabular-nums">
              CUI {formatoCUI(expediente.cui)}
            </p>
            {(expediente.seccion || expediente.renglon || expediente.tipo_servicio) && (
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-500">
                  {[expediente.seccion, expediente.renglon, expediente.tipo_servicio]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <BotonCopiar
                  texto={[expediente.seccion, expediente.renglon, expediente.tipo_servicio]
                    .filter(Boolean)
                    .join(' · ')}
                  etiqueta="sección, renglón y tipo de servicio"
                />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Última actualización: {fechaHoraGuatemala(expediente.actualizado_at)}
            </p>
          </div>
        </div>

        {expediente.observacion_general && (
          <div className="mt-3">
            <Aviso tipo="alerta" titulo="Observación general">
              {expediente.observacion_general}
            </Aviso>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {expediente.bloqueado && (
            <button
              type="button"
              onClick={desbloquear}
              className="py-2 px-5 rounded-xl border-2 border-igss-red/40 text-igss-red hover:bg-red-50 font-bold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/15"
            >
              Desbloquear
            </button>
          )}
          {puedeAprobar && (
            <button
              type="button"
              onClick={aprobar}
              className="py-2 px-5 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
            >
              Aprobar
            </button>
          )}
          {puedeDevolver && (
            <button
              type="button"
              onClick={() => setDevolviendo(true)}
              className="py-2 px-5 rounded-xl border-2 border-amber-400 text-amber-800 hover:bg-amber-50 font-bold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-amber-400/20"
            >
              Devolver con observaciones
            </button>
          )}
          {hayDocumentos && (
            <button
              type="button"
              onClick={descargarZip}
              disabled={descargandoZip}
              className="py-2 px-5 rounded-xl border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-bold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10 disabled:opacity-50"
            >
              {descargandoZip ? 'Preparando ZIP…' : 'Descargar ZIP'}
            </button>
          )}
        </div>
      </div>

      {/* Datos con copia campo por campo */}
      <div className="glass-card rounded-2xl shadow-igss p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-bold text-igss-900">Datos declarados</h3>
          {textoTodo && <BotonCopiar texto={textoTodo} etiqueta="todos los datos" />}
        </div>

        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-3 mb-1">
          Datos personales
        </h4>
        <dl>
          <CampoCopia etiqueta="Nombre completo" valor={expediente.nombre_completo} />
          <CampoCopia etiqueta="Nombres" valor={d.nombres} />
          <CampoCopia etiqueta="Apellidos" valor={d.apellidos} />
          <CampoCopia etiqueta="Apellido de casada" valor={d.apellido_casada} />
          <CampoCopia etiqueta="Edad" valor={edad ? `${edad} años` : ''} copia={edad} />
          <CampoCopia etiqueta="Fecha de nacimiento" valor={fechaNac} />
          <CampoCopia etiqueta="Estado civil" valor={d.estado_civil} />
          <CampoCopia
            etiqueta="DPI"
            valor={formatoCUI(expediente.cui)}
            botones={
              <>
                <BotonCopiar texto={formatoCUI(expediente.cui)} etiqueta="DPI con espacios" />
                <BotonCopiar texto={soloDigitos(expediente.cui)} etiqueta="DPI solo dígitos" />
              </>
            }
          />
        </dl>

        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-4 mb-1">
          Ubicación y contacto
        </h4>
        <dl>
          <CampoCopia etiqueta="Dirección" valor={d.direccion} />
          <CampoCopia etiqueta="Municipio" valor={d.municipio} />
          <CampoCopia etiqueta="Departamento" valor={departamentoParaMostrar(d.departamento)} />
          <CampoCopia etiqueta="Dirección completa" valor={direccionCompleta} />
          <CampoCopia
            etiqueta="Teléfono"
            valor={d.telefono ? formatoTelefono(d.telefono) : ''}
          />
          <CampoCopia etiqueta="Correo" valor={d.correo} />
        </dl>

        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-4 mb-1">
          Perfil profesional
        </h4>
        <dl>
          <CampoCopia etiqueta="Nacionalidad" valor={d.nacionalidad} />
          <CampoCopia etiqueta="Profesión" valor={d.profesion} />
          <CampoCopia etiqueta="Colegio y número de colegiado" valor={colegiatura} />
          <CampoCopia
            etiqueta="NIT"
            valor={d.nit ? formatoNIT(d.nit) : ''}
            botones={
              d.nit ? (
                <>
                  <BotonCopiar texto={formatoNIT(d.nit)} etiqueta="NIT con guion" />
                  <BotonCopiar texto={nitPlano(d.nit)} etiqueta="NIT sin guion" />
                </>
              ) : null
            }
          />
          <CampoCopia etiqueta="Área contratada" valor={d.area_contratada} />
        </dl>

        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-4 mb-1">
          Estudios
        </h4>
        {estudios.length === 0 && <p className="text-sm text-gray-400">—</p>}
        {estudios.map((e, i) => (
          <div key={i} className="mt-1 rounded-xl border border-gray-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-igss-800">Estudio {i + 1}</p>
              <BotonCopiar texto={lineaEstudio(e)} etiqueta={`estudio ${i + 1} completo`} />
            </div>
            <dl>
              <CampoCopia etiqueta="Nivel" valor={e.nivel} />
              <CampoCopia etiqueta="Título" valor={e.titulo} />
              <CampoCopia etiqueta="Centro" valor={e.centro} />
              <CampoCopia etiqueta="Inicio" valor={mesAnio(e.inicio)} />
              <CampoCopia etiqueta="Fin" valor={mesAnio(e.fin)} />
            </dl>
          </div>
        ))}

        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-4 mb-1">
          Actividades
        </h4>
        <dl>
          {actividades.length === 0 && <p className="text-sm text-gray-400">—</p>}
          {actividades.map((a, i) => (
            <CampoCopia key={i} etiqueta={`Actividad ${i + 1}`} valor={a} />
          ))}
        </dl>
      </div>

      {/* Documentos */}
      <div className="glass-card rounded-2xl shadow-igss p-5">
        <h3 className="text-sm font-bold text-igss-900 mb-3">Documentos</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {documentos.map((doc) => (
            <TarjetaDocumentoPanel
              key={doc.clave}
              expedienteId={id}
              documento={doc}
              definicion={definicionPara(doc.clave, config)}
              alRevisar={revisar}
              alAbrirVisor={setVisorClave}
              puedeRevisar={puedeRevisar}
            />
          ))}
        </div>
      </div>

      {/* Historial de cambios de datos (adenda §8), plegable junto a la bitácora */}
      <details className="glass-card rounded-2xl shadow-igss group lg:col-span-2">
        <summary className="flex items-center justify-between gap-2 px-5 py-4 cursor-pointer text-sm font-bold text-igss-900 rounded-2xl list-none [&::-webkit-details-marker]:hidden focus:outline-none focus:ring-4 focus:ring-igss-600/10">
          Historial de cambios de datos
          <svg
            className="w-4 h-4 text-igss-600 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-5 pb-5 -mt-1">
          {(expediente.historial_datos || []).length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay cambios de datos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {expediente.historial_datos.map((cambio, i) => {
                const campos = etiquetasCampos(cambio.campos_cambiados)
                return (
                  <li
                    key={i}
                    className="text-xs text-gray-600 border-l-2 border-igss-200 pl-3 py-0.5"
                  >
                    <p className="font-semibold text-gray-800">
                      {fechaHoraGuatemala(cambio.cuando)}
                      {campos.length > 0 && ` — cambió: ${campos.join(', ')}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </details>

      {/* Bitácora plegable */}
      <details className="glass-card rounded-2xl shadow-igss group lg:col-span-2">
        <summary className="flex items-center justify-between gap-2 px-5 py-4 cursor-pointer text-sm font-bold text-igss-900 rounded-2xl list-none [&::-webkit-details-marker]:hidden focus:outline-none focus:ring-4 focus:ring-igss-600/10">
          Bitácora del expediente
          <svg
            className="w-4 h-4 text-igss-600 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-5 pb-5 -mt-1">
          {(expediente.bitacora || []).length === 0 ? (
            <p className="text-sm text-gray-400">Todavía no hay eventos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {expediente.bitacora.map((evento, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-600 border-l-2 border-igss-200 pl-3 py-0.5"
                >
                  <p className="font-semibold text-gray-800">
                    {fechaHoraGuatemala(evento.cuando)} — {evento.accion}
                    {evento.quien ? ` (${evento.quien})` : ''}
                  </p>
                  {evento.detalle && <p className="text-gray-500">{evento.detalle}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {devolviendo && (
        <ModalTexto
          titulo="Devolver con observaciones"
          descripcion="El expediente volverá a ser editable para la persona. Explique qué debe corregir."
          min={5}
          max={1000}
          placeholder="Describa las correcciones que debe hacer la persona…"
          textoBoton="Devolver expediente"
          alCancelar={() => setDevolviendo(false)}
          alConfirmar={async (observacion) => {
            try {
              await devolverExpediente(id, observacion, expediente.version)
              await cargar(true)
              setAviso({ tipo: 'exito', texto: 'Expediente devuelto con observaciones.' })
            } catch (e) {
              await manejarError(e)
            } finally {
              setDevolviendo(false)
            }
          }}
        />
      )}

      {visorDocumento && (
        <VisorDocumento
          expedienteId={id}
          documento={visorDocumento}
          definicion={definicionPara(visorDocumento.clave, config)}
          alRevisar={revisar}
          alCerrar={() => setVisorClave(null)}
          puedeRevisar={puedeRevisar}
        />
      )}
    </div>
  )
}
