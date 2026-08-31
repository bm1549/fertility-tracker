// ── CYCLE TREATMENT CONTEXT UI ──────────────────────────────────────────
// Two views over the per-cycle records in cycles.js:
//   • CycleTreatmentSection — one editable card per cycle (protocol, meds,
//     trigger, timed events, retrieval/embryo outcomes, betas).
//   • CycleComparisonTable  — every cycle side by side, the way a clinic
//     reviews what changed between attempts.

import { useState } from "react";
import { formatDateShort, formatDateRange, cycleDayForDate } from "./utils.js";
import {
  CYCLE_TYPES, CYCLE_EVENTS, OUTCOME_COUNTS, CYCLE_RESULTS,
  cycleTypeInfo, cycleResultLabel, emptyCycleRecord, newMedication, newBeta,
  summarizeBetas, summarizeCycleLabs, isBlankCycleRecord,
} from "./cycles.js";
import { ink, paper, panel, hair, sage, sageDeep, amber, rust, muted, faint, smallBtn } from "./theme.js";

// Results that read as a positive outcome, a negative one, or neither —
// used only to tint the outcome chip, never to interpret anything clinically.
const POSITIVE_RESULTS = new Set(["clinical-pregnancy", "ongoing", "live-birth"]);
const NEGATIVE_RESULTS = new Set(["not-pregnant", "cancelled", "chemical", "miscarriage", "ectopic"]);
function resultTone(id) {
  if (POSITIVE_RESULTS.has(id)) return sageDeep;
  if (NEGATIVE_RESULTS.has(id)) return rust;
  return muted;
}

