// Validación y armado del payload de cada paso del asistente (CONTRATO §3).
// En borrador los campos son opcionales: solo se valida el formato de lo que venga;
// lo obligatorio lo exige el servidor al enviar (lista `faltantes`).

import {
  ESTADOS_CIVILES,
  NIVELES_ESTUDIO,
  esFechaReal,
  estudioVacioRevision,
  formatoNIT,
  formatoTelefono,
  nitPlano,
  normalizarCorreo,
  normalizarTexto,
  soloDigitos,
  textoMayusculas,
  validarActividad,
  validarCorreo,
  validarEstudio,
  validarFechaNacimiento,
  validarLongitud,
  validarNacionalidad,
  validarNombrePersona,
  validarNIT,
  validarTelefono,
} from './validaciones.js'
import { esMunicipioValido } from '../config/geografia.js'

// ---------------------------------------------------------------------------
// Datos guardados pero ocultos (visibilidad por sesión)
//
// El servidor solo devuelve en `datos` lo escrito en la sesión actual; lo que quedó guardado
// de una sesión anterior viene en `campos_ocultos`. Un campo oculto se muestra vacío con la
// marca «Guardado ✓», cuenta como completo y NO se envía mientras la persona no escriba en
// él (enviar vacío lo borraría). Estos campos se escriben juntos: si la persona toca uno, debe
// volver a llenar todo el grupo, porque el servidor los valida entre sí.
// ---------------------------------------------------------------------------

export const GRUPOS_DE_CAMPOS = [
  ['departamento', 'municipio'],
  ['es_colegiado', 'colegio_profesional', 'numero_colegiado'],
]

export function aConjunto(ocultos) {
  return ocultos instanceof Set ? ocultos : new Set(ocultos || [])
}

// ¿El valor del campo está vacío en la interfaz? (listas: todas sus filas vacías)
export function esVacioUi(campo, valor) {
  if (campo === 'estudios') return !Array.isArray(valor) || valor.every((e) => estudioVacioRevision(e))
  if (campo === 'actividades') return !Array.isArray(valor) || valor.every((a) => !normalizarTexto(a))
  if (valor === null || valor === undefined) return true
  return String(valor).trim() === ''
}

// Guardado en el servidor, oculto para esta sesión y sin que la persona haya escrito nada.
export function ocultoSinEditar(campo, datos, ocultos) {
  return aConjunto(ocultos).has(campo) && esVacioUi(campo, datos?.[campo])
}

// Si en un grupo se tocó un campo y otro sigue oculto sin llenar, ese otro es el error.
function erroresDeGrupo(datos, ocultos, miembros, mensajes) {
  const errores = {}
  const escritos = miembros.filter((c) => !esVacioUi(c, datos[c]))
  const pendientes = miembros.filter((c) => ocultoSinEditar(c, datos, ocultos))
  if (escritos.length > 0 && pendientes.length > 0) {
    for (const campo of pendientes) errores[campo] = mensajes[campo]
  }
  return errores
}

// ---------------------------------------------------------------------------
// Validación por paso → { campo: mensaje }
// ---------------------------------------------------------------------------

function listaEstadosCiviles(catalogos) {
  const lista = catalogos?.estado_civil
  return Array.isArray(lista) && lista.length ? lista : ESTADOS_CIVILES
}

function listaNiveles(catalogos) {
  const lista = catalogos?.niveles_estudio
  return Array.isArray(lista) && lista.length ? lista : NIVELES_ESTUDIO
}

export function validarPaso1(datos, { catalogos, hoy } = {}) {
  const errores = {}
  for (const campo of ['nombres', 'apellidos', 'apellido_casada']) {
    if (datos[campo] && !validarNombrePersona(datos[campo]).valido) {
      errores[campo] = validarNombrePersona(datos[campo]).error
    }
  }
  if (datos.fecha_nacimiento) {
    const r = validarFechaNacimiento(datos.fecha_nacimiento, hoy)
    if (!r.valido) errores.fecha_nacimiento = r.error
  }
  if (datos.estado_civil && !listaEstadosCiviles(catalogos).includes(datos.estado_civil)) {
    errores.estado_civil = 'Seleccione una opción de la lista'
  }
  if (datos.nacionalidad && !validarNacionalidad(datos.nacionalidad).valido) {
    errores.nacionalidad = validarNacionalidad(datos.nacionalidad).error
  }
  return errores
}

