import { useState } from 'react'
import CampoTexto from '../../fields/CampoTexto.jsx'
import CampoSelect from '../../fields/CampoSelect.jsx'
import CampoBuscador from '../../fields/CampoBuscador.jsx'
import { departamentos, departamentoParaMostrar, municipiosDe } from '../../../config/geografia.js'
import { formatoTelefono, validarCorreo } from '../../../lib/validaciones.js'
import { ocultoSinEditar } from '../../../lib/pasos.js'

export default function PasoContacto({ datos, errores, fijarCampo, ocultos }) {
  const g = (campo) => ocultoSinEditar(campo, datos, ocultos)
  const [avisoCorreo, setAvisoCorreo] = useState(null)
  const municipios = datos.departamento ? municipiosDe(datos.departamento) : []

  const cambiarDepartamento = (valor) => {
    fijarCampo('departamento', valor)
    // Al cambiar de departamento el municipio anterior deja de pertenecer a él.
    fijarCampo('municipio', '')
  }

  const cambiarCorreo = (valor) => {
    fijarCampo('correo', valor)
    const revision = valor ? validarCorreo(valor) : null
    setAvisoCorreo(revision?.aviso || null)
  }

  return (
    <section aria-labelledby="titulo-paso-2">
      <h2 id="titulo-paso-2" className="text-lg font-extrabold text-igss-900 mb-1">
        Contacto y domicilio
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Información para que el Departamento pueda localizarlo durante el trámite.
      </p>

      <div className="space-y-5">
        <CampoTexto
          id="direccion"
          guardado={g('direccion')}
          etiqueta="Dirección de domicilio"
          valor={datos.direccion}
          onChange={(v) => fijarCampo('direccion', v)}
          error={errores.direccion}
          obligatorio
          maxLength={200}
          autoComplete="street-address"
          ayuda="Calle o avenida, número, zona y colonia, tal como está registrada en el banco."
          placeholder="Calle o avenida, número, zona, colonia"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CampoSelect
            id="departamento"
          guardado={g('departamento')}
            etiqueta="Departamento"
            valor={datos.departamento}
            onChange={cambiarDepartamento}
            opciones={departamentos.map((d) => ({ valor: d, nombre: departamentoParaMostrar(d) }))}
            error={errores.departamento}
            obligatorio
          />

          <CampoBuscador
            id="municipio"
          guardado={g('municipio')}
            etiqueta="Municipio"
            valor={datos.municipio}
            onChange={(v) => fijarCampo('municipio', v)}
            opciones={municipios}
            error={errores.municipio}
            obligatorio
            ayuda={datos.departamento ? undefined : 'Seleccione primero el departamento.'}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CampoTexto
            id="telefono"
          guardado={g('telefono')}
            etiqueta="Teléfono"
            valor={datos.telefono}
            onChange={(v) => fijarCampo('telefono', formatoTelefono(v))}
            error={errores.telefono}
            obligatorio
            placeholder="0000-0000"
            inputMode="tel"
            autoComplete="tel-national"
          />

          <CampoTexto
            id="correo"
          guardado={g('correo')}
            etiqueta="Correo electrónico"
            valor={datos.correo}
            onChange={cambiarCorreo}
            error={errores.correo}
            aviso={avisoCorreo}
            obligatorio
            tipo="email"
            maxLength={120}
            inputMode="email"
            autoComplete="email"
            placeholder="nombre@ejemplo.com"
          />
        </div>
      </div>
    </section>
  )
}
