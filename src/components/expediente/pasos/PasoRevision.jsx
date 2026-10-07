import { useState } from 'react'
import Aviso from '../../ui/Aviso.jsx'
import { ETIQUETAS_REVISION } from '../../../lib/formato.js'
import { enviarExpediente } from '../../../api/cliente.js'

// A qué paso salta cada campo faltante y con qué nombre se muestra.
const MAPA_CAMPO_PASO = {
  nombres: 1,
  apellidos: 1,
  apellido_casada: 1,
  fecha_nacimiento: 1,
  estado_civil: 1,
  nacionalidad: 1,
  direccion: 2,
  departamento: 2,
  municipio: 2,
  telefono: 2,
  correo: 2,
  profesion: 3,
  es_colegiado: 3,
  colegio_profesional: 3,
  numero_colegiado: 3,
  nit: 3,
  area_contratada: 3,
  estudios: 3,
  actividades: 3,
}

const ETIQUETAS_CAMPO = {
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  apellido_casada: 'Apellido de casada',
  fecha_nacimiento: 'Fecha de nacimiento',
  estado_civil: 'Estado civil',
  nacionalidad: 'Nacionalidad',
  direccion: 'Dirección de domicilio',
  departamento: 'Departamento',
  municipio: 'Municipio',
  telefono: 'Teléfono',
  correo: 'Correo electrónico',
  profesion: 'Profesión',
  es_colegiado: 'Colegiatura',
  colegio_profesional: 'Colegio profesional',
  numero_colegiado: 'Número de colegiado',
  nit: 'NIT',
  area_contratada: 'Área contratada',
  estudios: 'Estudios',
  actividades: 'Actividades',
}

function infoFaltante(llave, config) {
  if (llave.startsWith('doc:')) {
    const clave = llave.slice(4)
    const definicion = (config?.documentos || []).find((d) => d.clave === clave)
    return { paso: 4, etiqueta: definicion?.titulo || clave }
  }
  return { paso: MAPA_CAMPO_PASO[llave] || 1, etiqueta: ETIQUETAS_CAMPO[llave] || llave }
}

function Fila({ etiqueta, children }) {
  return (
    <div className="py-1.5 border-b border-gray-100 last:border-b-0">
      <dt className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{etiqueta}</dt>
      <dd className="text-sm text-gray-800 mt-0.5 whitespace-pre-line">{children}</dd>
    </div>
  )
}

