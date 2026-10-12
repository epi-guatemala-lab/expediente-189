// Preparación de archivos antes de subirlos (CONTRATO §4):
// tipos PDF/JPG/PNG, tope de tamaño y reescalado de imágenes por <canvas>.
// Desde la tanda 7 se acepta cualquier imagen del navegador (HEIC de iPhone,
// WEBP, …): se decodifica y se sube recodificada como JPEG; si el navegador
// no puede abrirla, el mensaje se lo dice en vez del genérico de «tipo».

const TIPO_POR_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

// Word se detecta por extensión o por MIME: el mensaje tiene que decir cómo
// convertirlo, porque mucha gente solo tiene el .docx a mano.
const MIMES_WORD = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function esDocumentoWord(archivo) {
  const nombre = (archivo?.name || '').toLowerCase()
  return nombre.endsWith('.doc') || nombre.endsWith('.docx') || MIMES_WORD.includes(archivo?.type)
}

export function tipoDeArchivo(archivo) {
  if (esDocumentoWord(archivo)) return 'word'
  if (typeof archivo?.type === 'string' && archivo.type.startsWith('image/')) return 'jpg'
  return TIPO_POR_MIME[archivo?.type] || null
}

// La fotografía solo admite imágenes; el resto acepta también PDF.
export function tiposPermitidos(definicion) {
  const tipos = Array.isArray(definicion?.tipos) && definicion.tipos.length
    ? definicion.tipos
    : ['pdf', 'jpg', 'png']
  if (definicion?.clave === 'foto') return tipos.filter((t) => t !== 'pdf')
  return tipos
}

// El <input type="file"> acepta cualquier imagen del navegador, no solo
// JPG/PNG: la que no se pueda decodificar se rechaza después, con su mensaje.
export function aceptacionParaTipos(tipos) {
  return tipos.includes('pdf') ? 'application/pdf,image/*' : 'image/*'
}

// Reescala una imagen por canvas: lado mayor ≤ 2200 px, JPEG calidad 0.85.
// Un PNG (o HEIC/WEBP) se sube recodificado como JPEG (el servidor lo guarda así).
async function comprimirImagen(archivo) {
  const urlObjeto = URL.createObjectURL(archivo)
  try {
    const imagen = await new Promise((resolver, rechazar) => {
      const img = new Image()
      img.onload = () => resolver(img)
      img.onerror = () => rechazar(new Error('formato'))
      img.src = urlObjeto
    })
    const ladoMayor = Math.max(imagen.width, imagen.height)
    const escala = ladoMayor > 2200 ? 2200 / ladoMayor : 1
    const ancho = Math.max(1, Math.round(imagen.width * escala))
    const alto = Math.max(1, Math.round(imagen.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const contexto = canvas.getContext('2d')
    // Fondo blanco para que la transparencia de un PNG no quede negra en el JPEG.
    contexto.fillStyle = '#FFFFFF'
    contexto.fillRect(0, 0, ancho, alto)
    contexto.drawImage(imagen, 0, 0, ancho, alto)
    const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', 0.85))
    if (!blob) throw new Error('codificacion')
    const base = archivo.name.replace(/\.[^.]+$/, '') || 'documento'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(urlObjeto)
  }
}

// Peso en MB con un decimal, para el mensaje del PDF pesado.
function mb(size) {
  return (size / (1024 * 1024)).toFixed(1)
}

// Valida tipo y tamaño; si es imagen, la pasa por el canvas.
// Devuelve { archivo } listo para subir o { error } con el mensaje en español.
export async function prepararArchivo(archivo, definicion) {
  if (!archivo) return { error: 'Elija un archivo' }
  if (esDocumentoWord(archivo)) {
    return {
      error: 'Los documentos de Word no se aceptan. Ábralo y use “Guardar como PDF”, o tómele una foto al documento impreso.',
    }
  }
  const tipo = tipoDeArchivo(archivo)
  const permitidos = tiposPermitidos(definicion)
  if (!tipo) {
    return { error: 'El archivo debe ser PDF, JPG o PNG' }
  }
  if (!permitidos.includes(tipo)) {
    return {
      error: definicion?.clave === 'foto'
        ? 'La fotografía debe ser una imagen (JPG o PNG)'
        : 'El tipo de archivo no está permitido',
    }
  }
  const maxMb = definicion?.max_mb || 8
  if (archivo.size > maxMb * 1024 * 1024) {
    // El PDF no se puede reescalar en el navegador: el mensaje dice cómo
    // achicarlo. Las imágenes grandes sí pasan por el canvas.
    if (tipo === 'pdf') {
      return {
        error: `El PDF pesa ${mb(archivo.size)} MB y el máximo es ${maxMb} MB. Escanéelo en escala de grises o a menor resolución (150 ppp), o suba una foto de cada página.`,
      }
    }
    return { error: `El archivo supera el máximo de ${maxMb} MB` }
  }
  if (tipo === 'pdf') return { archivo }
  try {
    return { archivo: await comprimirImagen(archivo) }
  } catch (e) {
    if (e?.message === 'formato') {
      return { error: 'Este formato de imagen no se pudo abrir. Tome la foto de nuevo o guárdela como JPG.' }
    }
    return { error: 'No se pudo procesar la imagen' }
  }
}
