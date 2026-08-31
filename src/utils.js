// ── PURE UTILITY FUNCTIONS ──────────────────────────────────────────────
// Extracted from App.jsx so they can be imported by both the app and tests.

// ── DATE HELPERS ────────────────────────────────────────────────────────
const MONTH_NUMBERS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function normalizeDate(raw) {
  const s = (raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const mn = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mn) {
    const mo = MONTH_NUMBERS[mn[1].slice(0, 3).toLowerCase()];
    if (mo) return `${mn[3]}-${String(mo).padStart(2, "0")}-${mn[2].padStart(2, "0")}`;
  }
  return s;
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function computeCycleDateRanges(visits) {
  const ranges = {};
  visits.forEach((v) => {
    if (!ranges[v.cycleLabel]) ranges[v.cycleLabel] = { min: v.date, max: v.date };
    else {
      if (v.date < ranges[v.cycleLabel].min) ranges[v.cycleLabel].min = v.date;
      if (v.date > ranges[v.cycleLabel].max) ranges[v.cycleLabel].max = v.date;
    }
  });
  return ranges;
}

export function formatDateRange(range) {
  if (!range) return "";
  if (range.min === range.max) return formatDateShort(range.min);
  return `${formatDateShort(range.min)} – ${formatDateShort(range.max)}`;
}

// Day arithmetic runs in UTC so a DST boundary can never shift a date by one.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function addDays(dateStr, delta) {
  if (!ISO_DATE.test(dateStr || "")) return "";
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(fromDate, toDate) {
  if (!ISO_DATE.test(fromDate || "") || !ISO_DATE.test(toDate || "")) return null;
  const a = new Date(fromDate + "T00:00:00Z");
  const b = new Date(toDate + "T00:00:00Z");
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Infers each cycle's day-1 date from its visits: a visit on cycle day N was
// N-1 days after day 1. Visits within a cycle can disagree if a cycle day was
// mistyped, so the visit with the *lowest* cycle day wins — it's the closest
// to day 1 and therefore the least sensitive to that kind of drift.
export function computeCycleStartDates(visits) {
  const best = {};
  (visits || []).forEach((v) => {
    if (!v || !ISO_DATE.test(v.date || "")) return;
    const day = Number(v.cycleDay);
    if (!Number.isFinite(day) || day < 1) return;
    const prev = best[v.cycleLabel];
    if (prev && prev.day <= day) return;
    const start = addDays(v.date, -(day - 1));
    if (start) best[v.cycleLabel] = { day, start };
  });
  const out = {};
  Object.entries(best).forEach(([label, { start }]) => { out[label] = start; });
  return out;
}

// Maps a calendar date onto the cycle-day axis the charts are drawn against,
// so a treatment event recorded as a date can be marked on them. Day 1 is the
// cycle's start date itself.
export function cycleDayForDate(startDate, dateStr) {
  const diff = daysBetween(startDate, dateStr);
  return diff === null ? null : diff + 1;
}

// ── NUMBER EXTRACTION ───────────────────────────────────────────────────
export function extractNumber(raw) {
  const s = (raw || "").trim();
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? m[0] : "";
}

// ── PASTE PARSING ───────────────────────────────────────────────────────
export function splitLine(line, delimiter) {
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

export function parsePastedText(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  return lines.map((l) => splitLine(l, delimiter));
}

// ── FIELD HEADER DETECTION ──────────────────────────────────────────────
const FIELD_KEYWORDS = {
  date: ["date"],
  cycleDay: ["cycle day", "day"],
  cycleLabel: ["cycle label", "cycle name", "cycle"],
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
  bpSys: ["systolic", "sys bp", "bp sys", "sbp"],
  bpDia: ["diastolic", "dia bp", "bp dia", "dbp"],
  hr: ["heart rate", "pulse", "bpm"],
  notes: ["note"],
};

// Headers too short to match safely as a substring ("hr" would also hit
// "Chart"), so they only ever match a cell that is exactly that word.
const EXACT_FIELD_HEADERS = { hr: "hr", bp: "bpSys", pulse: "hr" };

export function guessFieldForHeader(text) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "ignore";
  if (EXACT_FIELD_HEADERS[t]) return EXACT_FIELD_HEADERS[t];
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) return field;
  }
  return "ignore";
}

