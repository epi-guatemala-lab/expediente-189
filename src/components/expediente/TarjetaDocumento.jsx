import { useEffect, useRef, useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import {
  ETIQUETAS_REVISION,
  TEXTOS_ALERTAS,
  formatoDia,
  formatoInstante,
  formatoTamano,
} from '../../lib/formato.js'
import { esFechaReal, fechaEnPalabras, fechaISO } from '../../lib/validaciones.js'
import { aceptacionParaTipos, prepararArchivo, tiposPermitidos } from '../../lib/archivos.js'
import { obtenerVistaDocumento } from '../../api/cliente.js'
import { servicio } from '../../sinconexion/instancia.js'

const MENSAJES_DE_FALLO = {
  tope: 'El espacio de este dispositivo para archivos sin enviar (80 MB) está lleno. Cuando haya conexión se enviarán; mientras tanto no se pueden agregar más archivos.',
  almacenamiento:
    'No se pudo guardar el archivo en este dispositivo (el navegador negó el espacio). Libere espacio e intente de nuevo.',
  no_editable: 'El expediente ya no admite cambios.',
  cerrado: 'Su sesión no está abierta. Vuelva a entrar con su DPI y su nombre.',
  archivo: 'No se pudo leer el archivo. Elija otro.',
  oculto: 'Por seguridad este documento no se puede modificar sin subirlo de nuevo.',
}

// Avisos de la verificación automática: ayudan, nunca bloquean.
export function avisosDeVerificacion(documento, titulo) {
  const v = documento?.verificacion
  const avisos = []
  if (!v || !documento.cargado) return avisos
  if (v.fecha === 'NO_COINCIDE') {
    avisos.push('No encontramos esa fecha en el documento. Revise que la fecha escrita sea la que aparece en él')
  }
  if (v.tipo === 'NO_COINCIDE') {
    avisos.push(`Este archivo no parece ser ${titulo}. Revise que subió el documento correcto`)
  }
  return avisos
}

// Texto del requisito de fecha en palabras, según min y max_sugerido de la configuración.
export function requisitoEnPalabras(definicion) {
  if (!definicion.etiqueta_fecha) return null
  if (definicion.clave === 'colegiado_activo') {
    return 'Indique la fecha hasta la cual su colegiatura está activa. Si esa vigencia no cubre todo el período del trámite, el documento generará una observación.'
  }
  const minimo = definicion.fecha_min ? fechaEnPalabras(definicion.fecha_min) : null
  const maximo = definicion.fecha_max_sugerida ? fechaEnPalabras(definicion.fecha_max_sugerida) : null
  if (minimo && maximo) {
    return `Se espera una fecha «${definicion.etiqueta_fecha.toLowerCase()}» entre el ${minimo} y el ${maximo}.`
  }
  if (minimo) {
    return `Se espera una fecha «${definicion.etiqueta_fecha.toLowerCase()}» del ${minimo} en adelante, sin fechas futuras.`
  }
  return null
}

function validarFecha(fecha, definicion) {
  if (!definicion.etiqueta_fecha) return null
  if (!fecha) return 'Indique primero la fecha del documento'
  if (!esFechaReal(fecha)) return 'La fecha indicada no es válida'
  if (definicion.clave !== 'colegiado_activo') {
    if (fecha > fechaISO()) return 'La fecha no puede ser futura'
    if (definicion.fecha_min && fecha < definicion.fecha_min) {
      return `La fecha no puede ser anterior al ${fechaEnPalabras(definicion.fecha_min)}`
    }
  }
  return null
}

const ESTILOS_REVISION = {
  ACEPTADO: 'bg-igss-100 text-igss-800 border-igss-300',
  RECHAZADO: 'bg-red-100 text-igss-red-dark border-igss-red/40',
  PENDIENTE: 'bg-gray-100 text-gray-600 border-gray-300',
}

export default function TarjetaDocumento({ definicion, documento, maxPaginas = 15 }) {
  const [fecha, setFecha] = useState(documento.fecha_documento || '')
  const [error, setError] = useState(null)
  const [vistaUrl, setVistaUrl] = useState(null)
  const [vistaPdf, setVistaPdf] = useState(false)
  const [cargandoVista, setCargandoVista] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const entradaArchivo = useRef(null)

  useEffect(() => {
    setFecha(documento.fecha_documento || '')
  }, [documento.cargado_at, documento.fecha_documento])

  // Miniatura. Un archivo encolado en esta sesión se muestra desde el dispositivo (cifrado en la
  // bóveda); uno ya enviado se pide al servidor con el token. Un documento que no se subió en
  // esta sesión (oculto) no tiene miniatura: el servidor la niega por seguridad.
  useEffect(() => {
    let vivo = true
    let urlCreada = null
    setVistaUrl(null)
    setVistaPdf(false)
    if (!documento.cargado || documento.oculto) {
      setCargandoVista(false)
      return undefined
    }
    setCargandoVista(true)
    const alTerminar = () => {
      if (vivo) setCargandoVista(false)
    }
    if (documento.pendiente) {
      servicio
        .vistaLocal(documento.clave)
        .then((local) => {
          if (!vivo || !local) return
          if (local.tipo === 'jpg') {
            urlCreada = URL.createObjectURL(local.blob)
            setVistaUrl(urlCreada)
          } else {
            setVistaPdf(true)
          }
        })
        .catch(() => {})
        .finally(alTerminar)
    } else {
      obtenerVistaDocumento(documento.clave, 1)
        .then((blob) => {
          if (!vivo) return
          urlCreada = URL.createObjectURL(blob)
          setVistaUrl(urlCreada)
        })
        .catch(() => {
          if (vivo) setVistaUrl(null)
        })
        .finally(alTerminar)
    }
    return () => {
      vivo = false
      if (urlCreada) URL.revokeObjectURL(urlCreada)
    }
  }, [documento.clave, documento.cargado, documento.oculto, documento.pendiente, documento.cargado_at])

  const tipos = tiposPermitidos(definicion)
  const aceptacion = aceptacionParaTipos(tipos)
  const requisito = requisitoEnPalabras(definicion)
  const maxMb = definicion.max_mb || 8
  const revision = documento.revision?.estado
  const rechazado = revision === 'RECHAZADO'

  const abrirSelector = () => entradaArchivo.current?.click()

  const subir = async (archivo) => {
    const errorFecha = validarFecha(fecha, definicion)
    if (errorFecha) {
      setError(errorFecha)
      return
    }
    setError(null)
    setProcesando(true)
    const preparado = await prepararArchivo(archivo, definicion)
    setProcesando(false)
    if (preparado.error) {
      setError(preparado.error)
      return
    }
    // Se cifra y se guarda en el dispositivo; el envío al servidor sigue solo.
    const resultado = await servicio.subirDocumento(
      definicion.clave,
      preparado.archivo,
      definicion.etiqueta_fecha ? fecha : null
    )
    if (!resultado.ok) setError(MENSAJES_DE_FALLO[resultado.motivo] || 'No se pudo guardar el archivo.')
  }

  const cambiarFecha = async (nuevaFecha) => {
    setFecha(nuevaFecha)
    // Un documento oculto no admite corregir solo la fecha: hay que subirlo de nuevo.
    if (!documento.cargado || documento.oculto || !nuevaFecha) return
    const errorFecha = validarFecha(nuevaFecha, definicion)
    if (errorFecha) {
      setError(errorFecha)
      return
    }
    setError(null)
    const resultado = await servicio.corregirFecha(definicion.clave, nuevaFecha)
    if (!resultado.ok) setError(MENSAJES_DE_FALLO[resultado.motivo] || 'No se pudo actualizar la fecha.')
  }

  const quitar = async () => {
    if (!window.confirm(`¿Quitar el documento «${definicion.titulo}»?`)) return
    setError(null)
    const resultado = await servicio.quitarDocumento(definicion.clave)
    if (!resultado.ok) setError(MENSAJES_DE_FALLO[resultado.motivo] || 'No se pudo quitar el documento.')
  }

  const clasesTarjeta = `rounded-2xl border-2 p-4 sm:p-5 transition-colors ${
    rechazado
      ? 'border-igss-red/50 bg-red-50/30'
      : documento.fallo
        ? 'border-igss-red/40 bg-white'
        : documento.cargado
          ? 'border-igss-600/30 bg-white'
          : 'border-gray-200 bg-white'
  }`

  const avisosVerificacion = documento.pendiente ? [] : avisosDeVerificacion(documento, definicion.titulo)
  const verificando = documento.cargado && !documento.pendiente && documento.verificacion?.estado === 'EN_PROCESO'
  // La fecha se escribe para subir un archivo nuevo, o se corrige si el documento es visible.
  const mostrarFecha = Boolean(definicion.etiqueta_fecha)

  return (
    <div className={clasesTarjeta}>
      <input
        ref={entradaArchivo}
        type="file"
        accept={aceptacion}
        className="sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) subir(archivo)
        }}
      />

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-igss-900 leading-snug">
            {definicion.titulo}
            <span className="text-igss-red"> *</span>
          </h3>
          {definicion.ayuda && (
            <p className="text-xs text-gray-500 mt-0.5">{definicion.ayuda}</p>
          )}
        </div>
        {documento.pendiente ? (
          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-300">
            Pendiente de enviar
          </span>
        ) : (
          documento.cargado &&
          revision && (
            <span
              className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${ESTILOS_REVISION[revision] || ESTILOS_REVISION.PENDIENTE}`}
            >
              {ETIQUETAS_REVISION[revision] || revision}
            </span>
          )
        )}
      </div>

      {/* Requisito de fecha en palabras */}
      {requisito && (
        <p className="text-xs text-igss-700 bg-igss-50 rounded-lg px-3 py-2 mb-3">{requisito}</p>
      )}

      {/* Fecha del documento */}
      {mostrarFecha && (
        <div className="mb-3">
          <label
            htmlFor={`doc-${definicion.clave}-fecha`}
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            {documento.oculto ? `${definicion.etiqueta_fecha} del documento nuevo` : definicion.etiqueta_fecha}
            <span className="text-igss-red"> *</span>
          </label>
          {documento.oculto && (
            <p className="text-xs text-gray-500 mb-1">
              Por seguridad la fecha del documento guardado no se muestra. Para cambiarlo, escriba la
              fecha del documento nuevo y use «Reemplazar».
            </p>
          )}
          <input
            id={`doc-${definicion.clave}-fecha`}
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            min={definicion.clave === 'colegiado_activo' ? undefined : definicion.fecha_min || undefined}
            max={definicion.clave === 'colegiado_activo' ? undefined : fechaISO()}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `doc-${definicion.clave}-error` : undefined}
            className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm shadow-sm focus:outline-none focus:ring-4 transition-colors ${
              error
                ? 'border-igss-red/50 bg-red-50/50'
                : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600'
            }`}
          />
        </div>
      )}

      {/* Motivo de rechazo */}
      {rechazado && documento.revision?.motivo && (
        <div className="mb-3">
          <Aviso tipo="error" titulo="Motivo del rechazo">
            {documento.revision.motivo}
          </Aviso>
        </div>
      )}

      {/* El envío de este archivo falló y el servidor dio su razón */}
      {documento.fallo && (
        <div className="mb-3">
          <Aviso tipo="error" titulo="No se pudo enviar este archivo">
            {documento.fallo.mensaje} Elija el archivo correcto para volver a intentarlo.
          </Aviso>
        </div>
      )}

      {/* Alertas en ámbar */}
      {documento.cargado && (documento.alertas || []).length > 0 && (
        <div className="mb-3 space-y-2">
          {documento.alertas.map((alerta) => (
            <Aviso key={alerta} tipo="alerta">
              {TEXTOS_ALERTAS[alerta] || alerta}
            </Aviso>
          ))}
        </div>
      )}

      {/* Verificación automática: orienta, nunca bloquea */}
      {avisosVerificacion.length > 0 && (
        <div className="mb-3 space-y-2">
          {avisosVerificacion.map((texto) => (
            <Aviso key={texto} tipo="alerta">
              {texto}
            </Aviso>
          ))}
        </div>
      )}
      {verificando && <p className="mb-3 text-xs text-gray-500">Verificando el documento…</p>}

      {/* Miniatura o resumen de un documento guardado en una sesión anterior */}
      {documento.cargado && (
        <div className="mb-3 flex items-start gap-3">
          <div className="w-28 h-36 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
            {cargandoVista ? (
              <div className="w-6 h-6 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
            ) : vistaUrl ? (
              <img
                src={vistaUrl}
                alt={`Vista previa de ${definicion.titulo}`}
                className="w-full h-full object-contain"
              />
            ) : documento.oculto ? (
              <span className="text-[10px] text-igss-700 text-center px-2 font-semibold">
                Guardado ✓<br />
                <span className="font-normal text-gray-400">sin vista previa por seguridad</span>
              </span>
            ) : vistaPdf ? (
              <span className="text-[10px] text-gray-500 text-center px-2">
                <span className="block text-lg font-extrabold text-igss-700">PDF</span>
                {documento.nombreLocal}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 text-center px-1">Sin vista previa</span>
            )}
          </div>
          <div className="text-xs text-gray-500 space-y-0.5 min-w-0">
            {documento.oculto && documento.cargado_at && (
              <p className="font-semibold text-igss-700">Cargado el {formatoDia(documento.cargado_at)} ✓</p>
            )}
            {documento.pendiente && (
              <p className="text-amber-700">Pendiente de enviar: está guardado, cifrado, en este dispositivo.</p>
            )}
            {documento.tipo && <p className="capitalize">Tipo: {documento.tipo}</p>}
            {documento.paginas > 0 && <p>Páginas: {documento.paginas}</p>}
            {documento.tamano > 0 && <p>Tamaño: {formatoTamano(documento.tamano)}</p>}
            {documento.cargado_at && !documento.oculto && (
              <p>Subido: {formatoInstante(documento.cargado_at)}</p>
            )}
          </div>
        </div>
      )}

      {/* Preparando el archivo (reescalado de imágenes) */}
      {procesando && (
        <div className="mb-3" role="status" aria-live="polite">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-igss-600 w-full" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Preparando el archivo…</p>
        </div>
      )}

      {/* Zona de carga / botones */}
      {!documento.cargado && !procesando && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('border-igss-500', 'bg-igss-50')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-igss-500', 'bg-igss-50')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-igss-500', 'bg-igss-50')
            const archivo = e.dataTransfer.files?.[0]
            if (archivo) subir(archivo)
          }}
          className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 px-4 py-6 text-center"
        >
          <svg className="w-8 h-8 mx-auto text-igss-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-gray-500 mt-2">
            Arrastre el archivo aquí o
          </p>
          <button
            type="button"
            onClick={abrirSelector}
            className="mt-2 py-2 px-5 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-xs transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
          >
            Elegir archivo
          </button>
          <p className="text-[10px] text-gray-400 mt-2">
            {tipos.join(' / ').toUpperCase()} · hasta {maxMb} MB · máximo {maxPaginas} páginas
          </p>
        </div>
      )}

      {documento.cargado && !procesando && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirSelector}
            className="py-2 px-4 rounded-xl border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
          >
            Reemplazar
          </button>
          {!documento.oculto && (
            <button
              type="button"
              onClick={quitar}
              className="py-2 px-4 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-igss-red/50 hover:text-igss-red font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/10"
            >
              Quitar
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          id={`doc-${definicion.clave}-error`}
          aria-live="polite"
          className="mt-2 text-xs text-igss-red font-medium"
        >
          {error}
        </p>
      )}
    </div>
  )
}