export function validarPaso2(datos, { ocultos } = {}) {
  const errores = {}
  Object.assign(
    errores,
    erroresDeGrupo(datos, ocultos, ['departamento', 'municipio'], {
      departamento: 'Vuelva a seleccionar también el departamento: departamento y municipio se guardan juntos.',
      municipio: 'Vuelva a seleccionar también el municipio: departamento y municipio se guardan juntos.',
    })
  )
  const rDireccion = validarLongitud(datos.direccion, 10, 200)
  if (!rDireccion.valido) errores.direccion = 'La dirección debe tener entre 10 y 200 caracteres'
  if (datos.telefono && !validarTelefono(datos.telefono).valido) {
    errores.telefono = validarTelefono(datos.telefono).error
  }
  if (datos.correo && !validarCorreo(datos.correo).valido) {
    errores.correo = validarCorreo(datos.correo).error
  }
  if (datos.municipio && !datos.departamento && !errores.departamento) {
    errores.municipio = 'Seleccione primero el departamento'
  }
  if (datos.departamento && datos.municipio && !esMunicipioValido(datos.departamento, datos.municipio)) {
    errores.municipio = 'El municipio no pertenece al departamento seleccionado'
  }
  return errores
}

export function validarPaso3(datos, { catalogos, cui, hoy, ocultos } = {}) {
  const errores = {}
  if (datos.es_colegiado === true) {
    Object.assign(
      errores,
      erroresDeGrupo(datos, ocultos, ['colegio_profesional', 'numero_colegiado'], {
        colegio_profesional: 'Vuelva a escribir también el colegio profesional: colegio y número se guardan juntos.',
        numero_colegiado: 'Vuelva a escribir también el número de colegiado: colegio y número se guardan juntos.',
      })
    )
  }
  for (const campo of ['profesion', 'area_contratada']) {
    if (!validarLongitud(datos[campo], 3, 100).valido) {
      errores[campo] = 'Debe tener entre 3 y 100 caracteres'
    }
  }
  if (datos.es_colegiado === true) {
    const rColegio = validarLongitud(datos.colegio_profesional, 3, 100)
    if (!rColegio.valido) errores.colegio_profesional = 'Debe tener entre 3 y 100 caracteres'
    const numero = soloDigitos(datos.numero_colegiado)
    if (datos.numero_colegiado && (numero.length < 1 || numero.length > 7 || numero !== String(datos.numero_colegiado))) {
      errores.numero_colegiado = 'Debe tener entre 1 y 7 dígitos'
    }
  }
  if (datos.nit && !validarNIT(datos.nit, cui).valido) {
    errores.nit = validarNIT(datos.nit, cui).error
  }
  const opciones = {
    fechaNacimiento: datos.fecha_nacimiento || null,
    hoy,
    niveles: listaNiveles(catalogos),
  }
  ;(datos.estudios || []).forEach((estudio, i) => {
    if (estudioVacioRevision(estudio)) return
    const r = validarEstudio(estudio, opciones)
    if (!r.valido) {
      for (const [campo, mensaje] of Object.entries(r.errores)) {
        errores[`estudios.${i}.${campo}`] = mensaje
      }
    }
  })
  ;(datos.actividades || []).forEach((texto, i) => {
    if (!texto) return
    const r = validarActividad(texto)
    if (!r.valido) errores[`actividades.${i}`] = r.error
  })
  return errores
}

export function validarPaso(paso, datos, opciones = {}) {
  switch (paso) {
    case 1:
      return validarPaso1(datos, opciones)
    case 2:
      return validarPaso2(datos, opciones)
    case 3:
      return validarPaso3(datos, opciones)
    default:
      return {}
  }
}

// ---------------------------------------------------------------------------
// Lo obligatorio que falta en cada paso (círculos de la barra de progreso y
// aviso al «Guardar y continuar»). Un campo cuenta como presente si tiene
// valor o si está guardado y oculto (CONTRATO, visibilidad por sesión); el
// formato lo siguen validando las funciones de arriba, que sí bloquean.
// ---------------------------------------------------------------------------

