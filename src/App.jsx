import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer, BarChart, Bar, LabelList
} from "recharts";

// ── TOKENS ───────────────────────────────────────────────────────────────
const ink      = "#1C2B3A";
const paper    = "#F6F5F1";
const panel    = "#FFFFFF";
const hair     = "#D8D3C7";
const sage     = "#7C9A82";
const sageDeep = "#4F6D57";
const amber    = "#C98A2B";
const rust     = "#B5482F";
const CYCLE_PALETTE = ["#3B5B7A", "#4F6D57", "#C98A2B", "#B5482F", "#7C6A9A", "#4A8A8C", "#9A6B4A"];

const DAY_MAX = 32;
const PHASES = [
  { label: "Follicular", x1: 1, x2: 12, fill: "#E7E7E4", textColor: "#6B6456" },
  { label: "Ovulatory",  x1: 12, x2: 16, fill: "#EDE6D3", textColor: "#8A6D2A" },
  { label: "Luteal",     x1: 16, x2: DAY_MAX, fill: "#DCE3DC", textColor: "#4A6650" },
];

// ── FIELD METADATA (shared by entry grid, saved table, and charts) ──────
const HORMONE_FIELDS = [
  { key: "fsh",      label: "FSH",          short: "FSH",     unit: "mIU/mL" },
  { key: "lh",       label: "LH",           short: "LH",      unit: "mIU/mL" },
  { key: "e2",       label: "Estradiol",    short: "E2",      unit: "pg/mL" },
  { key: "pgn",      label: "Progesterone", short: "PGN",     unit: "ng/mL" },
  { key: "endo",     label: "Endometrium",  short: "Endo",    unit: "mm" },
  { key: "follicle", label: "Lead follicle",short: "Follic.", unit: "mm" },
  { key: "afcR",     label: "AFC (right)",  short: "AFC R",   unit: "count" },
  { key: "afcL",     label: "AFC (left)",   short: "AFC L",   unit: "count" },
  { key: "amh",      label: "AMH",          short: "AMH",     unit: "ng/mL" },
  { key: "tsh",      label: "TSH",          short: "TSH",     unit: "uIU/mL" },
];

const FIELD_LABELS_SHORT = { date: "Date", cycleLabel: "Cycle", cycleDay: "Day", notes: "Notes" };
HORMONE_FIELDS.forEach((h) => { FIELD_LABELS_SHORT[h.key] = h.short; });

const EMPTY_DRAFT_FIELDS = { date: "", cycleLabel: "", cycleDay: "", notes: "" };
HORMONE_FIELDS.forEach((h) => { EMPTY_DRAFT_FIELDS[h.key] = ""; });

