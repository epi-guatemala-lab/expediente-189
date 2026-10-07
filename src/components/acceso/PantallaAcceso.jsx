import { useRef, useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import CampoTexto from '../fields/CampoTexto.jsx'
import { clavePlana, formatoClave, formatoCUI, soloDigitos, validarCUI } from '../../lib/validaciones.js'
import { acceso, guardarToken } from '../../api/cliente.js'

// Pantalla de entrada del solicitante: CUI + clave personal entregada por Recepción.
export default function PantallaAcceso({ aviso, alIngresar }) {
  const [cui, setCui] = useState('')
  const [clave, setClave] = useState('')
  const [errorCui, setErrorCui] = useState(null)
  const [errorClave, setErrorClave] = useState(null)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const referenciaCui = useRef(null)

  const cambiarCui = (valor) => {
    setCui(formatoCUI(valor))
    if (errorCui) setErrorCui(null)
  }

  const cambiarClave = (valor) => {
    setClave(formatoClave(valor))
    if (errorClave) setErrorClave(null)
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (enviando) return
    setErrorGeneral(null)
    setErrorCui(null)
    setErrorClave(null)

    // El dígito verificador se valida en el cliente antes de gastar un intento.
    const revision = validarCUI(cui)
    if (!revision.valido) {
      setErrorCui(revision.error)
      referenciaCui.current?.querySelector('input')?.focus()
      return
    }
    if (clavePlana(clave).length !== 10) {
      setErrorClave('La clave debe tener 10 caracteres, con el formato XXXXX-XXXXX')
      return
    }

    setEnviando(true)
    try {
      const respuesta = await acceso(soloDigitos(cui), clavePlana(clave))
      guardarToken(respuesta.token)
      alIngresar()
    } catch (error) {
      setErrorGeneral(error?.detail || 'No se pudo iniciar sesión. Intente de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-md mx-auto page-enter">
      <div className="glass-card rounded-2xl shadow-igss p-6 sm:p-8">
        <h2 className="text-xl font-extrabold text-igss-900">Acceso al expediente</h2>
        <p className="text-sm text-gray-600 mt-1 mb-6">
          Ingrese el CUI y la clave personal que le entregó el personal de Recepción.
        </p>

        {aviso && (
          <div className="mb-4">
            <Aviso tipo="alerta">{aviso}</Aviso>
          </div>
        )}
        {errorGeneral && (
          <div className="mb-4">
            <Aviso tipo="error">{errorGeneral}</Aviso>
          </div>
        )}

        <form onSubmit={enviar} noValidate>
          <div className="space-y-5">
            <div ref={referenciaCui}>
              <CampoTexto
                id="cui"
                etiqueta="CUI (DPI)"
                valor={cui}
                onChange={cambiarCui}
                error={errorCui}
                obligatorio
                placeholder="0000 00000 0000"
                inputMode="numeric"
                autoComplete="off"
                ayuda="Número de documento de identificación, 13 dígitos."
              />
            </div>

            <CampoTexto
              id="clave"
              etiqueta="Clave personal"
              valor={clave}
              onChange={cambiarClave}
              error={errorClave}
              obligatorio
              placeholder="XXXXX-XXXXX"
              autoComplete="off"
              ayuda="La clave aparece en la hoja entregada por Recepción."
            />

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3 px-4 rounded-xl bg-igss-700 hover:bg-igss-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
            >
              {enviando ? 'Verificando…' : 'Ingresar'}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-500 text-center mt-5">
          ¿Perdió su clave o no puede ingresar? Comuníquese con Recepción del Departamento de
          Medicina Preventiva.
        </p>
      </div>
    </div>
  )
}
