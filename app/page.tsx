export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 font-sans">
      <main className="w-full max-w-xl rounded-2xl bg-white px-8 py-12 shadow-sm">
        <p className="text-sm font-medium tracking-[0.18em] text-zinc-500 uppercase">
          Contractor MVP
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
          SITEPM
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600">
          AI Operating Layer for Construction. Local development is running.
        </p>
        <p className="mt-8 text-sm text-zinc-500">
          Week 1 — no Supabase, documents, or AI connected yet.
        </p>
      </main>
    </div>
  );
}