// ── SMALL FORM PRIMITIVES ───────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "6px 8px", border: `1px solid ${hair}`, borderRadius: 4,
  fontSize: 12, fontFamily: "inherit", color: ink, background: paper, boxSizing: "border-box",
};
const labelStyle = {
  display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase", color: muted, marginBottom: 4,
};

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 10, color: faint, marginTop: 3 }}>{hint}</span>}
    </label>
  );
}
function TextField({ label, value, onChange, placeholder, hint, type = "text", inputMode }) {
  return (
    <Field label={label} hint={hint}>
      <input type={type} inputMode={inputMode} value={value || ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </Field>
  );
}
function SelectField({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </Field>
  );
}
function SubHeading({ children, note }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: amber }}>{children}</div>
      {note && <div style={{ fontSize: 11, color: muted, marginTop: 3, lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}

// ── ONE CYCLE'S EDITOR CARD ─────────────────────────────────────────────
function CycleCard({ label, color, dateRange, startDate, record, onChange, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const rec = record || emptyCycleRecord();
  const typeInfo = cycleTypeInfo(rec.cycleType);

  // Every edit writes the whole record back, so the parent owns persistence
  // and this card stays a pure function of what it's given.
  const set = (patch) => onChange({ ...rec, ...patch });
  const setEvent = (key, value) => onChange({ ...rec, events: { ...rec.events, [key]: value } });
  const setOutcome = (key, value) => onChange({ ...rec, outcome: { ...rec.outcome, [key]: value } });
  const setMed = (id, patch) => onChange({ ...rec, medications: rec.medications.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const setBeta = (id, patch) => onChange({ ...rec, betas: rec.betas.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  // Turns an event date into "day 12" so it lines up with the cycle-day
  // x-axis the charts use. Silent when the cycle's day 1 can't be inferred.
  const dayHint = (dateStr) => {
    if (!dateStr || !startDate) return "";
    const day = cycleDayForDate(startDate, dateStr);
    return day && day >= 1 ? `Cycle day ${day}` : "";
  };

  const betaRows = summarizeBetas(rec.betas);
  const medSummary = rec.medications.filter((m) => m.name).map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name));
  const summaryBits = [];
  if (typeInfo.id) summaryBits.push(typeInfo.short);
  if (medSummary.length) summaryBits.push(medSummary.slice(0, 2).join(", ") + (medSummary.length > 2 ? ` +${medSummary.length - 2}` : ""));
  if (rec.outcome.result) summaryBits.push(cycleResultLabel(rec.outcome.result));

  return (
    <div style={{ border: `1px solid ${hair}`, borderRadius: 6, overflow: "hidden", background: panel }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: open ? paper : panel, border: "none", borderBottom: open ? `1px solid ${hair}` : "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: ink }}>{label}</span>
        {dateRange && <span style={{ fontSize: 10.5, color: faint }}>{formatDateRange(dateRange)}</span>}
        <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {summaryBits.length ? summaryBits.join(" · ") : "No treatment details recorded"}
        </span>
        <span style={{ fontSize: 11, color: faint }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "14px 14px 18px", display: "grid", gap: 16 }}>
          {/* Protocol */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <SelectField label="Cycle type" value={rec.cycleType} onChange={(v) => set({ cycleType: v })} options={CYCLE_TYPES}
              hint={typeInfo.medicated ? "Medicated — charts note that reference bands assume a natural cycle" : undefined} />
            <TextField label="Luteal support" value={rec.lutealSupport} onChange={(v) => set({ lutealSupport: v })}
              placeholder="e.g. PIO 1mL IM nightly from day 16" />
          </div>

          {/* Medications */}
          <div style={{ display: "grid", gap: 8 }}>
            <SubHeading note="Stimulation and suppression drugs, with the cycle days they ran.">Medications &amp; doses</SubHeading>
            {rec.medications.length === 0 && (
              <div style={{ fontSize: 11.5, color: faint, fontStyle: "italic" }}>No medications recorded for this cycle.</div>
            )}
            {rec.medications.map((m) => (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1.4fr) 74px 74px auto", gap: 8, alignItems: "end" }}>
                <TextField label="Drug" value={m.name} onChange={(v) => setMed(m.id, { name: v })} placeholder="Letrozole" />
                <TextField label="Dose" value={m.dose} onChange={(v) => setMed(m.id, { dose: v })} placeholder="5mg daily" />
                <TextField label="Start day" value={m.startDay} onChange={(v) => setMed(m.id, { startDay: v })} inputMode="numeric" placeholder="3" />
                <TextField label="End day" value={m.endDay} onChange={(v) => setMed(m.id, { endDay: v })} inputMode="numeric" placeholder="7" />
                <button onClick={() => set({ medications: rec.medications.filter((x) => x.id !== m.id) })}
                  title="Remove medication" aria-label={`Remove ${m.name || "medication"}`}
                  style={{ border: "none", background: "none", color: rust, cursor: "pointer", fontSize: 13, padding: "6px 4px" }}>✕</button>
              </div>
            ))}
            <button onClick={() => set({ medications: [...rec.medications, newMedication()] })}
              style={{ ...smallBtn(panel, sageDeep, `1px solid ${hair}`), justifySelf: "start" }}>+ Add medication</button>
          </div>

          {/* Trigger + timed events */}
          <div style={{ display: "grid", gap: 8 }}>
            <SubHeading note="Trigger timing is counted in hours — retrieval usually follows about 36 hours later, so the clock time matters as much as the date.">Trigger &amp; key events</SubHeading>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <TextField label="Trigger type" value={rec.triggerType} onChange={(v) => set({ triggerType: v })} placeholder="Ovidrel 250mcg" />
              <TextField label="Trigger date" type="date" value={rec.events.trigger} onChange={(v) => setEvent("trigger", v)} hint={dayHint(rec.events.trigger)} />
              <TextField label="Trigger time" type="time" value={rec.triggerTime} onChange={(v) => set({ triggerTime: v })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {CYCLE_EVENTS.filter((e) => e.key !== "trigger").map((e) => (
                <TextField key={e.key} label={e.label} type="date" value={rec.events[e.key]}
                  onChange={(v) => setEvent(e.key, v)} hint={dayHint(rec.events[e.key])} />
              ))}
            </div>
          </div>

          {/* Retrieval / embryo lab */}
          <div style={{ display: "grid", gap: 8 }}>
            <SubHeading note="For retrieval cycles: each step is a fraction of the one before it, and that attrition is what a clinic compares between cycles.">Retrieval &amp; embryo lab</SubHeading>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))", gap: 10 }}>
              {OUTCOME_COUNTS.map((c) => (
                <TextField key={c.key} label={c.label} value={rec.outcome[c.key]} inputMode="numeric"
                  onChange={(v) => setOutcome(c.key, v)} placeholder="—" />
              ))}
            </div>
          </div>

          {/* Betas */}
          <div style={{ display: "grid", gap: 8 }}>
            <SubHeading note="Serial hCG draws. The rise between draws is what's watched — a doubling time is computed for each draw after the first.">Beta hCG</SubHeading>
            {rec.betas.length === 0 && (
              <div style={{ fontSize: 11.5, color: faint, fontStyle: "italic" }}>No beta draws recorded for this cycle.</div>
            )}
            {rec.betas.map((b) => {
              const summary = betaRows.find((r) => r.id === b.id);
              return (
                <div key={b.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) auto", gap: 8, alignItems: "end" }}>
                  <TextField label="Draw date" type="date" value={b.date} onChange={(v) => setBeta(b.id, { date: v })} />
                  <TextField label="hCG (mIU/mL)" value={b.value} inputMode="decimal" onChange={(v) => setBeta(b.id, { value: v })} placeholder="—" />
                  <div style={{ fontSize: 11, color: summary && summary.doublingDays ? sageDeep : faint, paddingBottom: 7 }}>
                    {summary && summary.doublingDays
                      ? `Doubling ≈ ${summary.doublingDays.toFixed(1)} days`
                      : summary ? "First draw / no rise to compare" : ""}
                  </div>
                  <button onClick={() => set({ betas: rec.betas.filter((x) => x.id !== b.id) })}
                    title="Remove beta draw" aria-label="Remove beta draw"
                    style={{ border: "none", background: "none", color: rust, cursor: "pointer", fontSize: 13, padding: "6px 4px" }}>✕</button>
                </div>
              );
            })}
            <button onClick={() => set({ betas: [...rec.betas, newBeta()] })}
              style={{ ...smallBtn(panel, sageDeep, `1px solid ${hair}`), justifySelf: "start" }}>+ Add beta draw</button>
          </div>

          {/* Outcome */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <SelectField label="Cycle outcome" value={rec.outcome.result} onChange={(v) => setOutcome("result", v)} options={CYCLE_RESULTS} />
            <TextField label="Outcome notes" value={rec.outcome.notes} onChange={(v) => setOutcome("notes", v)} placeholder="e.g. 2 embryos frozen, transfer planned next cycle" />
          </div>
          <TextField label="Cycle notes" value={rec.notes} onChange={(v) => set({ notes: v })} placeholder="Anything else worth remembering about this cycle" />
        </div>
      )}
    </div>
  );
}

// ── SECTION: ALL CYCLE CARDS ────────────────────────────────────────────
export function CycleTreatmentSection({ cycleLabels, cycleColors, cycleDateRanges, cycleStartDates, cycles, onChangeCycle }) {
  if (!cycleLabels || cycleLabels.length === 0) return null;
  return (
    <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "18px 18px 20px" }}>
      <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: ink, margin: "0 0 6px" }}>Treatment context by cycle</h3>
      <p style={{ fontSize: 12, color: muted, margin: "0 0 14px", lineHeight: 1.5 }}>
        What kind of cycle each one was, and what was done during it. The charts below plot lab values against
        reference bands for a <em>natural</em> cycle — recording the protocol here is what makes a stimulated
        cycle&rsquo;s numbers readable, since estradiol and progesterone routinely run well above those bands on
        medication. Key event dates are also marked on the charts when a single cycle is selected.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {cycleLabels.map((label, i) => (
          <CycleCard key={label} label={label} color={cycleColors[label]}
            dateRange={cycleDateRanges ? cycleDateRanges[label] : null}
            startDate={cycleStartDates ? cycleStartDates[label] : ""}
            record={cycles[label]} onChange={(rec) => onChangeCycle(label, rec)}
            defaultOpen={cycleLabels.length === 1 && i === 0} />
        ))}
      </div>
    </div>
  );
}