// ── OCR TEXT NORMALIZATION ──────────────────────────────────────────────
// Tesseract output of lab reports carries predictable artifacts: table
// gridlines read as pipes, decimal points read as commas, and characters
// swapped inside the short analyte labels. Fixing them before parsing is
// safe for clean text too (every rule is a no-op on well-formed input),
// so parseLabText applies this to both the PDF and OCR paths.
export function normalizeOcrText(text) {
  let t = text || "";
  // Table gridlines / column separators read as vertical bars.
  t = t.replace(/[|│┃¦]/g, " ");
  // 1,234 is a thousands separator; 1,8 or 1,82 is a misread decimal point.
  t = t.replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  t = t.replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2");
  // Character confusions inside analyte labels. The ones that rewrite a
  // token another word could legitimately match require a number to
  // follow, so prose is left alone.
  t = t.replace(/\bF[5$]H\b/g, "FSH");
  t = t.replace(/\bFS[Il1]{2}\b/g, "FSH");
  t = t.replace(/\bT[5$]H\b/g, "TSH");
  t = t.replace(/\bTS[Il1]{2}\b/g, "TSH");
  t = t.replace(/\bAM[Il1]{2}\b/g, "AMH");
  t = t.replace(/\b[I1l]H\b(?=[^A-Za-z0-9\n]{0,6}\d)/g, "LH");
  t = t.replace(/\bSH\b(?=[^A-Za-z0-9\n]{0,6}\d)/g, "TSH");
  t = t.replace(/\bEZ\b(?=[^A-Za-z0-9\n]{0,6}\d)/g, "E2");
  t = t.replace(/£2\b/g, "E2");
  t = t.replace(/estrad[il1]o[l1]/gi, "estradiol");
  return t;
}

// ── MEDICATION LIST FILTERING ───────────────────────────────────────────
// Portal exports and after-visit summaries print the medication list in the
// same document as the labs, and its rows carry the same hormone names:
// "Progesterone 200 MG Capsule" is a prescription for a 200mg capsule, not
// a day-21 progesterone of 200 ng/mL. Every signal below is prescription
// vocabulary — a dose strength, a dosage form, SIG/route wording — that a
// result row never carries, so lab lines pass through untouched.

// Units a drug is dispensed in. A lab concentration can look the same
// ("8.5 mcg/dL"), so a strength unit followed by "/" only counts when it
// reads per-millilitre the way a vial is labeled ("50 mg/mL", "900
// UNT/1.08ML"); IU/mL and µU/mL are how assays report out, never a dose.
const DOSE_UNITS = "mcg|mg|µg|μg|ug|gm|g|units?|unts?";
const DOSE_STRENGTH_RE = new RegExp(`\\d+(\\.\\d+)?\\s*(${DOSE_UNITS}|iu)\\b(?!\\s*/)`, "i");
const DOSE_PER_ML_RE = new RegExp(`\\d+(\\.\\d+)?\\s*(${DOSE_UNITS})\\s*/\\s*\\d*\\.?\\d*\\s*ml\\b`, "i");

const DOSAGE_FORM_RE = /\b(tablets?|tabs?|capsules?|caplets?|softgels?|gel\s?caps?|lozenges?|troches?|suppositor(y|ies)|pessar(y|ies)|vials?|amp[ou]{1,2}les?|syringes?|pen[\s-]?injectors?|auto[\s-]?injectors?|inhalers?|transdermal|sublingual\w*|patch(es)?)\b/i;

const SIG_RE = /\b(takes?|taking|inject(s|ed|ing|ions?)?|instill|swallow|appl(y|ied)|orally|by mouth|subcutaneous\w*|subcut|sub-?q|intramuscular\w*|intravaginal\w*|vaginally|rectally|topically|as directed|as needed|at bedtime|before bed|nightly|once a day|twice a day|three times a day|every \d+ hours?|daily|b\.?i\.?d|t\.?i\.?d|q\.?i\.?d|q\.?h\.?s|p\.?r\.?n|refills?|dispense|sig|prescri\w*|duration:\s*\d+)\b/i;

// Assay units. A row that prints one is a result, whatever else is on it —
// this is what closes a medication list that never got a closing heading.
const LAB_UNIT_RE = /\b(ng|pg|µg|μg|ug|mcg|nmol|pmol|µmol|umol|mmol|mIU|uIU|µIU|μIU|IU|mU|uU|µU|μU|U)\s*\/\s*(mL|dL|L)\b/i;

// A prescription row is a table row, not a paragraph. Prose about hormone
// therapy ("…natural progesterone… consult a provider for proper dosing")
// carries the same words, so only short lines are read as medication rows.
const MED_LINE_MAX = 200;

