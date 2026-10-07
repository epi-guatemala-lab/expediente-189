// Vista optimista: el último expediente conocido del servidor con las operaciones
// pendientes aplicadas encima, para que la pantalla refleje el cambio de inmediato.
// También: diferencia de datos (solo lo que la persona cambió) y cálculo local de lo que
// falta para poder enviar (la misma regla del contrato, para poder enviar sin conexión).

import { departamentos, esMunicipioValido } from '../config/geografia.js'
import {
  ESTADOS_CIVILES,
  NIVELES_ESTUDIO,
  esFechaReal,
  estudioVacioRevision,
  normalizarTexto,
  validarActividades,
  validarCorreo,
  validarEstudio,
  validarFechaNacimiento,
  validarNacionalidad,
  validarNIT,
  validarNombrePersona,
  validarTelefono,
} from '../lib/validaciones.js'
import { ordenar } from './cola.js'

function clonar(valor) {
  return valor === undefined ? undefined : JSON.parse(JSON.stringify(valor))
}

// ---------------------------------------------------------------------------
// Diferencia de datos
// ---------------------------------------------------------------------------

function canonico(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  if (Array.isArray(valor)) return valor.map(canonico)
  if (typeof valor === 'object') {
    const salida = {}
    for (const clave of Object.keys(valor).sort()) salida[clave] = canonico(valor[clave])
    return salida
  }
  if (typeof valor === 'boolean') return valor
  return String(valor)
}

export function sonIguales(a, b) {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b))
}

// Solo los campos de `nuevos` cuyo valor difiere del que ya se veía. Enviar únicamente lo
// que la persona cambió evita pisar, tras un conflicto de versión, lo que cambió otro lado.
export function diffDatos(actuales, nuevos) {
  const cambios = {}
  for (const [campo, valor] of Object.entries(nuevos || {})) {
    if (!sonIguales(actuales?.[campo], valor)) cambios[campo] = valor
  }
  return cambios
}

// ---------------------------------------------------------------------------
// Lo que falta para enviar (CONTRATO §3 y §4)
// ---------------------------------------------------------------------------

function longitudEntre(valor, min, max) {
  const largo = normalizarTexto(valor == null ? '' : String(valor)).length
  return largo >= min && largo <= max
}

// `ocultos`: campos que ya están guardados en el servidor pero que esta sesión no puede leer
// (CONTRATO, visibilidad por sesión). Un campo guardado y oculto cuenta como completo.
export function calcularFaltantes(
  datos = {},
  documentos = [],
  config = {},
  { cui = null, hoy = new Date(), ocultos = [] } = {}
) {
  const faltantes = []
  const guardados = new Set(ocultos || [])
  const marcar = (clave, condicion) => {
    if (!condicion && !guardados.has(clave)) faltantes.push(clave)
  }
  const estadosCiviles = config?.catalogos?.estado_civil?.length ? config.catalogos.estado_civil : ESTADOS_CIVILES
  const niveles = config?.catalogos?.niveles_estudio?.length ? config.catalogos.niveles_estudio : NIVELES_ESTUDIO

  marcar('nombres', validarNombrePersona(datos.nombres).valido)
  marcar('apellidos', validarNombrePersona(datos.apellidos).valido)
  marcar('fecha_nacimiento', validarFechaNacimiento(datos.fecha_nacimiento, hoy).valido)
  marcar('estado_civil', estadosCiviles.includes(datos.estado_civil))
  marcar('direccion', longitudEntre(datos.direccion, 10, 200))
  marcar('departamento', departamentos.includes(datos.departamento))
  marcar('municipio', Boolean(datos.departamento) && esMunicipioValido(datos.departamento, datos.municipio))
  marcar('telefono', validarTelefono(datos.telefono).valido)
  marcar('correo', validarCorreo(datos.correo).valido)
  marcar('nacionalidad', Boolean(datos.nacionalidad) && validarNacionalidad(datos.nacionalidad).valido)
  marcar('profesion', longitudEntre(datos.profesion, 3, 100))
  marcar('es_colegiado', typeof datos.es_colegiado === 'boolean')
  if (datos.es_colegiado === true) {
    marcar('colegio_profesional', longitudEntre(datos.colegio_profesional, 3, 100))
    marcar('numero_colegiado', /^\d{1,7}$/.test(String(datos.numero_colegiado ?? '')))
  }
  marcar('nit', validarNIT(datos.nit, cui).valido)
  marcar('area_contratada', longitudEntre(datos.area_contratada, 3, 100))

  const estudios = (Array.isArray(datos.estudios) ? datos.estudios : []).filter((e) => !estudioVacioRevision(e))
  marcar(
    'estudios',
    estudios.length >= 1 &&
      estudios.length <= 3 &&
      estudios.every((e) => validarEstudio(e, { fechaNacimiento: datos.fecha_nacimiento, hoy, niveles }).valido)
  )
  marcar('actividades', validarActividades(datos.actividades, { completas: true }).valido)

  const porClave = new Map((documentos || []).map((d) => [d.clave, d]))
  for (const definicion of config?.documentos || []) {
    const requerido =
      definicion.obligatorio === 'siempre' ||
      (definicion.obligatorio === 'colegiado' && datos.es_colegiado === true)
    if (!requerido) continue
    const documento = porClave.get(definicion.clave)
    const completo =
      Boolean(documento?.cargado) &&
      (!definicion.etiqueta_fecha || esFechaReal(documento.fecha_documento) || Boolean(documento.oculto))
    if (!completo) faltantes.push(`doc:${definicion.clave}`)
  }
  return faltantes
}

