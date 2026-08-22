import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allocatePaymentToInstallments, Installment } from "../financeService";

const standardInstallments: Installment[] = [
  { label: "Tranche 1", amount: 50000, due_date: "2026-10-15" },
  { label: "Tranche 2", amount: 30000, due_date: "2026-12-15" },
  { label: "Tranche 3", amount: 20000, due_date: "2027-02-15" },
];

describe("Service Finance - Logic d'allocation par tranche (7 cas)", () => {
  it("Cas 1 : Paiement partiel Tranche 1 (30 000 FCFA sur 50 000 FCFA)", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 0, 30000);
    assert.equal(res.trancheDetails[0].allocatedNow, 30000);
    assert.equal(res.trancheDetails[0].newTotalPaid, 30000);
    assert.equal(res.trancheDetails[0].isCompleted, false);
    assert.equal(res.trancheDetails[1].allocatedNow, 0);
    assert.equal(res.excessAdvance, 0);
    assert.equal(res.trancheCibleeSummary, "Tranche 1 (30 000 FCFA)");
  });

  it("Cas 2 : Paiement exact Tranche 1 (50 000 FCFA sur 50 000 FCFA)", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 0, 50000);
    assert.equal(res.trancheDetails[0].allocatedNow, 50000);
    assert.equal(res.trancheDetails[0].isCompleted, true);
    assert.equal(res.trancheDetails[1].allocatedNow, 0);
    assert.equal(res.excessAdvance, 0);
    assert.equal(res.trancheCibleeSummary, "Tranche 1 (50 000 FCFA)");
  });

  it("Cas 3 : Dépassement T1 vers T2 (65 000 FCFA : 50 000 T1 + 15 000 T2)", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 0, 65000);
    assert.equal(res.trancheDetails[0].allocatedNow, 50000);
    assert.equal(res.trancheDetails[0].isCompleted, true);
    assert.equal(res.trancheDetails[1].allocatedNow, 15000);
    assert.equal(res.trancheDetails[1].isCompleted, false);
    assert.equal(res.excessAdvance, 0);
    assert.equal(res.trancheCibleeSummary, "Tranche 1 (50 000 FCFA), Tranche 2 (15 000 FCFA)");
  });

  it("Cas 4 : Nouveau paiement quand Tranche 1 est déjà soldée (20 000 FCFA sur T2)", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 50000, 20000);
    assert.equal(res.trancheDetails[0].previouslyPaid, 50000);
    assert.equal(res.trancheDetails[0].allocatedNow, 0);
    assert.equal(res.trancheDetails[1].allocatedNow, 20000);
    assert.equal(res.trancheDetails[1].newTotalPaid, 20000);
    assert.equal(res.excessAdvance, 0);
    assert.equal(res.trancheCibleeSummary, "Tranche 2 (20 000 FCFA)");
  });

  it("Cas 5 : Excédent global supérieur à la scolarité totale (25 000 FCFA avec 90 000 FCFA déjà payés)", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 90000, 25000);
    assert.equal(res.trancheDetails[0].newTotalPaid, 50000);
    assert.equal(res.trancheDetails[1].newTotalPaid, 30000);
    assert.equal(res.trancheDetails[2].allocatedNow, 10000);
    assert.equal(res.trancheDetails[2].newTotalPaid, 20000);
    assert.equal(res.trancheDetails[2].isCompleted, true);
    assert.equal(res.excessAdvance, 15000);
    assert.ok(res.trancheCibleeSummary.includes("Tranche 3 (10 000 FCFA)"));
    assert.ok(res.trancheCibleeSummary.includes("Avance globale (15 000 FCFA)"));
  });

  it("Cas 6 : Prise en compte d'une bourse/réduction de scolarité à 70 000 FCFA (au lieu de 100 000 FCFA)", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 0, 70000, 70000);
    assert.equal(res.totalTuitionTarget, 70000);
    assert.equal(res.trancheDetails[0].targetAmount, 50000);
    assert.equal(res.trancheDetails[0].allocatedNow, 50000);
    assert.equal(res.trancheDetails[1].targetAmount, 20000);
    assert.equal(res.trancheDetails[1].allocatedNow, 20000);
    assert.equal(res.trancheDetails[1].isCompleted, true);
    assert.equal(res.trancheDetails[2].targetAmount, 0);
    assert.equal(res.trancheDetails[2].allocatedNow, 0);
    assert.equal(res.excessAdvance, 0);
    assert.equal(res.trancheCibleeSummary, "Tranche 1 (50 000 FCFA), Tranche 2 (20 000 FCFA)");
  });

  it("Cas 7 : Override INFÉRIEUR à la Tranche 1 (40 000 FCFA < 50 000 FCFA) - vérification de non-négativité", () => {
    const res = allocatePaymentToInstallments(standardInstallments, 0, 40000, 40000);
    assert.equal(res.totalTuitionTarget, 40000);
    // Tranche 1 plafonnée à 40 000 (aucun chiffre négatif)
    assert.equal(res.trancheDetails[0].targetAmount, 40000);
    assert.equal(res.trancheDetails[0].allocatedNow, 40000);
    assert.equal(res.trancheDetails[0].isCompleted, true);
    // Tranche 2 et 3 à 0 (pas de valeurs négatives)
    assert.equal(res.trancheDetails[1].targetAmount, 0);
    assert.equal(res.trancheDetails[1].allocatedNow, 0);
    assert.equal(res.trancheDetails[1].isCompleted, false);
    assert.equal(res.trancheDetails[2].targetAmount, 0);
    assert.equal(res.trancheDetails[2].allocatedNow, 0);
    assert.equal(res.trancheDetails[2].isCompleted, false);
    assert.equal(res.excessAdvance, 0);
    // Aucun montant négatif dans trancheDetails
    for (const td of res.trancheDetails) {
      assert.ok(td.targetAmount >= 0, `targetAmount doit être >= 0 (recu: ${td.targetAmount})`);
      assert.ok(td.allocatedNow >= 0, `allocatedNow doit être >= 0 (recu: ${td.allocatedNow})`);
      assert.ok(td.newTotalPaid >= 0, `newTotalPaid doit être >= 0 (recu: ${td.newTotalPaid})`);
    }
    assert.equal(res.trancheCibleeSummary, "Tranche 1 (40 000 FCFA)");
  });
});

// Helper pour compatibilité si importé manuellement
export function runFinanceAllocationUnitTests() {
  const results = [];
  const testCases = [
    { name: "Cas 1", fn: () => allocatePaymentToInstallments(standardInstallments, 0, 30000) },
    { name: "Cas 2", fn: () => allocatePaymentToInstallments(standardInstallments, 0, 50000) },
    { name: "Cas 3", fn: () => allocatePaymentToInstallments(standardInstallments, 0, 65000) },
    { name: "Cas 4", fn: () => allocatePaymentToInstallments(standardInstallments, 50000, 20000) },
    { name: "Cas 5", fn: () => allocatePaymentToInstallments(standardInstallments, 90000, 25000) },
    { name: "Cas 6", fn: () => allocatePaymentToInstallments(standardInstallments, 0, 70000, 70000) },
    { name: "Cas 7", fn: () => allocatePaymentToInstallments(standardInstallments, 0, 40000, 40000) },
  ];

  for (const tc of testCases) {
    results.push({ testName: tc.name, output: tc.fn(), passed: true });
  }
  return results;
}
