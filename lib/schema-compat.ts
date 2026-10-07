/** True only when PostgREST/Postgres says this build's additive objects are not installed yet. */
export function missingRelationOrColumn(message: string) {
  return /does not exist|schema cache|Could not find the/i.test(message);
}
