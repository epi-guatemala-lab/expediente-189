import { useEffect, useRef, useState } from 'react'
import Aviso from '../ui/Aviso.jsx'
import {
  ETIQUETAS_REVISION,
  TEXTOS_ALERTAS,
  formatoTamano,
} from '../../lib/formato.js'
import { esFechaReal, fechaEnPalabras, fechaISO } from '../../lib/validaciones.js'
import { aceptacionParaTipos, prepararArchivo, tiposPermitidos } from '../../lib/archivos.js'
import {
  corregirFechaDocumento,
  obtenerVistaDocumento,
  quitarDocumento,
  subirDocumento,
} from '../../api/cliente.js'

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

export default function TarjetaDocumento({ definicion, documento, maxPaginas = 15, alCambiar }) {
  const [fecha, setFecha] = useState(documento.fecha_documento || '')
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [vistaUrl, setVistaUrl] = useState(null)
  const [cargandoVista, setCargandoVista] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const entradaArchivo = useRef(null)

  useEffect(() => {
    setFecha(documento.fecha_documento || '')
  }, [documento.cargado_at, documento.fecha_documento])

  // Miniatura: se pide con el token y se muestra como blob:, nunca como HTML.
  useEffect(() => {
    let vivo = true
    let urlCreada = null
    if (documento.cargado) {
      setCargandoVista(true)
      obtenerVistaDocumento(documento.clave, 1)
        .then((blob) => {
          if (!vivo) return
          urlCreada = URL.createObjectURL(blob)
          setVistaUrl(urlCreada)
        })
        .catch(() => {
          if (vivo) setVistaUrl(null)
        })
        .finally(() => {
          if (vivo) setCargandoVista(false)
        })
    } else {
      setVistaUrl(null)
    }
    return () => {
      vivo = false
      if (urlCreada) URL.revokeObjectURL(urlCreada)
    }
  }, [documento.clave, documento.cargado, documento.cargado_at])

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
    setSubiendo(true)
    setProgreso(0)
    try {
      await subirDocumento(
        definicion.clave,
        preparado.archivo,
        definicion.etiqueta_fecha ? fecha : null,
        setProgreso
      )
      await alCambiar()
    } catch (e) {
      setError(e?.errores?.fecha_documento || e?.detail || 'No se pudo subir el archivo')
    } finally {
      setSubiendo(false)
      setProgreso(0)
    }
  }

  const cambiarFecha = async (nuevaFecha) => {
    setFecha(nuevaFecha)
    if (!documento.cargado || !nuevaFecha) return
    const errorFecha = validarFecha(nuevaFecha, definicion)
    if (errorFecha) {
      setError(errorFecha)
      return
    }
    setError(null)
    try {
      await corregirFechaDocumento(definicion.clave, nuevaFecha)
      await alCambiar()
    } catch (e) {
      setError(e?.detail || 'No se pudo actualizar la fecha')
    }
  }

  const quitar = async () => {
    if (!window.confirm(`¿Quitar el documento «${definicion.titulo}»?`)) return
    setError(null)
    try {
      await quitarDocumento(definicion.clave)
      await alCambiar()
    } catch (e) {
      setError(e?.detail || 'No se pudo quitar el documento')
    }
  }

  const clasesTarjeta = `rounded-2xl border-2 p-4 sm:p-5 transition-colors ${
    rechazado
      ? 'border-igss-red/50 bg-red-50/30'
      : documento.cargado
        ? 'border-igss-600/30 bg-white'
        : 'border-gray-200 bg-white'
  }`

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
        {documento.cargado && revision && (
          <span
            className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${ESTILOS_REVISION[revision] || ESTILOS_REVISION.PENDIENTE}`}
          >
            {ETIQUETAS_REVISION[revision] || revision}
          </span>
        )}
      </div>

      {/* Requisito de fecha en palabras */}
      {requisito && (
        <p className="text-xs text-igss-700 bg-igss-50 rounded-lg px-3 py-2 mb-3">{requisito}</p>
      )}

      {/* Fecha del documento */}
      {definicion.etiqueta_fecha && (
        <div className="mb-3">
          <label
            htmlFor={`doc-${definicion.clave}-fecha`}
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            {definicion.etiqueta_fecha}
            <span className="text-igss-red"> *</span>
          </label>
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

      {/* Miniatura */}
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
            ) : (
              <span className="text-[10px] text-gray-400 text-center px-1">
                Sin vista previa
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 space-y-0.5 min-w-0">
            {documento.tipo && <p className="capitalize">Tipo: {documento.tipo}</p>}
            {documento.paginas > 0 && <p>Páginas: {documento.paginas}</p>}
            {documento.tamano > 0 && <p>Tamaño: {formatoTamano(documento.tamano)}</p>}
            {documento.cargado_at && (
              <p>Subido: {new Date(documento.cargado_at).toLocaleString('es-GT')}</p>
            )}
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      {(subiendo || procesando) && (
        <div className="mb-3" role="status" aria-live="polite">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-igss-600 transition-all duration-300"
              style={{ width: `${procesando ? 100 : progreso}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {procesando ? 'Preparando el archivo…' : `Subiendo… ${progreso}%`}
          </p>
        </div>
      )}

      {/* Zona de carga / botones */}
      {!documento.cargado && !subiendo && !procesando && (
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

      {documento.cargado && !subiendo && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirSelector}
            className="py-2 px-4 rounded-xl border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
          >
            Reemplazar
          </button>
          <button
            type="button"
            onClick={quitar}
            className="py-2 px-4 rounded-xl border-2 border-gray-200 text-gray-500 hover:border-igss-red/50 hover:text-igss-red font-semibold text-xs transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/10"
          >
            Quitar
          </button>
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
