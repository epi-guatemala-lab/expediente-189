import { useEffect, useRef, useState } from 'react'
import { copiarTexto } from './utiles.js'

// Botón de copiar con confirmación visual («Copiado» 1,5 s). Usa la API del
// portapapeles con respaldo execCommand.
export function BotonCopiar({ texto, etiqueta, rotulo = 'Copiar' }) {
  const [copiado, setCopiado] = useState(false)
  const [fallo, setFallo] = useState(false)
  const temporizador = useRef(null)

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    },
    []
  )

  const copiar = async () => {
    const ok = await copiarTexto(texto)
    setFallo(!ok)
    setCopiado(ok)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      setCopiado(false)
      setFallo(false)
    }, 1500)
  }

  const descripcion = etiqueta ? `Copiar ${etiqueta}` : 'Copiar'

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={copiado ? `Copiado: ${etiqueta || ''}`.trim() : descripcion}
      title={fallo ? 'No se pudo copiar' : descripcion}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/15 ${
        copiado
          ? 'text-igss-700 bg-igss-50 border-igss-200'
          : 'text-gray-500 bg-white border-gray-200 hover:text-igss-700 hover:border-igss-300 hover:bg-igss-50'
      }`}
    >
      {copiado ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-12h6a2 2 0 012 2v6m-8-8V3m0 2h8m-4 8h6a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6a2 2 0 012-2z"
          />
        </svg>
      )}
      <span aria-hidden="true">{copiado ? 'Copiado' : rotulo}</span>
    </button>
  )
}

// Fila «etiqueta — valor — botón Copiar». Un campo vacío muestra «—» y no
// tiene botón; `botones` permite variantes (DPI con espacios o solo dígitos).
export default function CampoCopia({ etiqueta, valor, copia, botones }) {
  const vacio = valor === null || valor === undefined || valor === ''
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-100 last:border-b-0">
      <dt className="text-xs font-medium text-gray-500 flex-shrink-0 pt-1 max-w-[38%]">
        {etiqueta}
      </dt>
      <dd
        className={`flex-1 min-w-0 text-right text-sm break-words ${
          vacio ? 'text-gray-400 font-normal' : 'text-gray-900 font-semibold'
        }`}
      >
        {vacio ? '—' : valor}
      </dd>
      <div className="flex-shrink-0 flex items-center gap-1 pt-0.5">
        {!vacio &&
          (botones || <BotonCopiar texto={copia ?? valor} etiqueta={etiqueta} />)}
      </div>
    </div>
  )
}
