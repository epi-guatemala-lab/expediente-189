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

// Las variantes que le tocan a la persona (las cuatro si la nómina no dice su tipo).
export function formatosDeclaracion(tipo) {
  return FORMATOS_DECLARACION.filter((f) => !tipo || f.tipo === tipo)
}

export function urlFormato(variante) {
  return `${BASE}/formatos/declaracion-jurada/${variante}`
}
