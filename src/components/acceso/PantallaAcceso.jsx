import { useRef, useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import CampoTexto from '../fields/CampoTexto.jsx'
import {
  formatoCUI,
  nombreParaEnviar,
  soloDigitos,
  validarCUI,
  validarNombreAcceso,
} from '../../lib/validaciones.js'
import { acceso, guardarSesion } from '../../api/cliente.js'
import { esDemanda, esFalloDeServidor, mensajeDeAcceso } from '../../api/errores.js'
import { hashDeCui } from '../../sinconexion/boveda.js'
import { servicio } from '../../sinconexion/instancia.js'

const MAX_REINTENTOS_POR_DEMANDA = 3

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

// Pantalla de entrada del solicitante: DPI + nombre completo (como aparece en el DPI).
// Al entrar el servidor entrega la llave que abre la bóveda cifrada de este dispositivo.
export default function PantallaAcceso({ aviso, alIngresar }) {
  const [cui, setCui] = useState('')
  const [nombre, setNombre] = useState('')
  const [errorCui, setErrorCui] = useState(null)
  const [errorNombre, setErrorNombre] = useState(null)
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [esperandoTurno, setEsperandoTurno] = useState(false)
  const referenciaCui = useRef(null)

  const cambiarCui = (valor) => {
    setCui(formatoCUI(valor))
    if (errorCui) setErrorCui(null)
  }

  const cambiarNombre = (valor) => {
    setNombre(valor)
    if (errorNombre) setErrorNombre(null)
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (enviando) return
    setErrorGeneral(null)
    setErrorCui(null)
    setErrorNombre(null)

    // El dígito verificador se valida en el cliente antes de gastar un intento.
    const revision = validarCUI(cui)
    if (!revision.valido) {
      setErrorCui(revision.error)
      referenciaCui.current?.querySelector('input')?.focus()
      return
    }
    const revisionNombre = validarNombreAcceso(nombre)
    if (!revisionNombre.valido) {
      setErrorNombre(revisionNombre.error)
      return
    }

    setEnviando(true)
    const cuiPlano = soloDigitos(cui)
    try {
      let respuesta = null
      for (let intento = 0; respuesta === null; intento++) {
        try {
          // El nombre viaja tal como se escribió: el servidor lo compara con tolerancia.
          respuesta = await acceso(cuiPlano, nombreParaEnviar(nombre))
        } catch (error) {
          // «Hay mucha demanda» no es un error: se espera lo que indique el servidor y se reintenta.
          if (esDemanda(error) && intento < MAX_REINTENTOS_POR_DEMANDA) {
            setEsperandoTurno(true)
            await esperar(Math.min(error.retryAfter || 1.5 * (intento + 1), 10) * 1000)
            continue
          }
          const hayBoveda = esFalloDeServidor(error) ? await servicio.existeBovedaDe(cuiPlano) : false
          setErrorGeneral(mensajeDeAcceso(error, { hayBoveda }))
          return
        }
      }
      guardarSesion({
        token: respuesta.token,
        llave: respuesta.llave_boveda || null,
        idBoveda: await hashDeCui(cuiPlano),
      })
      const resultado = await servicio.iniciarSesion({ cui: cuiPlano, llaveBoveda: respuesta.llave_boveda })
      alIngresar(resultado)
    } finally {
      setEnviando(false)
      setEsperandoTurno(false)
    }
  }

  return (
    <div className="max-w-md mx-auto page-enter">
      <div className="glass-card rounded-2xl shadow-igss p-6 sm:p-8">
        <h2 className="text-xl font-extrabold text-igss-900">Acceso al expediente</h2>
        <p className="text-sm text-gray-600 mt-1 mb-6">
          Ingrese su número de DPI y su nombre completo, tal como aparece en el DPI.
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
                etiqueta="DPI"
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
              id="nombre"
              etiqueta="Nombre completo (como aparece en su DPI)"
              valor={nombre}
              onChange={cambiarNombre}
              error={errorNombre}
              obligatorio
              placeholder="Nombres y apellidos"
              autoComplete="name"
            />

            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3 px-4 rounded-xl bg-igss-700 hover:bg-igss-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
            >
              {esperandoTurno ? 'Hay mucha demanda, un momento…' : enviando ? 'Verificando…' : 'Ingresar'}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-500 text-center mt-5">
          ¿No puede ingresar? Comuníquese con Recepción del Departamento de Medicina Preventiva.
        </p>
      </div>
    </div>
  )
}
