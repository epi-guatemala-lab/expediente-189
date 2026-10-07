export default function Footer() {
  return (
    <footer className="mt-auto">
      {/* Acento dorado */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-igss-gold to-transparent" />

      <div className="bg-igss-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px]">
            <div className="text-igss-300/60 text-center">
              IGSS — Medicina Preventiva — Expediente 189
            </div>
            <div className="text-igss-300/40">
              &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
