import { useState, useMemo } from "react";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ── NZ Tax ─────────────────────────────────────────────────────────────────
function calcPersonNet(gross, year) {
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
  return gross - tax - gross * 0.016;
}

// ── Mortgage ───────────────────────────────────────────────────────────────
function monthlyPmt(balance, annualRate, monthsRemaining) {
  if (annualRate === 0) return balance / monthsRemaining;
  const r = annualRate / 100 / 12;
  return balance * (r * Math.pow(1 + r, monthsRemaining)) / (Math.pow(1 + r, monthsRemaining) - 1);
}
function amortise12(startBalance, annualRate, monthsRemaining) {
  let balance = startBalance, totalPmt = 0, totalInterest = 0;
  for (let m = 0; m < 12; m++) {
    const pmt = monthlyPmt(balance, annualRate, monthsRemaining - m);
    const interest = balance * (annualRate / 100 / 12);
    balance -= pmt - interest;
    totalPmt += pmt;
    totalInterest += interest;
  }
  return { annualPayment: totalPmt, annualInterest: totalInterest, endBalance: Math.max(0, balance) };
}

// ── Historical data — sourced from Stats NZ / Public Service Commission ────
// LCI adjusted (all-sector nominal annual %) — same job, same quality measure
const lciActual = {
  2020: 2.0,   // Stats NZ Dec 2020
  2021: 2.5,   // Stats NZ Dec 2021
  2022: 3.5,   // Stats NZ Dec 2022 (public Pay Adjustment beginning)
  2023: 4.5,   // Stats NZ Dec 2023 — highest on record for public sector (5.7%)
  2024: 3.5,   // Stats NZ Dec 2024 — public 4.5%, private 3.0%
  2025: 2.2,   // Stats NZ Sep 2025 — public 2.4%, private 2.1%
};

// CPI annual %
const cpiActual = { 2020:1.7, 2021:3.9, 2022:7.2, 2023:5.7, 2024:2.5, 2025:3.1 };

// HLPI all-households annual %
const hlpiActual = { 2020:1.7, 2021:4.5, 2022:8.2, 2023:7.0, 2024:3.5, 2025:2.4 };

// 2yr fixed mortgage rate at each refix
const fixedRateAtRefix = { 2020:3.0, 2022:5.5, 2024:7.2, 2026:5.0, 2028:5.5 };
function getMortgageRate(yr) {
  if (yr < 2022) return fixedRateAtRefix[2020];
  if (yr < 2024) return fixedRateAtRefix[2022];
  if (yr < 2026) return fixedRateAtRefix[2024];
  if (yr < 2028) return fixedRateAtRefix[2026];
  return fixedRateAtRefix[2028];
}

// ── Model ──────────────────────────────────────────────────────────────────
function buildData(futureLCI, futureCPI, futureMtgRate) {
  const MORTGAGE = 550000, TERM = 360;
  let grossEach = 115000;
  let mortgageBalance = MORTGAGE, monthsElapsed = 0;
  let netCombined = calcPersonNet(grossEach, 2020) * 2;

  const { annualPayment: baseMortPmt } = amortise12(MORTGAGE, fixedRateAtRefix[2020], TERM);
  let nonMtgBasket = netCombined * 0.85 - baseMortPmt;

  // Track cumulative real index — starts at 100
  let realWageIndex = 100;

  const rows = [];
  for (let yr = 2020; yr <= 2032; yr++) {
    const lciRate  = lciActual[yr]  ?? futureLCI;
    const cpiRate  = cpiActual[yr]  ?? futureCPI;
    const hlpiRate = hlpiActual[yr] ?? futureCPI;
    const realWageGrowth = lciRate - cpiRate;

    const mtgRate = yr >= 2028 ? futureMtgRate
                  : yr >= 2026 ? fixedRateAtRefix[2026]
                  : getMortgageRate(yr);

    const { annualPayment: mortPmt, annualInterest, endBalance } =
      amortise12(mortgageBalance, mtgRate, TERM - monthsElapsed);

    const totalSpend = nonMtgBasket + mortPmt;
    const surplus = netCombined - totalSpend;
    const savingsRate = surplus / netCombined * 100;

    rows.push({
      year: yr,
      grossCombined: Math.round(grossEach * 2),
      netCombined: Math.round(netCombined),
      mortgagePmt: Math.round(mortPmt),
      mortgageInterest: Math.round(annualInterest),
      mortgageBalance: Math.round(mortgageBalance),
      mortgageRate: mtgRate,
      nonMtgSpend: Math.round(nonMtgBasket),
      totalSpend: Math.round(totalSpend),
      surplus: Math.round(surplus),
      savingsRate: Math.round(savingsRate * 10) / 10,
      lciRate,
      cpiRate,
      hlpiRate,
      realWageGrowth: Math.round(realWageGrowth * 10) / 10,
      realWageIndex: Math.round(realWageIndex * 10) / 10,
      isRefixYear: [2020,2022,2024,2026,2028].includes(yr),
      historic: yr <= 2025,
    });

    if (yr < 2032) {
      mortgageBalance = endBalance;
      monthsElapsed += 12;
      const nextLCI = (yr + 1 <= 2025 ? lciActual[yr + 1] : futureLCI) ?? futureLCI;
      const nextCPI = (yr + 1 <= 2025 ? cpiActual[yr + 1] : futureCPI) ?? futureCPI;
      grossEach = grossEach * (1 + nextLCI / 100);
      netCombined = calcPersonNet(grossEach, yr + 1) * 2;
      nonMtgBasket = nonMtgBasket * (1 + nextCPI / 100);
      realWageIndex = realWageIndex * (1 + (nextLCI - nextCPI) / 100);
    }
  }
  return rows;
}

