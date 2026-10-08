"use client";

import { Card } from "@/components/ui";

export default function Error({ reset }: { reset: () => void }) {
  return <Card><p role="alert">The report could not be loaded. Check your connection and try again.</p><button className="control mt-3 min-h-11 text-sm underline" onClick={reset}>Try again</button></Card>;
}