// ── HORMONE GUIDE CONTENT ─────────────────────────────────────────────────
const HORMONE_GUIDE = {
  fsh: {
    color: CYCLE_PALETTE[0], label: "FSH",
    question: "What does FSH do, and how can you support it?",
    what: "Produced by the pituitary gland, FSH stimulates the ovaries each month to develop a cohort of follicles — the fluid-filled sacs containing eggs. It is the pituitary's primary signal to the ovaries and is highest early in the follicular phase, when it's needed to recruit follicles.",
    fertility: "Basal (day 2–4) FSH is the key ovarian reserve marker. A high early-cycle FSH means the pituitary is working harder than normal to stimulate the ovaries — a signal they are less responsive. In women under 35, day-3 FSH above 10 mIU/mL is a commonly used flag for diminished ovarian reserve. Note: if day-3 E2 is elevated (>80 pg/mL), it suppresses FSH — making FSH look falsely normal.",
    optimal: [
      { phase: "Menstrual / early follicular (day 1–5)", range: "3–8 mIU/mL", note: "Ideal basal reading" },
      { phase: "Follicular (day 5–12)", range: "3–10 mIU/mL", note: ">10 is a DOR concern under 35" },
      { phase: "Ovulatory (day 12–16)", range: "4–13 mIU/mL", note: "Rises slightly at LH surge" },
      { phase: "Luteal (day 16+)", range: "1.5–7 mIU/mL", note: "Falls after ovulation" },
    ],
    tips: [
      "CoQ10 (600mg/day) supports mitochondrial function in follicles and may improve ovarian response, indirectly reducing compensatory FSH rise.",
      "DHEA (25–75mg/day under supervision) has shown FSH reduction in women with DOR — discuss with your RE.",
      "Vitamin D: target serum 25-OH-D of 40–60 ng/mL. Deficiency correlates with elevated FSH and poor ovarian response.",
      "Reduce alcohol — even moderate intake stresses the HPO axis and raises FSH.",
      "Avoid excessive high-intensity exercise if FSH is elevated — overtraining suppresses ovarian function.",
      "Acupuncture has shown modest FSH reduction in small RCTs and is low-risk alongside medical treatment.",
    ],
  },
  lh: {
    color: CYCLE_PALETTE[1], label: "LH",
    question: "What does LH do, and how can you support it?",
    what: "LH is also made by the pituitary. It works alongside FSH throughout the follicular phase to support follicle development, and then surges sharply at mid-cycle — this LH surge is the direct trigger for ovulation, causing the dominant follicle to release its egg within 36–40 hours. After ovulation, LH supports the corpus luteum.",
    fertility: "An inadequate LH surge (below ~20 mIU/mL) may fail to trigger ovulation. An LH:FSH ratio above 2:1 on day 3 can indicate PCOS. A persistently elevated LH after ovulation can suggest a luteinized unruptured follicle (LUF), where the follicle never actually released the egg despite hormonal signals.",
    optimal: [
      { phase: "Menstrual / early follicular (day 1–5)", range: "2–6 mIU/mL", note: "Should be near or below FSH" },
      { phase: "Follicular (day 5–12)", range: "2–8 mIU/mL", note: "Low and steady before the surge" },
      { phase: "Ovulatory surge (day 12–16)", range: "20–80 mIU/mL", note: "Surge triggers egg release" },
      { phase: "Luteal (day 16+)", range: "1–8 mIU/mL", note: "Should drop sharply post-ovulation" },
    ],
    tips: [
      "Myo-inositol (2–4g/day) supports healthy LH pulsatility — well-evidenced for ovulatory disorders and improving hormonal balance.",
      "Vitamin B6 (25–50mg/day) modulates LH/FSH signaling and supports progesterone production post-ovulation.",
      "Maintain a healthy BMI (18.5–24.9) — both over- and underweight disrupt LH pulsatility from the hypothalamus.",
      "Reduce BPA exposure (plastics, receipts) — xenoestrogens disrupt LH signaling at the pituitary level.",
      "Prioritize sleep: LH is released in pulses overnight, and poor sleep directly blunts LH pulse amplitude.",
      "Stress management: elevated cortisol suppresses GnRH → blunts LH. HRV tracking, therapy, and breathwork all have evidence.",
    ],
  },
  e2: {
    color: CYCLE_PALETTE[2], label: "Estradiol",
    question: "What does estradiol do, and how can you support it?",
    what: "Estradiol is the dominant estrogen in reproductive-age women, produced primarily by growing follicles. It rises steadily through the follicular phase as follicles develop, peaks sharply just before ovulation (the estrogen surge), then maintains a moderate level through the luteal phase to keep the uterine lining supportive for implantation.",
    fertility: "Day-3 E2 above 60–80 pg/mL suppresses FSH — a 'normal' FSH alongside a high E2 may be misleading. The pre-ovulatory peak (150–400 pg/mL) reflects follicle quality and maturity; a blunted peak suggests a poorly-developed lead follicle. Low mid-luteal E2 (under 100 pg/mL) contributes to thin lining and poor implantation conditions.",
    optimal: [
      { phase: "Menstrual / early follicular (day 1–5)", range: "20–50 pg/mL", note: "Should be at its cycle low" },
      { phase: "Follicular (day 5–12)", range: "30–80 pg/mL", note: ">80 on day 3 suppresses FSH" },
      { phase: "Pre-ovulatory peak (day 12–14)", range: "150–400 pg/mL", note: "Reflects lead follicle maturity" },
      { phase: "Luteal (day 16+)", range: "100–200 pg/mL", note: "Supports uterine lining" },
    ],
    tips: [
      "Eat cruciferous vegetables daily (broccoli, cauliflower, kale) — DIM and I3C support healthier estrogen metabolism and clearance.",
      "Ground flaxseed (1–2 tbsp/day) provides lignans that promote balanced estrogen metabolite ratios.",
      "Minimize alcohol — the liver metabolizes estrogen; alcohol impairs this and raises circulating E2.",
      "Magnesium glycinate (300–400mg/day) supports liver detox pathways for estrogen metabolites.",
      "Reduce xenoestrogen exposure: glass food storage, filtered water, fragrance-free personal care products.",
      "If mid-luteal E2 is low, vaginal estradiol is a common evidence-based option alongside progesterone — worth discussing with your RE.",
    ],
  },
  pgn: {
    color: CYCLE_PALETTE[3], label: "Progesterone",
    question: "What does progesterone do, and how can you support it?",
    what: "Progesterone is produced by the corpus luteum — the structure that forms at the ovulation site after the egg is released. It transforms the uterine lining from a proliferative state into a secretory, receptive environment for embryo implantation, and is essential for maintaining early pregnancy until the placenta takes over at ~10 weeks.",
    fertility: "Day-21 progesterone is the gold-standard test that ovulation occurred and the corpus luteum is functioning. Above 10 ng/mL confirms adequate ovulation; below 5 ng/mL suggests anovulation or luteal phase deficiency (LPD), which is directly linked to implantation failure. On stimulated cycles (e.g. Letrozole + hCG trigger), progesterone often runs higher than in natural cycles.",
    optimal: [
      { phase: "Follicular (day 1–12)", range: "<1 ng/mL", note: "Should be near zero pre-ovulation" },
      { phase: "Peri-ovulatory (day 12–16)", range: "1–6 ng/mL", note: "Begins rising as follicle ruptures" },
      { phase: "Luteal (day 16+)", range: "10–20 ng/mL", note: "Conception cycles average ~12.8 ng/mL" },
    ],
    tips: [
      "Vitamin B6 (25–50mg/day) is directly involved in progesterone synthesis — one of the best-supported supplements for luteal support.",
      "Vitex / chasteberry (400mg/day) stimulates LH release and supports the corpus luteum — takes 3+ cycles to work, evidence is moderate.",
      "Zinc (15–25mg/day) supports progesterone receptor sensitivity and corpus luteum function.",
      "Avoid NSAIDs (ibuprofen, naproxen) around ovulation — they can impair corpus luteum formation and progesterone output.",
      "Eat enough dietary fat: progesterone is cholesterol-derived, and very low-fat diets can suppress luteal progesterone production.",
      "Progesterone suppositories (e.g. Endometrin/Prometrium) are the most direct, evidence-based luteal support if levels run low — discuss with your RE.",
    ],
  },
  follicle: {
    color: amber, label: "Lead follicle size",
    question: "What does lead follicle size mean, and how can you support healthy growth?",
    what: "The lead (or dominant) follicle is the largest fluid-filled sac growing in the ovary each cycle, containing the egg that's most likely to be released at ovulation. It's measured by ultrasound as an average diameter in millimeters. In a natural cycle, one follicle typically outpaces the rest starting mid-follicular phase; in a medicated cycle, the goal is usually one or two follicles reaching maturity together.",
    fertility: "Follicle size tracks maturity, not just presence — a follicle needs to reach roughly 18–24mm before the egg inside is ready to be released. Triggering ovulation too early risks retrieving or releasing an immature egg; triggering too late risks the follicle over-maturing or spontaneously ovulating before a planned IUI or retrieval. Growth is usually tracked every 1–3 days once a lead follicle emerges (~10–12mm), specifically to time the trigger shot correctly.",
    optimal: [
      { phase: "Early recruitment (day 3–7)", range: "<10mm", note: "Cohort of small antral follicles" },
      { phase: "Mid-follicular (day 8–11)", range: "10–14mm", note: "Lead follicle begins to emerge" },
      { phase: "Late follicular (day 11–13)", range: "14–18mm", note: "Growth ~1–2mm/day on stimulation" },
      { phase: "Trigger-ready (day 12–14+)", range: "18–24mm", note: "Standard threshold for hCG trigger" },
    ],
    tips: [
      "CoQ10 (600mg/day) supports the energy-intensive process of follicle maturation and may improve egg quality within a growing follicle.",
      "Consistent stimulation-medication timing (same time each day) helps follicles grow evenly and predictably.",
      "Adequate hydration and protein intake support follicular fluid volume and granulosa cell function during rapid growth phases.",
      "Don't miss monitoring appointments near the trigger window — growth can accelerate to 1–2mm/day, and mistimed triggers are a common preventable cause of a cancelled or suboptimal cycle.",
      "Reduce alcohol and smoking — both are associated with slower follicular growth and lower oocyte yield in stimulated cycles.",
      "Moderate, regular exercise supports healthy blood flow to the ovaries; avoid very high-intensity training during active stimulation.",
    ],
  },
  endo: {
    color: sageDeep, label: "Endometrial thickness",
    question: "What does endometrial thickness mean, and how can you support a healthy lining?",
    what: "The endometrium is the uterine lining that thickens each cycle in response to rising estradiol, then becomes receptive to an embryo under the influence of progesterone after ovulation. It's measured by ultrasound at its widest point, and pattern matters too — a 'trilaminar' or triple-line appearance seen pre-ovulation is considered the most implantation-favorable.",
    fertility: "A pre-ovulatory lining under roughly 7mm is associated with lower implantation rates, though pregnancies do occur below this threshold. After ovulation, the lining should transition from trilaminar to a more uniform, echogenic (brighter) appearance as progesterone takes over. A lining that stays thin or fails to transition can be a sign of inadequate estrogen exposure, scar tissue, or chronic endometritis.",
    optimal: [
      { phase: "Menstrual (day 1–5)", range: "2–4mm", note: "Lining is shed and at its thinnest" },
      { phase: "Follicular (day 5–12)", range: "5–9mm", note: "Steady growth tracking with rising E2" },
      { phase: "Pre-ovulatory (day 12–16)", range: "≥7mm, trilaminar", note: "Target for good implantation odds" },
      { phase: "Luteal (day 16+)", range: "8–14mm, echogenic", note: "Should lose triple-line pattern" },
    ],
    tips: [
      "Vaginal estradiol is one of the most direct, evidence-based options for a thin lining — discuss with your RE.",
      "L-arginine (3–6g/day) has some evidence for improving uterine blood flow and lining thickness, though evidence is more limited than estrogen supplementation.",
      "Low-dose aspirin (81mg/day) is sometimes used to support uterine blood flow — only under medical guidance.",
      "Acupuncture around the follicular phase has modest evidence for improving uterine blood flow and lining receptivity.",
      "Address any underlying uterine cavity issues (adhesions, polyps, chronic endometritis) directly with your RE — these can cap lining growth regardless of hormone support.",
      "Stay well hydrated and maintain regular light cardiovascular exercise, both of which support general pelvic blood flow.",
    ],
  },
  reserve: {
    color: amber, label: "Ovarian reserve",
    question: "What do AMH, AFC, and TSH mean for ovarian reserve, and how can you support it?",
    what: "Ovarian reserve describes the quantity (not quality) of eggs remaining, estimated with three complementary markers: AMH (Anti-Müllerian Hormone), a blood test reflecting the pool of small, growing follicles, stable at any point in the cycle; AFC (Antral Follicle Count), a same-cycle ultrasound count of small follicles in both ovaries, typically done early-cycle; and TSH (thyroid-stimulating hormone), tracked as a fertility co-factor since thyroid dysfunction can independently affect ovulation and early pregnancy.",
    fertility: "AMH and AFC generally track together and both decline with age, but they can diverge cycle to cycle. Neither marker predicts egg quality or the chance of natural conception directly; they mainly inform how an ovary is likely to respond to stimulation medication. A 'diminished ovarian reserve' diagnosis based on borderline-low AMH/AFC generally means a somewhat reduced but not necessarily poor response to stimulation is expected — it does not mean pregnancy isn't possible. TSH above 2.5 uIU/mL is a commonly used (though debated) TTC-specific target, stricter than the general lab reference range.",
    optimal: [
      { phase: "AMH (any cycle day)", range: "≥1.5 ng/mL", note: "<1.0 ng/mL is a DOR concern" },
      { phase: "AFC (early cycle, day 2–5)", range: "10–20 follicles", note: "7–9 = low-normal; <7 = DOR" },
      { phase: "TSH (any cycle day)", range: "≤2.5 uIU/mL", note: "Stricter TTC-specific target" },
    ],
    tips: [
      "DHEA (25–75mg/day, under RE supervision) has some evidence for modestly improving AFC and response to stimulation in women with DOR.",
      "CoQ10 (400–600mg/day) is one of the more widely studied supplements for supporting egg quality alongside a lower ovarian reserve.",
      "Vitamin D sufficiency (target 40–60 ng/mL) is associated with better AMH levels and IVF outcomes in observational studies.",
      "If TSH is above the TTC target of 2.5, this is usually simple to correct with levothyroxine dose adjustment — worth flagging to the prescribing physician.",
      "Reserve markers don't change quickly — retesting more than once every few months rarely provides new information and can add unnecessary anxiety.",
      "Reserve numbers estimate egg quantity, not quality or natural conception odds — many people with DOR conceive naturally or with modest stimulation.",
    ],
  },
};

