// Marcador del panel de Recepción: la tanda 2 reemplaza este componente.
export default function PanelPlaceholder() {
  return (
    <div className="max-w-md mx-auto page-enter">
      <div className="glass-card rounded-2xl shadow-igss p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-igss-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h2 className="text-lg font-extrabold text-igss-900 mt-4">Panel de Recepción</h2>
        <p className="text-sm text-gray-500 mt-2">
          Esta sección estará disponible próximamente. El personal de Recepción accederá aquí para
          revisar los expedientes del trámite.
        </p>
      </div>
    </div>
  )
}
