// Parser del alta masiva de nómina: una persona por línea con hasta 6 columnas
// en este orden: CUI, nombre, sección, renglón, tipo de servicio y teléfono.
// Las columnas se separan por tabulación (pegado desde Excel) o punto y coma;
// la coma YA NO separa (los renglones traen «y/o» y los nombres pueden traer
// comas). Función pura, sin DOM ni entorno de Vite, para probarla con
// `node --test src/lib/` (ver src/lib/nomina.test.mjs).

import {
  soloDigitos,
  validarCUI,
  validarNombrePersona,
  validarTelefono,
} from '../lib/validaciones.js'

// El CONTRATO §5 acepta hasta 300 personas por solicitud.
export const MAX_PERSONAS = 300

// `cuisExistentes` son los CUI que ya están en la nómina (opcional).
// Devuelve { lineas, validas, invalidas }: cada línea lleva su número, los
// datos normalizados y la lista de errores que la marcan como inválida.
export function parsearNomina(texto, cuisExistentes = []) {
  const existentes = new Set(cuisExistentes.map((c) => soloDigitos(c)).filter(Boolean))
  const vistas = new Set()
  const lineas = []

  String(texto ?? '')
    .split(/\r?\n/)
    .forEach((cruda, indice) => {
      const numero = indice + 1
      const linea = cruda.trim()
      // Las líneas vacías se ignoran (Excel y copias manuales dejan huecos).
      if (!linea) return

      const item = {
        numero,
        cruda: linea,
        cui: '',
        nombre: '',
        seccion: '',
        renglon: '',
        tipoServicio: '',
        telefono: '',
        errores: [],
      }
      let partes = (linea.includes('\t') ? linea.split('\t') : linea.split(';')).map((p) => p.trim())
      // Una tabulación final deja una columna vacía que no cuenta.
      while (partes.length && partes[partes.length - 1] === '') partes.pop()

      if (partes.length < 2 || partes.length > 6) {
        item.errores.push(
          'Debe tener entre 2 y 6 columnas: CUI, nombre, sección, renglón, tipo de servicio y teléfono (las últimas cuatro opcionales)'
        )
        lineas.push(item)
        return
      }

      // Formato viejo de 3 columnas: si la tercera son 8 dígitos, es el teléfono.
      const viejo = partes.length === 3 && /^\d{8}$/.test(partes[2])
      const [cuiCrudo, nombreCrudo, ...resto] = partes
      const seccionCruda = viejo ? '' : resto[0] || ''
      const renglonCrudo = viejo ? '' : resto[1] || ''
      const tipoCrudo = viejo ? '' : resto[2] || ''
      const telefonoCrudo = viejo ? resto[0] || '' : resto[3] || ''

      const cui = soloDigitos(cuiCrudo)
      const veredictoCUI = validarCUI(cuiCrudo)
      if (!veredictoCUI.valido) {
        item.errores.push(`CUI: ${veredictoCUI.error.toLowerCase()}`)
      } else if (existentes.has(cui)) {
        item.errores.push('Este CUI ya está en la nómina')
      } else if (vistas.has(cui)) {
        item.errores.push('CUI repetido en la lista pegada')
      }

      if (!nombreCrudo) {
        item.errores.push('Falta el nombre')
      } else {
        const veredictoNombre = validarNombrePersona(nombreCrudo)
        if (!veredictoNombre.valido) item.errores.push(`Nombre: ${veredictoNombre.error}`)
      }

      const telefono = telefonoCrudo ? soloDigitos(telefonoCrudo) : ''
      if (telefonoCrudo && !validarTelefono(telefonoCrudo).valido) {
        item.errores.push('Teléfono: debe tener 8 dígitos e iniciar con un dígito entre 2 y 7')
      }

      item.cui = cui
      // El nombre y los datos de contratación se envían tal como se
      // escribieron: el servidor los normaliza. Solo se recorta el espacio
      // de relleno de la columna.
      item.nombre = nombreCrudo
      item.seccion = seccionCruda
      item.renglon = renglonCrudo
      item.tipoServicio = tipoCrudo
      item.telefono = telefono
      if (!item.errores.length) vistas.add(cui)
      lineas.push(item)
    })

  const validas = lineas.filter((l) => l.errores.length === 0)
  return { lineas, validas, invalidas: lineas.length - validas.length }
}
