// Parser del alta masiva de nómina: una persona por línea con columnas
// separadas por tabulación (pegado desde Excel) o coma. Función pura, sin
// DOM ni entorno de Vite, para probarla con `node --test src/lib/`
// (ver src/lib/nomina.test.mjs).

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

      const item = { numero, cruda: linea, cui: '', nombre: '', telefono: '', errores: [] }
      let partes = (linea.includes('\t') ? linea.split('\t') : linea.split(',')).map((p) => p.trim())
      // Una tabulación final deja una columna vacía que no cuenta.
      while (partes.length && partes[partes.length - 1] === '') partes.pop()

      if (partes.length < 2 || partes.length > 3) {
        item.errores.push('Debe tener 2 o 3 columnas: CUI, nombre y teléfono (opcional)')
        lineas.push(item)
        return
      }

      const [cuiCrudo, nombreCrudo, telefonoCrudo] = partes
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
      // El nombre se envía tal como se escribió: el servidor lo normaliza
      // (adenda §7). Solo se recorta el espacio de relleno de la columna.
      item.nombre = nombreCrudo
      item.telefono = telefono
      if (!item.errores.length) vistas.add(cui)
      lineas.push(item)
    })

  const validas = lineas.filter((l) => l.errores.length === 0)
  return { lineas, validas, invalidas: lineas.length - validas.length }
}
