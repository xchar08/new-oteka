export default function Loading() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-palenight-bg text-palenight-accent">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-palenight-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium animate-pulse">Initializing Oteka...</p>
      </div>
    </div>
  )
}
