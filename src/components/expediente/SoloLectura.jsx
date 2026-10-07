import Aviso from '../ui/Aviso.jsx'
import { ETIQUETAS_ESTADO, ETIQUETAS_REVISION, formatoInstante } from '../../lib/formato.js'
import { formatoCUI } from '../../lib/validaciones.js'

// Pantalla para ENVIADO / APROBADO (y cualquier expediente no editable): solo muestra el
// estado, las fechas, la lista de documentos con su revisión y la observación si la hay.
// En ese estado el servidor devuelve `datos` reducido y niega las vistas previas, así que
// no se muestran datos personales ni miniaturas.
export default function SoloLectura({ expediente, config, alSalir }) {
  const aprobado = expediente.estado === 'APROBADO'
  const fechaEnvio = expediente.enviado_at ? formatoInstante(expediente.enviado_at) : null
  const fechaActualizacion = expediente.actualizado_at ? formatoInstante(expediente.actualizado_at) : null

  const porClave = new Map((expediente.documentos || []).map((d) => [d.clave, d]))
  // Sin `datos.es_colegiado` a la vista, la constancia de colegiado se muestra si el servidor
  // la marca como requerida o ya está cargada.
  const documentos = (config?.documentos || []).filter(
    (d) =>
      d.obligatorio !== 'colegiado' ||
      porClave.get(d.clave)?.requerido === true ||
      porClave.get(d.clave)?.cargado === true
  )
  const rechazados = (expediente.documentos || []).filter((d) => d.revision?.estado === 'RECHAZADO')

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="glass-card rounded-2xl shadow-igss p-6 sm:p-8 text-center">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold text-sm ${
            aprobado
              ? 'bg-igss-100 border-igss-300 text-igss-800'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={aprobado ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M5 13l4 4L19 7'}
            />
          </svg>
          {ETIQUETAS_ESTADO[expediente.estado] || expediente.estado}
        </div>

        <h2 className="text-xl font-extrabold text-igss-900 mt-4">
          {aprobado
            ? 'Su expediente fue aprobado'
            : 'Su expediente fue enviado'}
        </h2>
        <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
          {aprobado
            ? 'El Departamento de Medicina Preventiva aprobó la información de su expediente. Si necesita algún cambio, comuníquese con Recepción.'
            : 'Sus datos y documentos quedaron en revisión por Recepción. Si algo requiere corrección, el expediente volverá a estar disponible para que lo actualice y reenvíe.'}
        </p>

        {fechaEnvio && (
          <p className="text-sm text-gray-500 mt-3">
            Fecha de envío: <span className="font-semibold text-gray-700">{fechaEnvio}</span>
          </p>
        )}

        {fechaActualizacion && (
          <p className="text-xs text-gray-400 mt-1">Última actualización: {fechaActualizacion}</p>
        )}
        {(expediente.nombre_nomina || expediente.cui) && (
          <p className="text-xs text-gray-400 mt-1">
            {[expediente.nombre_nomina, expediente.cui ? `CUI ${formatoCUI(expediente.cui)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <button
          type="button"
          onClick={alSalir}
          className="mt-6 py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
        >
          Salir
        </button>
      </div>

      {expediente.observacion_general && (
        <div className="mt-4">
          <Aviso tipo="alerta" titulo="Observación de Recepción">
            {expediente.observacion_general}
          </Aviso>
        </div>
      )}

      {rechazados.length > 0 && (
        <div className="mt-4">
          <Aviso tipo="error" titulo="Documentos observados">
            <ul className="list-disc list-inside space-y-0.5">
              {rechazados.map((d) => {
                const definicion = (config?.documentos || []).find((x) => x.clave === d.clave)
                return (
                  <li key={d.clave}>
                    {definicion?.titulo || d.clave}
                    {d.revision?.motivo ? `: ${d.revision.motivo}` : ''}
                  </li>
                )
              })}
            </ul>
          </Aviso>
        </div>
      )}

      {/* Detalle de documentos (solo lectura) */}
      <div className="glass-card rounded-2xl shadow-igss p-6 mt-4">
        <h3 className="text-sm font-bold text-igss-900 mb-3">Estado de los documentos</h3>
        <ul className="space-y-2">
          {documentos.map((definicion) => {
            const documento = porClave.get(definicion.clave)
            const revision = documento?.revision?.estado
            return (
              <li key={definicion.clave} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">{definicion.titulo}</span>
                <span
                  className={`text-xs font-semibold flex-shrink-0 ${
                    revision === 'RECHAZADO'
                      ? 'text-igss-red'
                      : revision === 'ACEPTADO'
                        ? 'text-igss-700'
                        : documento?.cargado
                          ? 'text-gray-500'
                          : 'text-gray-400'
                  }`}
                >
                  {documento?.cargado ? ETIQUETAS_REVISION[revision] || revision || 'Cargado' : 'No cargado'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
