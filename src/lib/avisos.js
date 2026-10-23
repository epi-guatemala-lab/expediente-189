// Avisos de la verificación automática para el solicitante (verificación v2).
// Viven aquí —y no dentro del componente— para poder probarlos con node
// --test: son lógica pura, sin React ni DOM.
//
// OJO: el campo `verificacion.resultado` (SIN_ANTECEDENTES / REVISAR /
// NO_LEIDO) es solo del panel de Recepción; el solicitante nunca lo muestra,
// ni siquiera si llegara por error.

import { TEXTOS_ALERTAS, fechaDMA } from './formato.js'
import { fechaEnPalabras } from './validaciones.js'

// Avisos que orientan a la persona, nunca bloquean. Solo con verificación
// LISTA y documento visible (no oculto ni pendiente de enviar); `documentos`
// es la lista de definiciones de la configuración, para nombrar el documento
// que parece ser el archivo. Cada aviso es { clave, tipo, texto }; «fecha_leida»
// lleva el botón «Usar esta fecha» que corrige la fecha declarada con la leída.
export function avisosDeVerificacion(documento, definicion, documentos = []) {
  const v = documento?.verificacion
  const avisos = []
  if (!v || !documento.cargado || documento.oculto || v.estado !== 'LISTA') return avisos
  const alertas = documento.alertas || []
  // La fecha leída llega como día de calendario «AAAA-MM-DD»; cualquier otra
  // cosa no se muestra (evita avisos con la fecha vacía).
  // En la constancia de colegiado la fecha que cuenta es el «activo hasta».
  const deDocumento = definicion?.clave === 'colegiado_activo' ? v.fecha_vence : v.fecha_emision
  const leida = /^\d{4}-\d{2}-\d{2}$/.test(deDocumento || '') ? deDocumento : null
  const enBlanco = v.en_blanco || alertas.includes('EN_BLANCO')

  // Si la fecha leída es anterior al mínimo, ofrecer «Usar esta fecha» no sirve (el
  // servidor la rechaza): basta el aviso rojo, que ya dice la fecha y qué hacer.
  const anteriorAlMinimo = alertas.includes('EMITIDO_ANTES_DEL_MINIMO')
  if (v.fecha_tomada && documento.fecha_documento) {
    // El sistema puso la fecha leyéndola del documento.
    avisos.push({
      clave: 'fecha_tomada',
      tipo: 'exito',
      texto:
        `Tomamos la fecha del documento: ${fechaDMA(documento.fecha_documento)}.` +
        (v.fecha_escrita ? ` Usted había escrito ${fechaDMA(v.fecha_escrita)}.` : ''),
    })
  } else if (!documento.fecha_documento && definicion?.etiqueta_fecha && !anteriorAlMinimo) {
    avisos.push({
      clave: 'fecha_falta',
      tipo: 'alerta',
      texto: 'No pudimos leer la fecha en el documento: escríbala arriba.',
    })
  } else if (leida && documento.fecha_documento && leida !== documento.fecha_documento && !anteriorAlMinimo) {
    avisos.push({
      clave: 'fecha_leida',
      tipo: 'alerta',
      fecha: leida,
      texto: `En el documento leímos la fecha ${fechaDMA(leida)}. ¿Es la correcta?`,
    })
  } else if (v.fecha === 'NO_COINCIDE' && !anteriorAlMinimo) {
    avisos.push({
      clave: 'fecha_no_encontrada',
      tipo: 'alerta',
      texto: 'No encontramos esa fecha en el documento. Revise que la fecha escrita sea la que aparece en él',
    })
  }

  if (v.tipo_detectado) {
    const titulo = (documentos.find((d) => d.clave === v.tipo_detectado)?.titulo) || v.tipo_detectado
    avisos.push({
      clave: 'tipo_detectado',
      tipo: 'error',
      texto: `Este archivo parece ser ${titulo}, no ${definicion.titulo}. Revise que lo subió en el lugar correcto.`,
    })
  } else if (v.tipo === 'NO_COINCIDE') {
    avisos.push({
      clave: 'tipo_no_coincide',
      tipo: 'alerta',
      texto: `Este archivo no parece ser ${definicion.titulo}. Revise que subió el documento correcto`,
    })
  }

  if (enBlanco) {
    avisos.push({ clave: 'en_blanco', tipo: 'error', texto: 'El archivo está en blanco. Súbalo de nuevo.' })
  }
  if (alertas.includes('EMITIDO_ANTES_DEL_MINIMO')) {
    const minimo = definicion.fecha_min ? fechaEnPalabras(definicion.fecha_min) : null
    const pedido = minimo ? ` (${minimo})` : ''
    avisos.push({
      clave: 'antes_del_minimo',
      tipo: 'error',
      texto: leida
        ? `Este documento fue emitido el ${fechaDMA(leida)}, antes de la fecha mínima pedida${pedido}. Necesita uno más reciente.`
        : `Este documento fue emitido antes de la fecha mínima pedida${pedido}. Necesita uno más reciente.`,
    })
  }
  if (alertas.includes('VENCIDO')) {
    avisos.push({ clave: 'vencido', tipo: 'error', texto: 'Este documento ya está vencido. Suba uno vigente.' })
  }

  // La lectura automática no distinguió bien las letras (pero sí vio que hay
  // algo): pedir una foto o un escaneo mejor.
  if (v.legible === false && !enBlanco) {
    avisos.push({
      clave: 'legible',
      tipo: 'alerta',
      texto: 'No pudimos leer este documento. Si es una foto, tómela de nuevo con buena luz, sin sombras y con el papel completo y derecho.',
    })
  }
  if (v.identidad === 'NO_COINCIDE') {
    avisos.push({
      clave: 'identidad',
      tipo: 'error',
      texto: 'En este documento no encontramos su nombre ni su DPI. Revise que sea el suyo.',
    })
  }
  if (v.colegiado === 'NO_COINCIDE') {
    avisos.push({
      clave: 'colegiado',
      tipo: 'error',
      texto: 'El número de colegiado del documento no coincide con el que usted escribió en el paso 3.',
    })
  }
  if (alertas.includes('ARCHIVO_REPETIDO')) {
    avisos.push({
      clave: 'archivo_repetido',
      tipo: 'error',
      texto: 'Este mismo archivo ya está cargado en otro documento. Cada casillero necesita su propio archivo.',
    })
  }
  if (alertas.includes('VARIOS_DOCUMENTOS')) {
    avisos.push({
      clave: 'varios_documentos',
      tipo: 'alerta',
      texto: 'Este archivo trae varios documentos juntos. Suba cada documento por separado en su casillero.',
    })
  }
  // Las alertas de la fotografía solo puede tenerlas el casillero de la foto;
  // las tres rematan con la misma recomendación.
  const CONSEJO_FOTO = 'Use una foto de frente, vertical, tipo cédula.'
  if (alertas.includes('FOTO_PEQUENA')) {
    avisos.push({
      clave: 'foto_pequena',
      tipo: 'alerta',
      texto: `La fotografía es muy pequeña. ${CONSEJO_FOTO}`,
    })
  }
  if (alertas.includes('FOTO_HORIZONTAL')) {
    avisos.push({
      clave: 'foto_horizontal',
      tipo: 'alerta',
      texto: `La fotografía está en horizontal. ${CONSEJO_FOTO}`,
    })
  }
  if (alertas.includes('FOTO_PARECE_DOCUMENTO')) {
    avisos.push({
      clave: 'foto_parece_documento',
      tipo: 'error',
      texto: `Esto parece un documento, no una fotografía. ${CONSEJO_FOTO}`,
    })
  }
  // Lo que Recepción más rechaza (oct-2026).
  for (const alerta of ['CAMSCANNER', 'NO_ES_PDF_ORIGINAL', 'ES_FOTO']) {
    if (alertas.includes(alerta)) avisos.push({ clave: alerta, tipo: 'error', texto: TEXTOS_ALERTAS[alerta] })
  }
  if (alertas.includes('SIN_TINTA_AZUL')) {
    avisos.push({ clave: 'SIN_TINTA_AZUL', tipo: 'alerta', texto: TEXTOS_ALERTAS.SIN_TINTA_AZUL })
  }
  // Declaración jurada: el acta contra el formato, con los tramos exactos.
  const formato = v.formato
  if (formato?.veredicto === 'OTRO_FORMATO') {
    avisos.push({
      clave: 'OTRO_FORMATO',
      tipo: 'error',
      texto:
        'Esta acta usa el formato del otro tipo de servicio (técnico/profesional). Descargue el formato que le corresponde aquí arriba y pida al notario que lo use.',
    })
  } else if (formato?.veredicto === 'CON_CAMBIOS') {
    const detalle = (formato.cambios || [])
      .slice(0, 3)
      .map((c) => `el formato dice: ${c.formato} — el acta dice: ${c.documento}`)
      .join(' | ')
    avisos.push({
      clave: 'FORMATO_CAMBIADO',
      tipo: 'error',
      texto: `El acta no dice exactamente lo mismo que el formato y Recepción no la recibe con cambios. Revíselo con su notario: ${detalle}. (Si su acta sí dice eso, puede ser la lectura del escaneo: súbala escaneada con mejor calidad.)`,
    })
  }
  return avisos
}

