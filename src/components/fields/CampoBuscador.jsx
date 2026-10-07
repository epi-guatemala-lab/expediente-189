import { useEffect, useRef, useState } from 'react'

// Selección con buscador (adaptación del SearchableSelect del molde).
// Normaliza tildes para que "PETEN" encuentre "PETÉN".
export default function CampoBuscador({
  id,
  etiqueta,
  valor,
  onChange,
  opciones = [],
  error,
  ayuda,
  obligatorio = false,
  placeholder = '— Seleccione —',
  placeholderBusqueda = 'Escriba para buscar…',
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const referenciaEnvoltura = useRef(null)
  const referenciaEntrada = useRef(null)

  const normalizar = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()

  const filtradas = (() => {
    if (!busqueda) return opciones
    const consulta = normalizar(busqueda)
    const puntuadas = []
    for (const opcion of opciones) {
      const n = normalizar(opcion)
      if (n === consulta) puntuadas.push({ opcion, rango: 0 })
      else if (n.startsWith(consulta)) puntuadas.push({ opcion, rango: 1 })
      else if (n.includes(consulta)) puntuadas.push({ opcion, rango: 2 })
    }
    return puntuadas.sort((a, b) => a.rango - b.rango).map((x) => x.opcion)
  })()

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function alClicFuera(e) {
      if (referenciaEnvoltura.current && !referenciaEnvoltura.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [])

  const elegir = (opcion) => {
    onChange(opcion)
    setBusqueda('')
    setAbierto(false)
  }

  const clasesCaja = `w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
    abierto
      ? 'border-igss-600 ring-4 ring-igss-600/10'
      : error
        ? 'border-red-300 bg-red-50/50'
        : 'border-gray-200 bg-white hover:border-igss-300'
  } shadow-sm`

  return (
    <div ref={referenciaEnvoltura} className="relative">
      <label htmlFor={id} className="block text-sm font-semibold text-igss-900 mb-1.5">
        {etiqueta}
        {obligatorio && <span className="text-igss-red"> *</span>}
      </label>
      {ayuda && <p className="text-xs text-gray-500 mb-1.5">{ayuda}</p>}

      <div
        className={clasesCaja}
        onClick={() => {
          setAbierto(true)
          referenciaEntrada.current?.focus()
        }}
      >
        {abierto ? (
          <input
            ref={referenciaEntrada}
            id={id}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={placeholderBusqueda}
            className="flex-1 outline-none bg-transparent text-sm placeholder:text-gray-400"
            autoFocus
            autoComplete="off"
          />
        ) : (
          <button
            type="button"
            id={id}
            onClick={(e) => {
              e.stopPropagation()
              setAbierto(true)
            }}
            className={`flex-1 text-left text-sm truncate bg-transparent border-0 p-0 cursor-pointer focus:outline-none ${
              valor ? 'text-gray-800' : 'text-gray-400'
            }`}
          >
            {valor || placeholder}
          </button>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {valor && !abierto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setBusqueda('')
                setAbierto(false)
              }}
              aria-label={`Quitar ${etiqueta}`}
              className="p-0.5 text-gray-400 hover:text-igss-red transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-igss-600 transition-transform ${abierto ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1 text-xs text-igss-red font-medium">
          {error}
        </p>
      )}

      {abierto && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtradas.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              No se encontraron resultados
            </div>
          ) : (
            filtradas.map((opcion, i) => (
              <button
                key={`${opcion}-${i}`}
                type="button"
                onClick={() => elegir(opcion)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-igss-50 ${
                  valor === opcion ? 'bg-igss-100 text-igss-800 font-semibold' : 'text-gray-700'
                }`}
              >
                {opcion}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
