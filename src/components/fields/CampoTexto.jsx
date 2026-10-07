import MarcaGuardado from './MarcaGuardado.jsx'

// Campo de texto con etiqueta, ayuda y mensaje de error accesible.
// `guardado`: el dato ya está guardado pero no se muestra por seguridad.
export default function CampoTexto({
  id,
  etiqueta,
  valor,
  onChange,
  error,
  ayuda,
  aviso,
  obligatorio = false,
  placeholder = '',
  maxLength,
  tipo = 'text',
  inputMode,
  autoComplete,
  soloLectura = false,
  mayusculas = false,
  hijo,
  guardado = false,
}) {
  const clases = `w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
    soloLectura
      ? 'border-igss-gold/40 bg-igss-gold-50 text-igss-800 font-bold cursor-default'
      : error
        ? 'border-igss-red/50 bg-red-50/50 focus:border-igss-red focus:ring-igss-red/20'
        : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600 focus:ring-igss-600/10'
  } shadow-sm focus:outline-none focus:ring-4 placeholder:text-gray-400`

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
        type={tipo}
        value={valor ?? ''}
        onChange={(e) => onChange(mayusculas ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        readOnly={soloLectura}
        tabIndex={soloLectura ? -1 : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : aviso ? `${id}-aviso` : undefined}
        style={mayusculas && !soloLectura ? { textTransform: 'uppercase' } : undefined}
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
      {hijo}
    </div>
  )
}