// ── AGE-BANDED REFERENCE RANGES ─────────────────────────────────────────
// FSH, AMH, and AFC are the three markers whose *reference ranges* — not
// just their real-world averages — are commonly age-banded in clinical
// practice (ASRM / SART-style bands). LH, E2, progesterone, endometrium,
// and follicle size track cycle phase, not age, so their ranges stay fixed.
// Figures below are commonly cited population-level approximations meant
// for general orientation, not a diagnosis — individual variation is large.
const AGE_BANDS = [
  {
    id: "u35", label: "Under 35", min: 0, max: 34,
    fshFlag: 10,
    fshNote: "Day-3 FSH >10 mIU/mL is the standard DOR flag under 35 (ASRM).",
    amh: { optimalMin: 1.5, typicalMax: 4.0, dor: 1.0 },
    afc: { optimalMin: 10, optimalMax: 20, dor: 7 },
  },
  {
    id: "35-37", label: "35–37", min: 35, max: 37,
    fshFlag: 10,
    fshNote: "Day-3 FSH >10 mIU/mL still flags DOR here, usually read alongside AMH/AFC rather than alone.",
    amh: { optimalMin: 1.0, typicalMax: 3.0, dor: 1.0 },
    afc: { optimalMin: 8, optimalMax: 15, dor: 6 },
  },
  {
    id: "38-40", label: "38–40", min: 38, max: 40,
    fshFlag: 12,
    fshNote: "Basal FSH above ~10–12 mIU/mL is commonly flagged; a normal reading is reassuring but less able to rule out DOR at this age.",
    amh: { optimalMin: 0.7, typicalMax: 2.0, dor: 0.7 },
    afc: { optimalMin: 6, optimalMax: 10, dor: 5 },
  },
  {
    id: "41-42", label: "41–42", min: 41, max: 42,
    fshFlag: 15,
    fshNote: "Basal FSH is frequently elevated by this age even with adequate response — AMH and AFC are generally more informative here.",
    amh: { optimalMin: 0.5, typicalMax: 1.2, dor: 0.5 },
    afc: { optimalMin: 4, optimalMax: 7, dor: 3 },
  },
  {
    id: "43p", label: "43+", min: 43, max: 200,
    fshFlag: 15,
    fshNote: "FSH is usually elevated by this age and adds little beyond AMH/AFC; egg quality — which none of these markers capture — is the dominant factor.",
    amh: { optimalMin: 0.3, typicalMax: 0.8, dor: 0.3 },
    afc: { optimalMin: 2, optimalMax: 5, dor: 2 },
  },
];
// Resolves a raw age (string/number/blank) to its band, and flags whether
// this is a real entered age or just the fallback default (<35) shown
// before someone enters one.
function resolveAgeBand(rawAge) {
  const n = Number(rawAge);
  if (!rawAge || isNaN(n) || n <= 0) return { band: AGE_BANDS[0], isDefault: true };
  const found = AGE_BANDS.find((b) => n >= b.min && n <= b.max) || AGE_BANDS[AGE_BANDS.length - 1];
  return { band: found, isDefault: false };
}
// Builds age-adjusted "optimal range" rows for the two hormone-guide
// sections whose thresholds are meaningfully age-dependent. Returns null
// for every other hormone, so callers fall back to the static table.
function buildAgeAwareOptimal(hormoneKey, band) {
  if (hormoneKey === "fsh") {
    return [
      { phase: "Menstrual / early follicular (day 1–5)", range: "3–8 mIU/mL", note: "Ideal basal reading" },
      { phase: `Day-3 DOR flag — age ${band.label}`, range: `>${band.fshFlag} mIU/mL`, note: band.fshNote },
      { phase: "Ovulatory (day 12–16)", range: "4–13 mIU/mL", note: "Rises slightly at LH surge" },
      { phase: "Luteal (day 16+)", range: "1.5–7 mIU/mL", note: "Falls after ovulation" },
    ];
  }
  if (hormoneKey === "reserve") {
    const { amh, afc } = band;
    return [
      { phase: `AMH — age ${band.label} (any cycle day)`, range: `${amh.optimalMin}–${amh.typicalMax} ng/mL`, note: `<${amh.dor} ng/mL is a DOR concern at this age` },
      { phase: `AFC — age ${band.label} (day 2–5)`, range: `${afc.optimalMin}–${afc.optimalMax} follicles`, note: `${afc.dor}–${afc.optimalMin - 1} = low-normal; <${afc.dor} = DOR` },
      { phase: "TSH (any cycle day)", range: "≤2.5 uIU/mL", note: "Stricter TTC-specific target — not age-dependent" },
    ];
  }
  return null;
}

// ── STORAGE LAYER ────────────────────────────────────────────────────────
// Uses the browser's own localStorage. Data is personal to this browser/
// device (never sent anywhere) and lives under a single key as a JSON array.
const STORAGE_KEY = "fertility-tracker:visits";

async function storeGetAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice().sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
async function storeSaveAll(visits) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
  } catch (err) {
    throw new Error("Storage write failed: " + err.message);
  }
}
// Upserts many visits in a single read + single write. Always prefer this
// over calling storePut in a loop.
async function storePutMany(newVisits) {
  const all = await storeGetAll();
  newVisits.forEach((visit) => {
    const idx = all.findIndex((v) => v.id === visit.id);
    if (idx >= 0) all[idx] = visit; else all.push(visit);
  });
  await storeSaveAll(all);
}
async function storePut(visit) {
  await storePutMany([visit]);
}
async function storeDelete(id) {
  const all = await storeGetAll();
  await storeSaveAll(all.filter((v) => v.id !== id));
}
async function storeClear() { await storeSaveAll([]); }

// Tiny separate record for profile info (currently just age) that drives
// age-banded reference ranges. Kept apart from the visits array since it's
// a single object, not a list.
const PROFILE_KEY = "fertility-tracker:profile";
async function storeGetProfile() {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
async function storeSaveProfile(profile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    throw new Error("Storage write failed: " + err.message);
  }
}


// ── FAKE DATA (lets someone see what the dashboard looks like before typing
// or pasting anything of their own — generated fresh each time, generic
// clinical-visit labels only, dates relative to today rather than a fixed
// pinned-to-2026 dataset) ────────────────────────────────────────────────
function generateFakeVisits() {
  const rand = (min, max) => min + Math.random() * (max - min);
  const r1 = (min, max) => Math.round(rand(min, max) * 10) / 10;
  const r2 = (min, max) => Math.round(rand(min, max) * 100) / 100;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const fmtDate = (d) => d.toISOString().slice(0, 10);

  const numCycles = 4;
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 24); // most recent cycle starts ~3.5 weeks ago
  const cycleStarts = [];
  for (let i = 0; i < numCycles; i++) {
    cycleStarts.unshift(new Date(cursor));
    cursor.setDate(cursor.getDate() - randInt(27, 33));
  }

  const visits = [];
  cycleStarts.forEach((start, idx) => {
    const cycleLabel = `Cycle ${idx + 1}`;
    const mkDate = (day) => {
      const d = new Date(start);
      d.setDate(d.getDate() + day - 1);
      return fmtDate(d);
    };
    let n = 0;
    const add = (day, fields, notes) => {
      n += 1;
      visits.push({ id: `fake-${idx}-${n}-${Date.now()}`, date: mkDate(day), cycleLabel, cycleDay: day, notes: notes || "", ...fields });
    };

    add(2, {
      fsh: r1(4, 11), lh: r1(2, 7), e2: Math.round(rand(30, 70)), pgn: r2(0.2, 1),
      endo: r1(2.5, 4.5), afcR: randInt(3, 9), afcL: randInt(3, 9), tsh: r1(1.0, 3.0),
      ...(idx % 2 === 0 ? { amh: r1(0.8, 2.4) } : {}),
    }, "Day 2\u20133 labs");

    const midDay = randInt(10, 13);
    add(midDay, {
      fsh: r1(6, 13), lh: r1(18, 55), e2: Math.round(rand(90, 260)),
      pgn: r1(0.5, 2), endo: r1(6, 9), follicle: r1(15, 21),
    }, "Follicle check");

    if (Math.random() > 0.4) {
      add(midDay + 1, { follicle: r1(18, 23) }, "Follow-up scan");
    }

    add(randInt(19, 22), {
      fsh: r1(2, 5), lh: r1(1, 6), e2: Math.round(rand(60, 180)), pgn: r1(6, 22), endo: r1(6, 10),
    }, "Day 21 progesterone check");
  });

  return visits;
}


// ── PASTE PARSING HELPERS ────────────────────────────────────────────────
function splitLine(line, delimiter) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}
function parsePastedText(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  return lines.map((l) => splitLine(l, delimiter));
}

const FIELD_KEYWORDS = {
  date: ["date"],
  cycleLabel: ["cycle label", "cycle name", "cycle"],
  cycleDay: ["cycle day", "day"],
  fsh: ["fsh"],
  lh: ["lh"],
  e2: ["e2", "estradiol"],
  pgn: ["pgn", "progesterone", "p4"],
  endo: ["endo", "lining", "endometri"],
  follicle: ["follicle", "folicle"],
  afcR: ["afc r", "afc (right)", "right afc", "r afc"],
  afcL: ["afc l", "afc (left)", "left afc", "l afc"],
  amh: ["amh"],
  tsh: ["tsh"],
  notes: ["note"],
};
function guessFieldForHeader(text) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "ignore";
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) return field;
  }
  return "ignore";
}
// The grid's own column order — this IS the "spreadsheet template". A paste
// that starts at the Date cell and matches this left-to-right order will map
// perfectly; a paste starting anywhere else just fills from that column on.
const COLUMN_ORDER = ["date", "cycleLabel", "cycleDay", "fsh", "lh", "e2", "pgn", "endo", "follicle", "afcR", "afcL", "amh", "tsh", "notes"];
const NUMERIC_KEYS = new Set(["cycleDay", ...HORMONE_FIELDS.map((h) => h.key)]);

function normalizeDate(raw) {
  const s = (raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}
function extractNumber(raw) {
  const s = (raw || "").trim();
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? m[0] : "";
}
let tempIdCounter = 0;
function nextTempId() { tempIdCounter += 1; return `tmp-${Date.now()}-${tempIdCounter}`; }

function isRowBlank(row) {
  return COLUMN_ORDER.every((k) => !row[k] || String(row[k]).trim() === "");
}
function withTrailingBlank(rows) {
  if (rows.length === 0 || !isRowBlank(rows[rows.length - 1])) {
    return [...rows, { tempId: nextTempId(), ...EMPTY_DRAFT_FIELDS }];
  }
  return rows;
}
function draftRowIsValid(row) {
  const missing = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || "")) missing.push("date (YYYY-MM-DD)");
  if (!row.cycleLabel || !row.cycleLabel.trim()) missing.push("cycle label");
  if (row.cycleDay === "" || row.cycleDay === null || isNaN(Number(row.cycleDay))) missing.push("cycle day");
  return { valid: missing.length === 0, missing };
}
function draftRowToVisit(row) {
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  const visit = {
    id: row.existingId || `${row.date}-${Math.random().toString(36).slice(2, 8)}`,
    date: row.date, cycleLabel: row.cycleLabel.trim(), cycleDay: Number(row.cycleDay),
    notes: (row.notes || "").trim(),
  };
  HORMONE_FIELDS.forEach((h) => { visit[h.key] = num(row[h.key]); });
  return visit;
}
function visitToDraftRow(visit) {
  const str = (v) => (v === null || v === undefined ? "" : String(v));
  const row = { tempId: nextTempId(), existingId: visit.id, date: visit.date, cycleLabel: visit.cycleLabel, cycleDay: str(visit.cycleDay), notes: visit.notes || "" };
  HORMONE_FIELDS.forEach((h) => { row[h.key] = str(visit[h.key]); });
  return row;
}

