// Lista desplegable con etiqueta y error accesible.
export default function CampoSelect({
  id,
  etiqueta,
  valor,
  onChange,
  opciones = [],
  error,
  ayuda,
  obligatorio = false,
  placeholder = '— Seleccione —',
  autoComplete,
}) {
  const clases = `w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 appearance-none pr-10 ${
    error
      ? 'border-igss-red/50 bg-red-50/50 focus:border-igss-red focus:ring-igss-red/20'
      : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600 focus:ring-igss-600/10'
  } shadow-sm focus:outline-none focus:ring-4`

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-igss-900 mb-1.5">
        {etiqueta}
        {obligatorio && <span className="text-igss-red"> *</span>}
      </label>
      {ayuda && <p className="text-xs text-gray-500 mb-1.5">{ayuda}</p>}
      <div className="relative">
        <select
          id={id}
          name={id}
          value={valor ?? ''}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={clases}
        >
          <option value="">{placeholder}</option>
          {opciones.map((opcion, i) => (
            <option key={`${opcion}-${i}`} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-5 h-5 text-igss-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1 text-xs text-igss-red font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
