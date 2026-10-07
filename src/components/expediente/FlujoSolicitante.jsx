import { useCallback, useEffect, useRef, useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import PantallaAcceso from '../acceso/PantallaAcceso.jsx'
import Asistente from './Asistente.jsx'
import SoloLectura from './SoloLectura.jsx'
import IndicadorEstado from '../sinconexion/IndicadorEstado.jsx'
import DialogoReingreso from '../sinconexion/DialogoReingreso.jsx'
import DialogoNoAbre from '../sinconexion/DialogoNoAbre.jsx'
import EnvioPendiente from '../sinconexion/EnvioPendiente.jsx'
import { alSesionVencida, cerrarSesion, leerSesion, leerToken } from '../../api/cliente.js'
import { MSJ_SIN_SERVIDOR } from '../../api/errores.js'
import { servicio } from '../../sinconexion/instancia.js'
import { useAvisoAlCerrar, useServicio } from '../../sinconexion/useServicio.js'

const plural = (n, uno, varios) => (n === 1 ? uno : varios)

// Orquesta las pantallas del solicitante: acceso → asistente (o solo lectura / envío pendiente).
// Todo lo que se escribe pasa por la capa sin conexión (src/sinconexion): se cifra y se guarda
// primero en el dispositivo y después se envía.
export default function FlujoSolicitante() {
  const vista = useServicio()
  const [fase, setFase] = useState('iniciando') // iniciando | acceso | cargando | listo | error | ilegible
  const [aviso, setAviso] = useState(null)
  const [mensajeCarga, setMensajeCarga] = useState('Cargando su expediente…')
  const [errorCarga, setErrorCarga] = useState(null)
  const cargando = useRef(false)

  // Al cerrar la pestaña con algo sin enviar, el navegador pregunta.
  useAvisoAlCerrar(vista.abierta && (vista.pendientes > 0 || vista.fallidas.length > 0))

  // Un 401 fuera de la cola (p. ej. al pedir una miniatura): con la bóveda abierta se pide
  // volver a entrar sin perder lo escrito; sin ella se vuelve a la pantalla de acceso.
  useEffect(() => {
    alSesionVencida(() => {
      if (servicio.obtenerVista().abierta) servicio.marcarSesionVencida()
      else {
        setAviso('Su sesión venció. Vuelva a entrar con su DPI y su nombre.')
        setFase('acceso')
      }
    })
    return () => alSesionVencida(null)
  }, [])

  const alAcceso = useCallback((texto = null) => {
    setAviso(texto)
    setFase('acceso')
  }, [])

  const cargar = useCallback(async () => {
    if (cargando.current) return
    cargando.current = true
    try {
      setFase('cargando')
      setErrorCarga(null)
      const previa = servicio.obtenerVista()
      setMensajeCarga(
        previa.pendientesAnteriores > 0
          ? `${previa.pendientesAnteriores} ${plural(previa.pendientesAnteriores, 'cambio pendiente de una sesión anterior se está enviando', 'cambios pendientes de una sesión anterior se están enviando')}…`
          : previa.pendientes > 0
            ? 'Enviando lo que quedó guardado en este dispositivo…'
            : 'Cargando su expediente…'
      )
      if (!leerToken()) {
        // La sesión venció: si hay copia de esta sesión se trabaja con ella y se pide volver a entrar.
        if (previa.expediente && previa.cui) {
          servicio.marcarSesionVencida()
          setFase('listo')
        } else {
          alAcceso('Su sesión venció. Vuelva a entrar con su DPI y su nombre.')
        }
        return
      }
      // Primero se envía lo que haya quedado pendiente (y, si no hay copia, se pide el expediente).
      await servicio.drenarYEsperar()
      let actual = servicio.obtenerVista()
      if (!actual.expediente) {
        const r = await servicio.refrescar()
        actual = servicio.obtenerVista()
        if (!actual.expediente) {
          if (r.resultado === 'sesion') alAcceso('Su sesión venció. Vuelva a entrar con su DPI y su nombre.')
          else {
            setErrorCarga(r.resultado === 'red' ? MSJ_SIN_SERVIDOR : r.mensaje || 'No se pudo cargar la información del expediente.')
            setFase('error')
          }
          return
        }
      }
      setAviso(null)
      setFase('listo')
    } finally {
      cargando.current = false
    }
  }, [alAcceso])

  // Al recargar la pestaña con la sesión abierta (token y llave en sessionStorage): se reabre la
  // bóveda sin volver a pedir datos.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const sesion = leerSesion()
      if (!sesion.llave || !sesion.idBoveda || (!sesion.token && !sesion.anterior)) {
        cerrarSesion()
        if (vivo) setFase('acceso')
        return
      }
      setFase('cargando')
      const r = await servicio.reanudarSesion({ idBoveda: sesion.idBoveda, llaveBoveda: sesion.llave })
      if (!vivo) return
      if (!r.ok) setFase('ilegible')
      else await cargar()
    })()
    return () => {
      vivo = false
    }
  }, [cargar])

  // Si la copia desapareció (otra sesión, tras volver a entrar), se vuelve a pedir el expediente.
  useEffect(() => {
    if (fase === 'listo' && vista.abierta && !vista.expediente && !vista.necesitaReingreso) cargar()
  }, [fase, vista.abierta, vista.expediente, vista.necesitaReingreso, cargar])

  const alIngresar = async (resultado) => {
    if (!resultado?.ok) setFase('ilegible')
    else await cargar()
  }

  // «Salir» conserva cifrado solo lo que aún no se envió (y lo dice); «Salir y borrar» elimina todo.
  const salir = async ({ borrarTodo = false } = {}) => {
    const actual = servicio.obtenerVista()
    const sinEnviar = actual.pendientes + actual.fallidas.length
    if (sinEnviar > 0) {
      const cambios = `${sinEnviar} ${plural(sinEnviar, 'cambio sin enviar', 'cambios sin enviar')}`
      if (borrarTodo) {
        if (!window.confirm(`Hay ${cambios}. Si borra todo de este dispositivo se perderán. ¿Salir y borrar?`)) return
      } else if (actual.almacenamiento === 'memoria') {
        if (!window.confirm(`Este navegador no guarda cambios sin conexión: si sale ahora se perderán ${cambios}. ¿Salir de todos modos?`)) return
      }
    }
    const { conservadas } = await servicio.cerrar({ borrarTodo })
    cerrarSesion()
    alAcceso(
      conservadas > 0
        ? `Salió de su sesión. ${conservadas} ${plural(conservadas, 'cambio quedó guardado', 'cambios quedaron guardados')}, cifrado${conservadas === 1 ? '' : 's'}, en este dispositivo y se ${plural(conservadas, 'enviará', 'enviarán')} cuando vuelva a entrar con conexión.`
        : null
    )
  }

  const descartarIlegible = async () => {
    await servicio.descartarBovedaIlegible()
    await cargar()
  }

  if (fase === 'iniciando' || fase === 'cargando') {
    return (
      <div className="text-center py-16" role="status">
        <div className="inline-block w-10 h-10 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 mt-4">{mensajeCarga}</p>
      </div>
    )
  }

  if (fase === 'acceso') {
    return <PantallaAcceso aviso={aviso} alIngresar={alIngresar} />
  }

  if (fase === 'ilegible') {
    return <DialogoNoAbre alDescartar={descartarIlegible} alSalir={() => salir()} />
  }

  if (fase === 'error') {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <Aviso tipo="error" titulo="No se pudo continuar">
          {errorCarga}
        </Aviso>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={cargar}
            className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => salir()}
            className="text-xs font-semibold text-igss-600 hover:text-igss-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
          >
            Salir
          </button>
        </div>
      </div>
    )
  }

  // fase === 'listo'
  const { expediente } = vista
  if (!expediente) {
    // Con la sesión abierta y sin copia (acaba de cambiar de sesión) el efecto de arriba lo
    // vuelve a pedir; en cualquier otro caso solo queda entrar de nuevo.
    if (vista.abierta && !vista.necesitaReingreso) {
      return (
        <div className="text-center py-16" role="status">
          <div className="inline-block w-10 h-10 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 mt-4">Cargando su expediente…</p>
        </div>
      )
    }
    return <PantallaAcceso aviso="Su sesión venció. Vuelva a entrar con su DPI y su nombre." alIngresar={alIngresar} />
  }
  if (vista.necesitaReingreso && !vista.cui) {
    return <PantallaAcceso aviso="Su sesión venció. Vuelva a entrar con su DPI y su nombre." alIngresar={alIngresar} />
  }

  // Fuera de SIN_INICIAR/BORRADOR/OBSERVADO no se puede escribir (CONTRATO §2).
  const soloLectura = expediente.editable === false || ['ENVIADO', 'APROBADO'].includes(expediente.estado)

  return (
    <>
      <IndicadorEstado vista={vista} />
      <div className="pt-3">
        {expediente.envioPendiente ? (
          <EnvioPendiente vista={vista} alSalir={() => salir()} />
        ) : soloLectura ? (
          <SoloLectura expediente={expediente} config={vista.config} alSalir={() => salir()} />
        ) : (
          <Asistente
            vista={vista}
            alSalir={() => salir()}
            alSalirYBorrar={() => salir({ borrarTodo: true })}
          />
        )}
      </div>
      {vista.necesitaReingreso && vista.cui && (
        <DialogoReingreso cui={vista.cui} pendientes={vista.pendientes} alSalir={() => salir()} />
      )}
    </>
  )
}
