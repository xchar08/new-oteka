export default function Loading() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <div className="text-sm font-medium text-gray-500 animate-pulse">Initializing Oteka...</div>
      </div>
    </div>
  )
}
