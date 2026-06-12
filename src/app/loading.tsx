export default function Loading() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-[var(--primary)]/10" />
          <div className="absolute inset-0 rounded-full border-4 border-[var(--primary)] border-t-transparent animate-spin" />
          <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
        </div>
        <p className="hud-label text-[var(--text-secondary)] animate-pulse">Initializing Oteka</p>
      </div>
    </div>
  )
}
