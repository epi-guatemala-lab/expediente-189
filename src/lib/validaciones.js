// Validaciones del lado del cliente según el CONTRATO (§3 datos, §4 documentos).
// Funciones puras: sin DOM ni entorno de Vite, para poder probarlas con `node --test`.

export const ESTADOS_CIVILES = [
  'SOLTERO(A)',
  'CASADO(A)',
  'UNIDO(A) DE HECHO',
  'DIVORCIADO(A)',
  'VIUDO(A)',
]

export const NIVELES_ESTUDIO = [
  'DIVERSIFICADO',
  'TÉCNICO UNIVERSITARIO',
  'LICENCIATURA',
  'MAESTRÍA',
  'DOCTORADO',
]

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const RE_NOMBRE = /^[A-ZÁÉÍÓÚÜÑ' -]+$/
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Dominios con errores de escritura frecuentes → dominio correcto (solo aviso, no bloquea).
const DOMINIOS_SOSPECHOSOS = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.om': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
}

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

export function soloDigitos(texto) {
  return String(texto ?? '').replace(/\D+/g, '')
}

// El servidor recorta, colapsa espacios y elimina caracteres de control y <>.
// El cliente normaliza igual antes de enviar para que lo que se ve sea lo que se guarda.
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function textoMayusculas(texto) {
  return normalizarTexto(texto).toUpperCase()
}

// ---------------------------------------------------------------------------
// CUI (DPI) — CONTRATO §3: 13 dígitos, verificador = dígito 9 por módulo 11,
// departamento 01–22 y municipio 01–35 en los dígitos 10–13.
// ---------------------------------------------------------------------------

