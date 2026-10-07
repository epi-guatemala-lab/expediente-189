import CampoTexto from '../../fields/CampoTexto.jsx'
import CampoSelect from '../../fields/CampoSelect.jsx'
import CampoAreaTexto from '../../fields/CampoAreaTexto.jsx'
import CampoBuscador from '../../fields/CampoBuscador.jsx'
import {
  MESES,
  NIVELES_ESTUDIO,
  esFechaReal,
  formatoNIT,
  soloDigitos,
} from '../../../lib/validaciones.js'
import { ocultoSinEditar } from '../../../lib/pasos.js'
import MarcaGuardado from '../../fields/MarcaGuardado.jsx'

// Primer año aceptable como inicio de estudios (nacimiento + 11, el inicio debe
// ser posterior a nacimiento + 10; sin fecha de nacimiento se abre el rango).
function anioInicial(fechaNacimiento) {
  if (esFechaReal(fechaNacimiento)) return Number(fechaNacimiento.slice(0, 4)) + 11
  return 1940
}

function aniosDisponibles(desde) {
  const actual = new Date().getFullYear()
  const anios = []
  for (let a = actual; a >= desde; a--) anios.push(String(a))
  return anios
}

function opcionesMeses() {
  return MESES.map((nombre, i) => ({ valor: String(i + 1).padStart(2, '0'), nombre }))
}