const OBLIGATORIOS_POR_PASO = {
  1: ['nombres', 'apellidos', 'fecha_nacimiento', 'estado_civil', 'nacionalidad'],
  2: ['direccion', 'departamento', 'municipio', 'telefono', 'correo'],
  3: ['profesion', 'es_colegiado', 'nit', 'area_contratada', 'estudios', 'actividades'],
}

// Paso 4: documentos requeridos según la configuración (la constancia de
// colegiado solo si la persona declaró ser colegiada), con la misma regla del
// servidor: cargado y, si pide fecha, con fecha válida (o guardado y oculto).
export function faltantesDePaso(paso, datos = {}, { ocultos = [], documentos = [], config = {} } = {}) {
  if (paso === 4) {
    const porClave = new Map((documentos || []).map((d) => [d.clave, d]))
    const faltan = []
    for (const definicion of config?.documentos || []) {
      const requerido =
        definicion.obligatorio === 'siempre' ||
        (definicion.obligatorio === 'colegiado' && datos.es_colegiado === true)
      if (!requerido) continue
      const documento = porClave.get(definicion.clave)
      const completo =
        Boolean(documento?.cargado) &&
        (!definicion.etiqueta_fecha || esFechaReal(documento.fecha_documento) || Boolean(documento?.oculto))
      if (!completo) faltan.push(`doc:${definicion.clave}`)
    }
    return faltan
  }

  const presente = (campo) => {
    if (aConjunto(ocultos).has(campo) && esVacioUi(campo, datos[campo])) return true
    if (campo === 'actividades') {
      return (Array.isArray(datos.actividades) ? datos.actividades : []).filter((a) => normalizarTexto(a)).length >= 2
    }
    return !esVacioUi(campo, datos[campo])
  }

  const campos = [...(OBLIGATORIOS_POR_PASO[paso] || [])]
  if (paso === 3 && datos.es_colegiado === true) {
    campos.splice(campos.indexOf('es_colegiado') + 1, 0, 'colegio_profesional', 'numero_colegiado')
  }
  return campos.filter((campo) => !presente(campo))
}

// ---------------------------------------------------------------------------
// Payload por paso → lo que se envía en el PUT /mi-expediente.
// Cada paso envía todos sus campos (vacío → null, que en el servidor borra el campo).
// ---------------------------------------------------------------------------

function texto(valor) {
  return normalizarTexto(valor) || null
}

export function payloadPaso1(datos) {
  return {
    nombres: textoMayusculas(datos.nombres) || null,
    apellidos: textoMayusculas(datos.apellidos) || null,
    apellido_casada: textoMayusculas(datos.apellido_casada) || null,
    fecha_nacimiento: esFechaReal(datos.fecha_nacimiento) ? datos.fecha_nacimiento : null,
    estado_civil: datos.estado_civil || null,
    nacionalidad: textoMayusculas(datos.nacionalidad) || null,
  }
}

export function payloadPaso2(datos) {
  return {
    direccion: texto(datos.direccion),
    departamento: datos.departamento || null,
    municipio: datos.municipio || null,
    telefono: soloDigitos(datos.telefono) || null,
    correo: normalizarCorreo(datos.correo) || null,
  }
}

export function payloadPaso3(datos) {
  const colegiado = datos.es_colegiado === true
  const estudios = (datos.estudios || [])
    .filter((e) => !estudioVacioRevision(e))
    .map((e) => ({
      nivel: e.nivel || null,
      centro: textoMayusculas(e.centro),
      titulo: textoMayusculas(e.titulo),
      inicio: e.inicio || null,
      fin: e.fin || null,
    }))
  const actividades = (datos.actividades || [])
    .map((a) => normalizarTexto(a))
    .filter((t) => t.length > 0)
  return {
    profesion: texto(datos.profesion),
    es_colegiado: datos.es_colegiado === null || datos.es_colegiado === undefined ? null : datos.es_colegiado,
    // Si no es colegiado, ambos campos se guardan en null (CONTRATO §3).
    colegio_profesional: colegiado ? texto(datos.colegio_profesional) : null,
    numero_colegiado: colegiado ? soloDigitos(datos.numero_colegiado) || null : null,
    nit: nitPlano(datos.nit) || null,
    area_contratada: texto(datos.area_contratada),
    estudios: estudios.length ? estudios : null,
    actividades: actividades.length ? actividades : null,
  }
}

