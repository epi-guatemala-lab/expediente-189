import { useState } from 'react'
import ProgressBar from '../ui/ProgressBar.jsx'
import Aviso from '../ui/Aviso.jsx'
import PasoPersonales from './pasos/PasoPersonales.jsx'
import PasoContacto from './pasos/PasoContacto.jsx'
import PasoProfesion from './pasos/PasoProfesion.jsx'
import PasoDocumentos from './pasos/PasoDocumentos.jsx'
import PasoRevision from './pasos/PasoRevision.jsx'
import { aConjunto, datosParaInterfaz, faltantesDePaso, payloadPaso, validarPaso } from '../../lib/pasos.js'
import { AVISO_DATOS_OCULTOS } from '../../lib/formato.js'
import { servicio } from '../../sinconexion/instancia.js'

const ETIQUETAS_PASOS = ['Personales', 'Contacto', 'Profesión', 'Documentos', 'Envío']
const TOTAL_PASOS = 5

const MENSAJES_DE_FALLO = {
  almacenamiento:
    'No se pudo guardar en este dispositivo (el navegador negó el espacio). Libere espacio o use otro navegador e intente de nuevo.',
  no_editable: 'El expediente ya no admite cambios.',
  cerrado: 'Su sesión no está abierta. Vuelva a entrar con su DPI y su nombre.',
}

const MENSAJE_FALTA_DATO = 'Falta este dato'

