// Lógica pura de la cola de operaciones (sin IndexedDB ni red).
//
// Una operación en memoria tiene la forma:
//   { id, tipo, clave|null, instante, intentos, estado:'pendiente'|'fallida', cuerpo, bytes }
// Tipos: GUARDAR (PUT de datos), SUBIR (archivo + fecha), FECHA, QUITAR, ENVIAR.
// El orden es el de `id` (autoincremental): estricto y de una en una.

export const TIPOS = {
  GUARDAR: 'GUARDAR',
  SUBIR: 'SUBIR',
  FECHA: 'FECHA',
  QUITAR: 'QUITAR',
  ENVIAR: 'ENVIAR',
}

// Tope de lo que se acumula en el dispositivo para archivos pendientes.
export const TOPE_BYTES = 80 * 1024 * 1024

const TIPOS_DE_DOCUMENTO = [TIPOS.SUBIR, TIPOS.FECHA, TIPOS.QUITAR]

export function ordenar(cola) {
  return [...cola].sort((a, b) => a.id - b.id)
}

export function bytesEnCola(cola) {
  return cola.reduce((suma, op) => suma + (op.bytes || 0), 0)
}

// Cada operación guarda en su cuerpo el `sid` de la sesión en que se encoló.
export function mismaSesion(a, b) {
  return (a.cuerpo?.sid ?? null) === (b.cuerpo?.sid ?? null)
}

function copiaSinClaves(datos, claves) {
  const resultado = {}
  for (const clave of claves) resultado[clave] = datos[clave]
  return resultado
}