export function formatoCUI(valor) {
  const d = soloDigitos(valor).slice(0, 13)
  if (d.length <= 4) return d
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 9)} ${d.slice(9)}`
}

export function validarCUI(cui) {
  const d = soloDigitos(cui)
  if (!d) return { valido: false, error: 'Ingrese su número de CUI' }
  if (d.length !== 13) return { valido: false, error: 'El CUI debe tener 13 dígitos' }
  let suma = 0
  for (let i = 0; i < 8; i++) suma += Number(d[i]) * (i + 2)
  const residuo = suma % 11
  if (residuo === 10) return { valido: false, error: 'El número de CUI no es válido' }
  if (residuo !== Number(d[8])) {
    return { valido: false, error: 'El número de CUI no es válido (dígito verificador incorrecto)' }
  }
  const departamento = Number(d.slice(9, 11))
  if (departamento < 1 || departamento > 22) {
    return { valido: false, error: 'El CUI indica un departamento inexistente' }
  }
  const municipio = Number(d.slice(11, 13))
  if (municipio < 1 || municipio > 35) {
    return { valido: false, error: 'El CUI indica un municipio inexistente' }
  }
  return { valido: true }
}

// ---------------------------------------------------------------------------
// Clave personal — formato XXXXX-XXXXX (CONTRATO §5: alfabeto sin I, L, O).
// ---------------------------------------------------------------------------

export function formatoClave(valor) {
  const d = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function clavePlana(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

// ---------------------------------------------------------------------------
// NIT — CONTRATO §3: 2–12 dígitos + verificador (0–9 o K) por módulo 11,
// o igual al CUI de la persona.
// ---------------------------------------------------------------------------

export function formatoNIT(valor) {
  const d = String(valor ?? '').toUpperCase().replace(/[^0-9K]/g, '').slice(0, 13)
  if (d.length <= 2) return d
  return `${d.slice(0, -1)}-${d.slice(-1)}`
}

export function nitPlano(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^0-9K]/g, '').slice(0, 13)
}

export function validarNIT(nit, cuiPersona) {
  const d = nitPlano(nit)
  if (!d) return { valido: false, error: 'Ingrese su número de NIT' }
  // La SAT acepta usar el CUI como NIT: se admite tal cual, sin verificador propio.
  if (cuiPersona && d === soloDigitos(cuiPersona)) return { valido: true }
  if (d.length < 3 || d.length > 13) {
    return { valido: false, error: 'El NIT debe tener entre 3 y 13 caracteres' }
  }
  const cuerpo = d.slice(0, -1)
  const verificador = d.slice(-1)
  if (!/^\d{2,12}$/.test(cuerpo)) return { valido: false, error: 'El número de NIT no es válido' }
  let suma = 0
  for (let i = 0; i < cuerpo.length; i++) {
    const posicionDesdeLaDerecha = cuerpo.length - i
    suma += Number(cuerpo[i]) * (posicionDesdeLaDerecha + 1)
  }
  const v = (11 - (suma % 11)) % 11
  const esperado = v === 10 ? 'K' : String(v)
  if (verificador !== esperado) {
    return { valido: false, error: 'El número de NIT no es válido (dígito verificador incorrecto)' }
  }
  return { valido: true }
}

// ---------------------------------------------------------------------------
// Teléfono — 8 dígitos, primero entre 2 y 7. Se guarda solo dígitos.
// ---------------------------------------------------------------------------

export function formatoTelefono(valor) {
  const d = soloDigitos(valor).slice(0, 8)
  if (d.length <= 4) return d
  return `${d.slice(0, 4)}-${d.slice(4)}`
}

export function validarTelefono(telefono) {
  const d = soloDigitos(telefono)
  if (!d) return { valido: false, error: 'Ingrese su número de teléfono' }
  if (d.length !== 8) return { valido: false, error: 'El teléfono debe tener 8 dígitos' }
  const primero = Number(d[0])
  if (primero < 2 || primero > 7) {
    return { valido: false, error: 'El teléfono debe iniciar con un dígito entre 2 y 7' }
  }
  return { valido: true }
}

// ---------------------------------------------------------------------------
// Correo — válido, ≤ 120, se guarda en minúsculas. Aviso (no bloqueante) si el
// dominio parece mal escrito.
// ---------------------------------------------------------------------------

export function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase()
}

export function validarCorreo(correo) {
  const c = normalizarCorreo(correo)
  if (!c) return { valido: false, error: 'Ingrese su correo electrónico' }
  if (c.length > 120) return { valido: false, error: 'El correo no puede superar 120 caracteres' }
  if (!RE_CORREO.test(c)) return { valido: false, error: 'Ingrese un correo electrónico válido' }
  const dominio = c.split('@')[1]
  const sugerencia = DOMINIOS_SOSPECHOSOS[dominio]
  if (sugerencia) {
    return { valido: true, aviso: `¿Quiso decir «@${sugerencia}»? Revise la escritura del dominio.` }
  }
  return { valido: true }
}

// ---------------------------------------------------------------------------
// Nombres y textos generales
// ---------------------------------------------------------------------------

export function validarNombrePersona(valor) {
  const t = textoMayusculas(valor)
  if (!t) return { valido: false, error: 'Ingrese la información solicitada' }
  if (t.length < 2 || t.length > 60) return { valido: false, error: 'Debe tener entre 2 y 60 caracteres' }
  if (!RE_NOMBRE.test(t)) {
    return { valido: false, error: "Solo se permiten letras, espacios, apóstrofos (') y guiones (-)" }
  }
  return { valido: true }
}

// Campos de texto libre con rango de longitud (dirección, profesión, área…).
// El vacío es válido: en borrador los campos son opcionales y lo exigente es el envío.
export function validarLongitud(valor, min, max) {
  const t = normalizarTexto(valor)
  if (!t) return { valido: true }
  if (t.length < min || t.length > max) {
    return { valido: false, error: `Debe tener entre ${min} y ${max} caracteres` }
  }
  return { valido: true }
}

export function validarNacionalidad(valor) {
  const t = textoMayusculas(valor)
  if (!t) return { valido: true }
  if (t.length < 3 || t.length > 40) return { valido: false, error: 'Debe tener entre 3 y 40 caracteres' }
  if (!/^[A-ZÁÉÍÓÚÜÑ ]+$/.test(t)) return { valido: false, error: 'Solo se permiten letras' }
  return { valido: true }
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

export function esFechaReal(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return false
  const [anio, mes, dia] = iso.split('-').map(Number)
  if (mes < 1 || mes > 12) return false
  const fecha = new Date(anio, mes - 1, dia)
  return (
    fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
  )
}

export function fechaISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function calcularEdad(fechaNacimiento, hoy = new Date()) {
  if (!esFechaReal(fechaNacimiento)) return null
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number)
  let edad = hoy.getFullYear() - anio
  const mesActual = hoy.getMonth() + 1
  if (mesActual < mes || (mesActual === mes && hoy.getDate() < dia)) edad -= 1
  return edad
}

export function validarFechaNacimiento(fecha, hoy = new Date()) {
  if (!fecha) return { valido: false, error: 'Ingrese su fecha de nacimiento' }
  if (!esFechaReal(fecha)) return { valido: false, error: 'La fecha indicada no existe' }
  if (fecha > fechaISO(hoy)) return { valido: false, error: 'La fecha no puede ser futura' }
  const edad = calcularEdad(fecha, hoy)
  if (edad < 18) return { valido: false, error: 'Debe tener al menos 18 años', edad }
  if (edad > 85) return { valido: false, error: 'La edad no puede ser mayor a 85 años', edad }
  return { valido: true, edad }
}

export function fechaEnPalabras(iso) {
  if (!esFechaReal(iso)) return ''
  const [anio, mes, dia] = iso.split('-').map(Number)
  return `${dia} de ${MESES[mes - 1].toLowerCase()} de ${anio}`
}

export function mesActual(hoy = new Date()) {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

// Compara dos meses "AAAA-MM": -1 si a < b, 0 si iguales, 1 si a > b, null si alguno no es válido.
export function compararMeses(a, b) {
  if (!/^\d{4}-\d{2}$/.test(a ?? '') || !/^\d{4}-\d{2}$/.test(b ?? '')) return null
  return a < b ? -1 : a === b ? 0 : 1
}

export function mesEnPalabras(aaaaMm) {
  if (!/^\d{4}-\d{2}$/.test(aaaaMm ?? '')) return ''
  const [anio, mes] = aaaaMm.split('-').map(Number)
  return `${MESES[mes - 1].toLowerCase()} de ${anio}`
}

// ---------------------------------------------------------------------------
// Estudios — lista de 1 a 3: {nivel, centro, titulo, inicio, fin}.
// inicio ≤ fin ≤ mes actual; inicio posterior al año de nacimiento + 10.
// ---------------------------------------------------------------------------

export function estudioVacio() {
  return { nivel: '', centro: '', titulo: '', inicio: '', fin: '' }
}

export function estudioVacioRevision(e) {
  const v = e ?? {}
  return !v.nivel && !v.centro && !v.titulo && !v.inicio && !v.fin
}

export function validarEstudio(estudio, { fechaNacimiento, hoy = new Date(), niveles } = {}) {
  const listaNiveles = (niveles && niveles.length ? niveles : NIVELES_ESTUDIO)
  const e = estudio ?? {}
  const errores = {}
  if (!e.nivel || !listaNiveles.includes(e.nivel)) errores.nivel = 'Seleccione el nivel académico'
  for (const campo of ['centro', 'titulo']) {
    const t = normalizarTexto(e[campo])
    if (t.length < 3 || t.length > 120) errores[campo] = 'Debe tener entre 3 y 120 caracteres'
  }
  if (!/^\d{4}-\d{2}$/.test(e.inicio ?? '')) errores.inicio = 'Seleccione el mes y año de inicio'
  if (!/^\d{4}-\d{2}$/.test(e.fin ?? '')) errores.fin = 'Seleccione el mes y año de fin'
  if (!errores.inicio && !errores.fin) {
    if (compararMeses(e.inicio, e.fin) > 0) errores.fin = 'El fin no puede ser anterior al inicio'
    else if (compararMeses(e.fin, mesActual(hoy)) > 0) errores.fin = 'El fin no puede ser posterior al mes actual'
  }
  if (!errores.inicio && esFechaReal(fechaNacimiento)) {
    const anioNacimiento = Number(fechaNacimiento.slice(0, 4))
    if (Number(e.inicio.slice(0, 4)) <= anioNacimiento + 10) {
      errores.inicio = 'El inicio debe ser posterior al año de nacimiento más diez años'
    }
  }
  return { valido: Object.keys(errores).length === 0, errores }
}

export function validarEstudios(estudios, opciones = {}) {
  const lista = Array.isArray(estudios) ? estudios : []
  const erroresPorIndice = lista.map((e) =>
    estudioVacioRevision(e) ? null : validarEstudio(e, opciones).errores
  )
  return {
    valido: erroresPorIndice.every((e) => !e || Object.keys(e).length === 0),
    erroresPorIndice,
  }
}

// ---------------------------------------------------------------------------
// Actividades — lista de 2 a 3 textos de 15 a 300 caracteres.
// ---------------------------------------------------------------------------

export function validarActividad(texto) {
  const t = normalizarTexto(texto)
  if (!t) return { valido: true }
  if (t.length < 15 || t.length > 300) return { valido: false, error: 'Debe tener entre 15 y 300 caracteres' }
  return { valido: true }
}

// `completas: true` exige además las 2 obligatorias (se usa al enviar).
export function validarActividades(actividades, { completas = false } = {}) {
  const lista = (Array.isArray(actividades) ? actividades : []).map((a) => normalizarTexto(a))
  const textos = lista.filter((t) => t.length > 0)
  if (completas && textos.length < 2) {
    return { valido: false, error: 'Describa al menos dos actividades' }
  }
  const erroresPorIndice = lista.map((t) => (t ? validarActividad(t).error ?? null : null))
  return { valido: erroresPorIndice.every((e) => !e), erroresPorIndice, textos }
}
