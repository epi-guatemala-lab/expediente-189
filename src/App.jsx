import { Suspense, lazy, useEffect, useState } from 'react'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import FlujoSolicitante from './components/expediente/FlujoSolicitante.jsx'

// El panel de Recepción (tanda 2) se carga solo cuando se visita #/panel.
const PanelPlaceholder = lazy(() => import('./components/panel/PanelPlaceholder.jsx'))

function rutaActual() {
  return window.location.hash.startsWith('#/panel') ? '/panel' : '/'
}

export default function App() {
  const [ruta, setRuta] = useState(rutaActual)

  useEffect(() => {
    const alCambiarRuta = () => setRuta(rutaActual())
    window.addEventListener('hashchange', alCambiarRuta)
    return () => window.removeEventListener('hashchange', alCambiarRuta)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {ruta === '/panel' ? (
          <Suspense
            fallback={
              <div className="text-center py-16" role="status">
                <div className="inline-block w-10 h-10 border-4 border-igss-200 border-t-igss-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-4">Cargando…</p>
              </div>
            }
          >
            <PanelPlaceholder />
          </Suspense>
        ) : (
          <FlujoSolicitante />
        )}
      </main>
      <Footer />
    </div>
  )
}