// ── CYCLE COMPARISON TABLE ──────────────────────────────────────────────
const numOrDash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

function EmbryoChain({ outcome }) {
  const steps = [outcome.eggsRetrieved, outcome.eggsMature, outcome.fertilized, outcome.blastocysts];
  if (steps.every((s) => s === "" || s === undefined)) return <span style={{ color: faint }}>—</span>;
  return (
    <span title="Eggs retrieved → mature (MII) → fertilized (2PN) → blastocysts" style={{ whiteSpace: "nowrap" }}>
      {steps.map((s, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: faint, margin: "0 3px" }}>›</span>}
          <span style={{ fontWeight: s === "" ? 400 : 700, color: s === "" ? faint : ink }}>{numOrDash(s)}</span>
        </span>
      ))}
    </span>
  );
}

function PgtCell({ outcome }) {
  const bits = [];
  if (outcome.pgtNormal !== "") bits.push(`${outcome.pgtNormal} euploid`);
  if (outcome.pgtAbnormal !== "") bits.push(`${outcome.pgtAbnormal} aneuploid`);
  if (outcome.pgtMosaic !== "") bits.push(`${outcome.pgtMosaic} mosaic`);
  if (bits.length === 0) return <span style={{ color: faint }}>—</span>;
  return <span style={{ whiteSpace: "nowrap" }}>{bits.join(" · ")}</span>;
}