const MED_HEADING_RE = /^[\s#*·•>\-–—|:]*((your|my|patient|current|active|home|discharge|outpatient|inpatient|new|continued|complete|updated|other)\s+)?(medications?|meds?\s+list|meds|prescriptions?|drug list|pharmacy|rx)\b/i;

const OTHER_HEADING_RE = /^[\s#*·•>\-–—|:]*(lab(orator)?\w*|results?|chemistry|hematology|hormones?|endocrin\w*|panels?|patholog\w*|microbiolog\w*|urinalysis|serolog\w*|vitals?|vital signs|allerg\w*|problems?|diagnos\w*|assessment|plan|immuniz\w*|vaccin\w*|procedures?|imaging|radiolog\w*|histor\w*|orders?|encounters?|visits?|appointments?|instructions?|follow[\s-]?up|notes?|summary|signature|specimens?|patient|provider)\b/i;

// A heading is a short line of words: "MEDICATIONS", or the column header
// "Medication  SIG (Take, Route, Frequency, Duration)  Start Date". A line
// carrying digits is a row of data, not the heading above it.
function isHeadingLine(line, re) {
  const t = (line || "").trim();
  return t !== "" && t.length <= 120 && !/\d/.test(t) && re.test(t);
}

export function isMedicationLine(line) {
  const t = (line || "").trim();
  if (t === "" || t.length > MED_LINE_MAX) return false;
  if (LAB_UNIT_RE.test(t)) return false;
  return (
    DOSE_STRENGTH_RE.test(t) || DOSE_PER_ML_RE.test(t) ||
    DOSAGE_FORM_RE.test(t) || SIG_RE.test(t)
  );
}

// Blanks out every medication row so the lab parser never sees one, keeping
// the line count intact so a value that wrapped to the next line still
// lines up with its label. Rows are dropped either because the line itself
// reads as a prescription, or because it sits under a MEDICATIONS heading —
// a list entry as bare as "Progesterone 200" has no vocabulary of its own.
export function stripMedicationLines(text) {
  const lines = (text || "").split(/\r\n|\r|\n/);
  let inMeds = false;
  let removed = 0;
  const kept = lines.map((line) => {
    if (isHeadingLine(line, MED_HEADING_RE)) { inMeds = true; return ""; }
    if (isHeadingLine(line, OTHER_HEADING_RE)) { inMeds = false; return line; }
    if (LAB_UNIT_RE.test(line)) { inMeds = false; return line; }
    if (isMedicationLine(line) || (inMeds && line.trim() !== "")) { removed++; return ""; }
    return line;
  });
  return { text: kept.join("\n"), removed };
}

// ── PDF TEXT LINE RECONSTRUCTION ────────────────────────────────────────
// pdf.js returns positioned text fragments, not lines. Joining them with
// spaces (the old behavior) collapses a whole page into one string, which
// loses the row structure the parser relies on. Group fragments that share
// a Y coordinate into a line, ordered left to right, top of page first.
export function reconstructPdfLines(items) {
  const lines = [];
  for (const it of items) {
    if (!it || !it.str || it.str.trim() === "" || !it.transform) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    let line = lines.find((l) => Math.abs(l.y - y) <= 2);
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, str: it.str.trim() });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines
    .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" "))
    .join("\n");
}

// ── LAB RESULT PARSING ──────────────────────────────────────────────────
// Each analyte: how its label appears (abbreviation and/or full name) and
// the widest value that could plausibly be a result, so reference-range
// bounds, years, phone numbers, and axis labels are never imported as
// results. `label` is shown in the import review UI.
export const LAB_PATTERNS = [
  { key: "fsh", label: "FSH", abbrev: /FSH/i, name: /follicle[\s-]*stimulat\w*(\s*hormone)?/i, max: 200 },
  { key: "lh", label: "LH", abbrev: /LH/i, name: /luteini[sz]\w*(\s*hormone)?/i, max: 200 },
  { key: "e2", label: "E2", abbrev: /E2/i, name: /estradiol/i, max: 20000 },
  { key: "pgn", label: "Progesterone", abbrev: /P4/i, name: /progesterone/i, max: 300 },
  { key: "tsh", label: "TSH", abbrev: /TSH/i, name: /thyroid[\s-]*stimulat\w*(\s*hormone)?/i, max: 150 },
  { key: "amh", label: "AMH", abbrev: /AMH/i, name: /anti[\s-]*m[uü]llerian(\s*hormone)?/i, max: 60 },
];

// An abbreviation counts only when it stands alone: not inside a word, and
// not preceded by "/" — "Pg/E2" is a ratio, not an estradiol result.
const ABBREV_RES = LAB_PATTERNS.map(({ abbrev }) =>
  new RegExp(`(^|[^A-Za-z0-9/])(${abbrev.source})\\b`, abbrev.flags)
);
const NAME_RES = LAB_PATTERNS.map(({ name }) => name);

const REF_RANGE_RE = /\(?\d+(\.\d+)?\s*[-–—~]\s*\d+(\.\d+)?\)?%?/g;
const INLINE_DATE_RE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
const TIME_RE = /\b\d{1,2}:\d{2}(:\d{2})?\b/g;

// How far past its label a result value can sit. Real reports keep them
// within a couple of column widths; anything farther is unrelated text.
const VALUE_WINDOW = 80;

