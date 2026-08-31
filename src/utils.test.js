import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
  addDays,
  daysBetween,
  computeCycleStartDates,
  cycleDayForDate,
  normalizeOcrText,
  reconstructPdfLines,
  extractReportDate,
  isMedicationLine,
  stripMedicationLines,
} from "./utils.js";

const fixture = (name) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

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

  it("recognizes vitals headers", () => {
    expect(guessFieldForHeader("Systolic")).toBe("bpSys");
    expect(guessFieldForHeader("BP Sys")).toBe("bpSys");
    expect(guessFieldForHeader("SBP")).toBe("bpSys");
    expect(guessFieldForHeader("Diastolic BP")).toBe("bpDia");
    expect(guessFieldForHeader("DBP")).toBe("bpDia");
    expect(guessFieldForHeader("Heart rate")).toBe("hr");
    expect(guessFieldForHeader("Pulse")).toBe("hr");
    expect(guessFieldForHeader("bpm")).toBe("hr");
  });

  it("matches short vitals headers only when they stand alone", () => {
    expect(guessFieldForHeader("HR")).toBe("hr");
    expect(guessFieldForHeader("hr")).toBe("hr");
    expect(guessFieldForHeader("BP")).toBe("bpSys");
    // "hr" as a substring of an unrelated word must not map to heart rate.
    expect(guessFieldForHeader("Chart")).toBe("ignore");
    expect(guessFieldForHeader("Threshold")).toBe("ignore");
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

    it("detects month-name date format and converts to ISO", () => {
      const result = parseLabText("August 15, 2026. FSH: 5.2");
      expect(result.date).toBe("2026-08-15");
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

  describe("reference-range and layout robustness", () => {
    it("skips a reference range that comes before the value", () => {
      const result = parseLabText("FSH 2.5-10.2 mIU/mL 5.2");
      expect(result.values.fsh).toBe("5.2");
    });

    it("detects nothing on a line that only carries the reference range", () => {
      // OCR often fails to read the value while the printed range survives;
      // importing a range bound would silently fabricate a result.
      const result = parseLabText("Estradiol 43-180 pg/mL Premeno-luteal");
      expect(result.values.e2).toBeUndefined();
    });

    it("does not read a Pg/E2 ratio as an estradiol result", () => {
      const text = "Estradiol 60 43-180 pg/mL\nRatio: Pg/E2 40 L (optimal 100-500)";
      expect(parseLabText(text).values.e2).toBe("60");
      expect(parseLabText("Ratio: Pg/E2 40 L").values.e2).toBeUndefined();
      expect(parseLabText("Pg/E2 40").values.e2).toBeUndefined();
    });

    it("ignores value-column noise like zero-padded lab codes", () => {
      // Labcorp-style row where OCR dropped the value: the trailing 01 is
      // a lab code, not a TSH of 1.
      const result = parseLabText("TSH uIU/mL 0.450 - 4.500 01");
      expect(result.values.tsh).toBeUndefined();
    });

    it("rejects implausible numbers such as phone numbers and years", () => {
      const brochure =
        "Follicle stimulating hormone (FSH) regulates estradiol production. Call 800.878.3787";
      expect(parseLabText(brochure).values.fsh).toBeUndefined();
      expect(parseLabText("Estradiol was last tested in 2018").values.e2).toBeUndefined();
    });

    it("picks up a value that wrapped to the next line", () => {
      const result = parseLabText("FSH\n5.2\nLH\n3.8");
      expect(result.values.fsh).toBe("5.2");
      expect(result.values.lh).toBe("3.8");
    });

    it("does not steal the next analyte's row as a wrapped value", () => {
      const result = parseLabText("FSH\nLH: 3.8");
      expect(result.values.fsh).toBeUndefined();
      expect(result.values.lh).toBe("3.8");
    });
  });

  describe("OCR artifacts", () => {
    it("reads values through table gridlines OCR'd as pipes", () => {
      expect(parseLabText("FSH | 5.2 | mIU/mL").values.fsh).toBe("5.2");
    });

    it("reads decimal points OCR'd as commas", () => {
      expect(parseLabText("TSH: 1,82 uIU/mL").values.tsh).toBe("1.82");
    });

    it("recovers common label misreads", () => {
      expect(parseLabText("F5H: 5.2 mIU/mL").values.fsh).toBe("5.2");
      expect(parseLabText("SH 3.51 mIU/L").values.tsh).toBe("3.51");
      expect(parseLabText("IH: 3.8 mIU/mL").values.lh).toBe("3.8");
      expect(parseLabText("EZ 42 pg/mL").values.e2).toBe("42");
    });
  });
});

// ── medication list filtering ───────────────────────────────────────────
// A portal export prints the medication list beside the labs, and its rows
// name the same hormones: "Progesterone 200 MG Capsule" is a 200mg
// prescription, not a day-21 progesterone of 200 ng/mL.
describe("medication list filtering", () => {
  describe("isMedicationLine", () => {
    it("flags a prescription row by its dose strength", () => {
      expect(isMedicationLine("Progesterone 200 MG Capsule")).toBe(true);
      expect(isMedicationLine("Progesterone 200 MG")).toBe(true);
      expect(isMedicationLine("Letrozole 2.5 MG Tablet")).toBe(true);
      expect(isMedicationLine("Chorionic Gonadotropin 10000 UNIT Solution")).toBe(true);
    });

    it("flags a prescription row by its dosage form or SIG wording", () => {
      expect(isMedicationLine("1 capsule at bedtime Orally Once a day; Duration: 10 days")).toBe(true);
      expect(isMedicationLine("inject 225 units as directed Subcutaneous daily")).toBe(true);
      expect(isMedicationLine("Progesterone in oil 50 mg/mL")).toBe(true);
      expect(isMedicationLine("estradiol patch — apply twice weekly")).toBe(true);
    });

    it("leaves a result row alone, including lab units that look like doses", () => {
      expect(isMedicationLine("Progesterone 1.2 ng/mL 0.1-0.9")).toBe(false);
      expect(isMedicationLine("Estradiol 412 pg/mL")).toBe(false);
      // "mcg/dL" and "IU/mL" are how assays report out, not how a drug is dosed.
      expect(isMedicationLine("T4 (THYROXINE), TOTAL 8.5 4.5-12.0 mcg/dL")).toBe(false);
      expect(isMedicationLine("TPOab* 10 0-150 IU/mL")).toBe(false);
      expect(isMedicationLine("FSH 5.2 IU/L")).toBe(false);
    });

    it("does not read a paragraph about hormone therapy as a prescription", () => {
      const prose =
        "Consider creating a more balanced progesterone/estradiol ratio with " +
        "progesterone and/or estrogen supplementation, taken daily (assuming no " +
        "contraindications); consult with a health care provider for proper dosing " +
        "and to review any medication you are already taking before starting.";
      expect(isMedicationLine(prose)).toBe(false);
    });
  });

  describe("stripMedicationLines", () => {
    it("drops every row under a MEDICATIONS heading, bare entries included", () => {
      const { text, removed } = stripMedicationLines(
        "MEDICATIONS\nProgesterone 200 MG Capsule 08/07/2026 Active\nProgesterone Unknown"
      );
      expect(text.trim()).toBe("");
      expect(removed).toBe(2);
    });

    it("keeps the line count so a wrapped value still follows its label", () => {
      const text = "Progesterone 200 MG Capsule\nProgesterone\n2.4";
      expect(stripMedicationLines(text).text.split("\n")).toHaveLength(3);
    });

    it("recognizes the headings a portal prints over the list", () => {
      ["MEDICATIONS", "Medications", "Current Medications", "Your Medication List",
       "Med list", "Prescriptions"].forEach((heading) => {
        // A bare list entry with no prescription vocabulary of its own is
        // dropped on the strength of the heading above it.
        expect(stripMedicationLines(`${heading}\nProgesterone 200`).removed).toBe(1);
      });
    });

    it("closes the list at the next section heading", () => {
      const { text } = stripMedicationLines(
        "Current Medications\nProgesterone 200 MG Capsule\nLab Results\nProgesterone 1.2"
      );
      expect(text).toContain("Progesterone 1.2");
      expect(text).not.toContain("200 MG");
    });

    it("closes the list at a row printed in assay units", () => {
      const { text } = stripMedicationLines(
        "Medications\nProgesterone 200 MG Capsule\nProgesterone 1.2 ng/mL\nEstradiol 412"
      );
      expect(text).toContain("Progesterone 1.2 ng/mL");
      expect(text).toContain("Estradiol 412");
    });

    it("leaves a document with no medication list untouched", () => {
      const text = "FSH 5.2 mIU/mL\nLH 3.8 mIU/mL";
      expect(stripMedicationLines(text)).toEqual({ text, removed: 0 });
    });
  });

  describe("parseLabText over medication rows", () => {
    it("does not import a prescribed dose as a result", () => {
      const row =
        "Progesterone 200 MG Capsule 1 capsule at bedtime Orally Once a day; " +
        "Duration: 10 days 08/07/2026 Active";
      expect(parseLabText(row).values).toEqual({});
      expect(parseLabText("Estradiol 2 MG Tablet 1 tablet Orally twice a day").values).toEqual({});
      expect(parseLabText("Progesterone in oil 50 mg/mL inject 1 mL IM nightly").values).toEqual({});
    });

    it("does not take a prescription's start date as the visit date", () => {
      expect(parseLabText("MEDICATIONS\nProgesterone 200 MG Capsule 08/07/2026 Active").date).toBe("");
    });

    it("reports how many medication rows it ignored", () => {
      const doc = "MEDICATIONS\nProgesterone 200 MG Capsule\nLetrozole 2.5 MG Tablet";
      expect(parseLabText(doc).medicationLines).toBe(2);
      expect(parseLabText("Progesterone: 12.8 ng/mL").medicationLines).toBe(0);
    });

    it("still reads the results when both are in one document", () => {
      const doc = `
        Collected: 08/12/2026

        LAB RESULTS
        Estradiol      412   pg/mL
        Progesterone   1.2   ng/mL

        MEDICATIONS
        Medication                 SIG (Take, Route, Frequency, Duration)   Start Date
        Progesterone 200 MG        1 capsule at bedtime                     08/07/2026
        Capsule                    Orally Once a day;
        Estradiol 2 MG Tablet      1 tablet Orally twice a day              08/06/2026
      `;
      const { values, date } = parseLabText(doc);
      expect(values.e2).toBe("412");
      expect(values.pgn).toBe("1.2");
      expect(date).toBe("2026-08-12");
    });

    it("reads the labs when the medication list comes first", () => {
      const doc = [
        "CURRENT MEDICATIONS",
        "Progesterone 200 MG Capsule   1 capsule at bedtime   08/07/2026   Active",
        "",
        "LABORATORY RESULTS",
        "Collected 08/14/2026",
        "Progesterone   1.2   ng/mL",
      ].join("\n");
      const { values, date } = parseLabText(doc);
      expect(values.pgn).toBe("1.2");
      expect(date).toBe("2026-08-14");
    });
  });
});

// ── normalizeOcrText ────────────────────────────────────────────────────
describe("normalizeOcrText", () => {
  it("replaces vertical bars with spaces", () => {
    expect(normalizeOcrText("FSH | 5.2")).toBe("FSH   5.2");
  });

  it("fixes misread decimal commas but keeps thousands separators", () => {
    expect(normalizeOcrText("TSH 1,82")).toBe("TSH 1.82");
    expect(normalizeOcrText("E2 1,234 pg/mL")).toBe("E2 1234 pg/mL");
  });

  it("repairs label character confusions", () => {
    expect(normalizeOcrText("F5H 5.2")).toBe("FSH 5.2");
    expect(normalizeOcrText("T5H 1.8")).toBe("TSH 1.8");
    expect(normalizeOcrText("SH 3.51")).toBe("TSH 3.51");
    expect(normalizeOcrText("1H 3.8")).toBe("LH 3.8");
    expect(normalizeOcrText("Estradlol 60")).toBe("estradiol 60");
  });

  it("only rewrites ambiguous tokens when a number follows", () => {
    expect(normalizeOcrText("SHBG 88 nmol/L")).toBe("SHBG 88 nmol/L");
    expect(normalizeOcrText("the SH sound")).toBe("the SH sound");
  });

  it("leaves clean text untouched", () => {
    const clean = "FSH: 5.2 mIU/mL Reference: 2.5-10.2";
    expect(normalizeOcrText(clean)).toBe(clean);
  });

  it("handles null/empty", () => {
    expect(normalizeOcrText("")).toBe("");
    expect(normalizeOcrText(null)).toBe("");
  });
});

// ── reconstructPdfLines ─────────────────────────────────────────────────
describe("reconstructPdfLines", () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });

  it("groups fragments sharing a Y coordinate into one line, left to right", () => {
    const items = [item("14.4", 200, 500), item("FSH", 40, 500), item("2.4-9.3", 320, 500)];
    expect(reconstructPdfLines(items)).toBe("FSH 14.4 2.4-9.3");
  });

  it("orders lines top of page first (descending Y)", () => {
    const items = [item("LH 11.8", 40, 480), item("FSH 14.4", 40, 500)];
    expect(reconstructPdfLines(items)).toBe("FSH 14.4\nLH 11.8");
  });

  it("tolerates small Y jitter within a line", () => {
    const items = [item("FSH", 40, 500), item("14.4", 200, 501.5)];
    expect(reconstructPdfLines(items)).toBe("FSH 14.4");
  });

  it("drops empty fragments and items without positions", () => {
    const items = [item("FSH 14.4", 40, 500), item("   ", 100, 500), { str: "stray" }];
    expect(reconstructPdfLines(items)).toBe("FSH 14.4");
  });
});

