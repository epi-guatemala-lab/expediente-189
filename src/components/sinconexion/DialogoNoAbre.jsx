import Aviso from '../ui/Aviso.jsx'

// Hay una bóveda en este dispositivo que la llave recibida no abre (de otra persona o dañada).
// Nunca se borra sola: la persona decide.
export default function DialogoNoAbre({ alDescartar, alSalir }) {
  return (
    <div className="max-w-md mx-auto space-y-4 page-enter">
      <Aviso tipo="alerta" titulo="Hay datos guardados en este dispositivo que no se pudieron abrir">
        <p>
          Puede que pertenezcan a otra persona o que estén dañados. No se borró nada. Si ya no los
          necesita, puede descartarlos y continuar; de lo contrario, salga y consulte a Recepción.
        </p>
      </Aviso>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                '¿Descartar los datos guardados en este dispositivo que no se pudieron abrir? Esta acción no se puede deshacer.'
              )
            ) {
              alDescartar()
            }
          }}
          className="py-2.5 px-6 rounded-xl border-2 border-igss-red/50 text-igss-red-dark font-bold text-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-4 focus:ring-igss-red/20"
        >
          Descartar lo guardado en este dispositivo
        </button>
        <button
          type="button"
          onClick={alSalir}
          className="py-2.5 px-6 rounded-xl bg-igss-700 hover:bg-igss-800 text-white font-bold text-sm transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-igss-600/20"
        >
          Salir sin borrar
        </button>
      </div>
    </div>
  )
}
