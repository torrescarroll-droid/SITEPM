export type CrewEntryInput = {
  companyName: string | null;
  tradeName: string;
  workerCount: number | null;
};

export function formatCrewLine(entry: CrewEntryInput) {
  const company = entry.companyName?.trim();
  const trade = entry.tradeName.trim();
  const count =
    entry.workerCount == null ? "" : ` — ${entry.workerCount} worker${entry.workerCount === 1 ? "" : "s"}`;
  if (company) return `${company} — ${trade}${count}`;
  return `${trade}${count}`;
}

export function parseCrewRows(formData: FormData): CrewEntryInput[] {
  const companies = formData.getAll("crew_company").map((value) => String(value));
  const trades = formData.getAll("crew_trade").map((value) => String(value));
  const counts = formData.getAll("crew_count").map((value) => String(value));
  const rows: CrewEntryInput[] = [];
  const length = Math.max(companies.length, trades.length, counts.length);
  for (let index = 0; index < length; index += 1) {
    const tradeName = (trades[index] ?? "").trim();
    const companyName = (companies[index] ?? "").trim();
    const countRaw = (counts[index] ?? "").trim();
    if (!tradeName && !companyName && !countRaw) continue;
    if (!tradeName) {
      throw new Error("Each crew row needs a trade, even when the company is still unknown.");
    }
    let workerCount: number | null = null;
    if (countRaw) {
      const parsed = Number(countRaw);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2147483647) {
        throw new Error("Crew count must be a whole number.");
      }
      workerCount = parsed;
    }
    rows.push({
      companyName: companyName || null,
      tradeName,
      workerCount,
    });
  }
  return rows;
}

export function reportHasSubstance(input: {
  notes: string | null;
  workPerformed: string | null;
  delays: string | null;
  deliveries: string | null;
}) {
  return Boolean(
    input.notes?.trim() ||
      input.workPerformed?.trim() ||
      input.delays?.trim() ||
      input.deliveries?.trim(),
  );
}
