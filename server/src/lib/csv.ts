/**
 * RFC 4180 CSV with spreadsheet formula-injection protection: cells starting with = + - @ (or tab/CR)
 * are prefixed with an apostrophe so Excel/Sheets treat them as text. A BOM keeps Telugu/Hindi text
 * readable when the file is opened in Excel.
 */
export type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
