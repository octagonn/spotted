/**
 * Guards for values interpolated into PostgREST filter STRINGS.
 *
 * Every other query-builder call (`.eq()`, `.in()`, `.rpc()` params, …) sends
 * values as data — PostgREST binds them, so they cannot change the query. The
 * one exception is `.or("a.eq.X,b.eq.Y")`: that argument is a mini filter
 * language PostgREST parses, so `,` `(` `)` `.` inside X would be read as
 * more filter clauses. RLS still bounds what such a query can touch, but the
 * value must never come from free text. Ids are UUIDs — enforce it here so a
 * malformed id fails loudly instead of building a mangled filter.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Returns `id` for use inside a `.or()` string; throws if it is not a UUID. */
export function uuidFilterValue(id: string): string {
  if (!isUuid(id)) {
    throw new Error("Refusing to build a PostgREST filter from a non-UUID id");
  }
  return id;
}

/** `in.(…)` list for a `.or()` string, every entry checked. */
export function uuidFilterList(ids: readonly string[]): string {
  return ids.map(uuidFilterValue).join(",");
}
