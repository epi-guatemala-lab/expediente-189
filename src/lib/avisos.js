// Avisos de la verificación automática para el solicitante (verificación v2).
// Viven aquí —y no dentro del componente— para poder probarlos con node
// --test: son lógica pura, sin React ni DOM.
//
// OJO: el campo `verificacion.resultado` (SIN_ANTECEDENTES / REVISAR /
// NO_LEIDO) es solo del panel de Recepción; el solicitante nunca lo muestra,
// ni siquiera si llegara por error.

import { fechaDMA } from './formato.js'
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
  const leida = /^\d{4}-\d{2}-\d{2}$/.test(v.fecha_emision || '') ? v.fecha_emision : null
  const enBlanco = v.en_blanco || alertas.includes('EN_BLANCO')

  // Si la fecha leída es anterior al mínimo, ofrecer «Usar esta fecha» no sirve (el
  // servidor la rechaza): basta el aviso rojo, que ya dice la fecha y qué hacer.
  const anteriorAlMinimo = alertas.includes('EMITIDO_ANTES_DEL_MINIMO')
  if (leida && documento.fecha_documento && leida !== documento.fecha_documento && !anteriorAlMinimo) {
    avisos.push({
      clave: 'fecha_leida',
      tipo: 'alerta',
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
  const verificacion = documento.verificacion
  if (verificacion?.fecha === 'NO_COINCIDE') motivos.push('la fecha escrita no coincide con la del documento')
  if (verificacion?.tipo === 'NO_COINCIDE') motivos.push('no parece ser el documento correcto')
  if (verificacion?.identidad === 'NO_COINCIDE') motivos.push('no aparecen el nombre ni el DPI de la persona')
  if (verificacion?.colegiado === 'NO_COINCIDE') {
    motivos.push('el número de colegiado no coincide con el escrito en el paso 3')
  }
  return motivos
}
