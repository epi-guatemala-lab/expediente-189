import { useState } from 'react'
import ProgressBar from '../ui/ProgressBar.jsx'
import Aviso from '../ui/Aviso.jsx'
import PasoPersonales from './pasos/PasoPersonales.jsx'
import PasoContacto from './pasos/PasoContacto.jsx'
import PasoProfesion from './pasos/PasoProfesion.jsx'
import PasoDocumentos from './pasos/PasoDocumentos.jsx'
import PasoRevision from './pasos/PasoRevision.jsx'
import { datosParaInterfaz, payloadPaso, validarPaso } from '../../lib/pasos.js'
import { guardarDatos, obtenerExpediente } from '../../api/cliente.js'

const ETIQUETAS_PASOS = ['Personales', 'Contacto', 'Profesión', 'Documentos', 'Envío']
const TOTAL_PASOS = 5

// Claves de error que este paso sabe pintar bajo su campo correspondiente.
const CLAVES_POR_PASO = {
  1: ['nombres', 'apellidos', 'apellido_casada', 'fecha_nacimiento', 'estado_civil', 'nacionalidad'],
  2: ['direccion', 'departamento', 'municipio', 'telefono', 'correo'],
  3: [
    'profesion', 'es_colegiado', 'colegio_profesional', 'numero_colegiado',
    'nit', 'area_contratada', 'estudios', 'actividades',
  ],
  4: [],
  5: [],
}

// Prefijos de claves compuestas (errores de la forma estudios.0.centro o actividades.1).
function clavePintable(clave, paso) {
  if (CLAVES_POR_PASO[paso]?.includes(clave)) return true
  if (paso === 3 && (clave.startsWith('estudios.') || clave.startsWith('actividades.'))) return true
  return false
}

function enfocarPrimerError() {
  requestAnimationFrame(() => {
    const elemento = document.querySelector(
      'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]'
    )
    if (elemento) {
      elemento.focus()
      elemento.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
}

export default function Asistente({ expediente, config, alCambiarExpediente, alCerrarSesion }) {
  const [paso, setPaso] = useState(1)
  const [datos, setDatos] = useState(() => datosParaInterfaz(expediente.datos))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const opciones = {
    catalogos: config?.catalogos,
    cui: expediente.cui,
    hoy: new Date(),
  }

  const fijarCampo = (campo, valor) => {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  const irA = (numero) => {
    setPaso(numero)
    setErrores({})
    setErrorGeneral(null)
    window.scrollTo({ top: 0 })
  }

  const guardarYContinuar = async () => {
    if (guardando) return
    setErrorGeneral(null)

    const erroresPaso = validarPaso(paso, datos, opciones)
    if (Object.keys(erroresPaso).length > 0) {
      setErrores(erroresPaso)
      enfocarPrimerError()
      return
    }

    setGuardando(true)
    try {
      const actualizado = await guardarDatos(payloadPaso(paso, datos))
      alCambiarExpediente(actualizado)
      setDatos(datosParaInterfaz(actualizado.datos))
      setErrores({})
      irA(Math.min(paso + 1, TOTAL_PASOS))
    } catch (error) {
      if (error?.status === 422 && error.errores) {
        const delServidor = {}
        const desconocidas = []
        for (const [clave, mensaje] of Object.entries(error.errores)) {
          if (clavePintable(clave, paso)) delServidor[clave] = mensaje
          else desconocidas.push(mensaje)
        }
        setErrores(delServidor)
        if (desconocidas.length > 0) setErrorGeneral(desconocidas.join(' '))
        enfocarPrimerError()
      } else if (error?.status === 409) {
        // El estado cambió fuera de esta pantalla (p. ej. Recepción lo aprobó).
        setErrorGeneral(error?.detail || 'El expediente ya no admite cambios.')
        try {
          alCambiarExpediente(await obtenerExpediente())
        } catch {
          // el oyente de sesión vencida se encarga de los 401
        }
      } else {
        setErrorGeneral(error?.detail || 'No se pudo guardar. Intente de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  const recargarExpediente = async () => {
    const actualizado = await obtenerExpediente()
    alCambiarExpediente(actualizado)
    return actualizado
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
  }

  return (
    <div className="page-enter">
      {/* Barra de sesión */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-gray-500 truncate">
          <span className="font-semibold text-igss-800">{expediente.nombre_nomina}</span>
          <span className="hidden sm:inline"> · nómina del período {expediente.periodo}</span>
        </p>
        <button
          type="button"
          onClick={alCerrarSesion}
          className="text-xs font-semibold text-igss-600 hover:text-igss-800 underline underline-offset-2 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
        >
          Cerrar sesión
        </button>
      </div>

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
              alRecargar={recargarExpediente}
            />
          )}
          {paso === 5 && (
            <PasoRevision
              datos={datos}
              expediente={expediente}
              config={config}
              irA={irA}
              alEnviado={alCambiarExpediente}
              alRecargar={recargarExpediente}
            />
          )}
        </div>

        {/* Botonera */}
        <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-gray-200">
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
              onClick={guardarYContinuar}
              disabled={guardando}
              className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
            >
              {guardando ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Sus datos se guardan en el servidor al presionar «Guardar y continuar»; nada queda
        guardado en este dispositivo.
      </p>
    </div>
  )
}

function tituloDocumento(config, clave) {
  const definicion = (config?.documentos || []).find((d) => d.clave === clave)
  return definicion?.titulo || clave
}
