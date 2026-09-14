export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.trim());
      if (row.some((item) => item.length > 0)) table.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((item) => item.length > 0)) table.push(row);
  const headers = (table[0] ?? []).map((header) => header.trim());
  const rows = table.slice(1).filter((item) => item.some((value) => value.length > 0));
  return { headers, rows };
}

export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function columnIndex(headers: string[], column: string): number {
  return headers.findIndex((header) => header === column || normalizeHeader(header) === normalizeHeader(column));
}

export function cellAt(headers: string[], row: string[], column: string | undefined): string {
  if (!column) return "";
  const index = columnIndex(headers, column);
  return index < 0 ? "" : (row[index] ?? "").trim();
}
