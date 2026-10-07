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

export function validarPaso2(datos) {
  const errores = {}
  const rDireccion = validarLongitud(datos.direccion, 10, 200)
  if (!rDireccion.valido) errores.direccion = 'La dirección debe tener entre 10 y 200 caracteres'
  if (datos.telefono && !validarTelefono(datos.telefono).valido) {
    errores.telefono = validarTelefono(datos.telefono).error
  }
  if (datos.correo && !validarCorreo(datos.correo).valido) {
    errores.correo = validarCorreo(datos.correo).error
  }
  if (datos.municipio && !datos.departamento) {
    errores.municipio = 'Seleccione primero el departamento'
  }
  if (datos.departamento && datos.municipio && !esMunicipioValido(datos.departamento, datos.municipio)) {
    errores.municipio = 'El municipio no pertenece al departamento seleccionado'
  }
  return errores
}

export function validarPaso3(datos, { catalogos, cui, hoy } = {}) {
  const errores = {}
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
      return validarPaso2(datos)
    case 3:
      return validarPaso3(datos, opciones)
    default:
      return {}
  }
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

export function payloadPaso(paso, datos) {
  switch (paso) {
    case 1:
      return payloadPaso1(datos)
    case 2:
      return payloadPaso2(datos)
    case 3:
      return payloadPaso3(datos)
    default:
      // Los documentos se guardan con sus propios endpoints al momento de subirlos.
      return {}
  }
}

// ---------------------------------------------------------------------------
// Copia de trabajo de `datos` para la interfaz (máscaras y valores por defecto).
// ---------------------------------------------------------------------------

export function datosParaInterfaz(datosServidor = {}) {
  return {
    nombres: datosServidor.nombres || '',
    apellidos: datosServidor.apellidos || '',
    apellido_casada: datosServidor.apellido_casada || '',
    fecha_nacimiento: datosServidor.fecha_nacimiento || '',
    estado_civil: datosServidor.estado_civil || '',
    nacionalidad: datosServidor.nacionalidad || 'GUATEMALTECA',
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
    area_contratada: datosServidor.area_contratada || '',
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
