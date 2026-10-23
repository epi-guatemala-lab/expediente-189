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
  EN_BLANCO: 'El archivo está en blanco',
  EMITIDO_ANTES_DEL_MINIMO: 'El documento fue emitido antes de la fecha mínima pedida',
  VENCIDO: 'El documento ya está vencido',
  ARCHIVO_REPETIDO: 'Este mismo archivo está cargado en otro documento',
  VARIOS_DOCUMENTOS: 'El archivo contiene varios documentos; suba cada uno por separado',
  FOTO_PEQUENA: 'La fotografía es muy pequeña',
  FOTO_HORIZONTAL: 'La fotografía está en horizontal',
  FOTO_PARECE_DOCUMENTO: 'Esto parece un documento, no una fotografía',
  CAMSCANNER: 'El archivo trae la marca de CamScanner: Recepción no lo recibe. Escanéelo con un escáner.',
  NO_ES_PDF_ORIGINAL:
    'Recepción pide el PDF original descargado del sistema (con su código QR), no un escaneo ni una fotografía.',
  ES_FOTO: 'Recepción pide el documento escaneado con escáner, no una fotografía.',
  SIN_TINTA_AZUL:
    'No encontramos una firma en azul: Recepción pide la carta firmada con lapicero azul y escaneada a color.',
  FORMATO_CAMBIADO: 'El acta no dice exactamente lo mismo que el formato: Recepción no la recibe con cambios.',
  OTRO_FORMATO: 'El acta usa el formato del otro tipo de servicio (técnico/profesional).',
}

// Alertas de la verificación v2 que se muestran en rojo (las demás siguen en
// ámbar): indican un problema del archivo, no algo para revisar con calma.
export const ALERTAS_ROJAS = [
  'EN_BLANCO',
  'EMITIDO_ANTES_DEL_MINIMO',
  'VENCIDO',
  'ARCHIVO_REPETIDO',
  'FOTO_PARECE_DOCUMENTO',
  'CAMSCANNER',
  'NO_ES_PDF_ORIGINAL',
  'ES_FOTO',
  'FORMATO_CAMBIADO',
  'OTRO_FORMATO',
]

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
