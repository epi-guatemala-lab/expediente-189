// Servicio sin conexión ya conectado al servidor real y a la sesión de la pestaña.
// Es el único archivo de la capa que depende del entorno de Vite.

import { BASE, borrarToken, leerToken, leerTokenAnterior } from '../api/cliente.js'
import { crearServicio } from './servicio.js'
import { sidDeToken } from './token.js'
import { crearTransporte } from './transporte.js'

export const servicio = crearServicio({
  transporte: crearTransporte({ base: BASE, obtenerToken: leerToken }),
  hayToken: () => Boolean(leerToken()),
  // Si el token venció se usa el último: la continuidad de sesión conserva el mismo `sid`.
  obtenerSid: () => sidDeToken(leerToken() || leerTokenAnterior()),
  alSesionVencida: borrarToken,
})
