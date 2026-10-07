import CampoTexto from '../../fields/CampoTexto.jsx'
import CampoFecha from '../../fields/CampoFecha.jsx'
import CampoSelect from '../../fields/CampoSelect.jsx'
import { ESTADOS_CIVILES, calcularEdad, esFechaReal, fechaISO, formatoCUI } from '../../../lib/validaciones.js'

export default function PasoPersonales({ datos, errores, fijarCampo, expediente, config }) {
  const hoy = fechaISO()
  const edad = esFechaReal(datos.fecha_nacimiento) ? calcularEdad(datos.fecha_nacimiento) : null
  const estadosCiviles =
    Array.isArray(config?.catalogos?.estado_civil) && config.catalogos.estado_civil.length
      ? config.catalogos.estado_civil
      : ESTADOS_CIVILES

  return (
    <section aria-labelledby="titulo-paso-1">
      <h2 id="titulo-paso-1" className="text-lg font-extrabold text-igss-900 mb-1">
        Datos personales
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Escriba sus nombres tal como aparecen en su documento de identificación.
      </p>

      <div className="space-y-5">
        <CampoTexto
          id="nombres"
          etiqueta="Nombres"
          valor={datos.nombres}
          onChange={(v) => fijarCampo('nombres', v)}
          error={errores.nombres}
          obligatorio
          mayusculas
          maxLength={60}
          autoComplete="given-name"
        />

        <CampoTexto
          id="apellidos"
          etiqueta="Apellidos"
          valor={datos.apellidos}
          onChange={(v) => fijarCampo('apellidos', v)}
          error={errores.apellidos}
          obligatorio
          mayusculas
          maxLength={60}
          autoComplete="family-name"
        />

        <CampoTexto
          id="apellido_casada"
          etiqueta="Apellido de casada"
          valor={datos.apellido_casada}
          onChange={(v) => fijarCampo('apellido_casada', v)}
          error={errores.apellido_casada}
          ayuda="Solo si corresponde; de lo contrario déjelo en blanco."
          mayusculas
          maxLength={60}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CampoFecha
            id="fecha_nacimiento"
            etiqueta="Fecha de nacimiento"
            valor={datos.fecha_nacimiento}
            onChange={(v) => fijarCampo('fecha_nacimiento', v)}
            error={errores.fecha_nacimiento}
            obligatorio
            max={hoy}
            hijo={
              edad !== null && !errores.fecha_nacimiento ? (
                <p className="mt-1.5 text-xs font-semibold text-igss-700">
                  Edad: {edad} {edad === 1 ? 'año' : 'años'}
                </p>
              ) : null
            }
          />

          <CampoSelect
            id="estado_civil"
            etiqueta="Estado civil"
            valor={datos.estado_civil}
            onChange={(v) => fijarCampo('estado_civil', v)}
            opciones={estadosCiviles}
            error={errores.estado_civil}
            obligatorio
          />
        </div>

        <CampoTexto
          id="nacionalidad"
          etiqueta="Nacionalidad"
          valor={datos.nacionalidad}
          onChange={(v) => fijarCampo('nacionalidad', v)}
          error={errores.nacionalidad}
          obligatorio
          mayusculas
          maxLength={40}
        />

        <CampoTexto
          id="cui"
          etiqueta="CUI (DPI)"
          valor={formatoCUI(expediente.cui)}
          onChange={() => {}}
          soloLectura
          ayuda={`Dato de la nómina: ${expediente.nombre_nomina}. No es modificable.`}
        />
      </div>
    </section>
  )
}