// ── extractReportDate ───────────────────────────────────────────────────
describe("extractReportDate", () => {
  it("never uses a date of birth as the report date", () => {
    expect(extractReportDate("DOB: 03/22/1988\nCollected: 08/15/2026")).toBe("2026-08-15");
    expect(extractReportDate("Patient DOB 5/17/1980")).toBe("");
  });

  it("prefers collection dates over report/printed dates", () => {
    const text = "Report Date: 10/04/2026\nCollected: 09/22/2026";
    expect(extractReportDate(text)).toBe("2026-09-22");
  });

  it("prefers an unlabeled date over a report date", () => {
    expect(extractReportDate("Printed 10/23/2026 Visit of 09/09/2026")).toBe("2026-09-09");
  });

  it("falls back to a report date when nothing better exists", () => {
    expect(extractReportDate("Reported: 10/04/2026")).toBe("2026-10-04");
  });

  it("skips impossible calendar dates", () => {
    expect(extractReportDate("code 55/55/2026, drawn 08/15/2026")).toBe("2026-08-15");
  });
});

// ── real report fixtures ────────────────────────────────────────────────
// Captured output of the app's actual extraction pipeline (pdfjs text
// extraction, tesseract.js OCR) over published sample lab reports — see
// src/__fixtures__/README.md for sources and how to regenerate.
describe("real report fixtures", () => {
  const VALUE_KEYS = ["fsh", "lh", "e2", "pgn", "tsh", "amh"];
  const valuesOf = (text) => {
    const { values } = parseLabText(text);
    const out = {};
    VALUE_KEYS.forEach((k) => { if (values[k] !== undefined) out[k] = values[k]; });
    return out;
  };

  it("ZRT fertility panel PDF (line-reconstructed text layer)", () => {
    const text = fixture("zrt-fertility-report.pdf-lines.txt");
    expect(valuesOf(text)).toEqual({ fsh: "14.4", lh: "11.8", e2: "60", pgn: "2.4", tsh: "1.8" });
    // 5/17/1980 (DOB) and 10/23/2018 (print stamp) must not win.
    expect(parseLabText(text).date).toBe("2018-09-28");
  });

  it("ZRT fertility panel PDF (legacy space-joined text)", () => {
    const text = fixture("zrt-fertility-report.pdf-joined.txt");
    expect(valuesOf(text)).toEqual({ fsh: "14.4", lh: "11.8", e2: "60", pgn: "2.4", tsh: "1.8" });
    expect(parseLabText(text).date).toBe("2018-09-22");
  });

  it("ZRT fertility panel screenshot OCR where values are unreadable", () => {
    // Tesseract only recovers the reference ranges; detecting nothing is
    // the correct outcome (the old parser reported LH 1.6, E2 43, Pgn 3.3
    // — all range bounds).
    const text = fixture("zrt-fertility-report.ocr.txt");
    expect(valuesOf(text)).toEqual({});
  });

  it("Labcorp-style thyroid panel screenshots", () => {
    expect(valuesOf(fixture("thyroid-labcorp-basic.ocr.txt"))).toEqual({ tsh: "1.070" });
    expect(valuesOf(fixture("thyroid-labcorp-expanded.ocr.txt"))).toEqual({ tsh: "2.680" });
  });

  it("Quest-style thyroid panel screenshots", () => {
    expect(valuesOf(fixture("thyroid-quest-basic.ocr.txt"))).toEqual({ tsh: "1.70" });
    // OCR read "TSH" as "SH" in this capture; normalization recovers it.
    expect(valuesOf(fixture("thyroid-quest-expanded.ocr.txt"))).toEqual({ tsh: "3.51" });
  });

  it("patient-portal medication list detects nothing", () => {
    // Screenshot of a fertility clinic's medication table: every row names a
    // drug, and three name hormones this app tracks. The old parser read
    // "Progesterone 200 MG Capsule" as a progesterone of 200 ng/mL and the
    // prescription's start date as the visit date.
    const text = fixture("portal-medication-list.ocr.txt");
    expect(valuesOf(text)).toEqual({});
    expect(parseLabText(text).date).toBe("");
    expect(parseLabText(text).medicationLines).toBeGreaterThan(10);
  });

  it("hormone brochure with no results detects nothing", () => {
    expect(valuesOf(fixture("brochure-no-results.pdf-joined.txt"))).toEqual({});
    expect(valuesOf(fixture("brochure-no-results.ocr.txt"))).toEqual({});
  });
});

