import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Modal accesible: atrapa el foco dentro, cierra con Esc solo si `alCerrar`
// está definido (los modales que exigen confirmación no lo pasan) y devuelve
// el foco a donde estaba al cerrarse. Si hay varios apilados, solo el último
// de la pila responde a Esc y al Tab.
export default function Modal({
  titulo,
  children,
  alCerrar,
  pantallaCompleta = false,
  ancho = 'max-w-lg',
  idSufijo = '',
}) {
  const referencia = useRef(null)
  const enfocableAnterior = useRef(null)

  useEffect(() => {
    enfocableAnterior.current = document.activeElement
    referencia.current?.focus()

    function dialogoTope(nodo) {
      const dialogos = Array.from(document.querySelectorAll('[role="dialog"]'))
      return dialogos[dialogos.length - 1] === nodo
    }

    function alTeclear(e) {
      const nodo = referencia.current
      if (!nodo || !dialogoTope(nodo)) return
      if (e.key === 'Escape') {
        if (alCerrar) {
          e.preventDefault()
          alCerrar()
        }
        return
      }
      if (e.key !== 'Tab') return
      const enfocables = Array.from(nodo.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (!enfocables.length) return
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      } else if (!nodo.contains(document.activeElement)) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alTeclear, true)
    return () => {
      document.removeEventListener('keydown', alTeclear, true)
      if (enfocableAnterior.current?.focus) enfocableAnterior.current.focus()
    }
  }, [alCerrar])

  const clasesCaja = pantallaCompleta
    ? 'w-full h-full max-w-none rounded-none'
    : `w-full ${ancho} rounded-2xl max-h-[90vh] flex flex-col`

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-igss-900/70 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
    >
      <div
        ref={referencia}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`bg-white shadow-igss-lg focus:outline-none ${pantallaCompleta ? 'flex flex-col' : 'overflow-hidden'} ${clasesCaja}`}
      >
        {!pantallaCompleta && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-extrabold text-igss-900">{titulo}</h2>
            {alCerrar && (
              <button
                type="button"
                onClick={alCerrar}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-gray-400 hover:text-igss-700 hover:bg-igss-50 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/15"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

// Modal con un texto obligatorio (rechazo de documento, devolución con
// observaciones). La longitud se valida entre `min` y `max` caracteres.
export function ModalTexto({
  titulo,
  descripcion,
  min = 5,
  max = 300,
  placeholder = '',
  textoBoton = 'Confirmar',
  alConfirmar,
  alCancelar,
}) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const confirmar = async () => {
    const limpio = texto.trim()
    if (limpio.length < min || limpio.length > max) {
      setError(`Escriba entre ${min} y ${max} caracteres (tiene ${limpio.length}).`)
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await alConfirmar(limpio)
    } catch {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={titulo} alCerrar={alCancelar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
        className="px-5 py-4"
      >
        {descripcion && <p className="text-sm text-gray-600 mb-3">{descripcion}</p>}
        <label htmlFor={`modal-texto${idSufijo(titulo)}`} className="sr-only">
          {titulo}
        </label>
        <textarea
          id={`modal-texto${idSufijo(titulo)}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          maxLength={max}
          rows={4}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `modal-texto-error${idSufijo(titulo)}` : undefined}
          className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-4 ${
            error
              ? 'border-igss-red/50 bg-red-50/50 focus:border-igss-red focus:ring-igss-red/20'
              : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600 focus:ring-igss-600/10'
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-gray-400">
            Entre {min} y {max} caracteres
          </span>
          {error && (
            <p
              id={`modal-texto-error${idSufijo(titulo)}`}
              aria-live="polite"
              className="text-xs text-igss-red font-medium"
            >
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={alCancelar}
            className="py-2 px-4 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 font-semibold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="py-2 px-5 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20 disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : textoBoton}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function idSufijo(titulo) {
  return `-${String(titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}
