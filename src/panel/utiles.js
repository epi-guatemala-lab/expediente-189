// Utilidades del panel: presentación de fechas en hora de Guatemala,
// portapapeles con respaldo, descargas de blobs y mensaje para compartir.

const ZONA_GUATEMALA = 'America/Guatemala'

const formatoFechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_GUATEMALA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Los instantes llegan en UTC ISO 8601 con Z (adenda §6) y se muestran en
// hora de Guatemala; si llegara sin zona, se trata como UTC.
function comoFecha(iso) {
  if (!iso) return null
  const texto = String(iso)
  const conZona = /Z$|[+-]\d{2}:?\d{2}$/.test(texto) ? texto : `${texto}Z`
  const fecha = new Date(conZona)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function fechaHoraGuatemala(iso) {
  const fecha = comoFecha(iso)
  return fecha ? formatoFechaHora.format(fecha) : ''
}

// Fechas de calendario (AAAA-MM-DD) → DD/MM/AAAA, sin zona horaria. La misma
// que usa el solicitante: vive en lib/formato.js y aquí se reexporta.
export { fechaDMA } from '../lib/formato.js'

// Dominios institucionales cuyo validador oficial se puede enlazar (verificación
// v2). Todo enlace que venga del servidor pasa por `urlValidadorOficial`: si no
// cumple, se muestra como texto plano, nunca como enlace clicable.
const DOMINIOS_VALIDADOR = ['oj.gob.gt', 'pnc.gob.gt', 'mp.gob.gt', 'sat.gob.gt']

export function urlValidadorOficial(url) {
  if (typeof url !== 'string' || !url) return null
  let destino
  try {
    destino = new URL(url)
  } catch {
    return null
  }
  if (destino.protocol !== 'https:') return null
  const host = destino.hostname.toLowerCase()
  const permitido = DOMINIOS_VALIDADOR.some(
    (dominio) => host === dominio || host.endsWith(`.${dominio}`)
  )
  return permitido ? url : null
}

// Día «AAAA-MM-DD» en Guatemala de una fecha leída del documento: las de
// calendario («AAAA-MM-DD») van directas; si llegara un instante completo se
// convierte a la zona horaria del país. null si no se puede leer.
export function diaGuatemala(iso) {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha.toLocaleDateString('en-CA', { timeZone: ZONA_GUATEMALA })
}

// Hoy («AAAA-MM-DD») en Guatemala, para comparar vigencias.
export function hoyGuatemala(ahora = new Date()) {
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA_GUATEMALA })
}

// Fecha leída del documento en «DD/MM/AAAA» para mostrar en pantalla.
export function fechaLeida(iso) {
  const dia = diaGuatemala(iso)
  if (!dia) return ''
  const [anio, mes, diaDelMes] = dia.split('-')
  return `${diaDelMes}/${mes}/${anio}`
}

// Copia al portapapeles con la API moderna y respaldo con execCommand para
// navegadores o contextos (http) donde clipboard no está disponible.
export async function copiarTexto(texto) {
  const valor = String(texto ?? '')
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor)
      return true
    }
  } catch {
    // se intenta el respaldo
  }
  try {
    const area = document.createElement('textarea')
    area.value = valor
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-9999px'
    document.body.appendChild(area)
    area.select()
    const copiado = document.execCommand('copy')
    document.body.removeChild(area)
    return copiado
  } catch {
    return false
  }
}

// Dispara la descarga de un blob y revoca su URL poco después (la descarga
// ya quedó iniciada; los blob: no deben quedar vivos indefinidamente).
export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Enlace público al formulario del solicitante (origin + base del deploy).
export function enlaceFormulario() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

// Mensaje que Recepción comparte con cada persona de la nómina: desde la
// adenda §7 entra con su número de DPI y su nombre completo, sin más datos.
export function mensajeCompartir() {
  return (
    `Para cargar sus datos y documentos del trámite de contratación 2027 ingrese a ` +
    `${enlaceFormulario()} con su número de DPI y su nombre completo.`
  )
}
