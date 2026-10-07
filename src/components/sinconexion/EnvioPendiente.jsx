import Aviso from '../ui/Aviso.jsx'

// El expediente ya se pidió enviar: queda guardado, cifrado, en este dispositivo y sale en
// cuanto se pueda. Mientras tanto no se puede seguir editando.
export default function EnvioPendiente({ vista, alSalir }) {
  const enviando = vista.indicador === 'guardando' && !vista.ocupado
  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="glass-card rounded-2xl shadow-igss p-6 sm:p-8 text-center">
        {enviando ? (
          <>
            <div className="inline-block w-10 h-10 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" role="status" />
            <h2 className="text-xl font-extrabold text-igss-900 mt-4">Enviando su expediente…</h2>
          </>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-igss-900">Su expediente está listo para enviarse</h2>
            <p className="text-sm text-gray-700 mt-3 max-w-md mx-auto">
              {vista.ocupado
                ? 'Hay mucha demanda en este momento; su expediente se enviará en un momento.'
                : 'Su expediente se enviará en cuanto haya conexión. No borre los datos del navegador ni use modo incógnito.'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Puede dejar esta pestaña abierta: se enviará solo. También puede cerrarla; al volver a
              entrar con conexión se enviará lo guardado.
            </p>
          </>
        )}
      </div>
      {vista.fallidas.length === 0 && !enviando && (
        <div className="mt-4">
          <Aviso tipo="info">
            Lo guardado en este dispositivo está cifrado y se borra en cuanto el envío se confirma.
          </Aviso>
        </div>
      )}
      <div className="text-center mt-4">
        <button
          type="button"
          onClick={alSalir}
          className="text-xs font-semibold text-igss-600 hover:text-igss-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-igss-600/30 rounded"
        >
          Salir (lo pendiente se conserva cifrado en este dispositivo)
        </button>
      </div>
    </div>
  )
}
