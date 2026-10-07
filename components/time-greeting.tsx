"use client";

import { useSyncExternalStore } from "react";
import { greetingForHour } from "@/lib/time-greeting";

function subscribe() {
  return () => {};
}

export function TimeGreeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(
    subscribe,
    () => new Date().getHours(),
    () => null,
  );
  if (hour === null) return name;
  return `${greetingForHour(hour)}, ${name}.`;
}