const cellStyle = { padding: "8px 9px", verticalAlign: "top", fontSize: 11.5, color: ink, borderBottom: `1px solid ${hair}` };
const headStyle = { textAlign: "left", padding: "7px 9px", color: muted, fontWeight: 700, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${hair}`, whiteSpace: "nowrap" };

export function CycleComparisonTable({ cycleLabels, cycleColors, cycleDateRanges, cycleStartDates, cycles, visits }) {
  if (!cycleLabels || cycleLabels.length === 0) return null;
  const anyRecorded = cycleLabels.some((c) => cycles[c] && !isBlankCycleRecord(cycles[c]));

  return (
    <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "18px 18px 16px" }}>
      <h3 style={{ fontFamily: "Georgia,serif", fontSize: 16, color: ink, margin: "0 0 6px" }}>Cycle comparison</h3>
      <p style={{ fontSize: 12, color: muted, margin: "0 0 14px", lineHeight: 1.5 }}>
        Every cycle side by side — protocol next to what the ovaries actually did. Peak estradiol, peak lining and
        baseline FSH are read from the visits you&rsquo;ve saved; everything else comes from the treatment details above.
      </p>

      {!anyRecorded && (
        <div style={{ marginBottom: 12, padding: "10px 13px", background: "#F7EFDF", border: `1px solid ${amber}`, borderRadius: 4, fontSize: 11.5, color: ink, lineHeight: 1.5 }}>
          No treatment details recorded yet — the lab columns below are filled in from your visits, and the rest fill in as you add protocol details above.
        </div>
      )}

      <div style={{ overflowX: "auto", border: `1px solid ${hair}`, borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: paper }}>
              <th style={headStyle}>Cycle</th>
              <th style={headStyle}>Type</th>
              <th style={headStyle}>Protocol</th>
              <th style={headStyle}>Trigger</th>
              <th style={headStyle}>Key events</th>
              <th style={headStyle} title="Highest estradiol recorded in this cycle">Peak E2</th>
              <th style={headStyle} title="Thickest endometrial lining recorded in this cycle">Peak lining</th>
              <th style={headStyle} title="Earliest day 2–4 FSH recorded in this cycle">Baseline FSH</th>
              <th style={headStyle} title="Eggs retrieved › mature › fertilized › blastocysts">Eggs › MII › 2PN › Blast</th>
              <th style={headStyle}>PGT-A</th>
              <th style={headStyle} title="Last recorded beta hCG, with doubling time where two draws allow one">Beta hCG</th>
              <th style={headStyle}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {cycleLabels.map((label) => {
              const rec = cycles[label] || emptyCycleRecord();
              const labs = summarizeCycleLabs(visits, label);
              const type = cycleTypeInfo(rec.cycleType);
              const start = cycleStartDates ? cycleStartDates[label] : "";
              const meds = rec.medications.filter((m) => m.name).map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name));
              const betaRows = summarizeBetas(rec.betas);
              const lastBeta = betaRows.length ? betaRows[betaRows.length - 1] : null;

              const eventBits = CYCLE_EVENTS.filter((e) => e.key !== "trigger" && rec.events[e.key]).map((e) => {
                const day = start ? cycleDayForDate(start, rec.events[e.key]) : null;
                return `${e.short}${day && day >= 1 ? ` d${day}` : ` ${formatDateShort(rec.events[e.key])}`}`;
              });

              const triggerDay = start && rec.events.trigger ? cycleDayForDate(start, rec.events.trigger) : null;
              const triggerBits = [];
              if (rec.triggerType) triggerBits.push(rec.triggerType);
              if (rec.events.trigger) triggerBits.push(`${formatDateShort(rec.events.trigger)}${triggerDay && triggerDay >= 1 ? ` (d${triggerDay})` : ""}${rec.triggerTime ? ` ${rec.triggerTime}` : ""}`);

              return (
                <tr key={label}>
                  <td style={cellStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cycleColors[label], flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
                    </span>
                    {cycleDateRanges && cycleDateRanges[label] && (
                      <div style={{ fontSize: 10, color: faint, marginTop: 2 }}>{formatDateRange(cycleDateRanges[label])}</div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {type.id
                      ? <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 10, fontSize: 10.5, fontWeight: 700, color: type.medicated ? amber : sageDeep, background: type.medicated ? "#F7EFDF" : "#EAF0EA", border: `1px solid ${type.medicated ? amber : sage}`, whiteSpace: "nowrap" }}>{type.short}</span>
                      : <span style={{ color: faint }}>—</span>}
                  </td>
                  <td style={{ ...cellStyle, minWidth: 130 }}>
                    {meds.length ? meds.join(", ") : <span style={{ color: faint }}>—</span>}
                    {rec.lutealSupport && <div style={{ fontSize: 10.5, color: muted, marginTop: 3 }}>Luteal: {rec.lutealSupport}</div>}
                  </td>
                  <td style={{ ...cellStyle, minWidth: 120 }}>
                    {triggerBits.length ? triggerBits.join(" · ") : <span style={{ color: faint }}>—</span>}
                  </td>
                  <td style={{ ...cellStyle, minWidth: 110 }}>
                    {eventBits.length ? eventBits.join(" · ") : <span style={{ color: faint }}>—</span>}
                  </td>
                  <td style={cellStyle}>{labs.peakE2 === null ? <span style={{ color: faint }}>—</span> : `${labs.peakE2} pg/mL`}</td>
                  <td style={cellStyle}>{labs.peakEndo === null ? <span style={{ color: faint }}>—</span> : `${labs.peakEndo} mm`}</td>
                  <td style={cellStyle}>{labs.baselineFsh === null ? <span style={{ color: faint }}>—</span> : `${labs.baselineFsh} mIU/mL`}</td>
                  <td style={cellStyle}><EmbryoChain outcome={rec.outcome} /></td>
                  <td style={cellStyle}><PgtCell outcome={rec.outcome} /></td>
                  <td style={cellStyle}>
                    {lastBeta ? (
                      <span style={{ whiteSpace: "nowrap" }}>
                        {lastBeta.value}
                        <span style={{ color: faint }}> · {formatDateShort(lastBeta.date)}</span>
                        {lastBeta.doublingDays && <div style={{ fontSize: 10.5, color: sageDeep, marginTop: 2 }}>≈{lastBeta.doublingDays.toFixed(1)}d doubling</div>}
                      </span>
                    ) : <span style={{ color: faint }}>—</span>}
                  </td>
                  <td style={cellStyle}>
                    {rec.outcome.result
                      ? <span style={{ fontWeight: 700, color: resultTone(rec.outcome.result), whiteSpace: "nowrap" }}>{cycleResultLabel(rec.outcome.result)}</span>
                      : <span style={{ color: faint }}>—</span>}
                    {rec.outcome.notes && <div style={{ fontSize: 10.5, color: muted, marginTop: 2 }}>{rec.outcome.notes}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: faint, marginTop: 8, fontStyle: "italic" }}>
        MII = mature egg · 2PN = normally fertilized · PGT-A = preimplantation genetic testing for aneuploidy ·
        doubling time is calculated from your two most recent beta draws, not a clinical assessment.
      </div>
    </div>
  );
}