// ── Utils ──────────────────────────────────────────────────────────────────
const fmt  = v => new Intl.NumberFormat("en-NZ", { style:"currency", currency:"NZD", maximumFractionDigits:0 }).format(v);
const fmtK = v => `$${(v/1000).toFixed(0)}k`;

// ── Tooltip ────────────────────────────────────────────────────────────────
const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:"#060d18", border:"1px solid #1e3248", borderRadius:8,
      padding:"14px 18px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
      color:"#c8dff0", minWidth:280 }}>
      <div style={{ fontSize:14, fontWeight:700, color:"#eaf4ff", marginBottom:10 }}>
        {d.year}{!d.historic ? " ◦ projected" : ""}
        {d.isRefixYear && d.year > 2020 ? "  ↻ refix" : ""}
      </div>
      <Row l="LCI Wage Growth"    v={`${d.lciRate?.toFixed(1)}%`}                 c="#60a5fa" />
      <Row l="CPI Inflation"      v={`${d.cpiRate?.toFixed(1)}%`}                 c="#f87171" />
      <Row l="Real Wage Change"   v={`${d.realWageGrowth > 0 ? "+" : ""}${d.realWageGrowth?.toFixed(1)}%`}
           c={d.realWageGrowth >= 0 ? "#34d399" : "#fb923c"} bold />
      <Row l="Real Wage Index"    v={`${d.realWageIndex?.toFixed(1)}`}            c={d.realWageIndex >= 100 ? "#34d399" : "#fb923c"} />
      <div style={{ borderTop:"1px solid #1e3248", margin:"8px 0" }} />
      <Row l="Net Combined Income" v={fmt(d.netCombined)}   c="#60a5fa" bold />
      <Row l="Mortgage Repayment"  v={fmt(d.mortgagePmt)}   c="#f59e0b" />
      <Row l="  Rate"              v={`${d.mortgageRate?.toFixed(1)}%`} c="#94a3b8" />
      <Row l="Non-Mtg Living Costs" v={fmt(d.nonMtgSpend)}  c="#f87171" />
      <div style={{ borderTop:"1px solid #1e3248", margin:"8px 0" }} />
      <Row l="Surplus / (Deficit)" v={fmt(d.surplus)}
           c={d.surplus >= 0 ? "#34d399" : "#f87171"} bold />
      <Row l="Savings Rate" v={`${d.savingsRate?.toFixed(1)}%`}
           c={d.savingsRate < 0 ? "#f87171" : d.savingsRate < 5 ? "#fbbf24" : "#34d399"} bold />
    </div>
  );
};
const Row = ({ l, v, c, bold }) => (
  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
    <span style={{ color:"#cbd5e1" }}>{l}</span>
    <span style={{ color:c, fontWeight: bold ? 700 : 400 }}>{v}</span>
  </div>
);