// ---------------------------------------------------------------------------
// Vista optimista
// ---------------------------------------------------------------------------

export function documentoVacio(clave) {
  return {
    clave,
    oculto: false,
    cargado: false,
    tipo: null,
    paginas: 0,
    tamano: 0,
    fecha_documento: null,
    alertas: [],
    revision: { estado: 'PENDIENTE', motivo: null },
    cargado_at: null,
    requerido: true,
    verificacion: null,
  }
}

export function esNoEditable(expediente) {
  return Boolean(expediente) && (expediente.editable === false || ['ENVIADO', 'APROBADO'].includes(expediente.estado))
}

// Devuelve una copia del expediente con las operaciones de la cola aplicadas.
// Las operaciones fallidas NO cuentan como hechas (salvo los datos escritos, que se
// siguen mostrando para que la persona los corrija): solo marcan el documento con su fallo.
// Solo se aplican las operaciones de la sesión actual (`sid`): lo que quedó pendiente de una
// sesión anterior se envía, pero su contenido no se muestra.
export function aplicarPendientes(base, cola = [], config = null, { hoy = new Date(), sid = null } = {}) {
  if (!base) return null
  const expediente = clonar(base)
  expediente.datos = expediente.datos || {}
  const escritos = new Set()
  const documentos = new Map((expediente.documentos || []).map((d) => [d.clave, d]))
  for (const definicion of config?.documentos || []) {
    if (!documentos.has(definicion.clave)) documentos.set(definicion.clave, documentoVacio(definicion.clave))
  }
  const doc = (clave) => {
    if (!documentos.has(clave)) documentos.set(clave, documentoVacio(clave))
    return documentos.get(clave)
  }

  let envioPendiente = false
  let hayCambios = false

  for (const op of ordenar(cola)) {
    if (op.corrupta) continue
    if ((op.cuerpo?.sid ?? null) !== (sid ?? null)) continue
    const fallo = op.estado === 'fallida' ? { tipo: op.tipo, mensaje: op.cuerpo?.fallo?.mensaje || 'No se pudo enviar.' } : null
    switch (op.tipo) {
      case 'GUARDAR':
        Object.assign(expediente.datos, op.cuerpo.datos)
        for (const [campo, valor] of Object.entries(op.cuerpo.datos)) {
          if (valor !== null && valor !== undefined) escritos.add(campo)
        }
        hayCambios = true
        break
      case 'SUBIR': {
        const d = doc(op.clave)
        if (fallo) {
          d.fallo = fallo
          break
        }
        Object.assign(d, {
          cargado: true,
          pendiente: true,
          oculto: false,
          tipo: op.cuerpo.tipo,
          paginas: 0,
          tamano: op.cuerpo.tamano,
          nombreLocal: op.cuerpo.nombre,
          fecha_documento: op.cuerpo.fecha || null,
          alertas: [],
          revision: { estado: 'PENDIENTE', motivo: null },
          cargado_at: null,
          verificacion: null,
        })
        delete d.fallo
        hayCambios = true
        break
      }
      case 'FECHA': {
        const d = doc(op.clave)
        if (fallo) {
          d.fallo = fallo
          break
        }
        d.fecha_documento = op.cuerpo.fecha
        hayCambios = true
        break
      }
      case 'QUITAR': {
        const d = doc(op.clave)
        if (fallo) {
          d.fallo = fallo
          break
        }
        documentos.set(op.clave, { ...documentoVacio(op.clave), requerido: d.requerido })
        hayCambios = true
        break
      }
      case 'ENVIAR':
        if (!fallo) {
          envioPendiente = true
          hayCambios = true
        }
        break
      default:
        break
    }
  }

  expediente.documentos = [...documentos.values()]
  expediente.envioPendiente = envioPendiente
  // Lo que se escribió en esta sesión deja de estar «oculto»: ya se ve.
  expediente.campos_ocultos = (expediente.campos_ocultos || []).filter((c) => !escritos.has(c))
  expediente.campos_guardados = [...new Set([...(expediente.campos_guardados || []), ...escritos])]
  if (hayCambios) {
    expediente.faltantes = calcularFaltantes(expediente.datos, expediente.documentos, config || {}, {
      cui: expediente.cui,
      hoy,
      ocultos: expediente.campos_ocultos,
    })
  }
  return expediente
}
