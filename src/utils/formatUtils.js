/**
 * Format a number as Indian Rupee currency: ₹1,00,000.00
 */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format as percentage: "2.00%"
 */
export function formatPercent(rate) {
  if (rate == null) return '0.00%';
  return `${Number(rate).toFixed(2)}%`;
}