// First number in the segment that could actually be this analyte's
// result: reference ranges, dates, and times are stripped first, and
// zero, zero-padded lab/station codes ("01"), and values beyond `max`
// are skipped. Returns "" when nothing qualifies — an honest miss beats
// importing a range bound.
function firstPlausibleNumber(segment, max) {
  const cleaned = segment
    .replace(INLINE_DATE_RE, " ")
    .replace(TIME_RE, " ")
    .replace(REF_RANGE_RE, " ");
  const numRe = /\d+(\.\d+)?/g;
  let m;
  while ((m = numRe.exec(cleaned))) {
    if (/^0\d/.test(m[0])) continue;
    if (/^(19|20)\d{2}$/.test(m[0])) continue; // bare year, not a result
    const v = parseFloat(m[0]);
    if (v > 0 && v <= max) return m[0];
  }
  return "";
}

function lineMatchesAnyLabel(line) {
  return NAME_RES.some((re) => re.test(line)) || ABBREV_RES.some((re) => re.test(line));
}

export function parseLabText(text) {
  // Medication rows go first: they name the same hormones as the results
  // ("Progesterone 200 MG Capsule") and a dose read as a result is worse
  // than no result at all. The date is read from what survives too — a
  // prescription's start date is not the day the blood was drawn.
  const { text: t, removed: medicationLines } =
    stripMedicationLines(normalizeOcrText(text || ""));
  const lines = t.split(/\r\n|\r|\n/);
  const values = {};

  lines.forEach((line, li) => {
    if (/^\s*ratio\b/i.test(line)) return;
    LAB_PATTERNS.forEach(({ key, max }, i) => {
      if (values[key] !== undefined) return;
      // Prefer the spelled-out name; fall back to the abbreviation.
      let idx = -1;
      const nm = line.match(NAME_RES[i]);
      if (nm) idx = nm.index + nm[0].length;
      else {
        const am = line.match(ABBREV_RES[i]);
        if (am) idx = am.index + am[0].length;
      }
      if (idx < 0) return;
      const rest = line.slice(idx, idx + VALUE_WINDOW);
      const found = firstPlausibleNumber(rest, max);
      if (found) { values[key] = found; return; }
      // Label at the end of a line with no digits after it: the value may
      // have wrapped to the next line (common in OCR of narrow columns),
      // but only claim it when that line starts with a number and isn't
      // some other analyte's row.
      if (!/\d/.test(rest)) {
        const next = lines.slice(li + 1).find((l) => l.trim() !== "");
        if (next && !lineMatchesAnyLabel(next)) {
          const lead = next
            .replace(REF_RANGE_RE, " ")
            .match(/^\s*(\d+(\.\d+)?)\b/);
          if (lead) {
            const v = firstPlausibleNumber(lead[1], max);
            if (v) values[key] = v;
          }
        }
      }
    });
  });

  return { values, date: extractReportDate(t), medicationLines };
}

// ── REPORT DATE DETECTION ───────────────────────────────────────────────
export const DATE_EXTRACT_PATTERNS = [
  /(\d{4}-\d{2}-\d{2})/,
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})/i,
];

const DATE_SCAN_RE = new RegExp(
  DATE_EXTRACT_PATTERNS.map((re) => re.source).join("|"),
  "gi"
);

// Nearby wording that tells us what a date on a lab report means. A
// birth date must never be imported as the visit date; collection-type
// dates beat unlabeled ones, which beat report/print/received dates.
const DATE_CONTEXT = [
  { tier: -1, re: /\b(dob|birth)\b/gi },
  { tier: 0, re: /\b(collect\w*|drawn|draw|specimen|service|results?)\b/gi },
  { tier: 2, re: /\b(report\w*|received|printed|generated|faxed|expir\w*)\b/gi },
];

function isRealDate(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  return y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

export function extractReportDate(text) {
  const t = text || "";
  const byTier = {};
  let m;
  let prevEnd = 0;
  DATE_SCAN_RE.lastIndex = 0;
  while ((m = DATE_SCAN_RE.exec(t))) {
    const iso = normalizeDate(m[0]);
    const start = Math.max(m.index - 32, prevEnd);
    prevEnd = m.index + m[0].length;
    if (!isRealDate(iso)) continue;
    // Classify by the nearest label word in the ~32 chars before the date,
    // stopping at the previous date so its label isn't misread as ours.
    const context = t.slice(start, m.index);
    let tier = 1;
    let best = -1;
    for (const { tier: ct, re } of DATE_CONTEXT) {
      re.lastIndex = 0;
      let cm;
      let last = -1;
      while ((cm = re.exec(context))) last = cm.index;
      if (last > best) { best = last; tier = ct; }
    }
    if (tier >= 0 && byTier[tier] === undefined) byTier[tier] = iso;
  }
  return byTier[0] ?? byTier[1] ?? byTier[2] ?? "";
}
