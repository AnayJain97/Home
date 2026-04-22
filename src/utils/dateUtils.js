/**
 * Get the financial year end date (March 31) for a given date.
 * If the date is between April 1 and March 31, FY ends on March 31 of the next calendar year.
 * If the date is between Jan 1 and March 31, FY ends on March 31 of the same calendar year.
 */
export function getFYEndDate(date = new Date()) {
  const d = new Date(date);
  const month = d.getMonth(); // 0-indexed: 0=Jan, 3=Apr
  const year = d.getFullYear();
  // April (3) onwards → FY ends March 31 of next year
  // Jan-Mar (0-2) → FY ends March 31 of same year
  const fyEndYear = month >= 3 ? year + 1 : year;
  return new Date(fyEndYear, 2, 31); // March 31
}

/**
 * Get current financial year label, e.g. "2025-26"
 */
export function getCurrentFYLabel(date = new Date()) {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/**
 * Format a Date or Firestore Timestamp to DD/MM/YYYY string.
 */
export function formatDate(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert any date value (Firestore Timestamp, string, Date) to a JS Date.
 */
export function toJSDate(date) {
  if (!date) return new Date();
  if (date.toDate) return date.toDate(); // Firestore Timestamp
  return new Date(date);
}

/**
 * Convert a date to YYYY-MM-DD for input[type=date] value.
 */
export function toInputDate(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string to Date object.
 */
export function fromInputDate(str) {
  if (!str) return null;
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day);
}
