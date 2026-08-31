import { describe, it, expect } from "vitest";
import {
  CYCLE_TYPES,
  cycleTypeInfo,
  isMedicatedCycle,
  cycleResultLabel,
  emptyCycleRecord,
  normalizeCycleRecord,
  isBlankCycleRecord,
  betaDoublingTimeDays,
  summarizeBetas,
  summarizeCycleLabs,
} from "./cycles.js";

// ── cycleTypeInfo / isMedicatedCycle ────────────────────────────────────
describe("cycleTypeInfo", () => {
  it("looks a known type up by id", () => {
    expect(cycleTypeInfo("ivf-stim").label).toBe("IVF stimulation");
    expect(cycleTypeInfo("natural").short).toBe("Natural");
  });

  it("falls back to the 'not set' entry for unknown or missing ids", () => {
    expect(cycleTypeInfo("").id).toBe("");
    expect(cycleTypeInfo(undefined).id).toBe("");
    expect(cycleTypeInfo("something-invented").id).toBe("");
  });

  it("gives every type a unique id", () => {
    const ids = CYCLE_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("isMedicatedCycle", () => {
  it("flags stimulated and oral-medication protocols", () => {
    expect(isMedicatedCycle({ cycleType: "ivf-stim" })).toBe(true);
    expect(isMedicatedCycle({ cycleType: "letrozole" })).toBe(true);
    expect(isMedicatedCycle({ cycleType: "fet" })).toBe(true);
  });

  it("does not flag natural, monitoring-only, or unset cycles", () => {
    expect(isMedicatedCycle({ cycleType: "natural" })).toBe(false);
    expect(isMedicatedCycle({ cycleType: "monitoring" })).toBe(false);
    expect(isMedicatedCycle({ cycleType: "" })).toBe(false);
  });

  it("handles a missing record", () => {
    expect(isMedicatedCycle(null)).toBe(false);
    expect(isMedicatedCycle(undefined)).toBe(false);
  });
});

describe("cycleResultLabel", () => {
  it("resolves a known result", () => {
    expect(cycleResultLabel("live-birth")).toBe("Live birth");
  });

  it("falls back to 'Not set' for anything unknown", () => {
    expect(cycleResultLabel("")).toBe("Not set");
    expect(cycleResultLabel("bogus")).toBe("Not set");
  });
});

// ── normalizeCycleRecord ────────────────────────────────────────────────
describe("normalizeCycleRecord", () => {
  it("returns a fully formed empty record for junk input", () => {
    [null, undefined, "string", 42, []].forEach((junk) => {
      const rec = normalizeCycleRecord(junk);
      expect(rec.cycleType).toBe("");
      expect(rec.medications).toEqual([]);
      expect(rec.betas).toEqual([]);
      expect(rec.events).toHaveProperty("trigger", "");
      expect(rec.outcome).toHaveProperty("result", "");
    });
  });

  it("keeps recognized values", () => {
    const rec = normalizeCycleRecord({
      cycleType: "ivf-stim",
      triggerType: "Ovidrel",
      triggerTime: "21:00",
      lutealSupport: "PIO nightly",
      events: { trigger: "2026-08-12", retrieval: "2026-08-14" },
      outcome: { eggsRetrieved: 12, result: "freeze-all" },
      notes: "went well",
    });
    expect(rec.cycleType).toBe("ivf-stim");
    expect(rec.triggerType).toBe("Ovidrel");
    expect(rec.triggerTime).toBe("21:00");
    expect(rec.lutealSupport).toBe("PIO nightly");
    expect(rec.events.trigger).toBe("2026-08-12");
    expect(rec.events.retrieval).toBe("2026-08-14");
    expect(rec.outcome.result).toBe("freeze-all");
    expect(rec.notes).toBe("went well");
  });

  it("coerces numeric outcome counts to strings for the form inputs", () => {
    const rec = normalizeCycleRecord({ outcome: { eggsRetrieved: 12, blastocysts: 0 } });
    expect(rec.outcome.eggsRetrieved).toBe("12");
    expect(rec.outcome.blastocysts).toBe("0");
  });

  it("drops an unrecognized cycle type and result rather than storing it", () => {
    const rec = normalizeCycleRecord({ cycleType: "made-up", outcome: { result: "made-up" } });
    expect(rec.cycleType).toBe("");
    expect(rec.outcome.result).toBe("");
  });

  it("ignores unknown event keys", () => {
    const rec = normalizeCycleRecord({ events: { trigger: "2026-08-12", teleport: "2026-08-13" } });
    expect(rec.events.trigger).toBe("2026-08-12");
    expect(rec.events).not.toHaveProperty("teleport");
  });

  it("rebuilds medications and betas, giving each a stable id", () => {
    const rec = normalizeCycleRecord({
      medications: [{ name: "Gonal-F", dose: "225 IU" }, "junk", null],
      betas: [{ date: "2026-08-20", value: 118 }, 7],
    });
    expect(rec.medications).toHaveLength(1);
    expect(rec.medications[0].name).toBe("Gonal-F");
    expect(rec.medications[0].id).toBeTruthy();
    expect(rec.medications[0].startDay).toBe("");
    expect(rec.betas).toHaveLength(1);
    expect(rec.betas[0].value).toBe("118");
  });

  it("ignores a non-array medications or betas field", () => {
    const rec = normalizeCycleRecord({ medications: "Gonal-F", betas: { a: 1 } });
    expect(rec.medications).toEqual([]);
    expect(rec.betas).toEqual([]);
  });

  it("is idempotent", () => {
    const once = normalizeCycleRecord({ cycleType: "fet", outcome: { result: "ongoing" } });
    expect(normalizeCycleRecord(once)).toEqual(once);
  });
});

// ── isBlankCycleRecord ──────────────────────────────────────────────────
describe("isBlankCycleRecord", () => {
  it("treats a fresh record and missing input as blank", () => {
    expect(isBlankCycleRecord(emptyCycleRecord())).toBe(true);
    expect(isBlankCycleRecord(null)).toBe(true);
  });

  it("detects any single filled field", () => {
    const cases = [
      { cycleType: "natural" },
      { triggerType: "Ovidrel" },
      { triggerTime: "21:00" },
      { lutealSupport: "PIO" },
      { notes: "note" },
      { events: { iui: "2026-08-14" } },
      { outcome: { result: "not-pregnant" } },
      { outcome: { eggsRetrieved: "8" } },
      { outcome: { notes: "freeze-all" } },
      { medications: [{ name: "Letrozole" }] },
      { betas: [{ date: "2026-08-20", value: "118" }] },
    ];
    cases.forEach((patch) => {
      expect(isBlankCycleRecord(normalizeCycleRecord(patch))).toBe(false);
    });
  });

  it("still counts a record with only empty medication rows as blank", () => {
    const rec = normalizeCycleRecord({ medications: [{ name: "", dose: "" }] });
    expect(isBlankCycleRecord(rec)).toBe(true);
  });
});

// ── betaDoublingTimeDays ────────────────────────────────────────────────
describe("betaDoublingTimeDays", () => {
  it("returns 2 days for a value that exactly doubles in 2 days", () => {
    const t = betaDoublingTimeDays({ date: "2026-08-20", value: 100 }, { date: "2026-08-22", value: 200 });
    expect(t).toBeCloseTo(2, 6);
  });

  it("returns 1 day for a value that doubles in 1 day", () => {
    const t = betaDoublingTimeDays({ date: "2026-08-20", value: 50 }, { date: "2026-08-21", value: 100 });
    expect(t).toBeCloseTo(1, 6);
  });

  it("returns a shorter doubling time for a faster rise", () => {
    const fast = betaDoublingTimeDays({ date: "2026-08-20", value: 100 }, { date: "2026-08-22", value: 400 });
    const slow = betaDoublingTimeDays({ date: "2026-08-20", value: 100 }, { date: "2026-08-22", value: 150 });
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeCloseTo(1, 6);
  });

  it("accepts string values as typed into the form", () => {
    const t = betaDoublingTimeDays({ date: "2026-08-20", value: "100" }, { date: "2026-08-22", value: "200" });
    expect(t).toBeCloseTo(2, 6);
  });

  it("returns null when the value does not rise", () => {
    expect(betaDoublingTimeDays({ date: "2026-08-20", value: 200 }, { date: "2026-08-22", value: 200 })).toBeNull();
    expect(betaDoublingTimeDays({ date: "2026-08-20", value: 200 }, { date: "2026-08-22", value: 100 })).toBeNull();
  });

  it("returns null for same-day or out-of-order draws", () => {
    expect(betaDoublingTimeDays({ date: "2026-08-20", value: 100 }, { date: "2026-08-20", value: 200 })).toBeNull();
    expect(betaDoublingTimeDays({ date: "2026-08-22", value: 100 }, { date: "2026-08-20", value: 200 })).toBeNull();
  });

  it("returns null for missing, zero, or non-numeric values", () => {
    expect(betaDoublingTimeDays(null, { date: "2026-08-22", value: 200 })).toBeNull();
    expect(betaDoublingTimeDays({ date: "2026-08-20", value: 0 }, { date: "2026-08-22", value: 200 })).toBeNull();
    expect(betaDoublingTimeDays({ date: "2026-08-20", value: "abc" }, { date: "2026-08-22", value: 200 })).toBeNull();
    expect(betaDoublingTimeDays({ date: "", value: 100 }, { date: "2026-08-22", value: 200 })).toBeNull();
  });
});

// ── summarizeBetas ──────────────────────────────────────────────────────
describe("summarizeBetas", () => {
  it("sorts by date and annotates each draw after the first", () => {
    const rows = summarizeBetas([
      { id: "b", date: "2026-08-22", value: "200" },
      { id: "a", date: "2026-08-20", value: "100" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows[0].doublingDays).toBeNull();
    expect(rows[1].doublingDays).toBeCloseTo(2, 6);
  });

  it("drops rows with no date or no usable value", () => {
    const rows = summarizeBetas([
      { id: "a", date: "2026-08-20", value: "100" },
      { id: "b", date: "", value: "200" },
      { id: "c", date: "2026-08-24", value: "" },
      { id: "d", date: "2026-08-26", value: "abc" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("a");
  });

  it("returns numbers, not strings, for the values", () => {
    const rows = summarizeBetas([{ id: "a", date: "2026-08-20", value: "118" }]);
    expect(rows[0].value).toBe(118);
  });

  it("handles empty and missing input", () => {
    expect(summarizeBetas([])).toEqual([]);
    expect(summarizeBetas(null)).toEqual([]);
  });

  it("leaves doublingDays null across a flat stretch", () => {
    const rows = summarizeBetas([
      { id: "a", date: "2026-08-20", value: "100" },
      { id: "b", date: "2026-08-22", value: "100" },
    ]);
    expect(rows[1].doublingDays).toBeNull();
  });
});

// ── summarizeCycleLabs ──────────────────────────────────────────────────
describe("summarizeCycleLabs", () => {
  const visits = [
    { cycleLabel: "Cycle 1", cycleDay: 3, fsh: 7.2, e2: 45, endo: 3.5, pgn: 0.4 },
    { cycleLabel: "Cycle 1", cycleDay: 12, e2: 320, endo: 9.1, follicle: 19, pgn: 1.2 },
    { cycleLabel: "Cycle 1", cycleDay: 21, e2: 180, endo: 8.4, pgn: 14.5 },
    { cycleLabel: "Cycle 2", cycleDay: 3, fsh: 9.9, e2: 60 },
  ];

  it("picks the peak value of each marker within one cycle", () => {
    const s = summarizeCycleLabs(visits, "Cycle 1");
    expect(s.peakE2).toBe(320);
    expect(s.peakEndo).toBe(9.1);
    expect(s.peakFollicle).toBe(19);
    expect(s.peakProgesterone).toBe(14.5);
  });

  it("counts only that cycle's visits", () => {
    expect(summarizeCycleLabs(visits, "Cycle 1").visitCount).toBe(3);
    expect(summarizeCycleLabs(visits, "Cycle 2").visitCount).toBe(1);
  });

  it("reads baseline FSH from the earliest day 2-4 draw", () => {
    expect(summarizeCycleLabs(visits, "Cycle 1").baselineFsh).toBe(7.2);
    expect(summarizeCycleLabs(visits, "Cycle 2").baselineFsh).toBe(9.9);
  });

  it("prefers the lower cycle day when several baseline draws exist", () => {
    const many = [
      { cycleLabel: "C", cycleDay: 4, fsh: 8 },
      { cycleLabel: "C", cycleDay: 2, fsh: 6 },
    ];
    expect(summarizeCycleLabs(many, "C").baselineFsh).toBe(6);
  });

  it("ignores an FSH drawn outside the day 2-4 window for the baseline", () => {
    const late = [{ cycleLabel: "C", cycleDay: 9, fsh: 11 }];
    expect(summarizeCycleLabs(late, "C").baselineFsh).toBeNull();
  });

  it("returns nulls for a cycle with no matching visits", () => {
    const s = summarizeCycleLabs(visits, "Cycle 99");
    expect(s.visitCount).toBe(0);
    expect(s.peakE2).toBeNull();
    expect(s.peakEndo).toBeNull();
    expect(s.baselineFsh).toBeNull();
  });

  it("skips null and missing readings rather than treating them as zero", () => {
    const sparse = [
      { cycleLabel: "C", cycleDay: 3, e2: null },
      { cycleLabel: "C", cycleDay: 12, e2: 250 },
    ];
    expect(summarizeCycleLabs(sparse, "C").peakE2).toBe(250);
  });

  it("handles empty and missing visit lists", () => {
    expect(summarizeCycleLabs([], "C").peakE2).toBeNull();
    expect(summarizeCycleLabs(null, "C").visitCount).toBe(0);
  });
});
