import Aviso from '../ui/Aviso.jsx'
import { ETIQUETAS_CAMPO } from '../../lib/formato.js'
import { servicio } from '../../sinconexion/instancia.js'

const plural = (n, uno, varios) => (n === 1 ? uno : varios)

const TITULOS_TIPO = {
  GUARDAR: 'Datos personales',
  ENVIAR: 'Envío del expediente',
}

function tituloDe(falla, config) {
  if (falla.anterior) return 'Un cambio de una sesión anterior'
  const documento = (config?.documentos || []).find((d) => d.clave === falla.clave)
  const nombre = documento?.titulo || falla.clave
  if (falla.tipo === 'SUBIR') return `Archivo de «${nombre}»`
  if (falla.tipo === 'FECHA') return `Fecha de «${nombre}»`
  if (falla.tipo === 'QUITAR') return `Quitar «${nombre}»`
  return TITULOS_TIPO[falla.tipo] || 'Cambio'
}

function Punto({ clase }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${clase}`} aria-hidden="true" />
}

// Indicador permanente de dónde está lo que la persona ha escrito.
export default function IndicadorEstado({ vista }) {
  const { indicador, pendientes, pendientesAnteriores, fallidas, ocupado, config } = vista

  let punto = 'bg-igss-600'
  let texto = 'Todo guardado en el servidor'
  let fondo = 'bg-igss-50 border-igss-300 text-igss-900'
  if (indicador === 'guardando') {
    punto = 'bg-blue-500 animate-pulse'
    fondo = 'bg-blue-50 border-blue-300 text-blue-900'
    texto =
      ocupado === 'SUBIR'
        ? 'Guardando… hay mucha demanda, su archivo se enviará en un momento'
        : ocupado
          ? 'Guardando… hay mucha demanda, sus cambios se enviarán en un momento'
          : 'Guardando…'
  } else if (indicador === 'dispositivo') {
    punto = 'bg-amber-500'
    fondo = 'bg-amber-50 border-amber-400 text-amber-900'
    texto = `${pendientes} ${plural(pendientes, 'cambio guardado', 'cambios guardados')} en este dispositivo; se ${plural(pendientes, 'enviará', 'enviarán')} al volver la conexión`
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-2 bg-white/90 backdrop-blur-sm border-b border-gray-100 space-y-2">
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold flex items-center gap-2 ${fondo}`}
      >
        <Punto clase={punto} />
        <span>{texto}</span>
      </div>

      {pendientesAnteriores > 0 && (
        <p className="text-xs text-gray-600 px-1">
          {pendientesAnteriores}{' '}
          {plural(pendientesAnteriores, 'cambio pendiente de una sesión anterior se está enviando', 'cambios pendientes de una sesión anterior se están enviando')}
        </p>
      )}

      {vista.sinServidor && (
        <Aviso tipo="alerta">
          No hay conexión con el servidor. Está trabajando con la última copia guardada en este
          dispositivo; todo lo que haga se enviará cuando vuelva la conexión.
        </Aviso>
      )}

      {vista.avisoAlmacenamiento && (
        <Aviso tipo="alerta">
          Este navegador no permite guardar sin conexión; sus cambios se guardan solo si hay
          conexión.
          <button
            type="button"
            onClick={() => servicio.descartarAviso('almacenamiento')}
            className="ml-2 text-xs font-bold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-600/30 rounded"
          >
            Entendido
          </button>
        </Aviso>
      )}

      {fallidas.length > 0 && (
        <div className="rounded-xl border-2 border-igss-red/40 bg-red-50 px-3 py-3">
          <p className="text-sm font-bold text-igss-red-dark flex items-center gap-2">
            <Punto clase="bg-igss-red" />
            {fallidas.length} {plural(fallidas.length, 'cambio no se pudo enviar', 'cambios no se pudieron enviar')}
          </p>
          <ul className="mt-2 space-y-3">
            {fallidas.map((falla) => (
              <li key={falla.id} className="text-xs text-red-900">
                <p className="font-semibold">{tituloDe(falla, config)}</p>
                <p>{falla.mensaje}</p>
                {falla.errores && Object.keys(falla.errores).length > 0 && (
                  <ul className="list-disc list-inside mt-0.5">
                    {Object.entries(falla.errores).map(([campo, mensaje]) => (
                      <li key={campo}>
                        {ETIQUETAS_CAMPO[campo] || campo}: {String(mensaje)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => servicio.reintentar(falla.id)}
                    className="py-1 px-3 rounded-lg border-2 border-igss-red/40 text-igss-red-dark font-bold hover:bg-white focus:outline-none focus:ring-2 focus:ring-igss-red/30"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Descartar este cambio? No se enviará y se perderá lo que había escrito.')) {
                        servicio.descartar(falla.id)
                      }
                    }}
                    className="py-1 px-3 rounded-lg border-2 border-gray-300 text-gray-600 font-bold hover:bg-white focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                  >
                    Descartar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
