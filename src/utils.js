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
  notes: ["note"],
};

export function guessFieldForHeader(text) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "ignore";
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
  const t = normalizeOcrText(text || "");
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

  return { values, date: extractReportDate(t) };
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
