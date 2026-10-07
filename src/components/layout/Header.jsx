export default function Header() {
  return (
    <header className="relative overflow-hidden">
      {/* Franja principal */}
      <div className="bg-gradient-to-br from-igss-900 via-igss-800 to-igss-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Logo con brillo suave */}
            <div className="flex-shrink-0 relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl" />
              <img
                src={`${import.meta.env.BASE_URL}igss-logo.png`}
                alt="Logo IGSS"
                className="relative w-16 h-16 sm:w-[76px] sm:h-[76px] object-contain drop-shadow-2xl"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs text-igss-300 font-semibold uppercase tracking-[0.15em]">
                Instituto Guatemalteco de Seguridad Social
              </p>
              <h1 className="text-sm sm:text-lg font-extrabold leading-tight mt-1 tracking-tight">
                Expediente de contratación
              </h1>
              <p className="text-[11px] sm:text-sm text-igss-200 mt-0.5 font-medium">
                Contrataciones 2027 · Departamento de Medicina Preventiva
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Acento dorado */}
      <div className="h-1.5 bg-gradient-to-r from-igss-gold-dark via-igss-gold to-igss-gold-light shadow-sm" />
    </header>
  )
}
