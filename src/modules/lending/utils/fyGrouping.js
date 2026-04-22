import { toJSDate, getFYForDate, getCurrentFYLabel } from '../../../utils/dateUtils';

/**
 * Group an array of items by Financial Year based on a date field.
 * Returns an object keyed by FY label (e.g. "2025-26") with arrays of items.
 * Keys are sorted descending (newest FY first).
 */
export function groupByFY(items, dateField) {
  const groups = {};

  items.forEach(item => {
    const dateVal = item[dateField];
    const jsDate = toJSDate(dateVal);
    const fy = getFYForDate(jsDate);
    if (!groups[fy]) groups[fy] = [];
    groups[fy].push(item);
  });

  // Sort keys descending (newest FY first)
  const sorted = {};
  Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .forEach(key => { sorted[key] = groups[key]; });

  return sorted;
}

/**
 * Get the current FY label for use as the default expanded section.
 */
export function getDefaultExpandedFY() {
  return getCurrentFYLabel();
}
