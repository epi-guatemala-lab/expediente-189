import { TEXTO_GUARDADO } from '../../lib/formato.js'

// Marca de un dato que ya está guardado pero que esta sesión no puede leer.
export default function MarcaGuardado({ id }) {
  return (
    <p id={id ? `${id}-guardado` : undefined} className="mt-1 text-xs font-medium text-igss-700">
      {TEXTO_GUARDADO}
    </p>
  )
}
