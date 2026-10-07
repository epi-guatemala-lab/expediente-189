// Utilidades de presentación (texto de fechas, tamaños y estados).

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
