// ── CYCLE TREATMENT CONTEXT ─────────────────────────────────────────────
// A visit record answers "what were the numbers on this day". This module
// answers "what kind of cycle was this" — the protocol, the drugs, the
// timed events, and how it ended. Without it a chart of E2 or progesterone
// can't be read properly: a stimulated cycle runs far above the natural-
// cycle reference bands the charts are drawn against, and that's expected
// rather than abnormal.
//
// Keyed by cycle label (the same string visits carry), so it layers on top
// of the existing visit store without changing a single visit record.

import { daysBetween } from "./utils.js";

// `medicated` drives the "these bands assume a natural cycle" caveat the
// dashboard shows — it is about whether the ovaries were being driven by
// drugs, not about whether any drug at all was taken.
export const CYCLE_TYPES = [
  { id: "",                 label: "Not set",                     short: "—",              medicated: false },
  { id: "natural",          label: "Natural / unmedicated",       short: "Natural",        medicated: false },
  { id: "monitoring",       label: "Baseline / monitoring only",  short: "Monitoring",     medicated: false },
  { id: "letrozole",        label: "Letrozole (oral)",            short: "Letrozole",      medicated: true },
  { id: "clomid",           label: "Clomid / clomiphene (oral)",  short: "Clomid",         medicated: true },
  { id: "oral-iui",         label: "Oral + IUI",                  short: "Oral + IUI",     medicated: true },
  { id: "gonadotropin-iui", label: "Gonadotropin + IUI",          short: "Gonadotropin IUI", medicated: true },
  { id: "ivf-stim",         label: "IVF stimulation",             short: "IVF stim",       medicated: true },
  { id: "fet",              label: "FET prep (frozen transfer)",  short: "FET prep",       medicated: true },
  { id: "other",            label: "Other / mixed protocol",      short: "Other",          medicated: true },
];

export function cycleTypeInfo(id) {
  return CYCLE_TYPES.find((t) => t.id === (id || "")) || CYCLE_TYPES[0];
}
export function isMedicatedCycle(record) {
  return !!record && cycleTypeInfo(record.cycleType).medicated;
}

// Dated events worth marking on the cycle-day charts. `trigger` also carries
// a type and a clock time, since trigger timing is counted in hours — the
// retrieval or IUI that follows is scheduled off it.
export const CYCLE_EVENTS = [
  { key: "opkPositive", label: "Positive OPK / LH surge", short: "OPK+" },
  { key: "trigger",     label: "Trigger shot",            short: "Trigger" },
  { key: "iui",         label: "IUI",                     short: "IUI" },
  { key: "retrieval",   label: "Egg retrieval",           short: "Retrieval" },
  { key: "transfer",    label: "Embryo transfer",         short: "Transfer" },
];

// The attrition chain an REI reads top to bottom after a retrieval: how many
// eggs came out, how many were mature enough to inject, how many fertilized,
// how many made it to blastocyst, and how many of those were genetically
// normal. Each step is a fraction of the one above it.
export const OUTCOME_COUNTS = [
  { key: "eggsRetrieved", label: "Eggs retrieved",     short: "Retrieved" },
  { key: "eggsMature",    label: "Mature (MII)",       short: "MII" },
  { key: "fertilized",    label: "Fertilized (2PN)",   short: "2PN" },
  { key: "blastocysts",   label: "Blastocysts",        short: "Blasts" },
  { key: "pgtNormal",     label: "PGT-A euploid",      short: "Euploid" },
  { key: "pgtAbnormal",   label: "PGT-A aneuploid",    short: "Aneuploid" },
  { key: "pgtMosaic",     label: "PGT-A mosaic",       short: "Mosaic" },
];

export const CYCLE_RESULTS = [
  { id: "",                   label: "Not set" },
  { id: "in-progress",        label: "In progress" },
  { id: "cancelled",          label: "Cancelled" },
  { id: "freeze-all",         label: "Freeze-all (no transfer)" },
  { id: "not-pregnant",       label: "Not pregnant" },
  { id: "chemical",           label: "Chemical pregnancy" },
  { id: "clinical-pregnancy", label: "Clinical pregnancy" },
  { id: "ongoing",            label: "Ongoing pregnancy" },
  { id: "miscarriage",        label: "Miscarriage" },
  { id: "ectopic",            label: "Ectopic" },
  { id: "live-birth",         label: "Live birth" },
];
export function cycleResultLabel(id) {
  return (CYCLE_RESULTS.find((r) => r.id === (id || "")) || CYCLE_RESULTS[0]).label;
}