// ── SHARED SMALL STYLES ─────────────────────────────────────────────────
const gridInputStyle = { width: "100%", padding: "6px 7px", border: `1px solid ${hair}`, borderRadius: 4, fontSize: 12, fontFamily: "inherit", color: ink, background: paper, boxSizing: "border-box" };
const gridInputErrorStyle = { ...gridInputStyle, border: `1px solid ${rust}`, background: "#FBEFEA" };
const smallBtn = (bg, color, border) => ({ padding: "5px 10px", borderRadius: 4, border: border || "none", background: bg, color, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" });

// ── EDITABLE SPREADSHEET GRID ────────────────────────────────────────────
function SpreadsheetGrid({ rows, onChangeCell, onPasteBlock, onRemoveRow, onDuplicateRow, onAddRows, onSaveRow, onSaveAll }) {
  const cellRefs = useRef({});
  const registerRef = (rowIdx, colKey) => (el) => { cellRefs.current[`${rowIdx}:${colKey}`] = el; };
  const focusCell = (rowIdx, colKey) => {
    const el = cellRefs.current[`${rowIdx}:${colKey}`];
    if (el) { el.focus(); el.select?.(); }
  };

  const nonBlankRows = rows.filter((r) => !isRowBlank(r));
  const invalidCount = nonBlankRows.filter((r) => !draftRowIsValid(r).valid).length;
  const validCount = nonBlankRows.length - invalidCount;

  const handlePaste = (e, rowIdx, colKey) => {
    const text = e.clipboardData ? e.clipboardData.getData("text") : "";
    if (!text.includes("\t") && !text.includes("\n")) return; // single value — let the browser paste normally
    e.preventDefault();
    let parsedRows = parsePastedText(text);
    if (parsedRows.length === 0) return;
    if (parsedRows.length > 1) {
      const hits = parsedRows[0].filter((c) => guessFieldForHeader(c) !== "ignore").length;
      if (hits >= 2) parsedRows = parsedRows.slice(1); // skip an accidentally-included header row
    }
    if (parsedRows.length === 0) return;
    onPasteBlock(rowIdx, colKey, parsedRows);
  };

  const handleKeyDown = (e, rowIdx, colIdx) => {
    const input = e.target;
    if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); focusCell(rowIdx + 1, COLUMN_ORDER[colIdx]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(rowIdx - 1, COLUMN_ORDER[colIdx]); }
    else if (e.key === "ArrowRight" && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
      if (COLUMN_ORDER[colIdx + 1]) { e.preventDefault(); focusCell(rowIdx, COLUMN_ORDER[colIdx + 1]); }
    } else if (e.key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
      if (COLUMN_ORDER[colIdx - 1]) { e.preventDefault(); focusCell(rowIdx, COLUMN_ORDER[colIdx - 1]); }
    }
  };

  const cellInput = (row, rowIdx, colIdx, key, opts = {}) => {
    const { placeholder = "—", inputMode } = opts;
    return (
      <input
        ref={registerRef(rowIdx, key)}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={row[key]}
        onChange={(e) => onChangeCell(row.tempId, key, e.target.value)}
        onPaste={(e) => handlePaste(e, rowIdx, key)}
        onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
        style={opts.error ? gridInputErrorStyle : gridInputStyle}
      />
    );
  };

  return (
    <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "16px 16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: ink, margin: 0 }}>
          Add visits
          {validCount > 0 && <span style={{ fontSize: 11.5, fontWeight: 400, color: sageDeep }}> · {validCount} ready to save</span>}
          {invalidCount > 0 && <span style={{ fontSize: 11.5, fontWeight: 400, color: rust }}> · {invalidCount} need{invalidCount === 1 ? "s" : ""} fixing</span>}
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onAddRows(5)} style={smallBtn(panel, ink, `1px solid ${hair}`)}>+ Add 5 rows</button>
          <button onClick={onSaveAll} disabled={validCount === 0} style={{ ...smallBtn(validCount > 0 ? sageDeep : hair, validCount > 0 ? "#fff" : "#8A8272"), cursor: validCount > 0 ? "pointer" : "default" }}>
            Save all valid rows
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "#6B6456", margin: "0 0 10px", lineHeight: 1.5 }}>
        Click any cell and paste — copying a block of rows/columns from Excel or Google Sheets fills this grid starting
        from that cell and adds rows if it needs more. Or just type directly; arrow keys and Enter move between cells.
      </p>

      <div style={{ overflowX: "auto", border: `1px solid ${hair}`, borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: paper }}>
              {COLUMN_ORDER.map((k) => (
                <th key={k} style={{ textAlign: "left", padding: "7px 6px", color: "#6B6456", fontWeight: 700, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${hair}`, whiteSpace: "nowrap" }}>{FIELD_LABELS_SHORT[k]}</th>
              ))}
              <th style={{ borderBottom: `1px solid ${hair}` }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const { valid, missing } = draftRowIsValid(row);
              const hasData = !isRowBlank(row);
              const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(row.date || "");
              const cycleOk = !!(row.cycleLabel && row.cycleLabel.trim());
              const dayOk = row.cycleDay !== "" && !isNaN(Number(row.cycleDay));
              return (
                <tr key={row.tempId} style={{ borderBottom: `1px solid ${hair}`, background: row.existingId ? "#F3F1EA" : "transparent" }}>
                  <td style={{ padding: "5px 6px", minWidth: 104 }}>{cellInput(row, rowIdx, 0, "date", { placeholder: "YYYY-MM-DD", error: hasData && !dateOk })}</td>
                  <td style={{ padding: "5px 6px", minWidth: 92 }}>{cellInput(row, rowIdx, 1, "cycleLabel", { placeholder: "Cycle 5", error: hasData && !cycleOk })}</td>
                  <td style={{ padding: "5px 6px", minWidth: 52 }}>{cellInput(row, rowIdx, 2, "cycleDay", { inputMode: "numeric", error: hasData && !dayOk })}</td>
                  {HORMONE_FIELDS.map((h, i) => (
                    <td key={h.key} style={{ padding: "5px 6px", minWidth: 60 }}>{cellInput(row, rowIdx, 3 + i, h.key, { inputMode: "decimal" })}</td>
                  ))}
                  <td style={{ padding: "5px 6px", minWidth: 120 }}>{cellInput(row, rowIdx, 3 + HORMONE_FIELDS.length, "notes")}</td>
                  <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={() => onSaveRow(row.tempId)} disabled={!valid} title={valid ? "" : hasData ? `Needs: ${missing.join(", ")}` : ""} style={{ ...smallBtn(valid ? sageDeep : hair, valid ? "#fff" : "#8A8272"), cursor: valid ? "pointer" : "default" }}>
                        {row.existingId ? "Update" : "Save"}
                      </button>
                      <button onClick={() => onDuplicateRow(row.tempId)} title="Duplicate row" style={{ border: "none", background: "none", color: sageDeep, cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>⎘</button>
                      <button onClick={() => onRemoveRow(row.tempId)} title="Remove row" style={{ border: "none", background: "none", color: rust, cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#9A8E7F", marginTop: 8, fontStyle: "italic" }}>
        Rows outlined in red have some data but are missing a date, cycle label, or cycle day. Rows shaded grey are edits to an already-saved visit.
      </div>
    </div>
  );
}

// ── SAVED VISITS TABLE ───────────────────────────────────────────────────
function VisitTable({ visits, onEdit, onDelete }) {
  if (visits.length === 0) {
    return <div style={{ border: `1px dashed ${hair}`, borderRadius: 6, padding: "28px 18px", textAlign: "center", color: "#8A8272", fontSize: 13 }}>No visits saved yet. Paste rows above, or add one by hand, to get started.</div>;
  }
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${hair}`, borderRadius: 6 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: paper }}>
            {["Date", "Cycle", "Day", "FSH", "LH", "E2", "PGN", "Endo", "Follic.", "AFC R/L", "AMH", "TSH", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "7px 8px", color: "#6B6456", fontWeight: 700, fontSize: 9.5, textTransform: "uppercase", borderBottom: `1px solid ${hair}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => (
            <tr key={v.id} style={{ borderBottom: `1px solid ${hair}` }}>
              <td style={{ padding: "7px 8px" }}>{v.date}</td>
              <td style={{ padding: "7px 8px" }}>{v.cycleLabel}</td>
              <td style={{ padding: "7px 8px" }}>{v.cycleDay}</td>
              <td style={{ padding: "7px 8px" }}>{v.fsh ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.lh ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.e2 ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.pgn ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.endo ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.follicle ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.afcR ?? "–"}/{v.afcL ?? "–"}</td>
              <td style={{ padding: "7px 8px" }}>{v.amh ?? "—"}</td>
              <td style={{ padding: "7px 8px" }}>{v.tsh ?? "—"}</td>
              <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                <button onClick={() => onEdit(v)} style={{ border: "none", background: "none", color: sageDeep, cursor: "pointer", fontSize: 11.5, fontWeight: 700, marginRight: 8 }}>Edit</button>
                <button onClick={() => onDelete(v.id)} style={{ border: "none", background: "none", color: rust, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── STORAGE PILL / CONFIRM BAR ───────────────────────────────────────────
function StoragePill({ count }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#EFECE3", border: `1px solid ${hair}`, borderRadius: 20, padding: "6px 14px", fontSize: 11.5, color: "#4A4438" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: sageDeep, display: "inline-block" }} />
      <span><strong style={{ color: ink }}>{count}</strong> visit{count === 1 ? "" : "s"} stored in this browser — never sent anywhere</span>
    </div>
  );
}
function ConfirmBar({ message, onConfirm, onCancel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FBEFEA", border: `1px solid ${rust}`, borderRadius: 4, padding: "10px 14px", fontSize: 12.5, color: ink }}>
      <span style={{ flex: 1, minWidth: 200 }}>{message}</span>
      <button onClick={onCancel} style={{ padding: "6px 13px", borderRadius: 4, border: `1px solid ${hair}`, background: panel, color: ink, fontSize: 12, cursor: "pointer" }}>Cancel</button>
      <button onClick={onConfirm} style={{ padding: "6px 13px", borderRadius: 4, border: "none", background: rust, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirm</button>
    </div>
  );
}

// ── DISCLAIMER ────────────────────────────────────────────────────────────
// Always-visible, non-dismissible: this tool is a personal record-keeping
// and charting aid, not a diagnostic or medical device, and every reference
// range shown is general population-level guidance, not a diagnosis for any
// individual. Shown once at the top of the page and again at the bottom.
const DISCLAIMER_TEXT = "This tool is for personal record-keeping and informational purposes only. It is not a medical device and does not provide medical advice, diagnosis, or treatment. Reference ranges shown are general population-level guidance, not a diagnosis — individual results vary. Always consult a qualified healthcare provider (your OB/GYN or reproductive endocrinologist) about your lab results, symptoms, and treatment decisions.";
function DisclaimerBanner() {
  return (
    <div role="note" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FBEFEA", border: `1px solid ${rust}`, borderRadius: 6, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: ink, lineHeight: 1.5 }}>
      <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }} aria-hidden="true">⚠️</span>
      <span><strong>Not medical advice.</strong> {DISCLAIMER_TEXT}</span>
    </div>
  );
}
function DisclaimerFooter() {
  return (
    <div role="note" style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${hair}`, fontSize: 11, color: "#8A8272", lineHeight: 1.55 }}>
      <strong style={{ color: "#6B6456" }}>Disclaimer:</strong> {DISCLAIMER_TEXT}
    </div>
  );
}

// ── DASHBOARD: SHARED CHART FURNITURE ────────────────────────────────────
// NOTE: Recharts only recognizes ReferenceArea/ReferenceLine as *direct*
// children of LineChart/BarChart, so these are returned as arrays and spread
// inline, never wrapped in a real component (which would hide them).
function phaseFurniture(yMax) {
  const els = [];
  PHASES.forEach((ph) => els.push(
    <ReferenceArea key={ph.label} x1={ph.x1} x2={ph.x2} y1={0} y2={yMax} fill={ph.fill} fillOpacity={0.55} stroke="none" ifOverflow="extendDomain" />
  ));
  [12, 16].forEach((x) => els.push(
    <ReferenceLine key={"b" + x} x={x} stroke="#B8B2A2" strokeDasharray="2 2" strokeWidth={1} />
  ));
  PHASES.forEach((ph) => els.push(
    <ReferenceArea key={ph.label + "-lbl"} x1={ph.x1} x2={ph.x2} y1={0} y2={yMax} fill="transparent" stroke="none" ifOverflow="extendDomain"
      label={{ value: ph.label.toUpperCase(), position: "insideTop", fontSize: 10, fontWeight: 700, letterSpacing: 1, fill: ph.textColor, offset: 8 }} />
  ));
  return els;
}
function sharedXAxis() {
  return (
    <XAxis dataKey="day" type="number" scale="linear" domain={[1, DAY_MAX]}
      ticks={[1, 3, 5, 7, 9, 11, 13, 16, 19, 22, 26, 30]}
      tick={{ fontSize: 11, fill: "#8A8272" }}
      label={{ value: "Cycle day", position: "insideBottom", offset: -8, fontSize: 11, fill: "#8A8272" }} />
  );
}
function CustomDot({ cx, cy, value, color }) {
  if (value === null || value === undefined || cx === undefined) return null;
  const label = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return (
    <g>
      <circle cx={cx} cy={cy} r={5.5} fill={color} stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 9} textAnchor="middle" fontSize={10} fill={color} fontWeight={700} paintOrder="stroke" stroke="#fff" strokeWidth={3}>{label}</text>
    </g>
  );
}
function buildMergedByDay(visits, key) {
  const days = {};
  visits.forEach((v) => {
    if (v[key] === null || v[key] === undefined) return;
    if (!days[v.cycleDay]) days[v.cycleDay] = { day: v.cycleDay };
    days[v.cycleDay][v.cycleLabel] = v[key];
  });
  return Object.values(days).sort((a, b) => a.day - b.day);
}

