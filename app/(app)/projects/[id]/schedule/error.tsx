"use client";
export default function Error({reset}:{reset:()=>void}){return <div role="alert" className="space-y-3 p-4"><h2 className="font-semibold">Scheduling records could not load</h2><p>Check your connection. This release also requires the scheduling migration. No save is implied by this message.</p><button className="min-h-11 underline" onClick={reset}>Try again</button></div>;}