export function emptyCycleRecord() {
  const events = {};
  CYCLE_EVENTS.forEach((e) => { events[e.key] = ""; });
  const outcome = { result: "", notes: "" };
  OUTCOME_COUNTS.forEach((c) => { outcome[c.key] = ""; });
  return {
    cycleType: "",
    medications: [],
    triggerType: "",
    triggerTime: "",
    lutealSupport: "",
    events,
    betas: [],
    outcome,
    notes: "",
  };
}

let medIdCounter = 0;
export function newMedication() {
  medIdCounter += 1;
  return { id: `med-${Date.now()}-${medIdCounter}`, name: "", dose: "", startDay: "", endDay: "" };
}
let betaIdCounter = 0;
export function newBeta() {
  betaIdCounter += 1;
  return { id: `beta-${Date.now()}-${betaIdCounter}`, date: "", value: "" };
}

// Imported backups and hand-edited localStorage can hold anything, so every
// record is rebuilt field by field on the way in. Unknown keys are dropped
// and missing ones fall back to the empty record's shape, which means the UI
// never has to guard against a half-formed record.
export function normalizeCycleRecord(raw) {
  const base = emptyCycleRecord();
  if (!raw || typeof raw !== "object") return base;
  const str = (v) => (v === null || v === undefined ? "" : String(v));

  base.cycleType = cycleTypeInfo(raw.cycleType).id;
  base.triggerType = str(raw.triggerType);
  base.triggerTime = str(raw.triggerTime);
  base.lutealSupport = str(raw.lutealSupport);
  base.notes = str(raw.notes);

  if (Array.isArray(raw.medications)) {
    base.medications = raw.medications
      .filter((m) => m && typeof m === "object")
      .map((m, i) => ({
        id: str(m.id) || `med-import-${i}`,
        name: str(m.name), dose: str(m.dose),
        startDay: str(m.startDay), endDay: str(m.endDay),
      }));
  }
  if (raw.events && typeof raw.events === "object") {
    CYCLE_EVENTS.forEach((e) => { base.events[e.key] = str(raw.events[e.key]); });
  }
  if (Array.isArray(raw.betas)) {
    base.betas = raw.betas
      .filter((b) => b && typeof b === "object")
      .map((b, i) => ({ id: str(b.id) || `beta-import-${i}`, date: str(b.date), value: str(b.value) }));
  }
  if (raw.outcome && typeof raw.outcome === "object") {
    OUTCOME_COUNTS.forEach((c) => { base.outcome[c.key] = str(raw.outcome[c.key]); });
    base.outcome.result = (CYCLE_RESULTS.find((r) => r.id === raw.outcome.result) || CYCLE_RESULTS[0]).id;
    base.outcome.notes = str(raw.outcome.notes);
  }
  return base;
}

// True when nothing has been filled in — used to decide whether a rename may
// overwrite a record, and whether to show a cycle in the comparison table.
export function isBlankCycleRecord(record) {
  if (!record) return true;
  const r = normalizeCycleRecord(record);
  if (r.cycleType || r.triggerType || r.triggerTime || r.lutealSupport || r.notes) return false;
  if (r.medications.some((m) => m.name || m.dose || m.startDay || m.endDay)) return false;
  if (r.betas.some((b) => b.date || b.value)) return false;
  if (CYCLE_EVENTS.some((e) => r.events[e.key])) return false;
  if (r.outcome.result || r.outcome.notes) return false;
  if (OUTCOME_COUNTS.some((c) => r.outcome[c.key])) return false;
  return true;
}

// ── STORAGE ─────────────────────────────────────────────────────────────
// Same browser-local localStorage as the visit store, under its own key so
// the two can be read and written independently.
export const CYCLES_KEY = "fertility-tracker:cycles";