// ── GUIDE PANEL ───────────────────────────────────────────────────────────
function GuidePanel({ hormoneKey, ageInfo }) {
  const [open, setOpen] = useState(false);
  const g = HORMONE_GUIDE[hormoneKey];
  if (!g) return null;
  const ageRows = ageInfo ? buildAgeAwareOptimal(hormoneKey, ageInfo.band) : null;
  const rows = ageRows || g.optimal;
  return (
    <div style={{ marginTop: 10, border: `1px solid ${hair}`, borderRadius: 6, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: open ? g.color : paper, border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: open ? "#fff" : ink }}>Guide — {g.question}</span>
        <span style={{ fontSize: 14, color: open ? "#fff" : "#8A8272", marginLeft: 8 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: panel, padding: "16px 16px 20px", display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: g.color, marginBottom: 5 }}>What it does</div>
            <p style={{ fontSize: 12.5, color: ink, lineHeight: 1.6, margin: 0 }}>{g.what}</p>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: g.color, marginBottom: 5 }}>Why it matters</div>
            <p style={{ fontSize: 12.5, color: ink, lineHeight: 1.6, margin: 0 }}>{g.fertility}</p>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: g.color, marginBottom: 6 }}>Optimal ranges</div>
            {ageRows && (
              <div style={{ fontSize: 11, color: g.color, fontWeight: 700, marginBottom: 6 }}>
                Showing thresholds for age {ageInfo.band.label}{ageInfo.isDefault ? " — default view, add your age at the top of the page to personalize" : ""}.
              </div>
            )}
            <div style={{ display: "grid", gap: 4 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: 8, alignItems: "center", background: paper, borderRadius: 4, padding: "6px 10px", fontSize: 11.5 }}>
                  <span style={{ color: "#6B6456", fontWeight: 600 }}>{r.phase}</span>
                  <span style={{ color: g.color, fontWeight: 700, fontFamily: "Georgia,serif", fontSize: 13, textAlign: "center" }}>{r.range}</span>
                  <span style={{ color: "#8A8272", fontSize: 11 }}>{r.note}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: g.color, marginBottom: 6 }}>How to support this</div>
            <div style={{ display: "grid", gap: 6 }}>
              {g.tips.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 18, height: 18, minWidth: 18, borderRadius: "50%", background: g.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, color: ink, lineHeight: 1.55 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GENERIC DAY CHART (used for FSH/LH/E2/PGN/Endo/Follicle/AFC-by-day) ──
function DayChart({ title, unit, sub, hormoneKey, refBands, thresholdLines, yMax, visits, cycleColors, cyclesToShow, guideKey, hideGuide, ageInfo }) {
  const data = buildMergedByDay(visits, hormoneKey);
  const dotR = (color) => (props) => <CustomDot cx={props.cx} cy={props.cy} value={props.value} color={color} />;
  return (
    <div style={{ display: "grid", gap: 0 }}>
      <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "18px 16px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
          <h3 style={{ fontFamily: "Georgia,serif", fontSize: 18, color: ink, margin: 0 }}>{title}</h3>
          <span style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8A8272" }}>{unit}</span>
        </div>
        {sub && <p style={{ fontSize: 12, color: "#6B6456", margin: "2px 0 14px", lineHeight: 1.45 }}>{sub}</p>}
        {data.length === 0 || cyclesToShow.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "#8A8272", fontSize: 12.5 }}>
            {cyclesToShow.length === 0 ? "No cycles selected." : `No ${title} values recorded yet.`}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={data} margin={{ top: 24, right: 20, left: 4, bottom: 20 }}>
              {phaseFurniture(yMax)}
              {(refBands || []).map((b, i) => (
                <ReferenceArea key={i} x1={b.x1} x2={b.x2} y1={b.y1} y2={b.y2} fill={sage} fillOpacity={0.28} stroke={sage} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 2" ifOverflow="extendDomain" />
              ))}
              {(thresholdLines || []).map((t, i) => (
                <ReferenceLine key={i} y={t.y} stroke={sageDeep} strokeDasharray="4 2" strokeWidth={1.5} label={{ value: t.label, position: "insideTopRight", fontSize: 10, fill: sageDeep }} />
              ))}
              <CartesianGrid stroke={hair} strokeDasharray="2 4" vertical={false} />
              {sharedXAxis()}
              <YAxis domain={[0, yMax]} tick={{ fontSize: 11, fill: "#8A8272" }} width={40} />
              <Tooltip
                contentStyle={{ background: ink, border: "none", borderRadius: 4, fontSize: 12, padding: "8px 12px" }}
                labelStyle={{ color: "#aaa", fontSize: 11 }} itemStyle={{ color: "#fff" }}
                formatter={(v, name) => (v !== null && v !== undefined ? [`${v} ${unit}`, name] : null)}
                labelFormatter={(d) => `Cycle day ${d}`} />
              {cyclesToShow.map((c) => (
                <Line key={c} dataKey={c} name={c} type="linear" stroke={cycleColors[c]} strokeWidth={2.5}
                  dot={dotR(cycleColors[c])} activeDot={{ r: 8, fill: cycleColors[c], stroke: "#fff", strokeWidth: 2 }}
                  connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <div style={{ fontSize: 11, color: "#9A8E7F", marginTop: 8, fontStyle: "italic" }}>Dots = actual lab draws. Lines bridge across unmeasured days and are not interpolated values.</div>
      </div>
      {!hideGuide && <GuidePanel hormoneKey={guideKey} ageInfo={ageInfo} />}
    </div>
  );
}

// ── AFC BY OVARY (bar, by visit date) ────────────────────────────────────
function makeAFCTick(rows) {
  return function AFCTick({ x, y, payload }) {
    const row = rows.find((d) => d.date === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#8A8272">{payload.value}</text>
        <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fontWeight={700} fill={sageDeep}>{row ? row.cycleLabel : ""}</text>
      </g>
    );
  };
}
function AFCByOvaryChart({ visits, selectedCycles, ageInfo }) {
  const rows = visits
    .filter((v) => selectedCycles.has(v.cycleLabel) && (v.afcR != null || v.afcL != null))
    .map((v) => ({ date: v.date, cycleLabel: v.cycleLabel, r: v.afcR || 0, l: v.afcL || 0, total: (v.afcR || 0) + (v.afcL || 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const afc = ageInfo.band.afc;
  const yMax = Math.max(16, afc.optimalMax + 6);

  return (
    <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "18px 16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <h3 style={{ fontFamily: "Georgia,serif", fontSize: 19, color: ink, margin: 0 }}>AFC by ovary</h3>
        <span style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8A8272" }}>follicles</span>
      </div>
      <p style={{ fontSize: 12, color: "#6B6456", margin: "2px 0 12px", lineHeight: 1.45 }}>Right and left ovary counts alongside the total, for every visit where a count was recorded. Threshold lines reflect age {ageInfo.band.label}{ageInfo.isDefault ? " (default — add your age above to personalize)" : ""}.</p>
      {rows.length === 0 ? (
        <div style={{ padding: "36px 12px", textAlign: "center", color: "#8A8272", fontSize: 12.5, border: `1px dashed ${hair}`, borderRadius: 6 }}>
          No AFC counts recorded for the selected cycle(s).
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={290}>
          <BarChart data={rows} margin={{ top: 24, right: 20, left: 4, bottom: 14 }} barGap={4} barCategoryGap="22%">
            <CartesianGrid stroke={hair} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tick={makeAFCTick(rows)} height={40} interval={0} />
            <YAxis domain={[0, yMax]} tick={{ fontSize: 11, fill: "#8A8272" }} width={36} />
            <ReferenceLine y={afc.optimalMin} stroke={sageDeep} strokeDasharray="3 3" strokeWidth={1} label={{ value: `total optimal ≥${afc.optimalMin}`, position: "insideTopLeft", fontSize: 9.5, fill: sageDeep }} />
            <ReferenceLine y={afc.dor} stroke={amber} strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `total DOR <${afc.dor}`, position: "insideTopRight", fontSize: 9.5, fill: amber }} />
            <Tooltip contentStyle={{ background: ink, border: "none", borderRadius: 4, fontSize: 12, padding: "8px 12px" }} labelStyle={{ color: "#aaa", fontSize: 11 }} itemStyle={{ color: "#fff" }}
              formatter={(v, name) => [`${v} follicles`, name]} labelFormatter={(d, payload) => (payload && payload[0] ? `${d} · ${payload[0].payload.cycleLabel}` : d)} />
            <Bar dataKey="r" name="Right ovary" fill={CYCLE_PALETTE[0]} radius={[3, 3, 0, 0]}><LabelList dataKey="r" position="top" style={{ fontSize: 10.5, fontWeight: 700, fill: CYCLE_PALETTE[0] }} /></Bar>
            <Bar dataKey="l" name="Left ovary" fill={amber} radius={[3, 3, 0, 0]}><LabelList dataKey="l" position="top" style={{ fontSize: 10.5, fontWeight: 700, fill: amber }} /></Bar>
            <Bar dataKey="total" name="Total" fill={sageDeep} radius={[3, 3, 0, 0]}><LabelList dataKey="total" position="top" style={{ fontSize: 10.5, fontWeight: 700, fill: sageDeep }} /></Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <div style={{ fontSize: 11, color: "#9A8E7F", marginTop: 8, fontStyle: "italic" }}>Bars show right (R), left (L), and total antral follicle counts for each visit where a count was recorded.</div>
    </div>
  );
}

// ── RESERVE CHART (AMH + TSH bars, plus AFC-by-cycle-day line) ──────────
function PointInTimeChart({ visits, field, label, unit, band, refLine, yMax }) {
  const rows = visits.filter((v) => v[field] != null).map((v) => ({ date: v.date, value: v[field] }));
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 4 }}>{label} · {unit}</div>
      {rows.length === 0 ? (
        <div style={{ padding: "18px 0", textAlign: "center", color: "#8A8272", fontSize: 12 }}>No {label} values yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={rows} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={hair} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8A8272" }} />
            <YAxis domain={[0, yMax]} tick={{ fontSize: 10, fill: "#8A8272" }} width={30} />
            {band && <ReferenceArea y1={band.y1} y2={band.y2} fill={sage} fillOpacity={0.2} stroke={sage} strokeOpacity={0.3} strokeDasharray="2 2" />}
            {refLine && <ReferenceLine y={refLine.y} stroke={amber} strokeDasharray="3 3" strokeWidth={1.5} label={{ value: refLine.label, position: "insideTopLeft", fontSize: 9, fill: amber }} />}
            <Tooltip contentStyle={{ background: ink, border: "none", borderRadius: 4, fontSize: 12 }} itemStyle={{ color: "#fff" }} />
            <Bar dataKey="value" fill={sageDeep} radius={[3, 3, 0, 0]}><LabelList dataKey="value" position="top" style={{ fontSize: 10.5, fontWeight: 700, fill: ink }} /></Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
function ReserveChart({ visits, cycleColors, cyclesToShow, ageInfo }) {
  const { amh } = ageInfo.band;
  const amhYMax = Math.max(2, Math.ceil(amh.typicalMax + 1));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "18px 16px 16px" }}>
        <h3 style={{ fontFamily: "Georgia,serif", fontSize: 19, color: ink, margin: "0 0 4px" }}>Ovarian reserve markers</h3>
        <p style={{ fontSize: 12, color: "#6B6456", margin: "0 0 18px", lineHeight: 1.45 }}>AMH and TSH are shown by visit date since they're stable across the cycle. AFC is shown in the chart above (by ovary, per visit), and FSH — the third standard reserve marker — has its own chart further up. AMH's threshold reflects age {ageInfo.band.label}{ageInfo.isDefault ? " (default — add your age above to personalize)" : ""}; TSH's target doesn't shift with age.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <PointInTimeChart visits={visits} field="amh" label="AMH" unit="ng/mL"
            band={{ y1: amh.optimalMin, y2: amh.typicalMax }} refLine={{ y: amh.dor, label: `DOR concern <${amh.dor}` }} yMax={amhYMax} />
          <PointInTimeChart visits={visits} field="tsh" label="TSH" unit="uIU/mL"
            band={{ y1: 0.34, y2: 2.5 }} refLine={{ y: 2.5, label: "TTC target ≤2.5" }} yMax={4} />
        </div>
      </div>
      <GuidePanel hormoneKey="reserve" ageInfo={ageInfo} />
    </div>
  );
}

// ── CYCLE FILTER (button + popover) ─────────────────────────────────────
function CyclePopoverFilter({ cycleLabels, cycleColors, visitCounts, selected, onToggle, onSelectAll, onClearAll }) {
  const [open, setOpen] = useState(false);
  const allSelected = cycleLabels.every((c) => selected.has(c));
  const noneSelected = selected.size === 0;
  const summary = allSelected ? "All cycles" : noneSelected ? "No cycles" : `${selected.size} of ${cycleLabels.length} cycles`;

  if (cycleLabels.length === 0) return null;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${hair}`, background: panel, color: ink, borderRadius: 7, padding: "9px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <span style={{ display: "flex", gap: 3 }}>
          {noneSelected
            ? <span style={{ width: 8, height: 8, borderRadius: "50%", border: `1px solid ${hair}`, display: "inline-block" }} />
            : cycleLabels.filter((c) => selected.has(c)).map((c) => <span key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: cycleColors[c], display: "inline-block" }} />)}
        </span>
        <span>Cycles: {summary}</span>
        <span style={{ fontSize: 9.5, color: "#8A8272" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 31, width: 280, maxWidth: "88vw", maxHeight: "60vh", overflowY: "auto", background: panel, border: `1px solid ${hair}`, borderRadius: 8, boxShadow: "0 10px 28px rgba(28,43,58,0.18)", padding: "13px 14px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A8272" }}>Show cycles</span>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={onSelectAll} disabled={allSelected} style={{ border: "none", background: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: allSelected ? "#C8C2B4" : sageDeep, cursor: allSelected ? "default" : "pointer" }}>All</button>
                <button onClick={onClearAll} disabled={noneSelected} style={{ border: "none", background: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: noneSelected ? "#C8C2B4" : "#8A8272", cursor: noneSelected ? "default" : "pointer" }}>None</button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 1 }}>
              {cycleLabels.map((c) => {
                const active = selected.has(c);
                return (
                  <label key={c} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 6px", borderRadius: 5, cursor: "pointer", background: active ? "#F3F1EA" : "transparent" }}>
                    <input type="checkbox" checked={active} onChange={() => onToggle(c)} style={{ width: 14, height: 14, accentColor: cycleColors[c], cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: cycleColors[c], display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: ink, lineHeight: 1.4 }}>{c}</span>
                    <span style={{ fontSize: 10.5, color: "#9A8E7F", marginLeft: "auto" }}>{visitCounts[c] || 0} visit{(visitCounts[c] || 0) === 1 ? "" : "s"}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${hair}`, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#6B6456" }}>
              <span style={{ width: 16, height: 10, background: sage, opacity: 0.45, display: "inline-block", borderRadius: 2, border: `1px dashed ${sageDeep}` }} />
              shaded band on each chart = evidence-based reference range
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── HORMONE META (reference bands, generic — not tied to any one dataset) ─
const HORMONE_META = {
  fsh: {
    title: "FSH", unit: "mIU/mL", guideKey: "fsh",
    sub: "Day-3 FSH >10 mIU/mL in women under 35 is a commonly used flag for diminished ovarian reserve (ASRM). Optimal basal value is 3–8 mIU/mL.",
    refBands: [{ x1: 1, x2: 5, y1: 3, y2: 8 }, { x1: 5, x2: 12, y1: 3, y2: 10 }, { x1: 12, x2: 16, y1: 4, y2: 13 }, { x1: 16, x2: DAY_MAX, y1: 1.5, y2: 7 }],
    yMax: 22,
  },
  lh: {
    title: "LH", unit: "mIU/mL", guideKey: "lh",
    sub: "Early-cycle LH should be 2–8 mIU/mL; the mid-cycle surge must reach 20–80 mIU/mL to trigger ovulation.",
    refBands: [{ x1: 1, x2: 5, y1: 2, y2: 6 }, { x1: 5, x2: 12, y1: 2, y2: 8 }, { x1: 12, x2: 16, y1: 20, y2: 60 }, { x1: 16, x2: DAY_MAX, y1: 1, y2: 8 }],
    yMax: 60,
  },
  e2: {
    title: "Estradiol (E2)", unit: "pg/mL", guideKey: "e2",
    sub: "Day-3 E2 should be 30–80 pg/mL. Values above 80 can suppress FSH, making ovarian reserve look falsely healthy. Pre-ovulatory peak of 150–400 pg/mL confirms a mature follicle.",
    refBands: [{ x1: 1, x2: 5, y1: 20, y2: 50 }, { x1: 5, x2: 12, y1: 30, y2: 80 }, { x1: 12, x2: 16, y1: 150, y2: 400 }, { x1: 16, x2: DAY_MAX, y1: 100, y2: 200 }],
    yMax: 220,
  },
  pgn: {
    title: "Progesterone", unit: "ng/mL", guideKey: "pgn",
    sub: "Day-21 value confirms ovulation (>10 ng/mL) and corpus luteum function.",
    refBands: [{ x1: 1, x2: 12, y1: 0, y2: 1 }, { x1: 12, x2: 16, y1: 1, y2: 6 }, { x1: 16, x2: DAY_MAX, y1: 10, y2: 20 }],
    yMax: 36,
  },
  endo: {
    title: "Endometrial thickness", unit: "mm", guideKey: "endo",
    sub: "Pre-ovulatory lining should reach ≥7mm trilaminar for good implantation odds.",
    refBands: [{ x1: 1, x2: 5, y1: 2, y2: 4 }, { x1: 5, x2: 12, y1: 5, y2: 9 }, { x1: 12, x2: 16, y1: 7, y2: 14 }, { x1: 16, x2: DAY_MAX, y1: 8, y2: 14 }],
    thresholdLines: [{ y: 7, label: "≥7mm target" }],
    yMax: 16,
  },
  follicle: {
    title: "Lead follicle size", unit: "mm", guideKey: "follicle",
    sub: "Trigger threshold is 18–24mm.",
    refBands: [{ x1: 1, x2: DAY_MAX, y1: 18, y2: 24 }],
    thresholdLines: [{ y: 18, label: "trigger threshold 18mm" }],
    yMax: 26,
  },
};

// A thin labeled rule to group related charts as the page scrolls, since
// there's no tab bar hiding sections from each other anymore.
function SectionDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: amber, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: hair }} />
    </div>
  );
}

// ── DASHBOARD SECTION ─────────────────────────────────────────────────────
function HormoneDashboardSection({ visits, onLoadFakeData, ageInfo }) {
  const [selectedCycles, setSelectedCycles] = useState(() => new Set());
  const seenCyclesRef = useRef(new Set());

  const cycleLabels = useMemo(() => {
    const order = [];
    visits.forEach((v) => { if (!order.includes(v.cycleLabel)) order.push(v.cycleLabel); });
    return order;
  }, [visits]);

  const cycleColors = useMemo(() => {
    const map = {};
    cycleLabels.forEach((c, i) => { map[c] = CYCLE_PALETTE[i % CYCLE_PALETTE.length]; });
    return map;
  }, [cycleLabels]);

  const visitCounts = useMemo(() => {
    const counts = {};
    visits.forEach((v) => { counts[v.cycleLabel] = (counts[v.cycleLabel] || 0) + 1; });
    return counts;
  }, [visits]);

  // New cycle labels default to "selected"; previously-toggled labels keep their state.
  useEffect(() => {
    setSelectedCycles((prev) => {
      const next = new Set(prev);
      let changed = false;
      cycleLabels.forEach((c) => {
        if (!seenCyclesRef.current.has(c)) {
          seenCyclesRef.current.add(c);
          next.add(c);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cycleLabels]);

  const toggleCycle = (c) => setSelectedCycles((prev) => {
    const next = new Set(prev);
    if (next.has(c)) next.delete(c); else next.add(c);
    return next;
  });
  const selectAllCycles = () => setSelectedCycles(new Set(cycleLabels));
  const clearAllCycles = () => setSelectedCycles(new Set());

  const shown = cycleLabels.filter((c) => selectedCycles.has(c));

  if (visits.length === 0) {
    return (
      <div style={{ border: `1px dashed ${hair}`, borderRadius: 6, padding: "34px 20px", textAlign: "center", color: "#8A8272", fontSize: 13, display: "grid", gap: 12, justifyItems: "center" }}>
        <span>Add visits above to see your hormone &amp; cycle dashboard here.</span>
        <button onClick={onLoadFakeData} style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${sageDeep}`, background: panel, color: sageDeep, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          Or load fake data to see how it looks
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderBottom: `2px solid ${ink}`, paddingBottom: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: amber, fontWeight: 700, marginBottom: 3 }}>Cycle-by-Cycle Trends</div>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, color: ink, margin: 0 }}>Hormone &amp; Cycle Dashboard</h2>
        <p style={{ fontSize: 12.5, color: "#6B6456", margin: "5px 0 0" }}>
          {cycleLabels.length} cycle{cycleLabels.length === 1 ? "" : "s"} · x-axis = cycle day · dots = actual lab draws · hover for exact values · expand ▼ for hormone guide
        </p>
      </div>

      <div style={{ margin: "12px 0 16px" }}>
        <CyclePopoverFilter cycleLabels={cycleLabels} cycleColors={cycleColors} visitCounts={visitCounts} selected={selectedCycles} onToggle={toggleCycle} onSelectAll={selectAllCycles} onClearAll={clearAllCycles} />
      </div>

      {selectedCycles.size === 0 && (
        <div style={{ margin: "0 0 16px", padding: "11px 15px", background: "#F7EFDF", border: `1px solid ${amber}`, borderRadius: 4, fontSize: 12.5, color: ink, lineHeight: 1.5 }}>
          No cycles selected — pick at least one cycle above to see chart data.
        </div>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        <SectionDivider label="LH & Follicle" />
        <DayChart {...HORMONE_META.lh} hormoneKey="lh" visits={visits} cycleColors={cycleColors} cyclesToShow={shown} />
        <DayChart {...HORMONE_META.follicle} hormoneKey="follicle" visits={visits} cycleColors={cycleColors} cyclesToShow={shown} />

        <SectionDivider label="Estradiol" />
        <DayChart {...HORMONE_META.e2} hormoneKey="e2" visits={visits} cycleColors={cycleColors} cyclesToShow={shown} />

        <SectionDivider label="Progesterone" />
        <DayChart {...HORMONE_META.pgn} hormoneKey="pgn" visits={visits} cycleColors={cycleColors} cyclesToShow={shown} />

        <SectionDivider label="Endometrium" />
        <DayChart {...HORMONE_META.endo} hormoneKey="endo" visits={visits} cycleColors={cycleColors} cyclesToShow={shown} />

        <SectionDivider label="Ovarian Reserve" />
        {ageInfo.isDefault && (
          <div style={{ padding: "10px 14px", background: "#F7EFDF", border: `1px solid ${amber}`, borderRadius: 4, fontSize: 12, color: ink, lineHeight: 1.5 }}>
            FSH, AMH, and AFC reference ranges below are shown for the default <strong>under-35</strong> band. Add your age at the top of the page to see thresholds tuned to your age instead.
          </div>
        )}
        <DayChart {...HORMONE_META.fsh}
          sub={`Day-3 FSH above ${ageInfo.band.fshFlag} mIU/mL is a commonly used DOR flag for age ${ageInfo.band.label}. Optimal basal value is 3–8 mIU/mL.`}
          thresholdLines={[{ y: ageInfo.band.fshFlag, label: `DOR flag >${ageInfo.band.fshFlag}` }]}
          hormoneKey="fsh" visits={visits} cycleColors={cycleColors} cyclesToShow={shown} ageInfo={ageInfo} />
        <AFCByOvaryChart visits={visits} selectedCycles={selectedCycles} ageInfo={ageInfo} />
        <ReserveChart visits={visits} cycleColors={cycleColors} cyclesToShow={shown} ageInfo={ageInfo} />
      </div>

      <div style={{ marginTop: 20, padding: "12px 16px", background: "#EFECE3", borderLeft: `3px solid ${amber}`, fontSize: 12, color: ink, lineHeight: 1.55 }}>
        <strong>How to read:</strong> Use the <em>Cycles</em> button above to choose which cycle(s) appear on every chart below — it defaults to all of them. Reference bands use commonly cited clinical targets (ASRM, Endocrine Society, IVF outcome literature) — general guidance, not a diagnosis. FSH, AMH, and AFC bands additionally adjust to the age you enter above, since those three references shift meaningfully with age; the rest track cycle phase rather than age. The colour bar below each chart shows the three cycle phases (follicular, ovulatory, luteal) across the tracked days. Expand the Hormone Guide beneath each chart for a full explanation and support tips.
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────
export default function LocalFertilityTracker() {
  const [visits, setVisits] = useState([]);
  const [draftRows, setDraftRows] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [age, setAge] = useState("");

  const refresh = useCallback(async () => {
    try { setVisits(await storeGetAll()); setError(""); }
    catch (err) { setError("Couldn't read saved data: " + err.message); }
  }, []);
  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);
  useEffect(() => {
    storeGetProfile().then((p) => { if (p && p.age) setAge(String(p.age)); }).catch(() => {});
  }, []);
  const ageInfo = useMemo(() => resolveAgeBand(age), [age]);
  const handleAgeChange = (val) => {
    const cleaned = val.replace(/[^\d]/g, "").slice(0, 2);
    setAge(cleaned);
    const n = Number(cleaned);
    storeSaveProfile(cleaned && !isNaN(n) && n > 0 ? { age: n } : {}).catch(() => {});
  };

  // Seed the grid with some blank rows once, so it looks like a spreadsheet
  // ready to paste into rather than an empty form.
  useEffect(() => {
    if (ready) setDraftRows((prev) => (prev.length === 0 ? Array.from({ length: 8 }, () => ({ tempId: nextTempId(), ...EMPTY_DRAFT_FIELDS })) : prev));
  }, [ready]);

  const addRows = (count) => setDraftRows((prev) => [...prev, ...Array.from({ length: count }, () => ({ tempId: nextTempId(), ...EMPTY_DRAFT_FIELDS }))]);
  const changeDraftCell = (tempId, key, value) => setDraftRows((prev) => withTrailingBlank(prev.map((r) => (r.tempId === tempId ? { ...r, [key]: value } : r))));
  const removeDraftRow = (tempId) => setDraftRows((prev) => prev.filter((r) => r.tempId !== tempId));
  const duplicateDraftRow = (tempId) => setDraftRows((prev) => {
    const src = prev.find((r) => r.tempId === tempId);
    if (!src) return prev;
    const copy = { ...src, tempId: nextTempId(), existingId: undefined };
    const idx = prev.findIndex((r) => r.tempId === tempId);
    const next = [...prev];
    next.splice(idx + 1, 0, copy);
    return next;
  });
  const editVisit = (visit) => setDraftRows((prev) => (prev.some((r) => r.existingId === visit.id) ? prev : [visitToDraftRow(visit), ...prev]));

  // Fills the grid starting at (rowIdx, colKey) with a pasted 2D block,
  // growing the row count as needed — this is what makes the grid behave
  // like a real spreadsheet paste target.
  const pasteBlock = (rowIdx, colKey, parsedRows) => {
    const startCol = COLUMN_ORDER.indexOf(colKey);
    setDraftRows((prev) => {
      const next = [...prev];
      parsedRows.forEach((cells, ri) => {
        const targetIdx = rowIdx + ri;
        while (targetIdx >= next.length) next.push({ tempId: nextTempId(), ...EMPTY_DRAFT_FIELDS });
        const row = { ...next[targetIdx] };
        cells.forEach((val, ci) => {
          const key = COLUMN_ORDER[startCol + ci];
          if (!key) return; // beyond the last column — nothing to put it in
          const trimmed = (val || "").trim();
          if (key === "date") row.date = trimmed ? normalizeDate(trimmed) : "";
          else if (NUMERIC_KEYS.has(key)) row[key] = trimmed ? extractNumber(trimmed) : "";
          else row[key] = trimmed;
        });
        next[targetIdx] = row;
      });
      return withTrailingBlank(next);
    });
  };

  const saveRow = async (tempId) => {
    const row = draftRows.find((r) => r.tempId === tempId);
    if (!row || !draftRowIsValid(row).valid) return;
    try {
      await storePut(draftRowToVisit(row));
      setDraftRows((prev) => withTrailingBlank(prev.filter((r) => r.tempId !== tempId)));
      setStatus("Saved 1 visit.");
      setError("");
      refresh();
    } catch (err) { setError("Couldn't save that visit: " + err.message); }
  };
  const saveAllValid = async () => {
    const valid = draftRows.filter((r) => draftRowIsValid(r).valid);
    const invalid = draftRows.filter((r) => !draftRowIsValid(r).valid);
    if (valid.length === 0) { setError("No rows are ready to save yet — fill in a date, cycle label, and cycle day for at least one row."); return; }
    try {
      await storePutMany(valid.map(draftRowToVisit));
      setDraftRows(withTrailingBlank(invalid.filter((r) => !isRowBlank(r))));
      const stillNeedFixing = invalid.filter((r) => !isRowBlank(r)).length;
      setStatus(`Saved ${valid.length} visit${valid.length === 1 ? "" : "s"}.` + (stillNeedFixing ? ` ${stillNeedFixing} row${stillNeedFixing === 1 ? "" : "s"} still need${stillNeedFixing === 1 ? "s" : ""} fixing.` : ""));
      setError("");
      refresh();
    } catch (err) { setError("Couldn't save all rows: " + err.message); }
  };

  const requestDelete = (id) => {
    setPendingConfirm({
      message: "Delete this visit? This can't be undone.",
      action: async () => {
        try { await storeDelete(id); setStatus("Visit deleted."); setError(""); refresh(); }
        catch (err) { setError("Couldn't delete that visit: " + err.message); }
        setPendingConfirm(null);
      },
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(visits, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fertility-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    setStatus("Backup file downloaded.");
  };
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error("File doesn't look like a valid backup.");
      const validVisits = data.filter((v) => v.id && v.date && v.cycleLabel);
      await storePutMany(validVisits);
      setStatus(`Imported ${validVisits.length} visit(s).`);
      setError("");
      refresh();
    } catch (err) { setError("Import failed: " + err.message); }
    e.target.value = "";
  };
  const requestClearAll = () => {
    setPendingConfirm({
      message: "Delete ALL saved visits? This can't be undone. Consider exporting a backup first.",
      action: async () => {
        try { await storeClear(); setStatus("All local data cleared."); setError(""); refresh(); }
        catch (err) { setError("Couldn't clear data: " + err.message); }
        setPendingConfirm(null);
      },
    });
  };

  const handleLoadFakeData = async () => {
    try {
      await storePutMany(generateFakeVisits());
      setStatus("Fake data loaded — explore the charts below. Use \u201cClear all local data\u201d anytime to start fresh with your own.");
      setError("");
      refresh();
    } catch (err) { setError("Couldn't load fake data: " + err.message); }
  };

  if (!ready) return null;

  return (
    <div style={{ fontFamily: "'Helvetica Neue',Arial,sans-serif", background: paper, minHeight: "100%", padding: "22px 18px 48px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <DisclaimerBanner />

        <div style={{ borderBottom: `2px solid ${ink}`, paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: amber, fontWeight: 700, marginBottom: 3 }}>Browser-local storage</div>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: 25, color: ink, margin: 0 }}>Local Fertility Lab Tracker</h1>
          <p style={{ fontSize: 12.5, color: "#6B6456", margin: "6px 0 12px" }}>
            Enter visits in the grid below like a spreadsheet — type directly, or copy cells from Excel or Google
            Sheets and paste them in. Everything is saved in your browser's local storage on this device, no account, no server.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <StoragePill count={visits.length} />
            {visits.length === 0 && (
              <button onClick={handleLoadFakeData} style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${sageDeep}`, background: panel, color: sageDeep, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                Load fake data to explore
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 4 }}>
              <label htmlFor="user-age" style={{ fontSize: 11.5, fontWeight: 700, color: ink }}>Age</label>
              <input id="user-age" type="text" inputMode="numeric" value={age}
                onChange={(e) => handleAgeChange(e.target.value)} placeholder="e.g. 34"
                style={{ width: 48, padding: "5px 8px", borderRadius: 20, border: `1px solid ${hair}`, fontSize: 12.5, background: panel, color: ink }} />
              <span style={{ fontSize: 11, color: "#8A8272" }}>
                {age ? `FSH/AMH/AFC ranges tuned for ${ageInfo.band.label}` : "Adjusts FSH/AMH/AFC reference ranges below"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <SpreadsheetGrid rows={draftRows} onChangeCell={changeDraftCell} onPasteBlock={pasteBlock} onRemoveRow={removeDraftRow} onDuplicateRow={duplicateDraftRow} onAddRows={addRows} onSaveRow={saveRow} onSaveAll={saveAllValid} />

          {error && <div style={{ fontSize: 12, color: rust, background: "#FBEFEA", border: `1px solid ${rust}`, borderRadius: 4, padding: "8px 12px" }}>{error}</div>}
          {status && !error && <div style={{ fontSize: 12, color: sageDeep, background: "#EAF0EA", border: `1px solid ${sage}`, borderRadius: 4, padding: "8px 12px" }}>{status}</div>}
          {pendingConfirm && <ConfirmBar message={pendingConfirm.message} onConfirm={pendingConfirm.action} onCancel={() => setPendingConfirm(null)} />}

          <div>
            <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: ink, margin: "4px 0 8px" }}>Saved visits</h3>
            <VisitTable visits={visits} onEdit={editVisit} onDelete={requestDelete} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${hair}`, paddingTop: 16 }}>
            <button onClick={handleExport} style={{ padding: "9px 16px", borderRadius: 4, border: `1px solid ${sageDeep}`, background: panel, color: sageDeep, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Download backup (.json)</button>
            <label style={{ padding: "9px 16px", borderRadius: 4, border: `1px solid ${hair}`, background: panel, color: ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Import backup
              <input type="file" accept="application/json" onChange={handleImport} style={{ display: "none" }} />
            </label>
            {visits.length === 0 && <button onClick={handleLoadFakeData} style={{ padding: "9px 16px", borderRadius: 4, border: `1px solid ${hair}`, background: panel, color: ink, fontSize: 12.5, cursor: "pointer" }}>Load fake data</button>}
            <button onClick={requestClearAll} style={{ padding: "9px 16px", borderRadius: 4, border: `1px solid ${hair}`, background: "none", color: rust, fontSize: 12.5, cursor: "pointer", marginLeft: "auto" }}>Clear all local data</button>
          </div>

          <HormoneDashboardSection visits={visits} onLoadFakeData={handleLoadFakeData} ageInfo={ageInfo} />
        </div>

        <DisclaimerFooter />
      </div>
    </div>
  );
}
