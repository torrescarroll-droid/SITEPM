/**
 * Browser-local greeting. Night hours use evening so the home title
 * is not stuck on morning.
 */
export function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