// ── addDays / daysBetween ───────────────────────────────────────────────
describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-08-15", 5)).toBe("2026-08-20");
  });

  it("subtracts days across a month boundary", () => {
    expect(addDays("2026-03-02", -5)).toBe("2026-02-25");
  });

  it("handles leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("returns empty for a non-ISO or missing date", () => {
    expect(addDays("08/15/2026", 1)).toBe("");
    expect(addDays("", 1)).toBe("");
    expect(addDays(null, 1)).toBe("");
  });

  it("is a no-op for a zero delta", () => {
    expect(addDays("2026-08-15", 0)).toBe("2026-08-15");
  });

  // Spring-forward in most US timezones: local-time arithmetic on this date
  // is where an off-by-one day would show up.
  it("is unaffected by a DST boundary", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
});

describe("daysBetween", () => {
  it("counts forward days", () => {
    expect(daysBetween("2026-08-01", "2026-08-15")).toBe(14);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-08-01", "2026-08-01")).toBe(0);
  });

  it("returns a negative count when the second date is earlier", () => {
    expect(daysBetween("2026-08-15", "2026-08-01")).toBe(-14);
  });

  it("spans a DST boundary without drifting", () => {
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
  });

  it("returns null for invalid input", () => {
    expect(daysBetween("nope", "2026-08-01")).toBeNull();
    expect(daysBetween("2026-08-01", "")).toBeNull();
    expect(daysBetween(null, null)).toBeNull();
  });
});