export default function PasoProfesion({ datos, errores, fijarCampo, config, ocultos }) {
  const g = (campo) => ocultoSinEditar(campo, datos, ocultos)
  const niveles =
    Array.isArray(config?.catalogos?.niveles_estudio) && config.catalogos.niveles_estudio.length
      ? config.catalogos.niveles_estudio
      : NIVELES_ESTUDIO
  const colegios = Array.isArray(config?.catalogos?.colegios) ? config.catalogos.colegios : []
  const desdeAnio = anioInicial(datos.fecha_nacimiento)
  const anios = aniosDisponibles(desdeAnio)
  const meses = opcionesMeses()
  const colegiado = datos.es_colegiado === true

  const fijarColegiado = (valor) => {
    fijarCampo('es_colegiado', valor)
    if (valor === false) {
      // Si no es colegiado, ambos campos se guardan en null (CONTRATO §3).
      fijarCampo('colegio_profesional', '')
      fijarCampo('numero_colegiado', '')
    }
  }

  const fijarEstudio = (indice, campo, valor) => {
    fijarCampo(
      'estudios',
      datos.estudios.map((e, i) => (i === indice ? { ...e, [campo]: valor } : e))
    )
  }

  const agregarEstudio = () => {
    if (datos.estudios.length < 3) {
      fijarCampo('estudios', [...datos.estudios, { nivel: '', centro: '', titulo: '', inicio: '', fin: '' }])
    }
  }

  const quitarEstudio = (indice) => {
    if (datos.estudios.length > 1) {
      fijarCampo('estudios', datos.estudios.filter((_, i) => i !== indice))
    }
  }

  const fijarActividad = (indice, valor) => {
    fijarCampo('actividades', datos.actividades.map((a, i) => (i === indice ? valor : a)))
  }

  const agregarActividad = () => {
    if (datos.actividades.length < 3) fijarCampo('actividades', [...datos.actividades, ''])
  }

  const quitarActividad = (indice) => {
    fijarCampo('actividades', datos.actividades.filter((_, i) => i !== indice))
  }

  return (
    <section aria-labelledby="titulo-paso-3">
      <h2 id="titulo-paso-3" className="text-lg font-extrabold text-igss-900 mb-1">
        Profesión y estudios
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Información profesional y académica para el expediente de contratación.
      </p>

      <div className="space-y-5">
        <CampoTexto
          id="profesion"
          guardado={g('profesion')}
          etiqueta="Profesión"
          valor={datos.profesion}
          onChange={(v) => fijarCampo('profesion', v)}
          error={errores.profesion}
          obligatorio
          maxLength={100}
        />

        {/* ¿Colegiado? */}
        <fieldset>
          <legend className="text-sm font-semibold text-igss-900 mb-1.5">
            ¿Está colegiado(a) activo(a)?
            <span className="text-igss-red"> *</span>
          </legend>
          <div className="flex gap-2" role="radiogroup" aria-label="¿Está colegiado activo?">
            {[
              { valor: true, texto: 'Sí' },
              { valor: false, texto: 'No' },
            ].map((opcion) => (
              <label
                key={String(opcion.valor)}
                className={`flex-1 sm:flex-none py-2.5 px-8 rounded-xl border-2 cursor-pointer text-center text-sm font-semibold transition-colors ${
                  datos.es_colegiado === opcion.valor
                    ? 'border-igss-600 bg-igss-50 text-igss-800'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-igss-300'
                }`}
              >
                <input
                  type="radio"
                  name="es_colegiado"
                  value={opcion.valor ? 'si' : 'no'}
                  checked={datos.es_colegiado === opcion.valor}
                  onChange={() => fijarColegiado(opcion.valor)}
                  className="sr-only"
                />
                {opcion.texto}
              </label>
            ))}
          </div>
          {errores.es_colegiado && (
            <p aria-live="polite" className="mt-1 text-xs text-igss-red font-medium">
              {errores.es_colegiado}
            </p>
          )}
        </fieldset>

        {colegiado && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 fade-in">
            {colegios.length > 0 ? (
              <CampoBuscador
                id="colegio_profesional"
                guardado={g('colegio_profesional')}
                etiqueta="Colegio profesional"
                valor={datos.colegio_profesional}
                onChange={(v) => fijarCampo('colegio_profesional', v)}
                opciones={colegios}
                error={errores.colegio_profesional}
                obligatorio
              />
            ) : (
              <CampoTexto
                id="colegio_profesional"
                guardado={g('colegio_profesional')}
                etiqueta="Colegio profesional"
                valor={datos.colegio_profesional}
                onChange={(v) => fijarCampo('colegio_profesional', v)}
                error={errores.colegio_profesional}
                obligatorio
                mayusculas
                maxLength={100}
              />
            )}

            <CampoTexto
              id="numero_colegiado"
              guardado={g('numero_colegiado')}
              etiqueta="Número de colegiado"
              valor={datos.numero_colegiado}
              onChange={(v) => fijarCampo('numero_colegiado', soloDigitos(v).slice(0, 7))}
              error={errores.numero_colegiado}
              obligatorio
              inputMode="numeric"
              placeholder="Hasta 7 dígitos"
            />
          </div>
        )}

        <CampoTexto
          id="nit"
          guardado={g('nit')}
          etiqueta="NIT"
          valor={datos.nit}
          onChange={(v) => fijarCampo('nit', formatoNIT(v))}
          error={errores.nit}
          obligatorio
          placeholder="1234567-9"
          ayuda="Puede escribirlo con o sin guion. Si usa su CUI como NIT, escríbalo completo."
        />

        <CampoTexto
          id="area_contratada"
          guardado={g('area_contratada')}
          etiqueta="Área contratada"
          valor={datos.area_contratada}
          onChange={(v) => fijarCampo('area_contratada', v)}
          error={errores.area_contratada}
          obligatorio
          maxLength={100}
          ayuda="Sección o área donde prestará servicios."
        />

        {/* Estudios */}
        <div className="pt-2">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-igss-900">Estudios realizados</h3>
            <span className="text-xs text-gray-400">
              {datos.estudios.length} de 3 (mínimo 1)
            </span>
          </div>
          {errores.estudios && (
            <p aria-live="polite" className="text-xs text-igss-red font-medium mb-3">
              {errores.estudios}
            </p>
          )}
          {g('estudios') && !errores.estudios && (
            <div className="mb-3">
              <MarcaGuardado />
              <p className="text-xs text-gray-500 mt-0.5">
                Si desea cambiar los estudios, vuelva a escribirlos todos.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {datos.estudios.map((estudio, indice) => (
              <div
                key={indice}
                className="rounded-xl border-2 border-gray-100 bg-white/70 p-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-igss-700 uppercase tracking-wide">
                    Estudio {indice + 1}
                  </p>
                  {datos.estudios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarEstudio(indice)}
                      className="text-xs font-semibold text-gray-400 hover:text-igss-red transition-colors focus:outline-none focus:ring-2 focus:ring-igss-red/30 rounded px-1"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <CampoSelect
                  id={`estudio-${indice}-nivel`}
                  etiqueta="Nivel"
                  valor={estudio.nivel}
                  onChange={(v) => fijarEstudio(indice, 'nivel', v)}
                  opciones={niveles}
                  error={errores[`estudios.${indice}.nivel`]}
                  obligatorio
                />

                <CampoTexto
                  id={`estudio-${indice}-centro`}
                  etiqueta="Centro de estudio"
                  valor={estudio.centro}
                  onChange={(v) => fijarEstudio(indice, 'centro', v)}
                  error={errores[`estudios.${indice}.centro`]}
                  obligatorio
                  mayusculas
                  maxLength={120}
                />

                <CampoTexto
                  id={`estudio-${indice}-titulo`}
                  etiqueta="Título obtenido"
                  valor={estudio.titulo}
                  onChange={(v) => fijarEstudio(indice, 'titulo', v)}
                  error={errores[`estudios.${indice}.titulo`]}
                  obligatorio
                  mayusculas
                  maxLength={120}
                />

                <div className="grid grid-cols-2 gap-4">
                  <SelectorMesAnio
                    id={`estudio-${indice}-inicio`}
                    etiqueta="Inicio"
                    valor={estudio.inicio}
                    onChange={(v) => fijarEstudio(indice, 'inicio', v)}
                    error={errores[`estudios.${indice}.inicio`]}
                    meses={meses}
                    anios={anios}
                  />
                  <SelectorMesAnio
                    id={`estudio-${indice}-fin`}
                    etiqueta="Fin"
                    valor={estudio.fin}
                    onChange={(v) => fijarEstudio(indice, 'fin', v)}
                    error={errores[`estudios.${indice}.fin`]}
                    meses={meses}
                    anios={anios}
                  />
                </div>
              </div>
            ))}
          </div>

          {datos.estudios.length < 3 && (
            <button
              type="button"
              onClick={agregarEstudio}
              className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
            >
              + Agregar otro estudio
            </button>
          )}
        </div>

        {/* Actividades */}
        <div className="pt-2">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-igss-900">Actividades a realizar</h3>
            <span className="text-xs text-gray-400">2 obligatorias{datos.actividades.length > 2 ? ' + 1 opcional' : ' + 1 opcional disponible'}</span>
          </div>
          {errores.actividades && (
            <p aria-live="polite" className="text-xs text-igss-red font-medium mb-3">
              {errores.actividades}
            </p>
          )}
          {g('actividades') && !errores.actividades && (
            <div className="mb-3">
              <MarcaGuardado />
              <p className="text-xs text-gray-500 mt-0.5">
                Si desea cambiar las actividades, vuelva a escribirlas todas.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {datos.actividades.map((texto, indice) => (
              <div key={indice} className="relative">
                <CampoAreaTexto
                  id={`actividad-${indice}`}
                  etiqueta={indice < 2 ? `Actividad ${indice + 1}` : 'Actividad opcional'}
                  valor={texto}
                  onChange={(v) => fijarActividad(indice, v)}
                  error={errores[`actividades.${indice}`]}
                  obligatorio={indice < 2}
                  placeholder="Describa la actividad que realizará en el área contratada…"
                />
                {indice >= 2 && (
                  <button
                    type="button"
                    onClick={() => quitarActividad(indice)}
                    className="absolute right-0 -top-1 text-xs font-semibold text-gray-400 hover:text-igss-red transition-colors focus:outline-none focus:ring-2 focus:ring-igss-red/30 rounded px-1"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>

          {datos.actividades.length < 3 && (
            <button
              type="button"
              onClick={agregarActividad}
              className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-igss-300 text-igss-700 hover:border-igss-500 hover:bg-igss-50 font-semibold text-sm transition-colors focus:outline-none focus:ring-4 focus:ring-igss-600/10"
            >
              + Agregar actividad opcional
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

// Selector de mes y año que produce un valor "AAAA-MM".
function SelectorMesAnio({ id, etiqueta, valor, onChange, error, meses, anios }) {
  const [anio, mes] = (valor || '').split('-')
  const fijar = (parte, nuevoValor) => {
    const nuevoAnio = parte === 'anio' ? nuevoValor : anio || ''
    const nuevoMes = parte === 'mes' ? nuevoValor : mes || ''
    onChange(nuevoAnio && nuevoMes ? `${nuevoAnio}-${nuevoMes}` : '')
  }

  return (
    <div>
      <span id={`${id}-etiqueta`} className="block text-sm font-semibold text-igss-900 mb-1.5">
        {etiqueta}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <select
          id={`${id}-mes`}
          value={mes || ''}
          onChange={(e) => fijar('mes', e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full px-3 py-2.5 rounded-xl border-2 transition-all appearance-none pr-7 shadow-sm focus:outline-none focus:ring-4 text-sm ${
            error
              ? 'border-igss-red/50 bg-red-50/50'
              : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600'
          }`}
        >
          <option value="">Mes</option>
          {meses.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select
          id={`${id}-anio`}
          value={anio || ''}
          onChange={(e) => fijar('anio', e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          className={`w-full px-3 py-2.5 rounded-xl border-2 transition-all appearance-none pr-7 shadow-sm focus:outline-none focus:ring-4 text-sm ${
            error
              ? 'border-igss-red/50 bg-red-50/50'
              : 'border-gray-200 bg-white hover:border-igss-300 focus:border-igss-600'
          }`}
        >
          <option value="">Año</option>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1 text-xs text-igss-red font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
