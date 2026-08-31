// ── PURE UTILITY FUNCTIONS ──────────────────────────────────────────────
// Extracted from App.jsx so they can be imported by both the app and tests.

// ── DATE HELPERS ────────────────────────────────────────────────────────
export function normalizeDate(raw) {
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

// ── LAB RESULT PARSING PATTERNS ─────────────────────────────────────────
export const LAB_PATTERNS = [
  { key: "fsh", label: "FSH", patterns: [/\bFSH[\s:=]+(\d+\.?\d*)/i, /follicle[\s-]*stimulat\w*[^0-9]*(\d+\.?\d*)/i] },
  { key: "lh", label: "LH", patterns: [/\bLH[\s:=]+(\d+\.?\d*)/i, /luteiniz\w*[^0-9]*(\d+\.?\d*)/i] },
  { key: "e2", label: "E2", patterns: [/\bE2[\s:=]+(\d+\.?\d*)/i, /estradiol[^0-9]*(\d+\.?\d*)/i] },
  { key: "pgn", label: "Progesterone", patterns: [/progesterone[^0-9]*(\d+\.?\d*)/i, /\bP4[\s:=]+(\d+\.?\d*)/i] },
  { key: "tsh", label: "TSH", patterns: [/\bTSH[\s:=]+(\d+\.?\d*)/i, /thyroid[\s-]*stimulat\w*[^0-9]*(\d+\.?\d*)/i] },
  { key: "amh", label: "AMH", patterns: [/\bAMH[\s:=]+(\d+\.?\d*)/i, /anti[\s-]*m[uü]llerian[^0-9]*(\d+\.?\d*)/i] },
];

export const DATE_EXTRACT_PATTERNS = [
  /(\d{4}-\d{2}-\d{2})/,
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})/i,
];

export function parseLabText(text) {
  const values = {};
  LAB_PATTERNS.forEach(({ key, patterns }) => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) { values[key] = m[1]; break; }
    }
  });
  let date = "";
  for (const re of DATE_EXTRACT_PATTERNS) {
    const m = text.match(re);
    if (m) { date = normalizeDate(m[1]); break; }
  }
  return { values, date };
}
