import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getCurrentFYLabel, getNextFYLabel, toJSDate, fyLabelToEndDate } from '../utils/dateUtils';
import { calculateFYTotals } from '../modules/lending/utils/lendingCalcs';

const CARRY_FORWARD_RATE = 0.8;

/**
 * Find all carry-forward docs in a collection for a given org.
 * Returns array of { id, ...data } where isCarryForward === true.
 */
async function getCarryForwardDocs(collectionPath) {
  const q = query(
    collection(db, collectionPath),
    where('isCarryForward', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Hook to auto-create/update carry-forward entries across FY boundaries.
 *
 * For each FY transition found in the data, it:
 *   1. Calculates the net for that FY (including any carry-forward entries IN that FY)
 *   2. Creates/updates a carry-forward doc in the next FY
 *   3. Cascades through subsequent FYs
 *
 * @param {string} orgId - selected org (e.g. 'PB')
 * @param {Array} loans - all loans for this org
 * @param {Array} borrowings - all borrowings for this org
 * @param {boolean} canWrite - whether user has write access
 */
export function useCarryForward(orgId, loans, borrowings, canWrite) {
  const processingRef = useRef(false);

  useEffect(() => {
    if (!orgId || !canWrite || processingRef.current) return;
    if (!loans.length && !borrowings.length) return;

    const loansPath = `orgs/${orgId}/loans`;
    const borrowingsPath = `orgs/${orgId}/borrowings`;

    async function processCarryForwards() {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        // Collect all FYs present in the data (excluding carry-forward entries to avoid circular)
        const fySet = new Set();
        loans.forEach(l => {
          if (!l.isCarryForward) fySet.add(getCurrentFYLabel(toJSDate(l.loanDate)));
        });
        borrowings.forEach(b => {
          if (!b.isCarryForward) fySet.add(getCurrentFYLabel(toJSDate(b.borrowDate)));
        });

        // Also include FYs from carry-forward entries' sourceFY
        loans.filter(l => l.isCarryForward).forEach(l => fySet.add(l.sourceFY));
        borrowings.filter(b => b.isCarryForward).forEach(b => fySet.add(b.sourceFY));

        const sortedFYs = [...fySet].sort(); // chronological
        if (sortedFYs.length === 0) return;

        const currentFY = getCurrentFYLabel();

        // Fill in all intermediate FYs up to (but not including) current FY
        const firstFY = sortedFYs[0];
        const allFYs = [firstFY];
        let fy = firstFY;
        while (fy < currentFY) {
          fy = getNextFYLabel(fy);
          if (fy <= currentFY && !allFYs.includes(fy)) {
            allFYs.push(fy);
          }
        }
        // Remove current FY — we only create carry-forwards INTO current FY, not from it
        const fysToProcess = allFYs.filter(f => f < currentFY);

        // Get existing carry-forward docs
        const existingLoanCFs = await getCarryForwardDocs(loansPath);
        const existingBorrowingCFs = await getCarryForwardDocs(borrowingsPath);

        // Deduplicate: if multiple carry-forward docs share the same sourceFY
        // in the same collection, delete the extras (keep only the first)
        const loanCFMap = {};
        for (const cf of existingLoanCFs) {
          if (loanCFMap[cf.sourceFY]) {
            await deleteDoc(doc(db, loansPath, cf.id));
          } else {
            loanCFMap[cf.sourceFY] = cf;
          }
        }
        const borrowingCFMap = {};
        for (const cf of existingBorrowingCFs) {
          if (borrowingCFMap[cf.sourceFY]) {
            await deleteDoc(doc(db, borrowingsPath, cf.id));
          } else {
            borrowingCFMap[cf.sourceFY] = cf;
          }
        }

        // Process each FY in chronological order, tracking carry-forward amounts
        // separately for lending and borrowing so both pages show correct totals
        let pendingLendingCF = 0;
        let pendingBorrowingCF = 0;

        for (const fy of fysToProcess) {
          const nextFY = getNextFYLabel(fy);
          if (nextFY > currentFY) continue;

          // Calculate separate lending and borrowing totals for this FY
          const { totalLendingDue, totalBorrowingCredit } = calculateFYTotals(loans, borrowings, fy);

          // Add any pending carry-forward from previous iteration (cascade)
          const lendingTotal = totalLendingDue + pendingLendingCF;
          const borrowingTotal = totalBorrowingCredit + pendingBorrowingCF;

          const fyEnd = fyLabelToEndDate(nextFY);
          const fyStartDate = new Date(parseInt(nextFY.split('-')[0], 10), 3, 1);
          const daysInFY = Math.ceil((fyEnd.getTime() - fyStartDate.getTime()) / (1000 * 60 * 60 * 24));
          const dailyRate = CARRY_FORWARD_RATE / 30;

          // Process lending carry-forward
          const lendingAmount = Math.round(lendingTotal * 100) / 100;
          if (lendingAmount > 0.01) {
            const interest = lendingAmount * (dailyRate / 100) * daysInFY;
            pendingLendingCF = Math.round((lendingAmount + interest) * 100) / 100;
            await upsertCarryForward(loanCFMap, fy, lendingAmount, true, fyStartDate, fyEnd, loansPath);
          } else {
            pendingLendingCF = 0;
            if (loanCFMap[fy]) {
              await deleteDoc(doc(db, loansPath, loanCFMap[fy].id));
              delete loanCFMap[fy];
            }
          }

          // Process borrowing carry-forward
          const borrowingAmount = Math.round(borrowingTotal * 100) / 100;
          if (borrowingAmount > 0.01) {
            const interest = borrowingAmount * (dailyRate / 100) * daysInFY;
            pendingBorrowingCF = Math.round((borrowingAmount + interest) * 100) / 100;
            await upsertCarryForward(borrowingCFMap, fy, borrowingAmount, false, fyStartDate, fyEnd, borrowingsPath);
          } else {
            pendingBorrowingCF = 0;
            if (borrowingCFMap[fy]) {
              await deleteDoc(doc(db, borrowingsPath, borrowingCFMap[fy].id));
              delete borrowingCFMap[fy];
            }
          }
        }
      } catch (err) {
        console.error('Carry-forward processing error:', err);
      } finally {
        processingRef.current = false;
      }
    }

    processCarryForwards();
  }, [orgId, loans, borrowings, canWrite]);
}

/**
 * Create or update a carry-forward document.
 */
async function upsertCarryForward(cfMap, sourceFY, amount, isLending, startDate, endDate, collectionPath) {
  const existing = cfMap[sourceFY];
  if (existing) {
    const existingAmount = isLending ? existing.principalAmount : existing.amount;
    if (Math.abs(existingAmount - amount) > 0.01) {
      const updateData = isLending
        ? { principalAmount: amount, updatedAt: serverTimestamp() }
        : { amount: amount, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, collectionPath, existing.id), updateData);
    }
  } else {
    const newData = buildCarryForwardDoc(sourceFY, amount, isLending, startDate, endDate);
    const newDoc = await addDoc(collection(db, collectionPath), newData);
    cfMap[sourceFY] = { id: newDoc.id, ...newData };
  }
}

function buildCarryForwardDoc(sourceFY, amount, isLending, startDate, endDate) {
  const base = {
    clientName: `FY ${sourceFY} Balance`,
    monthlyInterestRate: CARRY_FORWARD_RATE,
    endDate: endDate,
    notes: `Auto-generated carry-forward from FY ${sourceFY}`,
    isCarryForward: true,
    sourceFY: sourceFY,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.email || '',
  };

  if (isLending) {
    return { ...base, principalAmount: amount, loanDate: startDate, totalRepaid: 0 };
  } else {
    return { ...base, amount: amount, borrowDate: startDate };
  }
}