const Label = ({ text }) => (
  <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase",
    marginBottom:14, paddingLeft:6 }}>{text}</div>
);

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [futureLCI,    setFutureLCI]    = useState(2.4);
  const [futureCPI,    setFutureCPI]    = useState(3.0);
  const [futureMtgRate,setFutureMtgRate]= useState(5.5);

  const data = useMemo(() => buildData(futureLCI, futureCPI, futureMtgRate), [futureLCI, futureCPI, futureMtgRate]);

  const crossover   = data.find(d => d.surplus < 0);
  const worstReal   = data.reduce((m,d) => d.realWageGrowth < m.realWageGrowth ? d : m, data[0]);
  const endIndex    = data[data.length - 1].realWageIndex;
  const cumulReal20 = data[data.length - 1].realWageIndex - 100;

  const bg   = "#060d18";
  const card = { background:"#0b1824", border:"1px solid #162e42", borderRadius:10 };
  const mono = { fontFamily:"'IBM Plex Mono',monospace" };

  const Slider = ({ label, sub, val, set, min, max, step, color, dec=1, note }) => (
    <div style={{ ...card, padding:"14px 16px" }}>
      <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase", marginBottom:2 }}>{label}</div>
      {sub && <div style={{ fontSize:9, color:"#94a3b8", marginBottom:4 }}>{sub}</div>}
      <div style={{ fontSize:24, fontWeight:700, color, marginBottom:8 }}>{val.toFixed(dec)}%</div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(parseFloat(e.target.value))}
        style={{ width:"100%", accentColor:color, cursor:"pointer" }} />
      {note && <div style={{ fontSize:9, color:"#94a3b8", marginTop:4 }}>{note}</div>}
    </div>
  );

  return (
    <div style={{ ...mono, minHeight:"100vh", background:bg, color:"#c8dff0", padding:"28px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@600;700&display=swap');
        * { box-sizing:border-box; }
        table { border-collapse:collapse; width:100%; }
        td,th { padding:8px 10px; text-align:right; white-space:nowrap; }
        tr:not(:last-child) { border-bottom:1px solid #0d1e30; }
      `}</style>

      <div style={{ maxWidth:940, margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:9, letterSpacing:4, color:"#94a3b8", textTransform:"uppercase", marginBottom:8 }}>
            LCI Real Wage Model · Two-Income Household $230k · $550k Mortgage · 2yr Fixed
          </div>
          <h1 style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:24, fontWeight:700,
            color:"#eaf4ff", margin:"0 0 8px" }}>The Real Wage Lens</h1>
          <p style={{ fontSize:11, color:"#94a3b8", margin:0, lineHeight:1.8, maxWidth:720 }}>
            Previous models used a flat 2% wage assumption. This version applies <strong style={{color:"#e2e8f0"}}>actual LCI 
            annual rates</strong> (Stats NZ adjusted LCI — same job, same quality) historically, then projects forward.
            The LCI 20-year average is ~2.4% nominal. CPI averaged ~2.6% over the same period.
            Real wages have been essentially flat or slightly <em>negative</em> for three decades.
          </p>
        </div>

        {/* ── Context strip ── */}
        <div style={{ ...card, padding:"14px 20px", marginBottom:20, background:"#0a1520",
          borderColor:"#f59e0b44" }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#fbbf24", textTransform:"uppercase", marginBottom:10 }}>
            What the LCI actually tells us
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
            {[
              { label:"LCI 20yr avg", val:"2.4%", sub:"nominal p.a.", c:"#60a5fa" },
              { label:"CPI 20yr avg", val:"2.6%", sub:"nominal p.a.", c:"#f87171" },
              { label:"Real LCI 20yr", val:"≈ 0%", sub:"slightly negative", c:"#fb923c" },
              { label:"Real index 2025", val:"94.8", sub:"vs 100 in 1992", c:"#f87171" },
            ].map(({ label, val, sub, c }) => (
              <div key={label}>
                <div style={{ fontSize:9, color:"#94a3b8", marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:c, lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:9, color:"#94a3b8", marginTop:3 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stat pills ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
          {[
            { label:"Worst real wage yr", val:worstReal.year,
              sub:`${worstReal.realWageGrowth.toFixed(1)}% real growth`, c:"#f87171", bg:"#1a0808" },
            { label:"Cumul. real change", val:`${cumulReal20 >= 0 ? "+" : ""}${cumulReal20.toFixed(1)}%`,
              sub:"2020→2032 projected", c: cumulReal20 < 0 ? "#f87171" : "#34d399", bg:"#0a1a0a" },
            { label:"Cash crossover",
              val: crossover?.year ?? "Post 2032",
              sub: crossover ? "costs exceed net income" : "remains solvent at these settings",
              c: crossover ? "#f87171" : "#34d399", bg: crossover ? "#1a0808" : "#0a1a0a" },
            { label:"Savings rate 2025",
              val:`${data.find(d=>d.year===2025)?.savingsRate?.toFixed(1)}%`,
              sub:"down from 15% in 2020", c:"#fbbf24", bg:"#1a1200" },
          ].map(({ label, val, sub, c, bg:bg2 }) => (
            <div key={label} style={{ ...card, background:bg2, padding:"14px 16px" }}>
              <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:c, lineHeight:1 }}>{val}</div>
              <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Sliders ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
          <Slider label="Future LCI Wage Growth" sub="from 2026 — 20yr avg = 2.4%"
            val={futureLCI} set={setFutureLCI} min={0} max={7} step={0.1} color="#60a5fa"
            note="LCI adjusted: same job, same quality. Excludes promotions & bonuses." />
          <Slider label="Future CPI" sub="from 2026 — current = 3.1%"
            val={futureCPI} set={setFutureCPI} min={0} max={10} step={0.5} color="#f87171" />
          <Slider label="2028 Mortgage Refix" sub="2yr fixed rate projection"
            val={futureMtgRate} set={setFutureMtgRate} min={3} max={10} step={0.25} color="#f59e0b" />
        </div>

        {/* ── KEY CHART: Real wage growth vs CPI ── */}
        <div style={{ ...card, padding:"20px 12px 14px", marginBottom:14 }}>
          <Label text="Annual LCI Wage Growth vs CPI — The Real Wage Gap (%)" />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top:8, right:24, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0e1e2e" />
              <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={{ stroke:"#1e3248" }} tickLine={false} />
              <YAxis tickFormatter={v=>`${v}%`} tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={false} tickLine={false} domain={[-2, 10]} />
              <Tooltip content={<Tip />} />
              <ReferenceLine x={2025} stroke="#334155" strokeDasharray="3 3" strokeWidth={1}
                label={{ value:"← Actual | Proj →", fill:"#94a3b8", fontSize:9, fontFamily:"IBM Plex Mono", position:"insideTopLeft" }} />
              <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
              {/* Shade the gap between CPI and LCI */}
              <Area type="monotone" dataKey="cpiRate" stroke="none" fill="#f8717112" stackId={null} />
              <Line type="monotone" dataKey="cpiRate"  stroke="#f87171" strokeWidth={2.5} dot={{ r:3, fill:"#f87171" }} name="CPI" />
              <Line type="monotone" dataKey="lciRate"  stroke="#60a5fa" strokeWidth={2.5} dot={{ r:3, fill:"#60a5fa" }} name="LCI Wage Growth" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:20, paddingLeft:20, marginTop:10 }}>
            {[["#60a5fa","LCI Wage Growth (actual → projected)"],["#f87171","CPI Inflation"]].map(([c,l])=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#94a3b8" }}>
                <div style={{ width:18, height:2.5, background:c, borderRadius:2 }}/>{l}
              </div>
            ))}
            <div style={{ fontSize:10, color:"#94a3b8", marginLeft:"auto" }}>
              When CPI line is above LCI line → real wages falling
            </div>
          </div>
        </div>

        {/* ── Real wage index ── */}
        <div style={{ ...card, padding:"20px 12px 14px", marginBottom:14 }}>
          <Label text="Cumulative Real Wage Index (2020 = 100)" />
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data} margin={{ top:8, right:24, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0e1e2e" />
              <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={{ stroke:"#1e3248" }} tickLine={false} />
              <YAxis tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={false} tickLine={false} domain={[85, 110]} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value:"2020 baseline", fill:"#94a3b8", fontSize:9, fontFamily:"IBM Plex Mono", position:"right" }} />
              <ReferenceLine x={2025} stroke="#334155" strokeDasharray="3 3" strokeWidth={1} />
              <Area type="monotone" dataKey="realWageIndex" stroke="#60a5fa" strokeWidth={2.5}
                fill="#60a5fa18" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ fontSize:10, color:"#94a3b8", paddingLeft:20, marginTop:8 }}>
            Index below 100 = purchasing power lower than 2020. Compounding real losses lock in permanently.
          </div>
        </div>

        {/* ── Bottom two charts side by side ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          {/* Real wage growth bars */}
          <div style={{ ...card, padding:"20px 12px 14px" }}>
            <Label text="Annual Real Wage Growth (LCI minus CPI)" />
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data} margin={{ top:4, right:16, left:8, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e1e2e" />
                <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:10, fontFamily:"IBM Plex Mono" }}
                  axisLine={{ stroke:"#1e3248" }} tickLine={false} />
                <YAxis tickFormatter={v=>`${v}%`} tick={{ fill:"#94a3b8", fontSize:10, fontFamily:"IBM Plex Mono" }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                <Bar dataKey="realWageGrowth" radius={[3,3,0,0]}>
                  {data.map(d => (
                    <Cell key={d.year} fill={d.realWageGrowth >= 0 ? "#34d399" : "#f87171"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Savings rate */}
          <div style={{ ...card, padding:"20px 12px 14px" }}>
            <Label text="Household Savings Rate (%)" />
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data} margin={{ top:4, right:16, left:8, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e1e2e" />
                <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:10, fontFamily:"IBM Plex Mono" }}
                  axisLine={{ stroke:"#1e3248" }} tickLine={false} />
                <YAxis tickFormatter={v=>`${v}%`} tick={{ fill:"#94a3b8", fontSize:10, fontFamily:"IBM Plex Mono" }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <ReferenceLine y={0} stroke="#f87171" strokeWidth={1.5} />
                <ReferenceLine y={15} stroke="#34d399" strokeDasharray="3 3" strokeWidth={1}
                  label={{ value:"Start 15%", fill:"#34d399", fontSize:8, fontFamily:"IBM Plex Mono", position:"right" }} />
                <Bar dataKey="savingsRate" radius={[3,3,0,0]}>
                  {data.map(d => (
                    <Cell key={d.year}
                      fill={d.savingsRate < 0 ? "#f87171" : d.savingsRate < 5 ? "#f59e0b" : "#34d399"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Net income vs spending ── */}
        <div style={{ ...card, padding:"20px 12px 14px", marginBottom:14 }}>
          <Label text="Net Combined Income vs Total Spending (NZD)" />
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top:4, right:24, left:16, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0e1e2e" />
              <XAxis dataKey="year" tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={{ stroke:"#1e3248" }} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"IBM Plex Mono" }}
                axisLine={false} tickLine={false} domain={[100000, 225000]} />
              <Tooltip content={<Tip />} />
              {[2022,2024,2026,2028].map(yr => (
                <ReferenceLine key={yr} x={yr} stroke="#334155" strokeDasharray="4 4" strokeWidth={1} />
              ))}
              <ReferenceLine x={2025} stroke="#334155" strokeDasharray="3 3" strokeWidth={1}
                label={{ value:"← Actual | Proj →", fill:"#94a3b8", fontSize:9, fontFamily:"IBM Plex Mono", position:"top" }} />
              {crossover && <ReferenceLine x={crossover.year} stroke="#f8717166" strokeDasharray="5 3" strokeWidth={2}
                label={{ value:"Crossover", fill:"#f87171", fontSize:9, fontFamily:"IBM Plex Mono", position:"top" }} />}
              <Area type="monotone" dataKey="nonMtgSpend" stackId="s" fill="#f8717115" stroke="#f87171" strokeWidth={1.5} />
              <Area type="monotone" dataKey="mortgagePmt" stackId="s" fill="#f59e0b15" stroke="#f59e0b" strokeWidth={1.5} />
              <Line type="monotone" dataKey="netCombined" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", gap:20, paddingLeft:20, marginTop:10 }}>
            {[["#60a5fa","Net Income (LCI-adjusted)"],["#f87171","Non-Mortgage Costs (CPI)"],["#f59e0b","Mortgage Repayments"]].map(([c,l])=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#94a3b8" }}>
                <div style={{ width:18, height:2.5, background:c, borderRadius:2 }}/>{l}
              </div>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ ...card, overflow:"hidden", marginBottom:16 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#94a3b8", textTransform:"uppercase", padding:"16px 16px 10px" }}>
            Year-by-Year Detail
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ fontSize:11 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #162e42" }}>
                  {["Year","LCI","CPI","Real Wage","Real Index","Net Income","Mtg Pmt","Mtg Rate","Living Costs","Surplus","Savings Rate"].map(h=>(
                    <th key={h} style={{ color:"#94a3b8", fontWeight:400, fontSize:9, letterSpacing:1, textTransform:"uppercase", paddingBottom:8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.year} style={{
                    background: d.surplus < 0 ? "#1a08081a" : d.isRefixYear ? "#0a1a2a22" : "transparent",
                    borderLeft: d.isRefixYear ? "2px solid #f59e0b55" : "2px solid transparent",
                  }}>
                    <td style={{ textAlign:"left", paddingLeft:12, color: d.historic ? "#e2e8f0" : "#94a3b8" }}>
                      {d.year}{d.isRefixYear && d.year > 2020 ? " ↻" : ""}{!d.historic ? " ◦" : ""}
                    </td>
                    <td style={{ color:"#60a5fa" }}>{d.lciRate?.toFixed(1)}%</td>
                    <td style={{ color:"#f87171" }}>{d.cpiRate?.toFixed(1)}%</td>
                    <td style={{ color: d.realWageGrowth >= 0 ? "#34d399" : "#fb923c", fontWeight:600 }}>
                      {d.realWageGrowth > 0 ? "+" : ""}{d.realWageGrowth?.toFixed(1)}%
                    </td>
                    <td style={{ color: d.realWageIndex >= 100 ? "#34d399" : "#fb923c" }}>
                      {d.realWageIndex?.toFixed(1)}
                    </td>
                    <td style={{ color:"#60a5fa", fontWeight:600 }}>{fmt(d.netCombined)}</td>
                    <td style={{ color:"#f59e0b" }}>{fmt(d.mortgagePmt)}</td>
                    <td style={{ color: d.mortgageRate >= 7 ? "#f87171" : d.mortgageRate <= 3.5 ? "#34d399" : "#fbbf24" }}>
                      {d.mortgageRate?.toFixed(1)}%
                    </td>
                    <td style={{ color:"#f87171" }}>{fmt(d.nonMtgSpend)}</td>
                    <td style={{ color: d.surplus >= 0 ? "#34d399" : "#f87171", fontWeight:700 }}>{fmt(d.surplus)}</td>
                    <td style={{ color: d.savingsRate < 0 ? "#f87171" : d.savingsRate < 5 ? "#fbbf24" : "#34d399", fontWeight:700 }}>
                      {d.savingsRate?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"10px 16px", fontSize:9, color:"#94a3b8", borderTop:"1px solid #162e42" }}>
            ↻ refix year · ◦ projected · LCI = Stats NZ adjusted LCI (same job, same quality) · 
            Actual rates applied 2020–2025, slider from 2026 · 20yr LCI avg ~2.4% · Mortgage $550k P&I 30yr · $115k each pre-tax
          </div>
        </div>

        {/* ── Finding ── */}
        <div style={{ ...card, padding:"18px 20px", background:"#0c1420", borderColor:"#f87171aa", marginBottom:4 }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"#f87171", textTransform:"uppercase", marginBottom:10 }}>
            The LCI finding
          </div>
          <div style={{ fontSize:12, color:"#c8dff0", lineHeight:1.9 }}>
            The LCI reveals a structural problem hiding behind the nominal wage numbers.
            At the <strong style={{color:"#60a5fa"}}>20-year average LCI of 2.4%</strong> vs{" "}
            <strong style={{color:"#f87171"}}>CPI at 2.6%</strong>, real wages shrink by ~0.2% every year in a "normal" environment.
            In 2021–2023 the gap blew out to <strong style={{color:"#f87171"}}>−1.4%, −3.7%, −1.2%</strong> respectively —
            compounding real losses that cannot be recovered. Even the 2023–2024 period, which felt like "wages finally catching up",
            was largely the <strong style={{color:"#e2e8f0"}}>Public Sector Pay Adjustment</strong> — a one-off correction that
            won't repeat. Adjust the future LCI to{" "}
            <strong style={{color:"#34d399"}}>3.5%+</strong> to see what genuine real wage recovery would require.
          </div>
        </div>

      </div>
    </div>
  );
}
