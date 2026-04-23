import { getFYEndDate, toJSDate, getCurrentFYLabel, fyLabelToEndDate, getNextFYLabel } from '../../../utils/dateUtils';

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
  const { totalLendingDue, totalBorrowingCredit } = calculateFYTotals(loans, borrowings, fyLabel);
  return Math.round((totalLendingDue - totalBorrowingCredit) * 100) / 100;
}

/**
 * Calculate separate lending and borrowing totals for a given FY.
 * Only considers active, non-carry-forward entries whose date falls in the specified FY.
 */
export function calculateFYTotals(loans, borrowings, fyLabel) {
  const fyEnd = fyLabelToEndDate(fyLabel);

  const fyLoans = loans.filter(l => {
    if (l.isCarryForward) return false;
    const fy = getCurrentFYLabel(toJSDate(l.loanDate));
    return fy === fyLabel;
  });

  const fyBorrowings = borrowings.filter(b => {
    if (b.isCarryForward) return false;
    const fy = getCurrentFYLabel(toJSDate(b.borrowDate));
    return fy === fyLabel;
  });

  const totalLendingDue = Math.round(fyLoans.reduce((sum, loan) => {
    const s = getLendingSummary({ ...loan, endDate: loan.endDate || fyEnd });
    return sum + s.totalDue;
  }, 0) * 100) / 100;

  const totalBorrowingCredit = Math.round(fyBorrowings.reduce((sum, b) => {
    const s = getBorrowingSummary({ ...b, endDate: b.endDate || fyEnd });
    return sum + s.totalCredit;
  }, 0) * 100) / 100;

  return { totalLendingDue, totalBorrowingCredit };
}

const CF_RATE = 0.8;

/**
 * Compute carry-forward balances in-memory from all data.
 * Returns the carry-forward principal and interest entering the current FY,
 * so summary cards can show correct totals without depending on Firestore CF entries.
 */
export function getCarryForwardBalances(loans, borrowings) {
  const currentFY = getCurrentFYLabel();

  // Collect all FYs from non-carry-forward entries
  const fySet = new Set();
  loans.filter(l => !l.isCarryForward).forEach(l => fySet.add(getCurrentFYLabel(toJSDate(l.loanDate))));
  borrowings.filter(b => !b.isCarryForward).forEach(b => fySet.add(getCurrentFYLabel(toJSDate(b.borrowDate))));

  const previousFYs = [...fySet].filter(fy => fy < currentFY).sort();
  if (previousFYs.length === 0) return { lending: { amount: 0, interest: 0 }, borrowing: { amount: 0, interest: 0 } };

  // Fill intermediate FYs for proper cascading
  const allPreviousFYs = [];
  let fy = previousFYs[0];
  while (fy < currentFY) {
    allPreviousFYs.push(fy);
    fy = getNextFYLabel(fy);
  }

  let cfLending = 0;
  let cfBorrowing = 0;

  for (let i = 0; i < allPreviousFYs.length; i++) {
    const fy = allPreviousFYs[i];
    const { totalLendingDue, totalBorrowingCredit } = calculateFYTotals(loans, borrowings, fy);

    cfLending += totalLendingDue;
    cfBorrowing += totalBorrowingCredit;

    // For intermediate FYs, compound interest into the carry-forward principal
    // (the last FY's interest is computed separately below for the current FY)
    if (i < allPreviousFYs.length - 1) {
      const nextFY = getNextFYLabel(fy);
      const fyEnd = fyLabelToEndDate(nextFY);
      const fyStart = new Date(parseInt(nextFY.split('-')[0], 10), 3, 1);
      const daysInFY = Math.ceil((fyEnd.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24));
      const dailyRate = CF_RATE / 30;

      cfLending = cfLending > 0.01
        ? Math.round((cfLending + cfLending * (dailyRate / 100) * daysInFY) * 100) / 100
        : 0;
      cfBorrowing = cfBorrowing > 0.01
        ? Math.round((cfBorrowing + cfBorrowing * (dailyRate / 100) * daysInFY) * 100) / 100
        : 0;
    }
  }

  // cfLending/cfBorrowing = carry-forward principal entering the current FY
  // Now compute the current FY interest on it (from April 1 to March 31)
  const currentFYEnd = fyLabelToEndDate(currentFY);
  const currentFYStart = new Date(parseInt(currentFY.split('-')[0], 10), 3, 1);
  const daysInCurrentFY = Math.ceil((currentFYEnd.getTime() - currentFYStart.getTime()) / (1000 * 60 * 60 * 24));
  const dailyRate = CF_RATE / 30;

  const lendingInterest = cfLending > 0.01
    ? Math.round(cfLending * (dailyRate / 100) * daysInCurrentFY * 100) / 100 : 0;
  const borrowingInterest = cfBorrowing > 0.01
    ? Math.round(cfBorrowing * (dailyRate / 100) * daysInCurrentFY * 100) / 100 : 0;

  return {
    lending: { amount: Math.round(cfLending * 100) / 100, interest: lendingInterest },
    borrowing: { amount: Math.round(cfBorrowing * 100) / 100, interest: borrowingInterest },
  };
}
