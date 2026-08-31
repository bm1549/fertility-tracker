// ── DESIGN TOKENS ───────────────────────────────────────────────────────
// Extracted from App.jsx so every view — the dashboard, the entry grid, and
// the cycle treatment panels — draws from one palette rather than each file
// re-declaring its own near-identical hex values.

export const ink      = "#1C2B3A";
export const paper    = "#F6F5F1";
export const panel    = "#FFFFFF";
export const hair     = "#D8D3C7";
export const sage     = "#7C9A82";
export const sageDeep = "#4F6D57";
export const amber    = "#C98A2B";
export const rust     = "#B5482F";

// Muted greys used for secondary and tertiary text throughout.
export const muted    = "#6B6456";
export const faint    = "#9A8E7F";
export const axisGrey = "#8A8272"; // axis ticks and chart-adjacent labels

export const CYCLE_PALETTE = ["#3B5B7A", "#4F6D57", "#C98A2B", "#B5482F", "#7C6A9A", "#4A8A8C", "#9A6B4A"];

// ── SHARED SMALL STYLES ─────────────────────────────────────────────────
export const gridInputStyle = { width: "100%", padding: "6px 7px", border: `1px solid ${hair}`, borderRadius: 4, fontSize: 12, fontFamily: "inherit", color: ink, background: paper, boxSizing: "border-box" };
export const gridInputErrorStyle = { ...gridInputStyle, border: `1px solid ${rust}`, background: "#FBEFEA" };
export const smallBtn = (bg, color, border) => ({ padding: "5px 10px", borderRadius: 4, border: border || "none", background: bg, color, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" });