export default function PasoRevision({ datos, expediente, config, irA, alEnviado, alRecargar }) {
  const [declaracion, setDeclaracion] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroresEnvio, setErroresEnvio] = useState(null)
  const [errorGeneral, setErrorGeneral] = useState(null)

  const faltantes = expediente.faltantes || []
  const hayFaltantes = faltantes.length > 0

  const colegiado =
    datos.es_colegiado === true
      ? `Sí — ${datos.colegio_profesional || 'por completar'}${datos.numero_colegiado ? `, número ${datos.numero_colegiado}` : ''}`
      : datos.es_colegiado === false
        ? 'No'
        : 'Por completar'

  const documentos = (config?.documentos || []).filter(
    (d) => d.obligatorio !== 'colegiado' || datos.es_colegiado === true
  )
  const porClave = new Map((expediente.documentos || []).map((d) => [d.clave, d]))

  const enviar = async () => {
    if (enviando) return
    setErroresEnvio(null)
    setErrorGeneral(null)
    setEnviando(true)
    try {
      const actualizado = await enviarExpediente()
      alEnviado(actualizado)
    } catch (error) {
      if (error?.status === 422 && error.errores) {
        setErroresEnvio(Object.values(error.errores))
      } else {
        setErrorGeneral(error?.detail || 'No se pudo enviar el expediente.')
      }
      try {
        await alRecargar()
      } catch {
        // el oyente de sesión vencida se encarga de los 401
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-paso-5">
      <h2 id="titulo-paso-5" className="text-lg font-extrabold text-igss-900 mb-1">
        Revisión y envío
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Revise la información antes de enviar. Después del envío, Recepción revisará sus datos y
        documentos.
      </p>

      {errorGeneral && (
        <div className="mb-5">
          <Aviso tipo="error">{errorGeneral}</Aviso>
        </div>
      )}

      {erroresEnvio && erroresEnvio.length > 0 && (
        <div className="mb-5">
          <Aviso tipo="error" titulo="No se pudo enviar">
            <ul className="list-disc list-inside space-y-0.5">
              {erroresEnvio.map((mensaje, i) => (
                <li key={i}>{mensaje}</li>
              ))}
            </ul>
          </Aviso>
        </div>
      )}

      {/* Faltantes */}
      {hayFaltantes && (
        <div className="mb-6">
          <Aviso tipo="alerta" titulo="Falta completar antes de enviar">
            <ul className="space-y-1.5 mt-1">
              {faltantes.map((llave) => {
                const info = infoFaltante(llave, config)
                return (
                  <li key={llave} className="flex items-center justify-between gap-3">
                    <span>{info.etiqueta}</span>
                    <button
                      type="button"
                      onClick={() => irA(info.paso)}
                      className="text-xs font-bold text-igss-700 hover:text-igss-900 underline underline-offset-2 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
                    >
                      Completar en el paso {info.paso}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Aviso>
        </div>
      )}

      {/* Resumen */}
      <div className="rounded-xl border-2 border-gray-100 bg-white/70 p-4 sm:p-5 mb-6">
        <h3 className="text-sm font-bold text-igss-900 mb-3">Resumen de la información</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <Fila etiqueta="CUI">{expediente.cui}</Fila>
          <Fila etiqueta="Nombres">
            {[datos.nombres, datos.apellidos, datos.apellido_casada].filter(Boolean).join(' ') || '—'}
          </Fila>
          <Fila etiqueta="Fecha de nacimiento">{datos.fecha_nacimiento || '—'}</Fila>
          <Fila etiqueta="Estado civil">{datos.estado_civil || '—'}</Fila>
          <Fila etiqueta="Nacionalidad">{datos.nacionalidad || '—'}</Fila>
          <Fila etiqueta="Dirección">{datos.direccion || '—'}</Fila>
          <Fila etiqueta="Municipio">
            {[datos.municipio, datos.departamento].filter(Boolean).join(', ') || '—'}
          </Fila>
          <Fila etiqueta="Teléfono">{datos.telefono || '—'}</Fila>
          <Fila etiqueta="Correo electrónico">{datos.correo || '—'}</Fila>
          <Fila etiqueta="Profesión">{datos.profesion || '—'}</Fila>
          <Fila etiqueta="Colegiado">{colegiado}</Fila>
          <Fila etiqueta="NIT">{datos.nit || '—'}</Fila>
          <Fila etiqueta="Área contratada">{datos.area_contratada || '—'}</Fila>
        </dl>

        <div className="mt-4">
          <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
            Estudios
          </h4>
          <ul className="space-y-1.5">
            {datos.estudios
              .filter((e) => e.nivel || e.centro || e.titulo)
              .map((e, i) => (
                <li key={i} className="text-sm text-gray-800">
                  <span className="font-semibold">{e.nivel || '—'}</span>
                  {e.centro ? ` · ${e.centro}` : ''}
                  {e.titulo ? ` · ${e.titulo}` : ''}
                  {e.inicio && e.fin ? ` (${e.inicio} a ${e.fin})` : ''}
                </li>
              ))}
            {datos.estudios.every((e) => !e.nivel && !e.centro && !e.titulo) && (
              <li className="text-sm text-gray-400">Sin estudios registrados</li>
            )}
          </ul>
        </div>

        <div className="mt-4">
          <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
            Actividades
          </h4>
          <ul className="space-y-1.5">
            {datos.actividades.filter(Boolean).map((a, i) => (
              <li key={i} className="text-sm text-gray-800">
                {a}
              </li>
            ))}
            {datos.actividades.every((a) => !a) && (
              <li className="text-sm text-gray-400">Sin actividades registradas</li>
            )}
          </ul>
        </div>

        <div className="mt-4">
          <h4 className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
            Documentos
          </h4>
          <ul className="space-y-1.5">
            {documentos.map((definicion) => {
              const documento = porClave.get(definicion.clave)
              const cargado = documento?.cargado
              const revision = documento?.revision?.estado
              return (
                <li key={definicion.clave} className="text-sm flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      cargado ? (revision === 'RECHAZADO' ? 'bg-igss-red' : 'bg-igss-600') : 'bg-gray-300'
                    }`}
                  />
                  <span className={cargado ? 'text-gray-800' : 'text-gray-400'}>
                    {definicion.titulo}
                  </span>
                  {cargado ? (
                    <span className="text-xs text-gray-400">
                      ({ETIQUETAS_REVISION[revision] || revision || 'cargado'})
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">faltante</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Declaración */}
      <div className="rounded-xl border-2 border-igss-gold/40 bg-igss-gold-50 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={declaracion}
            onChange={(e) => setDeclaracion(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-igss-700 focus:ring-igss-600/30 flex-shrink-0"
          />
          <span className="text-sm text-igss-900 font-medium">
            Declaro que la información y los documentos son verídicos y autorizo su uso para el
            trámite de contratación
          </span>
        </label>

        <button
          type="button"
          onClick={enviar}
          disabled={!declaracion || hayFaltantes || enviando}
          className="mt-4 w-full py-3 px-4 rounded-xl bg-igss-700 hover:bg-igss-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
        >
          {enviando ? 'Enviando…' : 'Enviar expediente'}
        </button>
        {hayFaltantes && (
          <p className="text-xs text-amber-700 mt-2 text-center">
            Complete los pendientes indicados arriba para habilitar el envío.
          </p>
        )}
      </div>
    </section>
  )
}
