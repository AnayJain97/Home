import { getFYEndDate, toJSDate, getCurrentFYLabel, fyLabelToEndDate } from '../../../utils/dateUtils';

/**
 * Calculate monthly interest on a principal amount.
 */
function calcMonthlyInterest(principal, monthlyRatePercent) {
  return principal * (monthlyRatePercent / 100);
}

/**
 * Get number of days from a date to the target end date.
 * If endDate is provided, use that; otherwise use current FY end.
 */
function getDaysTillEnd(fromDate = new Date(), endDate = null) {
  const now = new Date(fromDate);
  const target = endDate ? new Date(endDate) : getFYEndDate(new Date());
  if (now >= target) return 0;
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate interest from a date till end date (or current FY end if no end date).
 * Formula: days × (principal × monthlyRate / 100 / 30)
 */
function calcInterestTillFYEnd(principal, monthlyRatePercent, fromDate = new Date(), endDate = null) {
  const days = getDaysTillEnd(fromDate, endDate);
  if (days === 0) return 0;
  const dailyRate = monthlyRatePercent / 30;
  const dailyInterest = principal * (dailyRate / 100);
  return dailyInterest * days;
}

/**
 * Build the formula description string for tooltip display.
 */
function getInterestFormula(principal, monthlyRatePercent, fromDate = new Date(), endDate = null) {
  const now = new Date(fromDate);
  const target = endDate ? new Date(endDate) : getFYEndDate(new Date());
  if (now >= target) return 'Period ended — no interest due';

  const days = getDaysTillEnd(now, endDate);
  const dailyRate = monthlyRatePercent / 30;
  const dailyInterest = principal * (dailyRate / 100);
  const total = dailyInterest * days;
  const targetStr = target.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const endLabel = endDate ? `end date (${targetStr})` : `FY end (31 Mar)`;

  return `Monthly rate: ${monthlyRatePercent}%\n`
    + `Daily rate: ${monthlyRatePercent}% / 30 = ${dailyRate.toFixed(4)}%\n`
    + `Daily interest: ₹${principal.toLocaleString('en-IN')} × ${dailyRate.toFixed(4)}% = ₹${dailyInterest.toFixed(2)}\n`
    + `End date: ${targetStr}\n`
    + `Days till ${endLabel}: ${days}\n`
    + `Interest = ${days} × ₹${dailyInterest.toFixed(2)} = ₹${total.toFixed(2)}`;
}

/**
 * Build a summary for a lending entry.
 * Interest is always on full principal from loan date to FY end.
 */
export function getLendingSummary(loan) {
  const principal = loan.principalAmount;
  const loanDate = toJSDate(loan.loanDate);
  const endDate = loan.endDate ? toJSDate(loan.endDate) : null;
  const monthlyInterest = calcMonthlyInterest(principal, loan.monthlyInterestRate);
  const daysTillEnd = getDaysTillEnd(loanDate, endDate);
  const interestTillFYEnd = Math.round(calcInterestTillFYEnd(principal, loan.monthlyInterestRate, loanDate, endDate) * 100) / 100;
  const totalDue = Math.round((principal + interestTillFYEnd) * 100) / 100;
  const formulaText = getInterestFormula(principal, loan.monthlyInterestRate, loanDate, endDate);

  return { principal, monthlyInterest, daysTillFYEnd: daysTillEnd, interestTillFYEnd, totalDue, formulaText };
}

/**
 * Build a summary for a borrowing entry.
 * Interest is on the amount from borrowing date to FY end.
 */
export function getBorrowingSummary(borrowing) {
  const amount = borrowing.amount;
  const borrowDate = toJSDate(borrowing.borrowDate);
  const endDate = borrowing.endDate ? toJSDate(borrowing.endDate) : null;
  const monthlyInterest = calcMonthlyInterest(amount, borrowing.monthlyInterestRate);
  const daysTillEnd = getDaysTillEnd(borrowDate, endDate);
  const interestTillFYEnd = Math.round(calcInterestTillFYEnd(amount, borrowing.monthlyInterestRate, borrowDate, endDate) * 100) / 100;
  const totalCredit = Math.round((amount + interestTillFYEnd) * 100) / 100;
  const formulaText = getInterestFormula(amount, borrowing.monthlyInterestRate, borrowDate, endDate);

  return { amount, monthlyInterest, daysTillFYEnd: daysTillEnd, interestTillFYEnd, totalCredit, formulaText };
}

/**
 * Build finalized per-client summary: lendings vs borrowings.
 */
export function getClientFinalized(loans, borrowings) {
  const clientMap = {};

  loans.forEach(loan => {
    const key = loan.clientName.trim().toLowerCase();
    if (!clientMap[key]) {
      clientMap[key] = { clientName: loan.clientName, lendings: [], borrowings: [] };
    }
    clientMap[key].lendings.push(loan);
  });

  borrowings.forEach(b => {
    const key = b.clientName.trim().toLowerCase();
    if (!clientMap[key]) {
      clientMap[key] = { clientName: b.clientName, lendings: [], borrowings: [] };
    }
    clientMap[key].borrowings.push(b);
  });

  return Object.values(clientMap).map(client => {
    const lendingSummaries = client.lendings.map(getLendingSummary);
    const borrowingSummaries = client.borrowings.map(getBorrowingSummary);

    const totalLent = Math.round(lendingSummaries.reduce((s, v) => s + v.principal, 0) * 100) / 100;
    const totalLendingInterest = Math.round(lendingSummaries.reduce((s, v) => s + v.interestTillFYEnd, 0) * 100) / 100;
    const totalLendingDue = Math.round((totalLent + totalLendingInterest) * 100) / 100;

    const totalBorrowed = Math.round(borrowingSummaries.reduce((s, v) => s + v.amount, 0) * 100) / 100;
    const totalBorrowingInterest = Math.round(borrowingSummaries.reduce((s, v) => s + v.interestTillFYEnd, 0) * 100) / 100;
    const totalBorrowingCredit = Math.round((totalBorrowed + totalBorrowingInterest) * 100) / 100;

    const netAmount = Math.round((totalLendingDue - totalBorrowingCredit) * 100) / 100;

    return {
      clientName: client.clientName,
      lendingCount: client.lendings.length,
      borrowingCount: client.borrowings.length,
      totalLent,
      totalLendingInterest,
      totalLendingDue,
      totalBorrowed,
      totalBorrowingInterest,
      totalBorrowingCredit,
      netAmount,
    };
  }).sort((a, b) => a.clientName.localeCompare(b.clientName));
}

/**
 * Calculate the net amount for an org in a given FY.
 * Only considers active, non-carry-forward entries whose date falls in the specified FY.
 * Carry-forward entries are excluded — the cascade is handled separately in useCarryForward.
 * Returns the net: positive = clients owe (lending excess), negative = you owe (borrowing excess).
 */
export function calculateFYNet(loans, borrowings, fyLabel) {
  const fyEnd = fyLabelToEndDate(fyLabel);

  const fyLoans = loans.filter(l => {
    if (l.status !== 'active' || l.isCarryForward) return false;
    const fy = getCurrentFYLabel(toJSDate(l.loanDate));
    return fy === fyLabel;
  });

  const fyBorrowings = borrowings.filter(b => {
    if ((b.status || 'active') !== 'active' || b.isCarryForward) return false;
    const fy = getCurrentFYLabel(toJSDate(b.borrowDate));
    return fy === fyLabel;
  });

  const totalLendingDue = fyLoans.reduce((sum, loan) => {
    const s = getLendingSummary({ ...loan, endDate: loan.endDate || fyEnd });
    return sum + s.totalDue;
  }, 0);

  const totalBorrowingCredit = fyBorrowings.reduce((sum, b) => {
    const s = getBorrowingSummary({ ...b, endDate: b.endDate || fyEnd });
    return sum + s.totalCredit;
  }, 0);

  return Math.round((totalLendingDue - totalBorrowingCredit) * 100) / 100;
}
