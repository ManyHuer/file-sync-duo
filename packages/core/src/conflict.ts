const CONFLICT_SUFFIX_RE = /_conflict_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(\.\w+)?$/;

export function conflictName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "").replace(/T/, "_").replace(/:/g, "-");
  return `${base}_conflict_${ts}${ext}`;
}

export function hasConflictSuffix(name: string): boolean {
  return CONFLICT_SUFFIX_RE.test(name);
}
