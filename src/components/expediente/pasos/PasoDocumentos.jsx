import TarjetaDocumento from '../TarjetaDocumento.jsx'
import { documentoVacio, pideColegiado } from '../../../sinconexion/optimista.js'

// Paso 4: una tarjeta por documento de la configuración
// (la constancia de colegiado solo si la persona declaró ser colegiada).
// `faltantes`: claves requeridas que faltan, para marcarlas al intentar avanzar.
export default function PasoDocumentos({ datos, expediente, config, faltantes = [] }) {
  const definiciones = (config?.documentos || []).filter(
    (d) => d.obligatorio !== 'colegiado' || pideColegiado(expediente, datos)
  )
  const porClave = new Map((expediente.documentos || []).map((d) => [d.clave, d]))
  const maxPaginas = config?.limites?.max_paginas || 15

  return (
    <section aria-labelledby="titulo-paso-4">
      <h2 id="titulo-paso-4" className="text-lg font-extrabold text-igss-900 mb-1">
        Documentos
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Suba un archivo por cada documento solicitado. Puede reemplazarlos cuantas veces necesite
        antes de enviar; cada archivo nuevo vuelve a quedar pendiente de revisión. Si no hay
        conexión, el archivo queda guardado cifrado en este dispositivo y se envía al volver.
      </p>
      {config?.observacion_general && (
        <p className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 -mt-3 mb-6">
          {config.observacion_general}
        </p>
      )}

      <div className="space-y-4">
        {definiciones.map((definicion) => {
          const documento = porClave.get(definicion.clave) || documentoVacio(definicion.clave)
          return (
            <TarjetaDocumento
              key={definicion.clave}
              definicion={definicion}
              documento={documento}
              documentos={definiciones}
              maxPaginas={maxPaginas}
              faltaDoc={faltantes.includes(definicion.clave)}
              tipoDeclaracion={expediente.tipo_declaracion}
              formatosDeclaracion={expediente.formatos_declaracion}
            />
          )
        })}
      </div>
    </section>
  )
}
