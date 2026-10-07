import MarcaGuardado from './MarcaGuardado.jsx'

// Campo de fecha con etiqueta y error accesible.
export default function CampoFecha({
  id,
  etiqueta,
  valor,
  onChange,
  error,
  ayuda,
  obligatorio = false,
  min,
  max,
  hijo,
  guardado = false,
}) {
  const clases = `w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
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
      <input
        id={id}
        name={id}
        type="date"
        value={valor ?? ''}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={clases}
      />
      {guardado && !error && <MarcaGuardado id={id} />}
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1 text-xs text-igss-red font-medium">
          {error}
        </p>
      )}
      {hijo}
    </div>
  )
}