// Quita del payload los campos ocultos que la persona no tocó: enviarlos vacíos los borraría.
// Excepción: si dejó de ser colegiado, colegio y número se envían en null (se anulan juntos).
export function sinOcultos(payload, datos, ocultos) {
  const salida = {}
  for (const [campo, valor] of Object.entries(payload)) {
    const seAnula =
      datos.es_colegiado === false && (campo === 'colegio_profesional' || campo === 'numero_colegiado')
    if (!seAnula && ocultoSinEditar(campo, datos, ocultos)) continue
    salida[campo] = valor
  }
  return salida
}

// Si cambió un campo de un grupo, se envía el grupo completo (con lo que ya trae `payload`).
export function completarGrupos(cambios, payload) {
  const resultado = { ...cambios }
  for (const grupo of GRUPOS_DE_CAMPOS) {
    if (grupo.some((c) => c in cambios)) {
      for (const c of grupo) if (c in payload) resultado[c] = payload[c]
    }
  }
  return resultado
}

export function payloadPaso(paso, datos, { ocultos } = {}) {
  let payload
  switch (paso) {
    case 1:
      payload = payloadPaso1(datos)
      break
    case 2:
      payload = payloadPaso2(datos)
      break
    case 3:
      payload = payloadPaso3(datos)
      break
    default:
      // Los documentos se guardan con sus propios endpoints al momento de subirlos.
      return {}
  }
  return sinOcultos(payload, datos, ocultos)
}

// ---------------------------------------------------------------------------
// Copia de trabajo de `datos` para la interfaz (máscaras y valores por defecto).
// ---------------------------------------------------------------------------

export function datosParaInterfaz(datosServidor = {}, { ocultos, seccion = '' } = {}) {
  const guardados = aConjunto(ocultos)
  const seccionPropuesta = seccion || ''
  return {
    nombres: datosServidor.nombres || '',
    apellidos: datosServidor.apellidos || '',
    apellido_casada: datosServidor.apellido_casada || '',
    fecha_nacimiento: datosServidor.fecha_nacimiento || '',
    estado_civil: datosServidor.estado_civil || '',
    // El valor por defecto no aplica si ya hay una nacionalidad guardada que no se muestra.
    nacionalidad: datosServidor.nacionalidad || (guardados.has('nacionalidad') ? '' : 'GUATEMALTECA'),
    direccion: datosServidor.direccion || '',
    departamento: datosServidor.departamento || '',
    municipio: datosServidor.municipio || '',
    telefono: formatoTelefono(datosServidor.telefono || ''),
    correo: datosServidor.correo || '',
    profesion: datosServidor.profesion || '',
    es_colegiado: datosServidor.es_colegiado ?? null,
    colegio_profesional: datosServidor.colegio_profesional || '',
    numero_colegiado:
      datosServidor.numero_colegiado !== null && datosServidor.numero_colegiado !== undefined
        ? String(datosServidor.numero_colegiado)
        : '',
    nit: datosServidor.nit ? formatoNIT(datosServidor.nit) : '',
    // La sección de la nómina se propone como valor inicial del área contratada
    // (editable) cuando aún no hay valor y no venía guardada-oculta.
    area_contratada:
      datosServidor.area_contratada || (guardados.has('area_contratada') ? '' : seccionPropuesta),
    estudios:
      Array.isArray(datosServidor.estudios) && datosServidor.estudios.length
        ? datosServidor.estudios.map((e) => ({
          nivel: e.nivel || '',
          centro: e.centro || '',
          titulo: e.titulo || '',
          inicio: e.inicio || '',
          fin: e.fin || '',
        }))
        : [{ nivel: '', centro: '', titulo: '', inicio: '', fin: '' }],
    actividades: (() => {
      const lista = Array.isArray(datosServidor.actividades)
        ? datosServidor.actividades.map((a) => a || '')
        : []
      while (lista.length < 2) lista.push('')
      return lista.slice(0, 3)
    })(),
  }
}
