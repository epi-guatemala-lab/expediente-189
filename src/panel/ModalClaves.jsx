import Aviso from '../components/ui/Aviso.jsx'
import { formatoClave, formatoCUI } from '../lib/validaciones.js'
import Modal from './Modal.jsx'
import { BotonCopiar } from './CampoCopia.jsx'
import { armarCSV, descargarBlob, enlaceFormulario } from './utiles.js'

// Modal «Claves de acceso — solo se muestran esta vez» (CONTRATO §5): la
// clave solo se devuelve al crear la persona o al regenerarla. Vive únicamente
// en memoria del componente y exige confirmar («Ya guardé las claves») para
// cerrarse; no se cierra con Esc ni con clic fuera.
export function mensajeDeClave(persona, enlace) {
  return (
    `Hola ${persona.nombre}. Para cargar sus datos y documentos del trámite 189 ` +
    `ingrese a ${enlace} con su DPI y esta clave: ${formatoClave(persona.clave)}. ` +
    `No la comparta.`
  )
}

export default function ModalClaves({ personas, alConfirmar }) {
  const enlace = enlaceFormulario()

  const descargar = () => {
    const filas = personas.map((p) => [
      p.nombre,
      formatoCUI(p.cui),
      formatoClave(p.clave),
      mensajeDeClave(p, enlace),
    ])
    const csv = armarCSV(['Nombre', 'CUI', 'Clave', 'Mensaje'], filas)
    descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'claves-expediente-189.csv')
  }

  return (
    <Modal titulo="Claves de acceso — solo se muestran esta vez" ancho="max-w-xl">
      <div className="px-5 py-4 space-y-4">
        <Aviso tipo="alerta" titulo="Guarde las claves ahora">
          Por seguridad, estas claves no se volverán a mostrar y no pueden recuperarse.
          Entregue cada clave a su persona; la necesitará junto con su DPI para ingresar al
          formulario.
        </Aviso>

        <ul className="space-y-3">
          {personas.map((p) => (
            <li key={p.cui} className="rounded-xl border-2 border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-igss-900 break-words">{p.nombre}</p>
                  <p className="text-xs text-gray-500 tabular-nums">CUI {formatoCUI(p.cui)}</p>
                </div>
                <p className="font-mono text-base font-extrabold tracking-widest text-igss-800 bg-igss-50 border border-igss-200 rounded-lg px-3 py-1.5">
                  {formatoClave(p.clave)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <BotonCopiar
                  texto={formatoClave(p.clave)}
                  etiqueta={`clave de ${p.nombre}`}
                  rotulo="Copiar clave"
                />
                <BotonCopiar
                  texto={mensajeDeClave(p, enlace)}
                  etiqueta={`mensaje para ${p.nombre}`}
                  rotulo="Copiar mensaje"
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={descargar}
            className="py-2 px-4 rounded-xl border-2 border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
          >
            Descargar lista (.csv)
          </button>
          <button
            type="button"
            onClick={alConfirmar}
            className="py-2 px-5 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
          >
            Ya guardé las claves
          </button>
        </div>
      </div>
    </Modal>
  )
}
