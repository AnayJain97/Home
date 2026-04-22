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

/**
 * Get the financial year start date (April 1) for a given date.
 */
export function getFYStartDate(date = new Date()) {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return new Date(startYear, 3, 1); // April 1
}

/**
 * Get the FY label (e.g. "2025-26") for the FY containing a given date.
 * Alias for getCurrentFYLabel but clearer in intent.
 */
export function getFYForDate(date) {
  return getCurrentFYLabel(date);
}

/**
 * Get the previous FY label: "2025-26" → "2024-25"
 */
export function getPreviousFYLabel(fyLabel) {
  const startYear = parseInt(fyLabel.split('-')[0], 10);
  const prev = startYear - 1;
  return `${prev}-${String(prev + 1).slice(2)}`;
}

/**
 * Get the next FY label: "2025-26" → "2026-27"
 */
export function getNextFYLabel(fyLabel) {
  const startYear = parseInt(fyLabel.split('-')[0], 10);
  const next = startYear + 1;
  return `${next}-${String(next + 1).slice(2)}`;
}

/**
 * Convert an FY label to its start date (April 1).
 * "2025-26" → April 1, 2025
 */
export function fyLabelToStartDate(fyLabel) {
  const startYear = parseInt(fyLabel.split('-')[0], 10);
  return new Date(startYear, 3, 1);
}

/**
 * Convert an FY label to its end date (March 31).
 * "2025-26" → March 31, 2026
 */
export function fyLabelToEndDate(fyLabel) {
  const startYear = parseInt(fyLabel.split('-')[0], 10);
  return new Date(startYear + 1, 2, 31);
}

/**
 * Get sorted (descending) array of unique FY labels from a list of dates.
 */
export function getAllFYs(dates) {
  const fySet = new Set();
  dates.forEach(d => {
    if (d) fySet.add(getFYForDate(d));
  });
  return [...fySet].sort((a, b) => b.localeCompare(a));
}