function enfocarPrimerError() {
  requestAnimationFrame(() => {
    const elemento = document.querySelector(
      'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], [data-falta]'
    )
    if (elemento) {
      elemento.focus()
      elemento.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
}

// `vista`: lo que ve la persona (expediente con sus cambios pendientes ya aplicados).
export default function Asistente({ vista, alSalir, alSalirYBorrar }) {
  const { expediente, config } = vista
  const ocultos = aConjunto(expediente.campos_ocultos)
  const [paso, setPaso] = useState(1)
  const [visitados, setVisitados] = useState(() => new Set([1]))
  const [datos, setDatos] = useState(() => datosParaInterfaz(expediente.datos, { ocultos }))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Obligatorios vacíos al intentar avanzar: { paso, cantidad, claves }.
  const [avisoFaltantes, setAvisoFaltantes] = useState(null)

  const opciones = {
    catalogos: config?.catalogos,
    cui: expediente.cui,
    hoy: new Date(),
    ocultos,
  }
  const opcionesFaltantes = { ocultos, documentos: expediente.documentos, config }

  // Estado de cada círculo: completo si no falta nada; si se visitó y falta algo,
  // incompleto (ámbar); si todavía no se visita, pendiente.
  const estadosPasos = Array.from({ length: TOTAL_PASOS }, (_, i) => {
    const numero = i + 1
    if (numero === TOTAL_PASOS) return numero <= paso ? 'completo' : 'pendiente'
    return faltantesDePaso(numero, datos, opcionesFaltantes).length === 0
      ? 'completo'
      : visitados.has(numero)
        ? 'incompleto'
        : 'pendiente'
  })

  const fijarCampo = (campo, valor) => {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  const irA = (numero) => {
    setPaso(numero)
    setVisitados((previos) => new Set(previos).add(numero))
    setErrores({})
    setErrorGeneral(null)
    setAvisoFaltantes(null)
    window.scrollTo({ top: 0 })
  }

  // «Guardar y continuar»: lo escrito se cifra y se guarda primero en el dispositivo y
  // enseguida se intenta enviar; la pantalla avanza sin esperar al servidor.
  // Los errores de FORMATO bloquean sin opción de continuar; los obligatorios vacíos
  // se marcan y se ofrece completarlos ahora o después (`continuarConFaltantes`).
  const guardarYContinuar = async ({ continuarConFaltantes = false } = {}) => {
    if (guardando) return
    setErrorGeneral(null)

    const erroresPaso = validarPaso(paso, datos, opciones)
    if (Object.keys(erroresPaso).length > 0) {
      setErrores(erroresPaso)
      setAvisoFaltantes(null)
      enfocarPrimerError()
      return
    }

    const faltan = faltantesDePaso(paso, datos, opcionesFaltantes)
    if (faltan.length > 0 && !continuarConFaltantes) {
      const marcas = {}
      for (const clave of faltan) {
        if (!clave.startsWith('doc:')) marcas[clave] = MENSAJE_FALTA_DATO
      }
      setErrores(marcas)
      enfocarPrimerError()
      setAvisoFaltantes({ paso, cantidad: faltan.length, claves: faltan })
      return
    }

    setGuardando(true)
    try {
      const resultado = await servicio.guardarDatos(payloadPaso(paso, datos, { ocultos }))
      if (!resultado.ok) {
        setErrorGeneral(MENSAJES_DE_FALLO[resultado.motivo] || 'No se pudo guardar. Intente de nuevo.')
        return
      }
      servicio.descartarAviso('ocultos')
      setErrores({})
      setAvisoFaltantes(null)
      irA(Math.min(paso + 1, TOTAL_PASOS))
    } finally {
      setGuardando(false)
    }
  }

  const documentosRechazados = (expediente.documentos || []).filter(
    (d) => d.revision?.estado === 'RECHAZADO'
  )

  const propiedadesComunes = {
    datos,
    errores,
    fijarCampo,
    expediente,
    config,
    ocultos,
  }

  return (
    <div className="page-enter">
      {/* Barra de sesión */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-gray-500 truncate">
          {expediente.nombre_nomina && (
            <span className="font-semibold text-igss-800">{expediente.nombre_nomina}</span>
          )}
          <span className="hidden sm:inline">
            {expediente.nombre_nomina ? ' · ' : ''}nómina del período {expediente.periodo}
          </span>
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={alSalir}
            className="text-xs font-semibold text-igss-600 hover:text-igss-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
          >
            Salir
          </button>
          <button
            type="button"
            onClick={alSalirYBorrar}
            className="text-xs font-semibold text-gray-500 hover:text-igss-red underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-igss-red/30 rounded"
          >
            Salir y borrar de este dispositivo
          </button>
        </div>
      </div>

      {/* Datos guardados en una sesión anterior (una sola vez) */}
      {vista.avisoOcultos && (
        <div className="mb-4">
          <Aviso tipo="info">
            <p>{AVISO_DATOS_OCULTOS}</p>
            <button
              type="button"
              onClick={() => servicio.descartarAviso('ocultos')}
              className="mt-2 text-xs font-bold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-600/30 rounded"
            >
              Entendido
            </button>
          </Aviso>
        </div>
      )}

      {/* Observación de Recepción (estado OBSERVADO: el expediente vuelve a ser editable) */}
      {expediente.estado === 'OBSERVADO' && (
        <div className="mb-6">
          <Aviso tipo="alerta" titulo="Su expediente fue observado por Recepción">
            {expediente.observacion_general || 'Revise sus datos y documentos y vuelva a enviarlos.'}
            {documentosRechazados.length > 0 && (
              <ul className="mt-2 list-disc list-inside space-y-0.5">
                {documentosRechazados.map((d) => (
                  <li key={d.clave}>
                    <span className="font-semibold">{tituloDocumento(config, d.clave)}</span>
                    {d.revision?.motivo ? `: ${d.revision.motivo}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Aviso>
        </div>
      )}

      <div className="glass-card rounded-2xl shadow-igss p-5 sm:p-8">
        <ProgressBar
          pasoActual={paso}
          totalPasos={TOTAL_PASOS}
          etiquetas={ETIQUETAS_PASOS}
          estados={estadosPasos}
          onIrA={irA}
        />

        {errorGeneral && (
          <div className="mb-6">
            <Aviso tipo="error">{errorGeneral}</Aviso>
          </div>
        )}

        <div className="fade-in">
          {paso === 1 && <PasoPersonales {...propiedadesComunes} />}
          {paso === 2 && <PasoContacto {...propiedadesComunes} />}
          {paso === 3 && <PasoProfesion {...propiedadesComunes} />}
          {paso === 4 && (
            <PasoDocumentos
              datos={datos}
              expediente={expediente}
              config={config}
              faltantes={
                avisoFaltantes?.paso === 4
                  ? avisoFaltantes.claves.filter((c) => c.startsWith('doc:')).map((c) => c.slice(4))
                  : []
              }
            />
          )}
          {paso === 5 && (
            <PasoRevision
              datos={datos}
              ocultos={ocultos}
              expediente={expediente}
              config={config}
              irA={irA}
              hayFallidas={vista.fallidas.length > 0}
            />
          )}
        </div>

        {/* Obligatorios vacíos en este paso: completar ahora o dejar para después */}
        {avisoFaltantes && avisoFaltantes.paso === paso && (
          <div className="mt-8">
            <Aviso tipo="alerta">
              <p className="font-bold">
                {avisoFaltantes.cantidad === 1
                  ? 'Falta 1 dato en este paso.'
                  : `Faltan ${avisoFaltantes.cantidad} datos en este paso.`}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setAvisoFaltantes(null)}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-amber-500/30"
                >
                  Completar ahora
                </button>
                <button
                  type="button"
                  onClick={() => guardarYContinuar({ continuarConFaltantes: true })}
                  disabled={guardando}
                  className="py-2 px-4 rounded-xl border-2 border-amber-400/70 text-amber-800 hover:bg-amber-100 font-bold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-amber-400/30 disabled:opacity-50"
                >
                  Continuar y completar después
                </button>
              </div>
            </Aviso>
          </div>
        )}

        {/* Botonera */}
        <div
          className={`flex items-center justify-between gap-3 ${avisoFaltantes?.paso === paso ? 'mt-4' : 'mt-8'} pt-5 border-t border-gray-200`}
        >
          {paso > 1 ? (
            <button
              type="button"
              onClick={() => irA(paso - 1)}
              disabled={guardando}
              className="py-2.5 px-5 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-igss-300 hover:text-igss-700 font-semibold text-sm transition-colors disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-igss-600/10"
            >
              Atrás
            </button>
          ) : (
            <span />
          )}

          {paso < TOTAL_PASOS && (
            <button
              type="button"
              onClick={() => guardarYContinuar()}
              disabled={guardando}
              className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
            >
              {guardando ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Lo que escribe se guarda primero, cifrado, en este dispositivo y de inmediato se envía al
        servidor; si no hay conexión, se enviará cuando vuelva. Si usa un equipo compartido, al
        terminar elija «Salir y borrar de este dispositivo».
      </p>
    </div>
  )
}

function tituloDocumento(config, clave) {
  const definicion = (config?.documentos || []).find((d) => d.clave === clave)
  return definicion?.titulo || clave
}
