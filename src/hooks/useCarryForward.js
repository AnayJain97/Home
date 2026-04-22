import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getCurrentFYLabel, getNextFYLabel, toJSDate, fyLabelToEndDate } from '../utils/dateUtils';
import { calculateFYNet } from '../modules/lending/utils/lendingCalcs';

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
        // so the cascade continues through FYs with no original data
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

        // Build a map: sourceFY → carry-forward doc
        const cfMap = {};
        existingLoanCFs.forEach(cf => {
          cfMap[cf.sourceFY] = { ...cf, type: 'lending', path: loansPath };
        });
        existingBorrowingCFs.forEach(cf => {
          cfMap[cf.sourceFY] = { ...cf, type: 'borrowing', path: borrowingsPath };
        });

        // Process each FY in chronological order, tracking carry-forward amounts in-memory
        // so the cascade works within a single pass (newly created docs aren't in loans/borrowings yet)
        let pendingCarryForwardNet = 0; // net amount carried into the current iteration's FY

        for (const fy of fysToProcess) {
          const nextFY = getNextFYLabel(fy);

          // Don't create carry-forward into the future beyond current FY
          if (nextFY > currentFY) continue;

          // Calculate net for this FY from the real data
          const realNet = calculateFYNet(loans, borrowings, fy);

          // Add any pending carry-forward from previous iteration (cascade)
          const net = realNet + pendingCarryForwardNet;

          const existingCF = cfMap[fy]; // carry-forward FROM this FY into the next
          const fyEnd = fyLabelToEndDate(nextFY);
          const fyStartDate = new Date(parseInt(nextFY.split('-')[0], 10), 3, 1);

          if (Math.abs(net) < 0.01) {
            // Net is zero — remove any existing carry-forward
            if (existingCF) {
              await deleteDoc(doc(db, existingCF.path, existingCF.id));
              delete cfMap[fy];
            }
            pendingCarryForwardNet = 0;
            continue;
          }

          const isLending = net > 0;
          const absAmount = Math.round(Math.abs(net) * 100) / 100;

          // Calculate interest on the carry-forward amount for the next FY
          // (from April 1 to March 31 = ~365 days)
          const daysInFY = Math.ceil((fyEnd.getTime() - fyStartDate.getTime()) / (1000 * 60 * 60 * 24));
          const dailyRate = CARRY_FORWARD_RATE / 30;
          const interest = absAmount * (dailyRate / 100) * daysInFY;
          const totalWithInterest = Math.round((absAmount + interest) * 100) / 100;

          // The carry-forward into the NEXT FY's net is this total (with interest) keeping the sign
          pendingCarryForwardNet = isLending ? totalWithInterest : -totalWithInterest;

          if (existingCF) {
            const sameType = (isLending && existingCF.type === 'lending') || (!isLending && existingCF.type === 'borrowing');

            if (sameType) {
              // Same type — check if amount changed
              const existingAmount = existingCF.type === 'lending' ? existingCF.principalAmount : existingCF.amount;
              if (Math.abs(existingAmount - absAmount) > 0.01) {
                // Update amount
                const updateData = existingCF.type === 'lending'
                  ? { principalAmount: absAmount, updatedAt: serverTimestamp() }
                  : { amount: absAmount, updatedAt: serverTimestamp() };
                await updateDoc(doc(db, existingCF.path, existingCF.id), updateData);
              }
            } else {
              // Type flipped — delete old, create new
              await deleteDoc(doc(db, existingCF.path, existingCF.id));
              delete cfMap[fy];

              const newPath = isLending ? loansPath : borrowingsPath;
              const newData = buildCarryForwardDoc(fy, absAmount, isLending, fyStartDate, fyEnd);
              const newDoc = await addDoc(collection(db, newPath), newData);
              cfMap[fy] = { id: newDoc.id, ...newData, type: isLending ? 'lending' : 'borrowing', path: newPath };
            }
          } else {
            // No existing carry-forward — create new
            const newPath = isLending ? loansPath : borrowingsPath;
            const newData = buildCarryForwardDoc(fy, absAmount, isLending, fyStartDate, fyEnd);
            const newDoc = await addDoc(collection(db, newPath), newData);
            cfMap[fy] = { id: newDoc.id, ...newData, type: isLending ? 'lending' : 'borrowing', path: newPath };
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

function buildCarryForwardDoc(sourceFY, amount, isLending, startDate, endDate) {
  const base = {
    clientName: `FY ${sourceFY} Balance`,
    monthlyInterestRate: CARRY_FORWARD_RATE,
    endDate: endDate,
    notes: `Auto-generated carry-forward from FY ${sourceFY}`,
    status: 'active',
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
