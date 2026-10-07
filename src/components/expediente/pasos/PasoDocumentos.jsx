import TarjetaDocumento from '../TarjetaDocumento.jsx'

const DOCUMENTO_VACIO = {
  clave: '',
  cargado: false,
  tipo: null,
  paginas: 0,
  tamano: 0,
  fecha_documento: null,
  alertas: [],
  revision: { estado: 'PENDIENTE', motivo: null },
  cargado_at: null,
  requerido: true,
}

// Paso 4: una tarjeta por documento de la configuración
// (la constancia de colegiado solo si la persona declaró ser colegiada).
export default function PasoDocumentos({ datos, expediente, config, alRecargar }) {
  const definiciones = (config?.documentos || []).filter(
    (d) => d.obligatorio !== 'colegiado' || datos.es_colegiado === true
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
        antes de enviar; cada archivo nuevo vuelve a quedar pendiente de revisión.
      </p>

      <div className="space-y-4">
        {definiciones.map((definicion) => {
          const documento = porClave.get(definicion.clave) || { ...DOCUMENTO_VACIO, clave: definicion.clave }
          return (
            <TarjetaDocumento
              key={definicion.clave}
              definicion={definicion}
              documento={documento}
              maxPaginas={maxPaginas}
              alCambiar={alRecargar}
            />
          )
        })}
      </div>
    </section>
  )
}
