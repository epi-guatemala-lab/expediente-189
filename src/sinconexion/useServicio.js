import { useEffect, useSyncExternalStore } from 'react'
import { servicio } from './instancia.js'

// Vista del servicio sin conexión para React (se vuelve a pintar cuando cambia).
export function useServicio() {
  return useSyncExternalStore(servicio.suscribir, servicio.obtenerVista, servicio.obtenerVista)
}

// Avisa al cerrar la pestaña si hay cambios que aún no llegaron al servidor.
export function useAvisoAlCerrar(hayCambiosSinEnviar) {
  useEffect(() => {
    if (!hayCambiosSinEnviar) return undefined
    const alCerrar = (evento) => {
      evento.preventDefault()
      evento.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', alCerrar)
    return () => window.removeEventListener('beforeunload', alCerrar)
  }, [hayCambiosSinEnviar])
}
