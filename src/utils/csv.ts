/**
 * Escape one value for a CSV cell.
 *
 * Two jobs:
 *  1. Keep the cell intact: wrap in quotes, double embedded quotes and flatten
 *     line breaks so a field can never spill into another column or row.
 *  2. Stop formula injection: a spreadsheet treats a cell that starts with
 *     `=`, `+`, `-`, `@`, tab or carriage return as a formula, so a farmer
 *     name like `=HYPERLINK(...)` would run when an admin opens the export.
 *     Such cells get a leading single quote, which makes Excel and Sheets
 *     read them as plain text.
 */
export function csvEscape(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}