export async function storeGetCycles() {
  try {
    const raw = window.localStorage.getItem(CYCLES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    Object.entries(parsed).forEach(([label, rec]) => { out[label] = normalizeCycleRecord(rec); });
    return out;
  } catch {
    return {};
  }
}
export async function storeSaveCycles(map) {
  try {
    window.localStorage.setItem(CYCLES_KEY, JSON.stringify(map || {}));
  } catch (err) {
    throw new Error("Storage write failed: " + err.message);
  }
}
export async function storePutCycle(label, record) {
  const all = await storeGetCycles();
  all[label] = normalizeCycleRecord(record);
  await storeSaveCycles(all);
}

// Keeps cycle records in step with a visit-label rename. Two filled records
// can't be merged into a coherent one (whose trigger? whose outcome?), so a
// rename onto a label that already has real treatment data keeps the target's
// record and reports the source as discarded, letting the caller say so
// rather than losing it silently.
export async function storeRenameCycleRecord(oldLabel, newLabel) {
  const all = await storeGetCycles();
  const source = all[oldLabel];
  if (!source) return { moved: false, discarded: false };
  const targetIsBlank = !all[newLabel] || isBlankCycleRecord(all[newLabel]);
  const sourceIsBlank = isBlankCycleRecord(source);
  delete all[oldLabel];
  if (targetIsBlank) {
    all[newLabel] = source;
    await storeSaveCycles(all);
    return { moved: true, discarded: false };
  }
  await storeSaveCycles(all);
  return { moved: false, discarded: !sourceIsBlank };
}

export async function storeClearCycles() { await storeSaveCycles({}); }

// ── DERIVED SUMMARIES ───────────────────────────────────────────────────
// Serial betas are judged by how fast they rise, not by either value alone.
// Returns the doubling time in days: t · ln2 / ln(v2/v1). Null when the pair
// can't produce one — same-day draws, a flat or falling value, bad input.
export function betaDoublingTimeDays(first, second) {
  if (!first || !second) return null;
  const days = daysBetween(first.date, second.date);
  if (days === null || days <= 0) return null;
  const v1 = Number(first.value);
  const v2 = Number(second.value);
  if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 <= 0 || v2 <= v1) return null;
  return (days * Math.LN2) / Math.log(v2 / v1);
}

// Betas in date order, each annotated with the doubling time from the draw
// before it. Undated or non-numeric rows are dropped rather than sorted to
// an arbitrary position.
export function summarizeBetas(betas) {
  const rows = (betas || [])
    .filter((b) => b && b.date && b.value !== "" && Number.isFinite(Number(b.value)))
    .map((b) => ({ ...b, value: Number(b.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return rows.map((row, i) => ({
    ...row,
    doublingDays: i === 0 ? null : betaDoublingTimeDays(rows[i - 1], row),
  }));
}

// Cycle-level lab highlights pulled from the visits themselves, so the
// comparison table can put the protocol next to what the ovaries actually
// did. Peak values are what a stimulation cycle is judged on; day-3 FSH is
// the baseline it started from.
export function summarizeCycleLabs(visits, cycleLabel) {
  const mine = (visits || []).filter((v) => v && v.cycleLabel === cycleLabel);
  const peak = (key) => {
    const vals = mine.map((v) => v[key]).filter((n) => n !== null && n !== undefined && Number.isFinite(Number(n))).map(Number);
    return vals.length ? Math.max(...vals) : null;
  };
  // "Day 3" in practice means the early-cycle baseline draw, days 2–4.
  const baseline = mine
    .filter((v) => Number(v.cycleDay) >= 2 && Number(v.cycleDay) <= 4 && Number.isFinite(Number(v.fsh)))
    .sort((a, b) => Number(a.cycleDay) - Number(b.cycleDay))[0];
  return {
    visitCount: mine.length,
    peakE2: peak("e2"),
    peakEndo: peak("endo"),
    peakFollicle: peak("follicle"),
    peakProgesterone: peak("pgn"),
    baselineFsh: baseline ? Number(baseline.fsh) : null,
  };
}
