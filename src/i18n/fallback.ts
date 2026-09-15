export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assignOverlay(target: Record<string, unknown>, overlay: Record<string, unknown>) {
  for (const [key, value] of Object.entries(overlay)) {
    if (typeof value === "string") {
      if (value.length > 0) target[key] = value;
      continue;
    }
    if (isPlainObject(value)) {
      const current = target[key];
      const next = isPlainObject(current) ? { ...current } : {};
      assignOverlay(next, value);
      target[key] = next;
    }
  }
}

export function mergeCatalog<T extends Record<string, unknown>>(base: T, overlay: unknown): T {
  const output = structuredClone(base) as T & Record<string, unknown>;
  if (isPlainObject(overlay)) assignOverlay(output, overlay);
  return output;
}

export function lookupPath(catalog: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = catalog;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

export function messageAt(catalog: unknown, path: string, fallbackCatalog?: unknown): string {
  const value = lookupPath(catalog, path);
  if (typeof value === "string" && value.length > 0) return value;
  if (fallbackCatalog !== undefined) {
    const fallback = lookupPath(fallbackCatalog, path);
    if (typeof fallback === "string" && fallback.length > 0) return fallback;
  }
  return path;
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}
