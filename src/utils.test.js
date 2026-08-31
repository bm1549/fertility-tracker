import { describe, it, expect } from "vitest";
import {
  normalizeDate,
  formatDateShort,
  computeCycleDateRanges,
  formatDateRange,
  extractNumber,
  splitLine,
  parsePastedText,
  guessFieldForHeader,
  parseLabText,
} from "./utils.js";

// ── normalizeDate ───────────────────────────────────────────────────────
describe("normalizeDate", () => {
  it("passes through ISO dates unchanged", () => {
    expect(normalizeDate("2026-08-15")).toBe("2026-08-15");
  });

  it("converts MM/DD/YYYY to ISO", () => {
    expect(normalizeDate("08/15/2026")).toBe("2026-08-15");
  });

  it("converts M/D/YYYY with single digits", () => {
    expect(normalizeDate("1/5/2026")).toBe("2026-01-05");
  });

  it("converts MM/DD/YY with 2-digit year", () => {
    expect(normalizeDate("08/15/26")).toBe("2026-08-15");
  });

  it("returns original string for unrecognized formats", () => {
    expect(normalizeDate("August 15")).toBe("August 15");
  });

  it("handles null/empty gracefully", () => {
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate(null)).toBe("");
    expect(normalizeDate(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeDate("  2026-08-15  ")).toBe("2026-08-15");
  });
});

// ── formatDateShort ─────────────────────────────────────────────────────
describe("formatDateShort", () => {
  it("formats ISO date as short US date", () => {
    const result = formatDateShort("2026-08-15");
    expect(result).toMatch(/Aug\s+15/);
  });

  it("returns empty for falsy input", () => {
    expect(formatDateShort("")).toBe("");
    expect(formatDateShort(null)).toBe("");
    expect(formatDateShort(undefined)).toBe("");
  });
});

// ── computeCycleDateRanges ──────────────────────────────────────────────
describe("computeCycleDateRanges", () => {
  it("computes min/max dates per cycle label", () => {
    const visits = [
      { cycleLabel: "Cycle 1", date: "2026-07-05" },
      { cycleLabel: "Cycle 1", date: "2026-07-10" },
      { cycleLabel: "Cycle 1", date: "2026-07-02" },
      { cycleLabel: "Cycle 2", date: "2026-08-01" },
    ];
    const ranges = computeCycleDateRanges(visits);
    expect(ranges["Cycle 1"]).toEqual({ min: "2026-07-02", max: "2026-07-10" });
    expect(ranges["Cycle 2"]).toEqual({ min: "2026-08-01", max: "2026-08-01" });
  });

  it("returns empty object for no visits", () => {
    expect(computeCycleDateRanges([])).toEqual({});
  });

  it("handles a single visit per cycle", () => {
    const visits = [{ cycleLabel: "Cycle 1", date: "2026-07-05" }];
    expect(computeCycleDateRanges(visits)["Cycle 1"]).toEqual({
      min: "2026-07-05",
      max: "2026-07-05",
    });
  });
});

// ── formatDateRange ─────────────────────────────────────────────────────
describe("formatDateRange", () => {
  it("returns empty for null/undefined range", () => {
    expect(formatDateRange(null)).toBe("");
    expect(formatDateRange(undefined)).toBe("");
  });

  it("returns single date when min === max", () => {
    const result = formatDateRange({ min: "2026-07-05", max: "2026-07-05" });
    expect(result).toMatch(/Jul\s+5/);
    expect(result).not.toContain("–");
  });

  it("returns range when min !== max", () => {
    const result = formatDateRange({ min: "2026-07-05", max: "2026-08-02" });
    expect(result).toMatch(/Jul\s+5/);
    expect(result).toContain("–");
    expect(result).toMatch(/Aug\s+2/);
  });
});

