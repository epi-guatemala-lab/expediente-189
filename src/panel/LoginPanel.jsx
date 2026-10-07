import { useState } from 'react'
import Aviso from '../components/ui/Aviso.jsx'
import CampoTexto from '../components/fields/CampoTexto.jsx'

// Acceso del personal de Recepción: usuario y contraseña del portal. Solo
// las cuentas con rol «recepción» pueden entrar.
export default function LoginPanel({ aviso, alIngresar }) {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    if (!usuario.trim() || !contrasena) {
      setError('Ingrese su usuario y su contraseña.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await alIngresar(usuario.trim(), contrasena)
    } catch (e2) {
      setError(e2?.detail || 'No se pudo iniciar sesión.')
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-md mx-auto page-enter">
      <div className="glass-card rounded-2xl shadow-igss p-6 sm:p-8">
        <svg className="w-12 h-12 mx-auto text-igss-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <h2 className="text-lg font-extrabold text-igss-900 mt-4 text-center">
          Panel de Recepción
        </h2>
        <p className="text-sm text-gray-500 mt-1 text-center">
          Ingrese con su usuario del portal para revisar los expedientes del trámite de contratación.
        </p>

        {aviso && (
          <div className="mt-4">
            <Aviso tipo="info">{aviso}</Aviso>
          </div>
        )}

        <form onSubmit={enviar} className="mt-5 space-y-3" noValidate>
          <CampoTexto
            id="panel-usuario"
            etiqueta="Usuario"
            valor={usuario}
            onChange={setUsuario}
            autoComplete="username"
            placeholder="Su usuario del portal"
          />
          <CampoTexto
            id="panel-contrasena"
            etiqueta="Contraseña"
            tipo="password"
            valor={contrasena}
            onChange={setContrasena}
            autoComplete="current-password"
            placeholder="Su contraseña"
          />
          {error && (
            <Aviso tipo="error" titulo="No se pudo iniciar sesión">
              {error}
            </Aviso>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20 disabled:opacity-50"
          >
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center mt-4">
          <a
            href="#/"
            className="text-xs font-semibold text-igss-700 hover:text-igss-900 underline underline-offset-2 rounded focus:outline-none focus:ring-4 focus:ring-igss-600/15 px-1"
          >
            ← Volver al formulario del solicitante
          </a>
        </p>
      </div>
    </div>
  )
}