// ── computeCycleStartDates ──────────────────────────────────────────────
describe("computeCycleStartDates", () => {
  it("infers day 1 from a visit's date and cycle day", () => {
    const visits = [{ cycleLabel: "Cycle 1", date: "2026-08-12", cycleDay: 12 }];
    expect(computeCycleStartDates(visits)["Cycle 1"]).toBe("2026-08-01");
  });

  it("treats a day-1 visit as the start date itself", () => {
    const visits = [{ cycleLabel: "Cycle 1", date: "2026-08-01", cycleDay: 1 }];
    expect(computeCycleStartDates(visits)["Cycle 1"]).toBe("2026-08-01");
  });

  it("handles several cycles independently", () => {
    const visits = [
      { cycleLabel: "Cycle 1", date: "2026-08-03", cycleDay: 3 },
      { cycleLabel: "Cycle 2", date: "2026-09-05", cycleDay: 5 },
    ];
    const starts = computeCycleStartDates(visits);
    expect(starts["Cycle 1"]).toBe("2026-08-01");
    expect(starts["Cycle 2"]).toBe("2026-09-01");
  });

  it("prefers the lowest cycle day when visits disagree", () => {
    // The day-21 visit implies Aug 1; the day-2 visit implies Aug 2. The
    // lower cycle day wins, being least sensitive to a mistyped day.
    const visits = [
      { cycleLabel: "Cycle 1", date: "2026-08-21", cycleDay: 21 },
      { cycleLabel: "Cycle 1", date: "2026-08-03", cycleDay: 2 },
    ];
    expect(computeCycleStartDates(visits)["Cycle 1"]).toBe("2026-08-02");
  });

  it("ignores visits with an unusable date or cycle day", () => {
    const visits = [
      { cycleLabel: "Cycle 1", date: "not-a-date", cycleDay: 3 },
      { cycleLabel: "Cycle 2", date: "2026-08-03", cycleDay: 0 },
      { cycleLabel: "Cycle 3", date: "2026-08-03", cycleDay: "x" },
    ];
    expect(computeCycleStartDates(visits)).toEqual({});
  });

  it("returns an empty map for no visits", () => {
    expect(computeCycleStartDates([])).toEqual({});
    expect(computeCycleStartDates(null)).toEqual({});
  });
});

// ── cycleDayForDate ─────────────────────────────────────────────────────
describe("cycleDayForDate", () => {
  it("maps the start date itself to day 1", () => {
    expect(cycleDayForDate("2026-08-01", "2026-08-01")).toBe(1);
  });

  it("maps a later date to the right cycle day", () => {
    expect(cycleDayForDate("2026-08-01", "2026-08-14")).toBe(14);
  });

  it("round-trips with computeCycleStartDates", () => {
    const visits = [{ cycleLabel: "Cycle 1", date: "2026-08-12", cycleDay: 12 }];
    const start = computeCycleStartDates(visits)["Cycle 1"];
    expect(cycleDayForDate(start, "2026-08-12")).toBe(12);
  });

  it("returns a day below 1 for a date before the cycle started", () => {
    expect(cycleDayForDate("2026-08-10", "2026-08-08")).toBe(-1);
  });

  it("returns null when either date is unusable", () => {
    expect(cycleDayForDate("", "2026-08-01")).toBeNull();
    expect(cycleDayForDate("2026-08-01", "")).toBeNull();
  });
});
