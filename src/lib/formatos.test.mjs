import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatosDeclaracion, urlFormato } from './formatos.js'
import { avisosDeVerificacion } from './avisos.js'

test('cada tipo de servicio descarga sus dos formatos; sin tipo, los cuatro', () => {
  assert.deepEqual(formatosDeclaracion('TECNICO').map((f) => f.variante), ['tecnico-masculino', 'tecnico-femenino'])
  assert.deepEqual(formatosDeclaracion('PROFESIONAL').map((f) => f.variante), [
    'profesional-masculino',
    'profesional-femenino',
  ])
  assert.equal(formatosDeclaracion(null).length, 4)
  assert.ok(urlFormato('tecnico-femenino').endsWith('/expediente189/formatos/declaracion-jurada/tecnico-femenino'))
})

test('el acta con cambios avisa con el tramo exacto; la de otro tipo, en rojo', () => {
  const base = { cargado: true, oculto: false, alertas: [], fecha_documento: '2026-11-05' }
  const definicion = { clave: 'declaracion_jurada', etiqueta_fecha: 'Fecha del acta' }
  const conCambios = avisosDeVerificacion(
    {
      ...base,
      verificacion: {
        estado: 'LISTA',
        formato: {
          veredicto: 'CON_CAMBIOS',
          cambios: [{ formato: 'acta notarial «quince» minutos', documento: 'acta notarial «veinte» minutos' }],
        },
      },
    },
    definicion
  )
  const aviso = conCambios.find((a) => a.clave === 'FORMATO_CAMBIADO')
  assert.ok(aviso && aviso.tipo === 'error' && aviso.texto.includes('«veinte»'))
  const otro = avisosDeVerificacion(
    { ...base, verificacion: { estado: 'LISTA', formato: { veredicto: 'OTRO_FORMATO', cambios: [] } } },
    definicion
  )
  assert.ok(otro.some((a) => a.clave === 'OTRO_FORMATO' && a.tipo === 'error'))
  const camscanner = avisosDeVerificacion({ ...base, alertas: ['CAMSCANNER'], verificacion: { estado: 'LISTA' } }, {
    clave: 'banrural',
  })
  assert.ok(camscanner.some((a) => a.clave === 'CAMSCANNER'))
})
