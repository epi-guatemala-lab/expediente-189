import MarcaGuardado from './MarcaGuardado.jsx'

// Área de texto con contador de caracteres y error accesible.
export default function CampoAreaTexto({
  id,
  etiqueta,
  valor,
  onChange,
  error,
  ayuda,
  aviso,
  obligatorio = false,
  placeholder = '',
  max = 300,
  filas = 3,
  guardado = false,
}) {
  const clases = `w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
    error
      ? 'border-igss-red/50 bg-red-50/50 focus:border-igss-red focus:ring-igss-red/20'
      : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600 focus:ring-igss-600/10'
  } shadow-sm focus:outline-none focus:ring-4 placeholder:text-gray-400`

  const longitud = (valor ?? '').length

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="block text-sm font-semibold text-igss-900">
          {etiqueta}
          {obligatorio && <span className="text-igss-red"> *</span>}
        </label>
        <span
          className={`text-xs tabular-nums ${longitud > max ? 'text-igss-red font-bold' : 'text-gray-400'}`}
          aria-live="off"
        >
          {longitud}/{max}
        </span>
      </div>
      {ayuda && <p className="text-xs text-gray-500 mb-1.5">{ayuda}</p>}
      <textarea
        id={id}
        name={id}
        value={valor ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        rows={filas}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : aviso ? `${id}-aviso` : undefined}
        className={clases}
      />
      {guardado && !error && <MarcaGuardado id={id} />}
      {aviso && !error && (
        <p id={`${id}-aviso`} className="mt-1 text-xs text-amber-700">
          {aviso}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1 text-xs text-igss-red font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
