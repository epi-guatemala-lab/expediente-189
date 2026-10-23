import { BASE } from '../api/cliente.js'

// Formatos de la declaración jurada que entregó Recepción. El servidor los sirve
// tal cual (los bytes del Word original): el notario debe usarlos sin cambios.
export const FORMATOS_DECLARACION = [
  { variante: 'tecnico-masculino', tipo: 'TECNICO', etiqueta: 'Masculino' },
  { variante: 'tecnico-femenino', tipo: 'TECNICO', etiqueta: 'Femenino' },
  { variante: 'profesional-masculino', tipo: 'PROFESIONAL', etiqueta: 'Masculino' },
  { variante: 'profesional-femenino', tipo: 'PROFESIONAL', etiqueta: 'Femenino' },
]

export const NOMBRE_TIPO = { TECNICO: 'servicios técnicos', PROFESIONAL: 'servicios profesionales' }

// Las variantes que le tocan a la persona. `variantes` (del servidor) ya filtra por
// tipo de servicio y sexo; sin ellas, por tipo (las cuatro si no se sabe nada).
export function formatosDeclaracion(tipo, variantes = null) {
  if (Array.isArray(variantes) && variantes.length > 0) {
    return FORMATOS_DECLARACION.filter((f) => variantes.includes(f.variante))
  }
  return FORMATOS_DECLARACION.filter((f) => !tipo || f.tipo === tipo)
}

export function urlFormato(variante) {
  return `${BASE}/formatos/declaracion-jurada/${variante}`
}
