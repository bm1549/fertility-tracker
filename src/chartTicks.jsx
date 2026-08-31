// Two-line x-axis tick for charts indexed by visit date rather than cycle
// day: the date on top, the cycle it belongs to underneath. Shared by the
// AFC, ovarian-reserve, and vitals charts so they all label the same way.
import { formatDateShort } from "./utils.js";
import { sageDeep, axisGrey } from "./theme.js";

// `shortDates` swaps the full ISO date for "Aug 5". Charts plotting one point
// per cycle have room for the full date; those plotting every visit don't.
export function makeDateCycleTick(rows, opts = {}) {
  const { shortDates = false } = opts;
  return function DateCycleTick({ x, y, payload }) {
    const row = rows.find((d) => d.date === payload.value);
    const label = shortDates ? formatDateShort(payload.value) : payload.value;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill={axisGrey}>{label}</text>
        <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fontWeight={700} fill={sageDeep}>{row ? row.cycleLabel : ""}</text>
      </g>
    );
  };
}

// Recharts can't measure a custom SVG tick, so it can't thin ticks itself.
// This keeps roughly `maxTicks` of them so labels stop colliding once a
// chart has a point for every visit rather than one per cycle.
export function tickInterval(rowCount, maxTicks = 7) {
  if (rowCount <= maxTicks) return 0;
  return Math.ceil(rowCount / maxTicks) - 1;
}
