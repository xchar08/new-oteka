import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center space-y-4">
      <h2 className="text-2xl font-bold">Page Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/dashboard" className="text-blue-600 underline">
        Return Home
      </Link>
    </div>
  )
}