// Motivos por los que conviene revisar un documento antes de enviar
// (verificación v2): alerta roja o dato que no coincide. No bloquea el envío:
// se pide reconocer el riesgo con una segunda casilla.
export function motivosParaRevisar(documento) {
  const motivos = []
  const alertas = documento.alertas || []
  if (alertas.includes('EN_BLANCO')) motivos.push('el archivo está en blanco')
  if (alertas.includes('EMITIDO_ANTES_DEL_MINIMO')) motivos.push('fue emitido antes de la fecha mínima pedida')
  if (alertas.includes('VENCIDO')) motivos.push('ya está vencido')
  if (alertas.includes('ARCHIVO_REPETIDO')) motivos.push('el mismo archivo está cargado en otro documento')
  if (alertas.includes('FOTO_PARECE_DOCUMENTO')) motivos.push('la fotografía parece ser un documento')
  if (alertas.includes('CAMSCANNER')) motivos.push('trae la marca de CamScanner')
  if (alertas.includes('NO_ES_PDF_ORIGINAL')) motivos.push('no es el PDF original descargado del sistema')
  if (alertas.includes('ES_FOTO')) motivos.push('es una fotografía, no un escaneo')
  if (alertas.includes('FORMATO_CAMBIADO')) motivos.push('el acta no dice exactamente lo del formato')
  if (alertas.includes('OTRO_FORMATO')) motivos.push('el acta es del otro tipo de servicio')
  const verificacion = documento.verificacion
  if (verificacion?.fecha === 'NO_COINCIDE') motivos.push('la fecha escrita no coincide con la del documento')
  if (verificacion?.tipo === 'NO_COINCIDE') motivos.push('no parece ser el documento correcto')
  if (verificacion?.identidad === 'NO_COINCIDE') motivos.push('no aparecen el nombre ni el DPI de la persona')
  if (verificacion?.colegiado === 'NO_COINCIDE') {
    motivos.push('el número de colegiado no coincide con el escrito en el paso 3')
  }
  return motivos
}
