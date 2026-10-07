// Utilidades de presentación (texto de fechas, tamaños y estados).

import { MESES } from './validaciones.js'

export function formatoTamano(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const ETIQUETAS_ESTADO = {
  SIN_INICIAR: 'Sin iniciar',
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
}

export const ETIQUETAS_REVISION = {
  PENDIENTE: 'Pendiente de revisión',
  ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado',
}

export const TEXTOS_ALERTAS = {
  FUERA_DE_VIGENCIA: 'La fecha del documento está fuera del período sugerido.',
  NO_CUBRE_2027: 'La vigencia del documento no cubre todo el período del trámite.',
}

// Marca de un dato que ya está guardado pero que esta sesión no puede leer.
export const TEXTO_GUARDADO =
  'Guardado ✓ — por seguridad no se muestra. Escriba aquí solo si desea cambiarlo.'

export const AVISO_DATOS_OCULTOS =
  'Por seguridad, lo que usted guardó en una sesión anterior no se muestra. Sus datos están guardados; complete solo lo que falta.'

export const ETIQUETAS_CAMPO = {
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  apellido_casada: 'Apellido de casada',
  fecha_nacimiento: 'Fecha de nacimiento',
  estado_civil: 'Estado civil',
  nacionalidad: 'Nacionalidad',
  direccion: 'Dirección de domicilio',
  departamento: 'Departamento',
  municipio: 'Municipio',
  telefono: 'Teléfono',
  correo: 'Correo electrónico',
  profesion: 'Profesión',
  es_colegiado: 'Colegiatura',
  colegio_profesional: 'Colegio profesional',
  numero_colegiado: 'Número de colegiado',
  nit: 'NIT',
  area_contratada: 'Área contratada',
  estudios: 'Estudios',
  actividades: 'Actividades',
}

// Los instantes del servidor vienen en UTC (ISO 8601 con Z) y se muestran en hora de Guatemala.
export const ZONA_HORARIA = 'America/Guatemala'

export function formatoInstante(iso) {
  const fecha = new Date(iso)
  if (!iso || Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleString('es-GT', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

// Fecha de calendario «AAAA-MM-DD» → «DD/MM/AAAA», sin zona horaria (no es
// un instante: no hay que convertir la zona).
export function fechaDMA(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return ''
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

// Mes y año «AAAA-MM» → «enero 2009», para los períodos de estudio.
export function mesAnio(aaaaMm) {
  if (!/^\d{4}-\d{2}$/.test(aaaaMm ?? '')) return ''
  const [anio, mes] = aaaaMm.split('-').map(Number)
  return `${MESES[mes - 1].toLowerCase()} ${anio}`
}

// Solo el día, DD/MM/AAAA, en hora de Guatemala.
export function formatoDia(iso) {
  const fecha = new Date(iso)
  if (!iso || Number.isNaN(fecha.getTime())) return ''
  return fecha.toLocaleDateString('es-GT', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
