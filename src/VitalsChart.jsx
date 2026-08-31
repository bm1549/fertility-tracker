// ── VITALS (BLOOD PRESSURE + HEART RATE) ────────────────────────────────
// Plotted by visit date rather than cycle day: vitals don't follow a cycle
// phase the way estradiol does, so what matters is the trend across visits.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { makeDateCycleTick, tickInterval } from "./chartTicks.jsx";
import { ink, paper, panel, hair, sage, sageDeep, amber, muted, faint, axisGrey, CYCLE_PALETTE } from "./theme.js";

const tooltipStyle = { background: ink, border: "none", borderRadius: 4, fontSize: 12, padding: "8px 12px" };
const emptyBox = (msg) => (
  <div style={{ padding: "26px 10px", textAlign: "center", color: axisGrey, fontSize: 12, border: `1px dashed ${hair}`, borderRadius: 6 }}>{msg}</div>
);

function BloodPressureChart({ rows }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 4 }}>Blood pressure · mmHg</div>
      {rows.length === 0 ? emptyBox("No blood pressure recorded for the selected cycle(s).") : (
        <ResponsiveContainer width="100%" height={215}>
          <LineChart data={rows} margin={{ top: 20, right: 14, left: 0, bottom: 4 }}>
            {/* Typical resting range; the line above it is where the AHA
                starts calling a reading elevated rather than normal. */}
            <ReferenceArea y1={60} y2={120} fill={sage} fillOpacity={0.16} stroke={sage} strokeOpacity={0.3} strokeDasharray="2 2" />
            <ReferenceLine y={130} stroke={amber} strokeDasharray="3 3" strokeWidth={1.2}
              label={{ value: "systolic 130", position: "insideTopLeft", fontSize: 9, fill: amber }} />
            <CartesianGrid stroke={hair} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tick={makeDateCycleTick(rows, { shortDates: true })} height={40} interval={tickInterval(rows.length)} />
            <YAxis domain={[40, 160]} tick={{ fontSize: 10, fill: axisGrey }} width={32} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#aaa", fontSize: 11 }} itemStyle={{ color: "#fff" }}
              formatter={(v, name) => [`${v} mmHg`, name]}
              labelFormatter={(d, p) => (p && p[0] ? `${d} · ${p[0].payload.cycleLabel}` : d)} />
            <Line dataKey="sys" name="Systolic" type="linear" stroke={CYCLE_PALETTE[0]} strokeWidth={2.2}
              dot={{ r: 3.5, fill: CYCLE_PALETTE[0] }} connectNulls isAnimationActive={false} />
            <Line dataKey="dia" name="Diastolic" type="linear" stroke={sageDeep} strokeWidth={2.2}
              dot={{ r: 3.5, fill: sageDeep }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function HeartRateChart({ rows }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 4 }}>Resting heart rate · bpm</div>
      {rows.length === 0 ? emptyBox("No heart rate recorded for the selected cycle(s).") : (
        <ResponsiveContainer width="100%" height={215}>
          <LineChart data={rows} margin={{ top: 20, right: 14, left: 0, bottom: 4 }}>
            <ReferenceArea y1={60} y2={100} fill={sage} fillOpacity={0.16} stroke={sage} strokeOpacity={0.3} strokeDasharray="2 2" />
            <CartesianGrid stroke={hair} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tick={makeDateCycleTick(rows, { shortDates: true })} height={40} interval={tickInterval(rows.length)} />
            <YAxis domain={[40, 130]} tick={{ fontSize: 10, fill: axisGrey }} width={32} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#aaa", fontSize: 11 }} itemStyle={{ color: "#fff" }}
              formatter={(v) => [`${v} bpm`, "Heart rate"]}
              labelFormatter={(d, p) => (p && p[0] ? `${d} · ${p[0].payload.cycleLabel}` : d)} />
            <Line dataKey="hr" name="Heart rate" type="linear" stroke={amber} strokeWidth={2.2}
              dot={{ r: 3.5, fill: amber }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function VitalsChart({ visits, cyclesToShow }) {
  const shown = new Set(cyclesToShow || []);
  const inScope = (visits || []).filter((v) => shown.has(v.cycleLabel)).sort((a, b) => a.date.localeCompare(b.date));
  const bpRows = inScope
    .filter((v) => v.bpSys != null || v.bpDia != null)
    .map((v) => ({ date: v.date, cycleLabel: v.cycleLabel, sys: v.bpSys ?? null, dia: v.bpDia ?? null }));
  const hrRows = inScope
    .filter((v) => v.hr != null)
    .map((v) => ({ date: v.date, cycleLabel: v.cycleLabel, hr: v.hr }));

  return (
    <div style={{ background: panel, border: `1px solid ${hair}`, borderRadius: 6, padding: "18px 16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <h3 style={{ fontFamily: "Georgia,serif", fontSize: 19, color: ink, margin: 0 }}>Vitals</h3>
        <span style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: axisGrey }}>mmHg · bpm</span>
      </div>
      <p style={{ fontSize: 12, color: muted, margin: "2px 0 14px", lineHeight: 1.45 }}>
        Blood pressure and heart rate taken at each monitoring visit, in date order. Shaded bands are the usual
        resting ranges — general population guidance, not a diagnosis.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, background: paper, padding: "12px 12px 4px", borderRadius: 6 }}>
        <BloodPressureChart rows={bpRows} />
        <HeartRateChart rows={hrRows} />
      </div>
      <div style={{ fontSize: 11, color: faint, marginTop: 8, fontStyle: "italic" }}>
        Dots are individual readings. A single high reading at a clinic visit is common and not meaningful on its own —
        the trend across visits is what a clinician looks at.
      </div>
    </div>
  );
}
