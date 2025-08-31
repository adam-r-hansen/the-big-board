// lib/api/normalize.ts
export function firstOrNull<T>(maybe: T | T[] | null | undefined): T | null {
  if (Array.isArray(maybe)) return maybe[0] ?? null;
  return (maybe as T) ?? null;
}