// ── extractNumber ───────────────────────────────────────────────────────
describe("extractNumber", () => {
  it("extracts integer from string", () => {
    expect(extractNumber("42 mIU/mL")).toBe("42");
  });

  it("extracts decimal from string", () => {
    expect(extractNumber("5.2 ng/mL")).toBe("5.2");
  });

  it("extracts negative number", () => {
    expect(extractNumber("-3.5")).toBe("-3.5");
  });

  it("returns empty for no numbers", () => {
    expect(extractNumber("no numbers")).toBe("");
    expect(extractNumber("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(extractNumber(null)).toBe("");
    expect(extractNumber(undefined)).toBe("");
  });
});

// ── splitLine ───────────────────────────────────────────────────────────
describe("splitLine", () => {
  it("splits tab-delimited line", () => {
    expect(splitLine("a\tb\tc", "\t")).toEqual(["a", "b", "c"]);
  });

  it("splits comma-delimited line", () => {
    expect(splitLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with embedded delimiters", () => {
    expect(splitLine('"hello, world",b,c', ",")).toEqual(["hello, world", "b", "c"]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(splitLine('"he said ""hi""",b', ",")).toEqual(['he said "hi"', "b"]);
  });

  it("trims whitespace from cells", () => {
    expect(splitLine("  a ,  b , c  ", ",")).toEqual(["a", "b", "c"]);
  });
});

// ── parsePastedText ─────────────────────────────────────────────────────
describe("parsePastedText", () => {
  it("returns empty for blank input", () => {
    expect(parsePastedText("")).toEqual([]);
    expect(parsePastedText("  \n  ")).toEqual([]);
  });

  it("parses tab-delimited rows", () => {
    const text = "a\tb\tc\n1\t2\t3";
    expect(parsePastedText(text)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("parses comma-delimited rows when no tabs present", () => {
    const text = "a,b,c\n1,2,3";
    expect(parsePastedText(text)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles \\r\\n line endings", () => {
    const text = "a\tb\r\n1\t2";
    expect(parsePastedText(text)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    const text = "a\tb\n\n1\t2\n\n";
    expect(parsePastedText(text)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

// ── guessFieldForHeader ─────────────────────────────────────────────────
describe("guessFieldForHeader", () => {
  it("recognizes standard headers", () => {
    expect(guessFieldForHeader("Date")).toBe("date");
    expect(guessFieldForHeader("FSH")).toBe("fsh");
    expect(guessFieldForHeader("LH")).toBe("lh");
    expect(guessFieldForHeader("Estradiol")).toBe("e2");
    expect(guessFieldForHeader("Progesterone")).toBe("pgn");
    expect(guessFieldForHeader("AMH")).toBe("amh");
    expect(guessFieldForHeader("TSH")).toBe("tsh");
    expect(guessFieldForHeader("Notes")).toBe("notes");
    expect(guessFieldForHeader("Cycle Day")).toBe("cycleDay");
    expect(guessFieldForHeader("Cycle Label")).toBe("cycleLabel");
  });

  it("is case-insensitive", () => {
    expect(guessFieldForHeader("fsh")).toBe("fsh");
    expect(guessFieldForHeader("FSH")).toBe("fsh");
    expect(guessFieldForHeader("Fsh")).toBe("fsh");
  });

  it("recognizes AFC ovary-specific headers", () => {
    expect(guessFieldForHeader("AFC (right)")).toBe("afcR");
    expect(guessFieldForHeader("AFC (left)")).toBe("afcL");
    expect(guessFieldForHeader("Right AFC")).toBe("afcR");
  });

  it("returns 'ignore' for unrecognized headers", () => {
    expect(guessFieldForHeader("Something random")).toBe("ignore");
    expect(guessFieldForHeader("")).toBe("ignore");
    expect(guessFieldForHeader(null)).toBe("ignore");
  });
});

// ── parseLabText ────────────────────────────────────────────────────────
describe("parseLabText", () => {
  describe("hormone value detection", () => {
    it("detects FSH with colon format", () => {
      const result = parseLabText("FSH: 5.2 mIU/mL");
      expect(result.values.fsh).toBe("5.2");
    });

    it("detects FSH with equals format", () => {
      const result = parseLabText("FSH= 8.1");
      expect(result.values.fsh).toBe("8.1");
    });

    it("detects FSH by full name", () => {
      const result = parseLabText("Follicle Stimulating Hormone  5.2");
      expect(result.values.fsh).toBe("5.2");
    });

    it("detects LH", () => {
      const result = parseLabText("LH: 3.8 mIU/mL");
      expect(result.values.lh).toBe("3.8");
    });

    it("detects LH by full name", () => {
      const result = parseLabText("Luteinizing Hormone  18.7");
      expect(result.values.lh).toBe("18.7");
    });

    it("detects Estradiol by abbreviation", () => {
      const result = parseLabText("E2: 42 pg/mL");
      expect(result.values.e2).toBe("42");
    });

    it("detects Estradiol by full name", () => {
      const result = parseLabText("Estradiol  142 pg/mL");
      expect(result.values.e2).toBe("142");
    });

    it("detects Progesterone", () => {
      const result = parseLabText("Progesterone: 12.8 ng/mL");
      expect(result.values.pgn).toBe("12.8");
    });

    it("detects P4 abbreviation for progesterone", () => {
      const result = parseLabText("P4: 0.4 ng/mL");
      expect(result.values.pgn).toBe("0.4");
    });

    it("detects TSH", () => {
      const result = parseLabText("TSH: 1.82 uIU/mL");
      expect(result.values.tsh).toBe("1.82");
    });

    it("detects TSH by full name", () => {
      const result = parseLabText("Thyroid Stimulating Hormone  2.1");
      expect(result.values.tsh).toBe("2.1");
    });

    it("detects AMH", () => {
      const result = parseLabText("AMH: 2.1 ng/mL");
      expect(result.values.amh).toBe("2.1");
    });

    it("detects AMH by full name", () => {
      const result = parseLabText("Anti-Müllerian Hormone  1.8");
      expect(result.values.amh).toBe("1.8");
    });
  });

  describe("multi-value lab reports", () => {
    it("detects multiple values from a typical lab report", () => {
      const labText = `
        Lab Results - 08/15/2026
        FSH: 5.2 mIU/mL    Reference: 2.5-10.2
        LH: 3.8 mIU/mL     Reference: 1.9-12.5
        Estradiol: 42 pg/mL Reference: 19-144
        TSH: 1.82 uIU/mL   Reference: 0.40-4.50
        AMH: 2.1 ng/mL
      `;
      const result = parseLabText(labText);
      expect(result.values.fsh).toBe("5.2");
      expect(result.values.lh).toBe("3.8");
      expect(result.values.e2).toBe("42");
      expect(result.values.tsh).toBe("1.82");
      expect(result.values.amh).toBe("2.1");
    });

    it("detects values from a tabular lab format", () => {
      const labText = `
        FSH              5.2        mIU/mL       2.5-10.2
        LH               3.8        mIU/mL       1.9-12.5
        Progesterone     0.4        ng/mL        0.1-0.9
      `;
      const result = parseLabText(labText);
      expect(result.values.fsh).toBe("5.2");
      expect(result.values.lh).toBe("3.8");
      expect(result.values.pgn).toBe("0.4");
    });
  });

  describe("date detection", () => {
    it("detects ISO date format", () => {
      const result = parseLabText("Lab results from 2026-08-15. FSH: 5.2");
      expect(result.date).toBe("2026-08-15");
    });

    it("detects US date format MM/DD/YYYY", () => {
      const result = parseLabText("Lab results from 08/15/2026. FSH: 5.2");
      expect(result.date).toBe("2026-08-15");
    });

    it("detects US date format MM/DD/YY", () => {
      const result = parseLabText("Date: 08/15/26. FSH: 5.2");
      expect(result.date).toBe("2026-08-15");
    });

    it("detects month-name date format", () => {
      const result = parseLabText("August 15, 2026. FSH: 5.2");
      // normalizeDate won't convert this to ISO, it passes through
      // The date extract pattern matches "August 15, 2026" and normalizeDate returns it as-is
      expect(result.date).toBe("August 15, 2026");
    });

    it("returns empty date when none found", () => {
      const result = parseLabText("FSH: 5.2 mIU/mL");
      expect(result.date).toBe("");
    });
  });

  describe("edge cases", () => {
    it("returns empty values for text with no lab data", () => {
      const result = parseLabText("This is just some random text with no lab values.");
      expect(Object.keys(result.values)).toHaveLength(0);
      expect(result.date).toBe("");
    });

    it("handles empty string", () => {
      const result = parseLabText("");
      expect(Object.keys(result.values)).toHaveLength(0);
      expect(result.date).toBe("");
    });

    it("handles integer values (no decimal)", () => {
      const result = parseLabText("FSH: 8 mIU/mL");
      expect(result.values.fsh).toBe("8");
    });

    it("does not cross-contaminate between hormones", () => {
      // "LH" shouldn't match inside "mL" or other substrings
      const result = parseLabText("FSH: 5.2 mIU/mL\nLH: 3.8 mIU/mL");
      expect(result.values.fsh).toBe("5.2");
      expect(result.values.lh).toBe("3.8");
    });
  });
});
