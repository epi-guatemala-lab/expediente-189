import { useCallback, useEffect, useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import PantallaAcceso from '../acceso/PantallaAcceso.jsx'
import Asistente from './Asistente.jsx'
import SoloLectura from './SoloLectura.jsx'
import {
  alSesionVencida,
  cerrarSesion,
  leerToken,
  obtenerConfig,
  obtenerExpediente,
} from '../../api/cliente.js'

// Orquesta las pantallas del solicitante: acceso → asistente (o solo lectura).
export default function FlujoSolicitante() {
  const [fase, setFase] = useState(leerToken() ? 'cargando' : 'acceso')
  const [aviso, setAviso] = useState(null)
  const [config, setConfig] = useState(null)
  const [expediente, setExpediente] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null)

  useEffect(() => {
    alSesionVencida(() => {
      setFase('acceso')
      setAviso('Tu sesión venció')
      setExpediente(null)
      setConfig(null)
    })
  }, [])

  const cargar = useCallback(async () => {
    if (!leerToken()) {
      setFase('acceso')
      return
    }
    setFase('cargando')
    setErrorCarga(null)
    try {
      const [configuracion, expedienteActual] = await Promise.all([
        obtenerConfig(),
        obtenerExpediente(),
      ])
      setConfig(configuracion)
      setExpediente(expedienteActual)
      setAviso(null)
      setFase('listo')
    } catch (error) {
      if (error?.status === 401) return // el oyente ya devolvió la pantalla de acceso
      setErrorCarga(error?.detail || 'No se pudo cargar la información del expediente.')
      setFase('error')
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const salir = () => {
    cerrarSesion()
    setFase('acceso')
    setAviso(null)
    setExpediente(null)
    setConfig(null)
  }

  if (fase === 'acceso') {
    return <PantallaAcceso aviso={aviso} alIngresar={cargar} />
  }

  if (fase === 'cargando') {
    return (
      <div className="text-center py-16" role="status">
        <div className="inline-block w-10 h-10 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-4">Cargando su expediente…</p>
      </div>
    )
  }

  if (fase === 'error') {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Aviso tipo="error" titulo="No se pudo continuar">
          {errorCarga}
        </Aviso>
        <div className="text-center">
          <button
            type="button"
            onClick={cargar}
            className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Fuera de SIN_INICIAR/BORRADOR/OBSERVADO no se puede escribir (CONTRATO §2).
  const soloLectura =
    expediente.editable === false || ['ENVIADO', 'APROBADO'].includes(expediente.estado)

  return soloLectura ? (
    <SoloLectura expediente={expediente} config={config} alCerrarSesion={salir} />
  ) : (
    <Asistente
      expediente={expediente}
      config={config}
      alCambiarExpediente={setExpediente}
      alCerrarSesion={salir}
    />
  )
}