// Decide qué hacer en la cola al llegar una operación nueva. No toca nada: devuelve un plan.
//   nueva: { tipo, clave?, cuerpo, archivo? }
//   contexto.enVuelo:      Set de ids que ya se están enviando (no se pueden alterar)
//   contexto.baseTieneDoc: (clave) => ¿el servidor ya tiene ese documento?
// Plan: { agregar: op|null, actualizar: [{id, cuerpo}], quitar: [id], fusionado: bool }
export function planEncolar(cola, nueva, { enVuelo = new Set(), baseTieneDoc = () => false } = {}) {
  const ordenada = ordenar(cola)
  const plan = { agregar: null, actualizar: [], quitar: [], fusionado: false }
  const libre = (op) => !enVuelo.has(op.id)

  switch (nueva.tipo) {
    case TIPOS.GUARDAR: {
      const nuevasLlaves = Object.keys(nueva.cuerpo.datos)
      // Un GUARDAR que falló y que la persona ya corrigió (vuelve a guardar esos campos)
      // se reemplaza; si solo cubre una parte, conserva lo que sigue sin corregir.
      for (const op of ordenada) {
        if (op.tipo !== TIPOS.GUARDAR || op.estado !== 'fallida') continue
        const restantes = Object.keys(op.cuerpo.datos).filter((k) => !nuevasLlaves.includes(k))
        if (restantes.length === Object.keys(op.cuerpo.datos).length) continue
        if (restantes.length === 0) {
          plan.quitar.push(op.id)
        } else {
          const fallo = op.cuerpo.fallo
            ? {
                ...op.cuerpo.fallo,
                errores: op.cuerpo.fallo.errores
                  ? Object.fromEntries(
                      Object.entries(op.cuerpo.fallo.errores).filter(([k]) => !nuevasLlaves.includes(k))
                    )
                  : null,
              }
            : undefined
          plan.actualizar.push({
            id: op.id,
            cuerpo: { ...op.cuerpo, datos: copiaSinClaves(op.cuerpo.datos, restantes), ...(fallo ? { fallo } : {}) },
          })
        }
      }
      const vivas = ordenada.filter((op) => !plan.quitar.includes(op.id))
      const ultima = vivas[vivas.length - 1]
      // Dos GUARDAR seguidos que aún no salieron se funden en uno (si son de la misma
      // sesión: lo de una sesión anterior no se mezcla con lo que se escribe ahora).
      if (
        ultima &&
        ultima.tipo === TIPOS.GUARDAR &&
        ultima.estado === 'pendiente' &&
        libre(ultima) &&
        mismaSesion(ultima, nueva)
      ) {
        plan.actualizar.push({
          id: ultima.id,
          cuerpo: { ...ultima.cuerpo, datos: { ...ultima.cuerpo.datos, ...nueva.cuerpo.datos } },
        })
        plan.fusionado = true
        return plan
      }
      plan.agregar = nueva
      return plan
    }

    case TIPOS.SUBIR: {
      // Un archivo nuevo reemplaza a cualquier cambio anterior del mismo documento
      // que todavía no salió (lo que ya falló también: es la corrección de la persona).
      for (const op of ordenada) {
        if (op.clave === nueva.clave && TIPOS_DE_DOCUMENTO.includes(op.tipo) && libre(op)) {
          plan.quitar.push(op.id)
        }
      }
      plan.agregar = nueva
      return plan
    }

    case TIPOS.FECHA: {
      const subida = ordenada.find(
        (op) =>
          op.tipo === TIPOS.SUBIR &&
          op.clave === nueva.clave &&
          op.estado === 'pendiente' &&
          libre(op) &&
          mismaSesion(op, nueva)
      )
      if (subida) {
        plan.actualizar.push({ id: subida.id, cuerpo: { ...subida.cuerpo, fecha: nueva.cuerpo.fecha } })
        plan.fusionado = true
        return plan
      }
      const anterior = ordenada.find(
        (op) =>
          op.tipo === TIPOS.FECHA &&
          op.clave === nueva.clave &&
          op.estado === 'pendiente' &&
          libre(op) &&
          mismaSesion(op, nueva)
      )
      if (anterior) {
        plan.actualizar.push({ id: anterior.id, cuerpo: { ...anterior.cuerpo, fecha: nueva.cuerpo.fecha } })
        plan.fusionado = true
        return plan
      }
      plan.agregar = nueva
      return plan
    }

    case TIPOS.QUITAR: {
      for (const op of ordenada) {
        if (op.clave === nueva.clave && TIPOS_DE_DOCUMENTO.includes(op.tipo) && libre(op)) {
          plan.quitar.push(op.id)
        }
      }
      // Solo hace falta pedirle al servidor que lo quite si el documento existe allá
      // o si hay una subida en camino que lo va a crear.
      const subidaEnCamino = ordenada.some(
        (op) => op.tipo === TIPOS.SUBIR && op.clave === nueva.clave && !libre(op)
      )
      if (baseTieneDoc(nueva.clave) || subidaEnCamino) plan.agregar = nueva
      return plan
    }

    case TIPOS.ENVIAR: {
      const previo = ordenada.find((op) => op.tipo === TIPOS.ENVIAR)
      if (previo && previo.estado === 'pendiente') {
        plan.fusionado = true
        return plan
      }
      if (previo) plan.quitar.push(previo.id) // uno fallido se reemplaza por el nuevo
      plan.agregar = nueva
      return plan
    }

    default:
      throw new Error(`Tipo de operación desconocido: ${nueva.tipo}`)
  }
}

// Qué operación toca enviar ahora (o null). Reglas:
//  - orden estricto por id, de una en una;
//  - las fallidas se saltan (la persona decide), pero lo que dependa del mismo
//    documento queda detrás de ellas;
//  - ENVIAR solo sale cuando ya no queda nada pendiente antes y no hay NINGUNA fallida:
//    enviar un expediente al que le faltó un cambio sería hacerlo incompleto en silencio.
export function siguienteOperacion(cola, enVuelo = new Set()) {
  const ordenada = ordenar(cola)
  const fallidas = ordenada.filter((op) => op.estado === 'fallida')
  for (const op of ordenada) {
    if (op.estado !== 'pendiente' || enVuelo.has(op.id)) continue
    if (op.tipo === TIPOS.ENVIAR) {
      const hayAntes = ordenada.some((o) => o.id < op.id && o.estado === 'pendiente')
      if (hayAntes || fallidas.length > 0) return null
      return op
    }
    if (op.clave && fallidas.some((f) => f.clave === op.clave && f.id < op.id)) continue
    return op
  }
  return null
}

// ¿Hay algo detenido por una operación fallida? (para informar que la cola no está «vacía»).
export function hayBloqueadas(cola) {
  return cola.some((op) => op.estado === 'fallida')
}
