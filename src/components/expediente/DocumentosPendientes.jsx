import { useState } from 'react'
import { requisitoEnPalabras } from './TarjetaDocumento.jsx'

// Lista de documentos en la primera página: qué falta y con qué fecha debe venir,
// para que la persona empiece a tramitarlos antes de llenar todo el formulario.
// La constancia de colegiado solo se lista si declaró ser colegiada (o aún no lo dice).
export default function DocumentosPendientes({ datos, expediente, config, irADocumentos }) {
  const definiciones = (config?.documentos || []).filter(
    (d) => d.obligatorio !== 'colegiado' || datos.es_colegiado !== false
  )
  const porClave = new Map((expediente.documentos || []).map((d) => [d.clave, d]))

  const filas = definiciones.map((definicion) => {
    const documento = porClave.get(definicion.clave)
    let estado = 'pendiente'
    if (documento?.cargado) {
      estado = documento.revision?.estado === 'RECHAZADO' ? 'rechazado' : 'subido'
    }
    return { definicion, estado }
  })
  const faltan = filas.filter((f) => f.estado !== 'subido').length
  const [abierta, setAbierta] = useState(faltan > 0)

  return (
    <section
      aria-labelledby="titulo-docs-pendientes"
      className="mb-6 rounded-2xl border border-igss-200 bg-igss-50/60 p-4 sm:p-5"
    >
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="w-full flex items-start justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
      >
        <span className="min-w-0">
          <span id="titulo-docs-pendientes" className="block text-sm font-extrabold text-igss-900">
            {faltan === 0
              ? 'Ya subió todos los documentos'
              : faltan === 1
                ? 'Le falta 1 documento'
                : `Le faltan ${faltan} documentos`}
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Puede empezar a tramitarlos desde ya, antes de llenar el resto del formulario.
          </span>
        </span>
        <span className="text-xs font-semibold text-igss-700 flex-shrink-0 mt-0.5">
          {abierta ? 'Ocultar' : 'Ver lista'}
        </span>
      </button>

      {abierta && (
        <>
          <ul className="mt-4 space-y-3">
            {filas.map(({ definicion, estado }) => {
              const requisito = requisitoEnPalabras(definicion)
              return (
                <li key={definicion.clave} className="flex items-start gap-3">
                  <Marca estado={estado} />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-gray-800 break-words">
                      {definicion.titulo}
                      {definicion.obligatorio === 'colegiado' && datos.es_colegiado !== true && (
                        <span className="font-normal text-gray-500"> (solo si es colegiado)</span>
                      )}
                    </p>
                    {estado === 'rechazado' && (
                      <p className="text-xs font-semibold text-igss-red">
                        Recepción lo rechazó: súbalo de nuevo.
                      </p>
                    )}
                    {estado !== 'subido' && (
                      <p className="text-xs text-gray-500 break-words">
                        {definicion.ayuda}
                        {requisito ? ` ${requisito}` : ''}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {faltan > 0 && (
            <button
              type="button"
              onClick={irADocumentos}
              className="mt-4 text-xs font-bold text-igss-700 hover:text-igss-900 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
            >
              Ya tengo alguno: ir a subir documentos
            </button>
          )}
        </>
      )}
    </section>
  )
}

function Marca({ estado }) {
  if (estado === 'subido') {
    return (
      <span
        aria-label="Subido"
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center"
      >
        ✓
      </span>
    )
  }
  return (
    <span
      aria-label={estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
        estado === 'rechazado' ? 'border-igss-red' : 'border-amber-400'
      }`}
    />
  )
}
