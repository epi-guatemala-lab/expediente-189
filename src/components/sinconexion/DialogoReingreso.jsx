import { useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import CampoTexto from '../fields/CampoTexto.jsx'
import { formatoCUI, nombreParaEnviar, validarNombreAcceso } from '../../lib/validaciones.js'
import { acceso, guardarLlave, guardarSesion } from '../../api/cliente.js'
import { mensajeDeAcceso } from '../../api/errores.js'
import { servicio } from '../../sinconexion/instancia.js'

// La sesión venció (o el servidor volvió tras trabajar sin conexión): se pide solo el nombre
// para seguir. Lo escrito está a salvo en la cola y el formulario sigue detrás, sin perder nada.
export default function DialogoReingreso({ cui, pendientes, alSalir }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const confirmar = async (e) => {
    e.preventDefault()
    if (enviando) return
    setError(null)
    setErrorGeneral(null)
    const revision = validarNombreAcceso(nombre)
    if (!revision.valido) {
      setError(revision.error)
      return
    }
    setEnviando(true)
    try {
      const respuesta = await acceso(cui, nombreParaEnviar(nombre))
      guardarSesion({ token: respuesta.token })
      const { llaveTexto } = await servicio.renovarSesion({ llaveBoveda: respuesta.llave_boveda })
      if (llaveTexto) guardarLlave(llaveTexto)
    } catch (fallo) {
      setErrorGeneral(mensajeDeAcceso(fallo, { hayBoveda: true }))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="titulo-reingreso">
      <div className="glass-card bg-white rounded-2xl shadow-igss-lg p-6 w-full max-w-md">
        <h2 id="titulo-reingreso" className="text-lg font-extrabold text-igss-900">
          Vuelva a entrar para continuar
        </h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          Su sesión venció. {pendientes > 0
            ? `Lo que escribió (${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'}) está guardado en este dispositivo y se enviará en cuanto vuelva a entrar.`
            : 'Lo que escribió está a salvo.'}
        </p>
        {errorGeneral && (
          <div className="mb-4">
            <Aviso tipo="error">{errorGeneral}</Aviso>
          </div>
        )}
        <form onSubmit={confirmar} noValidate className="space-y-4">
          <p className="text-xs text-gray-500">DPI: {formatoCUI(cui)}</p>
          <CampoTexto
            id="nombre-reingreso"
            etiqueta="Nombre completo (como aparece en su DPI)"
            valor={nombre}
            onChange={(v) => {
              setNombre(v)
              if (error) setError(null)
            }}
            error={error}
            obligatorio
            autoComplete="name"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={alSalir}
              className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-igss-red focus:outline-none focus:ring-2 focus:ring-igss-red/30 rounded"
            >
              Salir
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 disabled:opacity-60 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
            >
              {enviando ? 'Verificando…' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
