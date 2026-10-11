/** Limit tab-local drafts to the current authenticated user; logout removes all. */
export function clearOtherReportDrafts(storage: Pick<Storage, "length" | "key" | "removeItem">, userId?: string) {
  const remove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("sitepm-report-v1:") && (!userId || key.split(":")[2] !== userId)) remove.push(key);
  }
  for (const key of remove) storage.removeItem(key);
}
