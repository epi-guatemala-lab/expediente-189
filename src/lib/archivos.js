// Preparación de archivos antes de subirlos (CONTRATO §4):
// tipos PDF/JPG/PNG, tope de tamaño y reescalado de imágenes por <canvas>.

const TIPO_POR_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export function tipoDeArchivo(archivo) {
  return TIPO_POR_MIME[archivo?.type] || null
}

// La fotografía solo admite JPG/PNG; el resto acepta también PDF.
export function tiposPermitidos(definicion) {
  const tipos = Array.isArray(definicion?.tipos) && definicion.tipos.length
    ? definicion.tipos
    : ['pdf', 'jpg', 'png']
  if (definicion?.clave === 'foto') return tipos.filter((t) => t !== 'pdf')
  return tipos
}

export function aceptacionParaTipos(tipos) {
  const extensiones = { pdf: ['.pdf'], jpg: ['.jpg', '.jpeg'], png: ['.png'] }
  return tipos.flatMap((t) => extensiones[t] || []).join(',')
}

// Reescala una imagen por canvas: lado mayor ≤ 2200 px, JPEG calidad 0.85.
// Un PNG se sube recodificado como JPEG (el servidor también lo guarda así).
async function comprimirImagen(archivo) {
  const urlObjeto = URL.createObjectURL(archivo)
  try {
    const imagen = await new Promise((resolver, rechazar) => {
      const img = new Image()
      img.onload = () => resolver(img)
      img.onerror = () => rechazar(new Error('no legible'))
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
    if (!blob) throw new Error('no codificable')
    const base = archivo.name.replace(/\.[^.]+$/, '') || 'documento'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(urlObjeto)
  }
}

// Valida tipo y tamaño; si es imagen, la pasa por el canvas.
// Devuelve { archivo } listo para subir o { error } con el mensaje en español.
export async function prepararArchivo(archivo, definicion) {
  if (!archivo) return { error: 'Elija un archivo' }
  const tipo = tipoDeArchivo(archivo)
  const permitidos = tiposPermitidos(definicion)
  if (!tipo) {
    return { error: 'El archivo debe ser PDF, JPG o PNG' }
  }
  if (!permitidos.includes(tipo)) {
    return {
      error: definicion?.clave === 'foto'
        ? 'La fotografía debe ser JPG o PNG'
        : 'El tipo de archivo no está permitido',
    }
  }
  const maxMb = definicion?.max_mb || 8
  if (archivo.size > maxMb * 1024 * 1024) {
    return { error: `El archivo supera el máximo de ${maxMb} MB` }
  }
  if (tipo === 'pdf') return { archivo }
  try {
    return { archivo: await comprimirImagen(archivo) }
  } catch {
    return { error: 'No se pudo procesar la imagen' }
  }
}
