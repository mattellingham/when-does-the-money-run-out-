import { useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// NZ Tax calculation
function calcNet(gross, year) {
  let tax = 0;
  if (year < 2024) {
    tax += Math.min(gross, 14000) * 0.105;
    tax += Math.max(0, Math.min(gross, 48000) - 14000) * 0.175;
    tax += Math.max(0, Math.min(gross, 70000) - 48000) * 0.30;
    tax += Math.max(0, gross - 70000) * 0.33;
  } else {
    tax += Math.min(gross, 15600) * 0.105;
    tax += Math.max(0, Math.min(gross, 53500) - 15600) * 0.175;
    tax += Math.max(0, Math.min(gross, 78100) - 53500) * 0.30;
    tax += Math.max(0, gross - 78100) * 0.33;
  }
  return gross - tax - (gross * 0.016);
}

// Real NZ annual rates (year-on-year %)
const historicCPI  = { 2020:1.7, 2021:3.9, 2022:7.2, 2023:5.7, 2024:2.5, 2025:3.1 };
// HLPI (all-households) — includes mortgage interest payments
// Key: peaked at 8.2% in Dec 2022. Now BELOW CPI due to falling mortgage rates.
const historicHLPI = { 2020:1.7, 2021:4.5, 2022:8.2, 2023:7.0, 2024:3.5, 2025:2.4 };

function buildData(startSalary, wagePct, futureCPI, futureHLPI) {
  const rows = [];
  let gross = startSalary;
  let net = calcNet(gross, 2020);
  const startSpend = net * 0.85;
  let spendCPI = startSpend;
  let spendHLPI = startSpend;

  for (let yr = 2020; yr <= 2032; yr++) {
    const surplusCPI  = net - spendCPI;
    const surplusHLPI = net - spendHLPI;
    rows.push({
      year: yr,
      gross: Math.round(gross),
      net: Math.round(net),
      spendCPI: Math.round(spendCPI),
      spendHLPI: Math.round(spendHLPI),
      surplusCPI: Math.round(surplusCPI),
      surplusHLPI: Math.round(surplusHLPI),
      savingsRateCPI:  Math.round((surplusCPI  / net) * 1000) / 10,
      savingsRateHLPI: Math.round((surplusHLPI / net) * 1000) / 10,
      cpiRate:  historicCPI[yr]  ?? futureCPI,
      hlpiRate: historicHLPI[yr] ?? futureHLPI,
      historic: yr <= 2025,
    });
    if (yr < 2032) {
      gross = gross * (1 + wagePct / 100);
      net = calcNet(gross, yr + 1);
      const thisCPI  = yr + 1 <= 2025 ? (historicCPI[yr+1]  ?? futureCPI)  : futureCPI;
      const thisHLPI = yr + 1 <= 2025 ? (historicHLPI[yr+1] ?? futureHLPI) : futureHLPI;
      spendCPI  = spendCPI  * (1 + thisCPI  / 100);
      spendHLPI = spendHLPI * (1 + thisHLPI / 100);
    }
  }
  return rows;
}

const fmt = (v) => new Intl.NumberFormat("en-NZ", { style:"currency", currency:"NZD", maximumFractionDigits:0 }).format(v);
const pct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#0a1520", border:"1px solid #1e3248", borderRadius:8, padding:"14px 18px",
      fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#b8cfe0", minWidth:260 }}>
      <div style={{ fontSize:15, fontWeight:700, color:"#deeeff", marginBottom:10 }}>
        {d.year}{!d.historic ? " ◦ projected" : ""}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ color:"#60a5fa" }}>Net Take-Home</span>
        <span style={{ color:"#60a5fa", fontWeight:600 }}>{fmt(d.net)}</span>
      </div>
      <div style={{ borderTop:"1px solid #1e3248", margin:"8px 0", paddingTop:8 }}>
        <div style={{ fontSize:10, letterSpacing:2, color:"#94a3b8", textTransform:"uppercase", marginBottom:6 }}>CPI Scenario</div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#f87171" }}>Cost of Living</span>
          <span>{fmt(d.spendCPI)}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#94a3b8" }}>CPI Rate</span>
          <span>{d.cpiRate?.toFixed(1)}%</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span>Surplus/Deficit</span>
          <span style={{ color: d.surplusCPI >= 0 ? "#34d399" : "#fb923c", fontWeight:600 }}>
            {pct(d.savingsRateCPI)} ({fmt(d.surplusCPI)})
          </span>
        </div>
      </div>
      <div style={{ borderTop:"1px solid #1e3248", margin:"8px 0", paddingTop:8 }}>
        <div style={{ fontSize:10, letterSpacing:2, color:"#94a3b8", textTransform:"uppercase", marginBottom:6 }}>HLPI Scenario</div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#f59e0b" }}>Cost of Living</span>
          <span>{fmt(d.spendHLPI)}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#94a3b8" }}>HLPI Rate</span>
          <span>{d.hlpiRate?.toFixed(1)}%</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span>Surplus/Deficit</span>
          <span style={{ color: d.surplusHLPI >= 0 ? "#34d399" : "#fb923c", fontWeight:600 }}>
            {pct(d.savingsRateHLPI)} ({fmt(d.surplusHLPI)})
          </span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [wagePct, setWagePct] = useState(2);
  const [futureCPI, setFutureCPI] = useState(3);
  const [futureHLPI, setFutureHLPI] = useState(3);

  const data = buildData(100000, wagePct, futureCPI, futureHLPI);

  const crossoverCPI  = data.find(d => d.surplusCPI  < 0)?.year;
  const crossoverHLPI = data.find(d => d.surplusHLPI < 0)?.year;

  return (
    <div style={{ minHeight:"100vh", background:"#070e18", color:"#b8cfe0",
      fontFamily:"'IBM Plex Mono',monospace", padding:"32px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;600;700&family=IBM+Plex+Sans:wght@300;400;600;700&display=swap');
        * { box-sizing:border-box; }
        input[type=range] { accent-color:#60a5fa; cursor:pointer; }
      `}</style>

      <div style={{ maxWidth:880, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, letterSpacing:4, color:"#94a3b8", textTransform:"uppercase", marginBottom:8 }}>
            NZ Cost of Living · CPI vs HLPI · $100k Salary · 2% Wage Growth · 15% Savings
          </div>
          <h1 style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:26, fontWeight:700,
            color:"#deeeff", margin:0, lineHeight:1.2 }}>
            When Does the Money Run Out?
          </h1>
          <p style={{ fontSize:11, color:"#cbd5e1", marginTop:8, lineHeight:1.8 }}>
            Comparing CPI (official measure) vs HLPI (Household Living-costs Price Index, Stats NZ) — which adds mortgage interest payments and better reflects owner-occupier costs
          </p>
        </div>

        {/* Crossover callouts */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
          {[
            { label:"CPI Scenario", year:crossoverCPI,  color:"#f87171", accent:"#5a1010",
              sub:"Official CPI — excludes mortgage interest" },
            { label:"HLPI Scenario", year:crossoverHLPI, color:"#f59e0b", accent:"#5a3a00",
              sub:"Incl. mortgage interest — better for owner-occupiers" },
          ].map(({ label, year, color, accent, sub }) => (
            <div key={label} style={{ background:`linear-gradient(135deg, #0d1520 0%, ${accent}44 100%)`,
              border:`1px solid ${accent}`, borderRadius:10, padding:"18px 20px" }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#cbd5e1", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:42, fontWeight:700, color, lineHeight:1 }}>{year ?? "2032+"}</div>
              <div style={{ fontSize:11, color:"#cbd5e1", marginTop:6, lineHeight:1.6 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Key insight box */}
        <div style={{ background:"#0d1a27", border:"1px solid #1a3a5a", borderRadius:10,
          padding:"16px 20px", marginBottom:20, fontSize:12, lineHeight:1.8, color:"#7a9ab8" }}>
          <span style={{ color:"#f59e0b", fontWeight:600 }}>↑ HLPI insight: </span>
          The HLPI peaked at <span style={{ color:"#f87171" }}>8.2%</span> in December 2022 vs CPI's <span style={{ color:"#f87171" }}>7.2%</span> — 
          the mortgage interest surge drove a full percentage point more pain for owner-occupiers.
          But the story has reversed: by December 2025 HLPI was just <span style={{ color:"#34d399" }}>2.2%</span> vs 
          CPI <span style={{ color:"#f87171" }}>3.1%</span>, as OCR cuts delivered a <span style={{ color:"#34d399" }}>15% drop</span> in 
          mortgage interest payments. The cumulative damage from 2021–2023 still determines the crossover, however.
        </div>

        {/* Controls */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
          {[
            { label:"Wage Growth", value:wagePct, set:setWagePct, min:0, max:8, step:0.5, color:"#60a5fa" },
            { label:"Future CPI (from 2026)", value:futureCPI, set:setFutureCPI, min:0, max:10, step:0.5, color:"#f87171" },
            { label:"Future HLPI (from 2026)", value:futureHLPI, set:setFutureHLPI, min:0, max:10, step:0.5, color:"#f59e0b" },
          ].map(({ label, value, set, min, max, step, color }) => (
            <div key={label} style={{ background:"#0d1a27", border:"1px solid #1a2e42", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:26, fontWeight:700, color, marginBottom:8 }}>{value}%</div>
              <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(parseFloat(e.target.value))} style={{ width:"100%" }} />
            </div>
          ))}
        </div>

        {/* Main chart — Income vs both cost lines */}
        <div style={{ background:"#0d1a27", border:"1px solid #1a2e42", borderRadius:10,
          padding:"22px 14px 14px", marginBottom:16 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase",
            marginBottom:18, paddingLeft:8 }}>Net Income vs Cost of Living — CPI & HLPI (NZD)</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top:4, right:24, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#101e2e" />
              <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={{ stroke:"#1a2e42" }} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={false} tickLine={false} domain={[55000, 110000]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={2025} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1}
                label={{ value:"← Actual | Proj →", fill:"#94a3b8", fontSize:9, fontFamily:"IBM Plex Mono", position:"top" }} />
              {crossoverCPI && <ReferenceLine x={crossoverCPI} stroke="#f8717155" strokeDasharray="5 3" strokeWidth={1} />}
              {crossoverHLPI && crossoverHLPI !== crossoverCPI &&
                <ReferenceLine x={crossoverHLPI} stroke="#f59e0b55" strokeDasharray="5 3" strokeWidth={1} />}
              <Line type="monotone" dataKey="net" stroke="#60a5fa" strokeWidth={2.5} dot={false} name="Net Income" />
              <Line type="monotone" dataKey="spendCPI" stroke="#f87171" strokeWidth={2} dot={false}
                strokeDasharray="0" name="Cost (CPI)" />
              <Line type="monotone" dataKey="spendHLPI" stroke="#f59e0b" strokeWidth={2} dot={false}
                strokeDasharray="5 3" name="Cost (HLPI)" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:20, paddingLeft:20, marginTop:10 }}>
            {[["#60a5fa","Net Take-Home"], ["#f87171","Cost of Living (CPI)"], ["#f59e0b","Cost of Living (HLPI)"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, color:"#cbd5e1" }}>
                <div style={{ width:20, height:2.5, background:c, borderRadius:2 }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Divergence chart — HLPI vs CPI rates side by side */}
        <div style={{ background:"#0d1a27", border:"1px solid #1a2e42", borderRadius:10,
          padding:"22px 14px 14px", marginBottom:16 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase",
            marginBottom:18, paddingLeft:8 }}>Annual Cost Rate — CPI vs HLPI (%)</div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data.filter(d => d.year <= 2026)} margin={{ top:4, right:24, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#101e2e" />
              <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={{ stroke:"#1a2e42" }} tickLine={false} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div style={{ background:"#0a1520", border:"1px solid #1e3248", borderRadius:6,
                    padding:"10px 14px", fontFamily:"IBM Plex Mono", fontSize:11, color:"#b8cfe0" }}>
                    <div style={{ fontWeight:700, marginBottom:6 }}>{d.year}</div>
                    <div style={{ color:"#f87171" }}>CPI: {d.cpiRate?.toFixed(1)}%</div>
                    <div style={{ color:"#f59e0b" }}>HLPI: {d.hlpiRate?.toFixed(1)}%</div>
                    <div style={{ color:"#60a5fa", marginTop:4, fontSize:10 }}>
                      Gap: {(d.hlpiRate - d.cpiRate).toFixed(1)}pp
                    </div>
                  </div>
                );
              }} />
              <Line type="monotone" dataKey="cpiRate" stroke="#f87171" strokeWidth={2} dot={{ fill:"#f87171", r:3 }} />
              <Line type="monotone" dataKey="hlpiRate" stroke="#f59e0b" strokeWidth={2} dot={{ fill:"#f59e0b", r:3 }} strokeDasharray="5 3" />
              <ReferenceLine y={wagePct} stroke="#60a5fa" strokeDasharray="3 3" strokeWidth={1}
                label={{ value:`Wage ${wagePct}%`, fill:"#60a5fa", fontSize:9, fontFamily:"IBM Plex Mono", position:"right" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Savings rate comparison */}
        <div style={{ background:"#0d1a27", border:"1px solid #1a2e42", borderRadius:10,
          padding:"22px 14px 14px", marginBottom:16 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase",
            marginBottom:18, paddingLeft:8 }}>Savings Rate — CPI vs HLPI (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data} margin={{ top:4, right:24, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#101e2e" />
              <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={{ stroke:"#1a2e42" }} tickLine={false} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={false} tickLine={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div style={{ background:"#0a1520", border:"1px solid #1e3248", borderRadius:6,
                    padding:"10px 14px", fontFamily:"IBM Plex Mono", fontSize:11, color:"#b8cfe0" }}>
                    <div style={{ fontWeight:700, marginBottom:6 }}>{d.year}</div>
                    <div style={{ color: d.savingsRateCPI >= 0 ? "#f87171" : "#fb923c" }}>CPI savings rate: {d.savingsRateCPI?.toFixed(1)}%</div>
                    <div style={{ color: d.savingsRateHLPI >= 0 ? "#f59e0b" : "#fb923c" }}>HLPI savings rate: {d.savingsRateHLPI?.toFixed(1)}%</div>
                  </div>
                );
              }} />
              <ReferenceLine y={0} stroke="#f87171" strokeWidth={1.5} />
              <Line type="monotone" dataKey="savingsRateCPI" stroke="#f87171" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="savingsRateHLPI" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:20, paddingLeft:20, marginTop:10 }}>
            {[["#f87171","Savings Rate (CPI)"], ["#f59e0b","Savings Rate (HLPI)"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, color:"#cbd5e1" }}>
                <div style={{ width:20, height:2.5, background:c, borderRadius:2 }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Data table */}
        <div style={{ background:"#0d1a27", border:"1px solid #1a2e42", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase", padding:"18px 20px 10px" }}>
            Year-by-Year Breakdown
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #1a2e42" }}>
                {["Year","Net Income","CPI Rate","Cost (CPI)","CPI Surplus","HLPI Rate","Cost (HLPI)","HLPI Surplus"].map(h => (
                  <th key={h} style={{ padding:"7px 12px", textAlign:"right", color:"#94a3b8",
                    fontWeight:400, fontSize:9, letterSpacing:1, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.year} style={{
                  borderBottom:"1px solid #0a1520",
                  background: (!d.historic) ? "rgba(255,255,255,0.01)" : "transparent"
                }}>
                  <td style={{ padding:"9px 12px", textAlign:"right", color: d.historic ? "#c8d8e8" : "#cbd5e1" }}>
                    {d.year}{!d.historic ? " ◦" : ""}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#60a5fa", fontWeight:600 }}>{fmt(d.net)}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#f87171" }}>{d.cpiRate?.toFixed(1)}%</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#f87171" }}>{fmt(d.spendCPI)}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right",
                    color: d.surplusCPI >= 0 ? "#34d399" : "#fb923c", fontWeight:600 }}>
                    {pct(d.savingsRateCPI)}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#f59e0b" }}>{d.hlpiRate?.toFixed(1)}%</td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#f59e0b" }}>{fmt(d.spendHLPI)}</td>
                  <td style={{ padding:"9px 12px", textAlign:"right",
                    color: d.surplusHLPI >= 0 ? "#34d399" : "#fb923c", fontWeight:600 }}>
                    {pct(d.savingsRateHLPI)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"10px 20px", fontSize:9, color:"#94a3b8", borderTop:"1px solid #1a2e42" }}>
            ◦ Projected · CPI: Stats NZ · HLPI: Stats NZ (all-households; peaked 8.2% Dec 2022, fell to 2.2% Dec 2025 as OCR cuts reduced mortgage interest costs 15%) · NZ income tax applied (pre/post July 2024 brackets) · ACC 1.6%
          </div>
        </div>

        <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.9 }}>
          <span style={{ color:"#94a3b8" }}>Sources:</span> Stats NZ CPI releases · Stats NZ HLPI releases (paused May–Oct 2025 for methodology review, resumed Oct 2025) · 
          RBNZ · interest.co.nz · HLPI includes mortgage interest, consumer credit interest, hire purchase interest · 
          Does not include house purchase price or capital gains.
        </div>
      </div>
    </div>
  );
}
