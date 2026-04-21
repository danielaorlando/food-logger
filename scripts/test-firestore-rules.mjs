// Automated attack-path tests for firestore.rules.
// Run with: npm run test:rules (requires emulator on 127.0.0.1:8080).
//
// Each case writes a payload to /foods/{id} as userA and asserts whether
// the rule accepts or rejects it. Covers the 10 scenarios from C1 / Phase 2C.

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const PROJECT_ID = "food-logger-70c31";
const UID_A = "userA";
const UID_B = "userB";
const RUN_ID = Date.now().toString(36);

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

const dbA = testEnv.authenticatedContext(UID_A).firestore();

const base = () => ({
  name: "Apple",
  nameLower: "apple",
  caloriesPer100g: 52,
  submittedBy: UID_A,
  createdAt: serverTimestamp(),
});

const cases = [
  {
    id: "01_valid_full",
    describe: "Valid full doc (required + one optional)",
    payload: { ...base(), proteinPer100g: 10 },
    expect: "allow",
  },
  {
    id: "02_impersonation",
    describe: "submittedBy set to a different UID",
    payload: { ...base(), submittedBy: UID_B },
    expect: "deny",
  },
  {
    id: "03_calories_out_of_range",
    describe: "caloriesPer100g = 99999 (above 2000 cap)",
    payload: { ...base(), caloriesPer100g: 99999 },
    expect: "deny",
  },
  {
    id: "04_calories_wrong_type",
    describe: 'caloriesPer100g = "150" (string, not number)',
    payload: { ...base(), caloriesPer100g: "150" },
    expect: "deny",
  },
  {
    id: "05_name_too_long",
    describe: "name is 5000 chars (above 200 cap)",
    payload: (() => {
      const p = base();
      const big = "a".repeat(5000);
      p.name = big;
      p.nameLower = big;
      return p;
    })(),
    expect: "deny",
  },
  {
    id: "06_nameLower_mismatch",
    describe: 'nameLower = "unrelated" (does not match name.lower())',
    payload: { ...base(), nameLower: "unrelated" },
    expect: "deny",
  },
  {
    id: "07_extra_unknown_field",
    describe: "Contains an extra evil_payload field",
    payload: { ...base(), evil_payload: "xyz" },
    expect: "deny",
  },
  {
    id: "08_missing_required_calories",
    describe: "caloriesPer100g field is absent",
    payload: (() => {
      const p = base();
      delete p.caloriesPer100g;
      return p;
    })(),
    expect: "deny",
  },
  {
    id: "09_barcode_too_short",
    describe: 'barcode = "12345" (5 chars, below 8 min)',
    payload: { ...base(), barcode: "12345" },
    expect: "deny",
  },
  {
    id: "10_protein_negative",
    describe: "proteinPer100g = -5 (below 0)",
    payload: { ...base(), proteinPer100g: -5 },
    expect: "deny",
  },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const ref = doc(dbA, "foods", `${RUN_ID}_${c.id}`);
  try {
    if (c.expect === "allow") {
      await assertSucceeds(setDoc(ref, c.payload));
      console.log(`  PASS  ${c.id}  allow  ${c.describe}`);
    } else {
      await assertFails(setDoc(ref, c.payload));
      console.log(`  PASS  ${c.id}  deny   ${c.describe}`);
    }
    passed++;
  } catch (err) {
    console.log(
      `  FAIL  ${c.id}  expected ${c.expect}  ${c.describe}\n        -> ${err.message}`,
    );
    failed++;
  }
}

console.log(`\n  ${passed}/${cases.length} passed, ${failed} failed.`);

await testEnv.cleanup();
process.exit(failed === 0 ? 0 : 1);
