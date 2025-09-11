// app/access-denied/page.tsx
export default function AccessDenied() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold mb-2">Access denied</h1>
      <p className="text-sm text-neutral-600">
        You don’t have permission to view that page. If you think this is a mistake, contact the commissioner.
      </p>
      <a href="/picks" className="inline-block mt-4 underline">Go to Picks</a>
    </main>
  )
}
