import { NOMBRE_TIPO, formatosDeclaracion, urlFormato } from '../../lib/formatos.js'

// Botones para descargar el formato de la declaración jurada que le toca a la
// persona (técnico o profesional según su contratación; ella elige masculino o
// femenino). Sin tipo en la nómina se ofrecen los cuatro, con la advertencia.
export default function DescargaFormato({ tipo, variantes = null, compacto = false }) {
  const formatos = formatosDeclaracion(tipo, variantes)
  const unico = formatos.length === 1
  return (
    <div className={compacto ? 'mt-1' : 'mb-3 rounded-xl border border-igss-200 bg-igss-50 px-3 py-2.5'}>
      {!compacto && (
        <p className="text-xs font-semibold text-igss-900">
          {unico
            ? `Su formato (${NOMBRE_TIPO[formatos[0].tipo]}, ${formatos[0].etiqueta.toLowerCase()}): descárguelo y llévelo a su notario.`
            : tipo
            ? `Su formato (${NOMBRE_TIPO[tipo]}): descárguelo y llévelo a su notario.`
            : 'Recepción todavía no indicó si su contratación es de servicios técnicos o profesionales: consúltelo antes de llevar el formato al notario.'}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-2">
        {formatos.map((f) => (
          <a
            key={f.variante}
            href={urlFormato(f.variante)}
            download
            className="inline-flex items-center gap-1 rounded-lg border-2 border-igss-300 bg-white px-3 py-1.5 text-xs font-bold text-igss-700 hover:border-igss-500 hover:bg-igss-50 focus:outline-none focus:ring-4 focus:ring-igss-600/15"
          >
            ⬇ {tipo ? '' : `${NOMBRE_TIPO[f.tipo]} — `}
            {f.etiqueta}
          </a>
        ))}
      </div>
      {!compacto && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          El notario solo llena los espacios marcados (XX, nombre, edad, profesión…). Si cambia
          cualquier otra palabra o una coma, Recepción no recibe el acta.
        </p>
      )}
    </div>
  )
}
