import { useEffect, useState } from 'react'
import { alSesionVencida, cerrarSesion, ingresarPanel, leerToken, obtenerConfig } from '../api/panel.js'
import LoginPanel from './LoginPanel.jsx'
import Inicio from './Inicio.jsx'
import Nomina from './Nomina.jsx'

const MINUTOS_INACTIVIDAD = 30

// Panel de Recepción (ruta #/panel): acceso con cuenta del portal (rol
// «recepción»), pestañas de expedientes y nómina, cierre de sesión visible y
// cierre automático tras 30 minutos sin actividad.
export default function Panel() {
  const [conSesion, setConSesion] = useState(() => Boolean(leerToken()))
  const [usuario, setUsuario] = useState(null)
  const [config, setConfig] = useState(null)
  const [pestana, setPestana] = useState('expedientes')
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    // El mensaje distingue sesión vencida de cuenta sin acceso (`PERMISO`,
    // adenda §8); en ambos casos se vuelve a la pantalla de ingreso.
    alSesionVencida((mensaje) => {
      setConSesion(false)
      setUsuario(null)
      setAviso(mensaje || 'Su sesión venció. Ingrese nuevamente.')
    })
  }, [])

  // Configuración pública (títulos de los documentos); si falla, el panel
  // sigue funcionando con los títulos del contrato.
  useEffect(() => {
    if (!conSesion) {
      setConfig(null)
      return undefined
    }
    let vivo = true
    obtenerConfig()
      .then((c) => {
        if (vivo) setConfig(c)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [conSesion])

  // Cierre automático tras 30 minutos sin actividad (clic, teclado, puntero).
  useEffect(() => {
    if (!conSesion) return undefined
    const ultimaActividad = { cuando: Date.now() }
    const tocar = () => {
      ultimaActividad.cuando = Date.now()
    }
    const eventos = ['click', 'keydown', 'pointermove', 'scroll', 'touchstart']
    eventos.forEach((nombre) => window.addEventListener(nombre, tocar, { passive: true }))
    const vigilante = setInterval(() => {
      if (Date.now() - ultimaActividad.cuando >= MINUTOS_INACTIVIDAD * 60 * 1000) {
        cerrarSesion()
        setConSesion(false)
        setUsuario(null)
        setAviso('Su sesión se cerró por inactividad. Ingrese nuevamente.')
      }
    }, 30000)
    return () => {
      eventos.forEach((nombre) => window.removeEventListener(nombre, tocar))
      clearInterval(vigilante)
    }
  }, [conSesion])

  const ingresar = async (nombreUsuario, contrasena) => {
    const r = await ingresarPanel(nombreUsuario, contrasena)
    setUsuario(r.user)
    setConSesion(true)
    setAviso(null)
  }

  const salir = () => {
    cerrarSesion()
    setConSesion(false)
    setUsuario(null)
    setAviso(null)
  }

  if (!conSesion) {
    return <LoginPanel aviso={aviso} alIngresar={ingresar} />
  }

  const pestanas = [
    ['expedientes', 'Expedientes'],
    ['nomina', 'Nómina'],
  ]

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-extrabold text-igss-900">Panel de Recepción</h2>
          <p className="text-xs text-gray-500">
            Trámite de contratación 2027 · Medicina Preventiva
            {usuario?.nombre ? ` · ${usuario.nombre}` : usuario?.username ? ` · ${usuario.username}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={salir}
          className="py-2 px-4 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-igss-red/50 hover:text-igss-red font-semibold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/10"
        >
          Cerrar sesión
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Secciones del panel"
        className="flex gap-1 p-1 rounded-xl bg-gray-100 mb-4"
      >
        {pestanas.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/15 ${
              pestana === id ? 'bg-white text-igss-800 shadow-sm' : 'text-gray-500 hover:text-igss-700'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {pestana === 'expedientes' ? <Inicio config={config} /> : <Nomina />}
      </div>
    </div>
  )
}
