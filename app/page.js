'use client';
import { useState, useEffect, useMemo } from 'react';

/* ── CONSTANTS ── */
const LAG = 21;
const TODAY = new Date();
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const STORES = ['brooklyn','cos cob','darien','larchmont','new canaan','westport'];
const STORE_LABELS = {
  brooklyn:'Brooklyn', 'cos cob':'Cos Cob', darien:'Darien',
  larchmont:'Larchmont', 'new canaan':'New Canaan', westport:'Westport',
};

/* ── COMPENSATION MODEL ── */
const BASE_TIERS = [
  { upTo: 300000, pct: 0.62 },
  { upTo: 500000, pct: 0.55 },
  { upTo: 700000, pct: 0.49 },
  { upTo: Infinity, pct: 0.43 },
];
const GROWTH_ACCEL_TIERS = [
  { above: 0.05, upTo: 0.15, pct: 0.10 },
  { above: 0.15, upTo: 0.25, pct: 0.18 },
  { above: 0.25, upTo: Infinity, pct: 0.25 },
];

function calcTieredShare(annualizedRevenue, dailyGross) {
  let totalShare = 0, prev = 0;
  for (const t of BASE_TIERS) {
    const tierRev = Math.min(annualizedRevenue, t.upTo) - prev;
    if (tierRev <= 0) break;
    totalShare += tierRev * t.pct;
    prev = t.upTo;
  }
  const effectiveRate = annualizedRevenue > 0 ? totalShare / annualizedRevenue : BASE_TIERS[0].pct;
  return dailyGross * effectiveRate;
}

function calcGrowthBonusFromRate(dailyGross, trailingGrowthRate) {
  if (trailingGrowthRate <= GROWTH_ACCEL_TIERS[0].above) return 0;
  // Bonus is a multiplier on dailyGross based on the trailing growth rate
  let bonusRate = 0;
  for (const t of GROWTH_ACCEL_TIERS) {
    if (trailingGrowthRate <= t.above) continue;
    const applicableGrowth = Math.min(trailingGrowthRate, t.upTo) - t.above;
    bonusRate += applicableGrowth * t.pct;
  }
  return dailyGross * bonusRate;
}

/* ── HELPERS ── */
const fmt = v => '$' + Math.round(v).toLocaleString('en-US');
const fmtD = v => '$' + v.toFixed(2);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateFull = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateStr = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dowIdx = d => (d.getDay() + 6) % 7;
const pct = v => (v * 100).toFixed(1) + '%';

const NAVY = '#0f1f3d';
const NAVY_LIGHT = '#1a2f52';
const GOLD_ACCENT = '#c9a84c';

/* ── LEDGER BUILDER ── */
function buildLedger(sales) {
  const posMap = {};
  sales.forEach(s => posMap[s.date] = s.gross);

  // Annualize: rolling 365-day revenue
  const sortedDates = Object.keys(posMap).sort();
  const annualizedMap = {};
  let rollingSum = 0;
  const window = [];
  for (const d of sortedDates) {
    window.push({ d, g: posMap[d] });
    rollingSum += posMap[d];
    while (window.length > 0) {
      const first = new Date(window[0].d);
      const last = new Date(d);
      const diff = (last - first) / 86400000;
      if (diff >= 365) {
        rollingSum -= window.shift().g;
      } else break;
    }
    const daysInWindow = window.length;
    annualizedMap[d] = daysInWindow > 0 ? (rollingSum / daysInWindow) * 365 : 0;
  }

  // Monthly YoY growth: compare each calendar month to same month prior year
  const monthlyRevenue = {};
  for (const d of sortedDates) {
    const dt = new Date(d);
    const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    monthlyRevenue[key] = (monthlyRevenue[key] || 0) + posMap[d];
  }

  const monthlyGrowthMap = {};
  for (const d of sortedDates) {
    const dt = new Date(d);
    const curKey = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    const priorKey = (dt.getFullYear() - 1) + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    const curRev = monthlyRevenue[curKey] || 0;
    const priorRev = monthlyRevenue[priorKey] || 0;
    monthlyGrowthMap[d] = priorRev > 0 ? (curRev - priorRev) / priorRev : 0;
  }

  return sortedDates.map(d => {
    const g = posMap[d];
    const ed = new Date(d);
    const pd = addDays(ed, LAG);
    const annualized = annualizedMap[d] || 0;
    const trailingGrowth = monthlyGrowthMap[d] || 0;

    const baseShare = calcTieredShare(annualized, g);
    const growthBonus = calcGrowthBonusFromRate(g, trailingGrowth);
    const payout = baseShare + growthBonus;
    const isPaid = pd < TODAY;
    const effectiveRate = g > 0 ? payout / g : 0;

    return {
      d, ed, pd, g, payout, baseShare, growthBonus,
      isPaid,
      dow: DOW[dowIdx(ed)],
      annualized,
      effectiveRate,
      trailingGrowth,
    };
  });
}

/* ── UI COMPONENTS ── */
function Badge({ status }) {
  const styles = {
    paid:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
    confirmed: 'bg-sky-50 text-sky-700 border border-sky-200',
    partial:   'bg-violet-50 text-violet-700 border border-violet-200',
    estimated: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  const labels = { paid:'Paid', confirmed:'Confirmed', partial:'Updating', estimated:'Estimated' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${styles[status]}`}>{labels[status]}</span>;
}


function InvoicesTab({ invoices, store }) {
  const [selected, setSelected] = useState(null);
  const filtered = invoices.filter(inv => !store || inv.store === store);

  if (filtered.length === 0) return (
    <div className="text-center py-12 rounded-xl" style={{background:'white', border:'1px solid #dde4ed', color:'#8899aa'}}>
      No invoices found for this store.
    </div>
  );

  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-72 space-y-2">
        {filtered.map(inv => (
          <div key={inv.filename}
            onClick={() => setSelected(selected?.filename === inv.filename ? null : inv)}
            className="rounded-xl p-4 cursor-pointer transition-all"
            style={{
              background: selected?.filename === inv.filename ? '#fdf8ec' : 'white',
              border: selected?.filename === inv.filename ? `2px solid ${GOLD_ACCENT}` : '1px solid #dde4ed',
            }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-sm font-bold" style={{color: NAVY}}>{inv.vendor}</div>
              <span className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                style={{background:'#edfaf2', color:'#1a6b3a', border:'1px solid #9dd4b5'}}>PDF</span>
            </div>
            <div className="text-xs space-y-1" style={{color:'#8899aa'}}>
              <div>Delivery: <strong style={{color:'#445566'}}>{fmtDateStr(inv.deliveryDate)}</strong></div>
              <div>Window: <strong style={{color:'#445566'}}>{fmtDateStr(inv.windowStart)} &rarr; {fmtDateStr(inv.windowEnd)}</strong></div>
              <div className="text-base font-bold mt-2" style={{color:'#8a5c1a'}}>${inv.totalAmount.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="flex-1 rounded-xl overflow-hidden" style={{border:'1px solid #dde4ed', background:'white'}}>
          <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:'1px solid #dde4ed', background:'#f7f9fc'}}>
            <div>
              <div className="font-bold" style={{color: NAVY}}>{selected.vendor}</div>
              <div className="text-xs mt-0.5" style={{color:'#8899aa'}}>
                {selected.filename} &middot; {fmtDateStr(selected.deliveryDate)} &middot; ${selected.totalAmount.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/pdf?file=${encodeURIComponent(selected.filename)}`}
                target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{background: NAVY}}>
                Open Full PDF
              </a>
              <button onClick={() => setSelected(null)}
                className="px-3 py-2 rounded-lg text-xs font-medium"
                style={{background:'#f0f4f8', color:'#6b7a99'}}>
                Close
              </button>
            </div>
          </div>
          <iframe
            src={`/api/pdf?file=${encodeURIComponent(selected.filename)}`}
            className="w-full"
            style={{height:'calc(100vh - 300px)', border:'none'}}
            title={selected.filename}
          />
        </div>
      ) : (
        <div className="flex-1 rounded-xl flex items-center justify-center"
          style={{border:'2px dashed #dde4ed', background:'white', color:'#8899aa'}}>
          <div className="text-center">
            <div className="text-3xl mb-3">&#128196;</div>
            <div className="text-sm font-medium">Select an invoice to preview</div>
            <div className="text-xs mt-1">Click any invoice on the left</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SCENARIO MODELER ── */
function ScenarioModeler({ storeSales }) {
  const [cogsRate, setCogsRate] = useState(20);
  const [staffHrs, setStaffHrs] = useState({
    brooklyn: 12, 'cos cob': 74, darien: 74, larchmont: 12, 'new canaan': 74, westport: 74,
  });
  const [staffRate, setStaffRate] = useState(25);
  const [growthPct, setGrowthPct] = useState(0);

  const BURDEN = 1.25;

  const results = useMemo(() => {
    return STORES.map(store => {
      const sales = storeSales[store] || [];
      const totalRev = sales.reduce((s, r) => s + r.gross, 0);
      const days = sales.length;
      const annualized = days > 0 ? (totalRev / days) * 365 : 0;
      const grownAnnual = annualized * (1 + growthPct / 100);

      // Tiered share
      let tieredTotal = 0, prev = 0;
      for (const t of BASE_TIERS) {
        const tierRev = Math.min(grownAnnual, t.upTo) - prev;
        if (tierRev <= 0) break;
        tieredTotal += tierRev * t.pct;
        prev = t.upTo;
      }

      // Growth accelerator (tiered)
      let accelBonus = 0;
      const gRate = growthPct / 100;
      if (gRate > GROWTH_ACCEL_TIERS[0].above) {
        for (const t of GROWTH_ACCEL_TIERS) {
          if (gRate <= t.above) continue;
          const applicableGrowth = Math.min(gRate, t.upTo) - t.above;
          accelBonus += annualized * applicableGrowth * t.pct;
        }
      }

      const totalShare = tieredTotal + accelBonus;
      const effRate = grownAnnual > 0 ? totalShare / grownAnnual : 0;
      const cogs = grownAnnual * (cogsRate / 100);
      const payroll = (staffHrs[store] || 0) * staffRate * 52 * BURDEN;
      const takeHome = totalShare - cogs - payroll;
      const dailyPayout = days > 0 ? takeHome / 365 : 0;

      // Fjord's side
      const fjordNet = grownAnnual - totalShare;
      const fjordPct = grownAnnual > 0 ? fjordNet / grownAnnual : 0;
      const fjordDaily = days > 0 ? fjordNet / 365 : 0;

      return {
        store, annualized, grownAnnual, tieredTotal, accelBonus, totalShare,
        effRate, cogs, payroll, takeHome, dailyPayout,
        fjordNet, fjordPct, fjordDaily,
      };
    });
  }, [storeSales, cogsRate, staffHrs, staffRate, growthPct]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{color: NAVY}}>Scenario Modeler</h1>
        <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Adjust assumptions to model operator economics across all stores</p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{color:'#6b7a99'}}>COGS %</label>
          <div className="flex items-center gap-3">
            <input type="range" min="10" max="40" step="1" value={cogsRate}
              onChange={e => setCogsRate(Number(e.target.value))}
              className="flex-1" />
            <span className="text-lg font-bold w-14 text-right" style={{color: NAVY}}>{cogsRate}%</span>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{color:'#6b7a99'}}>Staff Hourly Rate</label>
          <div className="flex items-center gap-3">
            <input type="range" min="15" max="40" step="1" value={staffRate}
              onChange={e => setStaffRate(Number(e.target.value))}
              className="flex-1" />
            <span className="text-lg font-bold w-14 text-right" style={{color: NAVY}}>${staffRate}/hr</span>
          </div>
          <div className="text-xs mt-1" style={{color:'#8899aa'}}>+25% burden = ${(staffRate * BURDEN).toFixed(2)}/hr loaded</div>
        </div>
        <div className="rounded-xl p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{color:'#6b7a99'}}>YoY Growth Scenario</label>
          <div className="flex items-center gap-3">
            <input type="range" min="-10" max="40" step="5" value={growthPct}
              onChange={e => setGrowthPct(Number(e.target.value))}
              className="flex-1" />
            <span className="text-lg font-bold w-14 text-right" style={{color: growthPct > 0 ? '#1a6b3a' : growthPct < 0 ? '#b5282a' : NAVY}}>
              {growthPct > 0 ? '+' : ''}{growthPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Staff hours per store */}
      <div className="rounded-xl p-4 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
        <label className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{color:'#6b7a99'}}>Additional Staff Hours / Week (per store)</label>
        <div className="grid grid-cols-6 gap-3">
          {STORES.map(store => (
            <div key={store}>
              <div className="text-xs font-medium mb-1" style={{color: NAVY}}>{STORE_LABELS[store]}</div>
              <input type="number" min="0" max="80" step="5"
                value={staffHrs[store]}
                onChange={e => setStaffHrs(prev => ({ ...prev, [store]: Number(e.target.value) }))}
                className="w-full rounded-lg border px-3 py-2 text-sm text-center"
                style={{borderColor:'#dde4ed'}} />
              <div className="text-xs mt-1 text-center" style={{color:'#8899aa'}}>
                {fmt((staffHrs[store] || 0) * staffRate * 52 * BURDEN)}/yr
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          ['Total Revenue', fmt(results.reduce((s,r) => s+r.grownAnnual, 0)), '#445566', '#f7f9fc', '#dde4ed'],
          ['Operator Payouts', fmt(results.reduce((s,r) => s+r.totalShare, 0)), '#1a6b8a', '#edf6fb', '#b3d9eb'],
          ['Total Operator Take-Home', fmt(results.reduce((s,r) => s+r.takeHome, 0)), '#1a6b3a', '#edfaf2', '#9dd4b5'],
          ['Fjord Net Revenue', fmt(results.reduce((s,r) => s+r.fjordNet, 0)), GOLD_ACCENT, '#fdf8ec', '#e8d38a'],
        ].map(([label,val,color,bg,border]) => (
          <div key={label} className="rounded-xl p-4" style={{background:bg, border:`1px solid ${border}`}}>
            <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>{label}</div>
            <div className="text-2xl font-bold" style={{color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Results Table */}
      <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #dde4ed', background:'white'}}>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#f7f9fc', borderBottom:'1px solid #dde4ed'}}>
          Operator Economics
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Store</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Revenue</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Base Share</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Growth Bonus</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Total Payout</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#8a5c1a'}}>COGS</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#3a4a8a'}}>Payroll</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edfaf2'}}>Take-Home</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edfaf2'}}>Daily</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const thColor = r.takeHome >= 70000 ? '#1a6b3a' : '#b5282a';
              return (
                <tr key={r.store} style={{borderBottom:'1px solid #eef1f6'}} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-semibold" style={{color: NAVY}}>{STORE_LABELS[r.store]}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#445566'}}>{fmt(r.grownAnnual)}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmt(r.tieredTotal)}</td>
                  <td className="px-4 py-3 text-right" style={{color: r.accelBonus > 0 ? '#1a6b3a' : '#8899aa', background:'rgba(237,246,251,0.4)'}}>
                    {r.accelBonus > 0 ? '+' + fmt(r.accelBonus) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmt(r.totalShare)}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#8a5c1a'}}>{fmt(r.cogs)}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#3a4a8a'}}>{fmt(r.payroll)}</td>
                  <td className="px-4 py-3 text-right font-bold text-sm" style={{color: thColor, background:'rgba(237,250,242,0.4)'}}>{fmt(r.takeHome)}</td>
                  <td className="px-4 py-3 text-right font-medium" style={{color: thColor, background:'rgba(237,250,242,0.4)'}}>{fmt(r.dailyPayout)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:'#f0f4f8', borderTop:`2px solid ${NAVY}`}}>
              <td className="px-4 py-3 font-bold uppercase text-xs" style={{color:'#6b7a99'}}>All Stores</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#445566'}}>{fmt(results.reduce((s,r) => s+r.grownAnnual, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(results.reduce((s,r) => s+r.tieredTotal, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b3a', background:'rgba(237,246,251,0.6)'}}>{fmt(results.reduce((s,r) => s+r.accelBonus, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(results.reduce((s,r) => s+r.totalShare, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#8a5c1a'}}>{fmt(results.reduce((s,r) => s+r.cogs, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#3a4a8a'}}>{fmt(results.reduce((s,r) => s+r.payroll, 0))}</td>
              <td className="px-4 py-3 text-right font-bold text-sm" style={{color:'#1a6b3a', background:'rgba(237,250,242,0.6)'}}>{fmt(results.reduce((s,r) => s+r.takeHome, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b3a', background:'rgba(237,250,242,0.6)'}}>{fmt(results.reduce((s,r) => s+r.dailyPayout, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Fjord Economics */}
      <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #dde4ed', background:'white'}}>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{color: GOLD_ACCENT, background:'#fdf8ec', borderBottom:'1px solid #e8d38a'}}>
          Fjord Net Revenue
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Store</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Gross Revenue</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a'}}>Operator Payout</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Operator Eff. %</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color: GOLD_ACCENT, background:'#fdf8ec'}}>Fjord Net</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#fdf8ec'}}>Fjord %</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color: GOLD_ACCENT, background:'#fdf8ec'}}>Fjord Daily</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr key={r.store} style={{borderBottom:'1px solid #eef1f6'}} className="hover:bg-blue-50/30">
                <td className="px-4 py-3 font-semibold" style={{color: NAVY}}>{STORE_LABELS[r.store]}</td>
                <td className="px-4 py-3 text-right" style={{color:'#445566'}}>{fmt(r.grownAnnual)}</td>
                <td className="px-4 py-3 text-right" style={{color:'#1a6b8a'}}>{fmt(r.totalShare)}</td>
                <td className="px-4 py-3 text-right" style={{color:'#6b7a99'}}>{pct(r.effRate)}</td>
                <td className="px-4 py-3 text-right font-bold text-sm" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.4)'}}>{fmt(r.fjordNet)}</td>
                <td className="px-4 py-3 text-right" style={{color:'#6b7a99', background:'rgba(253,248,236,0.4)'}}>{pct(r.fjordPct)}</td>
                <td className="px-4 py-3 text-right font-medium" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.4)'}}>{fmt(r.fjordDaily)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{background:'#fdf8ec', borderTop:`2px solid ${GOLD_ACCENT}`}}>
              <td className="px-4 py-3 font-bold uppercase text-xs" style={{color:'#6b7a99'}}>All Stores</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#445566'}}>{fmt(results.reduce((s,r) => s+r.grownAnnual, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a'}}>{fmt(results.reduce((s,r) => s+r.totalShare, 0))}</td>
              <td className="px-4 py-3 text-right" style={{color:'#6b7a99'}}>-</td>
              <td className="px-4 py-3 text-right font-bold text-sm" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.6)'}}>{fmt(results.reduce((s,r) => s+r.fjordNet, 0))}</td>
              <td className="px-4 py-3 text-right" style={{color:'#6b7a99', background:'rgba(253,248,236,0.6)'}}>
                {pct(results.reduce((s,r) => s+r.grownAnnual, 0) > 0 ? results.reduce((s,r) => s+r.fjordNet, 0) / results.reduce((s,r) => s+r.grownAnnual, 0) : 0)}
              </td>
              <td className="px-4 py-3 text-right font-bold" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.6)'}}>{fmt(results.reduce((s,r) => s+r.fjordDaily, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Compensation Structure Reference */}
      <div className="mt-6 rounded-xl p-5" style={{background:'white', border:'1px solid #dde4ed'}}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{color:'#6b7a99'}}>Compensation Structure</div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium mb-2" style={{color: NAVY}}>Base Revenue Share (4 Tiers)</div>
            <div className="space-y-1">
              {BASE_TIERS.map((t, i) => {
                const prevUpTo = i > 0 ? BASE_TIERS[i-1].upTo : 0;
                const label = t.upTo === Infinity
                  ? '$' + (prevUpTo/1000) + 'k+'
                  : (i === 0 ? 'First $' + (t.upTo/1000) + 'k' : '$' + (prevUpTo/1000) + 'k - $' + (t.upTo/1000) + 'k');
                return (
                  <div key={i} className="flex justify-between text-xs py-1" style={{borderBottom:'1px solid #eef1f6'}}>
                    <span style={{color:'#8899aa'}}>{label}</span>
                    <strong style={{color: NAVY}}>{(t.pct * 100)}%</strong>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium mb-2" style={{color: NAVY}}>YoY Growth Accelerator (Tiered)</div>
            <div className="space-y-1">
              {GROWTH_ACCEL_TIERS.map((t, i) => (
                <div key={i} className="flex justify-between text-xs py-1" style={{borderBottom:'1px solid #eef1f6'}}>
                  <span style={{color:'#8899aa'}}>
                    {t.upTo === Infinity ? (t.above*100) + '%+ YoY' : (t.above*100) + '-' + (t.upTo*100) + '% YoY'}
                  </span>
                  <strong style={{color: NAVY}}>+{(t.pct * 100)}%</strong>
                </div>
              ))}
              <div className="flex justify-between text-xs py-1" style={{borderBottom:'1px solid #eef1f6'}}>
                <span style={{color:'#8899aa'}}>Payout lag</span>
                <strong style={{color: NAVY}}>21 days</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── INCOME CALCULATOR ── */
function IncomeCalculator() {
  const [storeVolume, setStoreVolume] = useState(700000);
  const [myGrowth, setMyGrowth] = useState(10);

  const results = useMemo(() => {
    let tieredTotal = 0, prev = 0;
    for (const t of BASE_TIERS) {
      const tierRev = Math.min(storeVolume, t.upTo) - prev;
      if (tierRev <= 0) break;
      tieredTotal += tierRev * t.pct;
      prev = t.upTo;
    }

    // Growth accelerator
    let accelBonus = 0;
    const gRate = myGrowth / 100;
    if (gRate > GROWTH_ACCEL_TIERS[0].above) {
      for (const t of GROWTH_ACCEL_TIERS) {
        if (gRate <= t.above) continue;
        const applicableGrowth = Math.min(gRate, t.upTo) - t.above;
        accelBonus += storeVolume * applicableGrowth * t.pct;
      }
    }

    const totalPayout = tieredTotal + accelBonus;
    const effRate = storeVolume > 0 ? totalPayout / storeVolume : 0;
    const dailyPayout = totalPayout / 365;

    const tierBreakdown = [];
    let p = 0;
    for (const t of BASE_TIERS) {
      const tierRev = Math.min(storeVolume, t.upTo) - p;
      if (tierRev <= 0) break;
      const label = p === 0
        ? 'First $' + (t.upTo/1000) + 'k'
        : (t.upTo === Infinity ? '$' + (p/1000) + 'k+' : '$' + (p/1000) + 'k\u2013$' + (t.upTo/1000) + 'k');
      tierBreakdown.push({ range: label, pct: t.pct, share: tierRev * t.pct });
      p = t.upTo;
    }

    return { tieredTotal, accelBonus, totalPayout, effRate, dailyPayout, tierBreakdown };
  }, [storeVolume, myGrowth]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{color: NAVY}}>Income Calculator</h1>
        <p className="text-sm mt-2" style={{color:'#6b7a99'}}>See what Fjord pays you as an owner-operator. Adjust the sliders to model different scenarios.</p>
      </div>

      {/* Hero Payout Display */}
      <div className="rounded-xl p-8 mb-6 text-center" style={{background: NAVY, border:`2px solid ${GOLD_ACCENT}`}}>
        <div className="text-xs uppercase tracking-widest mb-2" style={{color:'rgba(255,255,255,0.5)'}}>Your Annual Payout from Fjord</div>
        <div className="text-5xl font-bold mb-3" style={{color: GOLD_ACCENT}}>
          {fmt(results.totalPayout)}
        </div>
        <div className="flex justify-center gap-8 text-sm" style={{color:'rgba(255,255,255,0.6)'}}>
          <span>{fmt(results.totalPayout / 12)}/month</span>
          <span>{fmt(results.totalPayout / 52)}/week</span>
          <span>{fmt(results.dailyPayout)}/day</span>
        </div>
        <div className="text-xs mt-3" style={{color:'rgba(255,255,255,0.35)'}}>
          {pct(results.effRate)} effective rate on {fmt(storeVolume)} store revenue
        </div>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-5" style={{background:'white', border:'1px solid #dde4ed'}}>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{color:'#6b7a99'}}>Store Annual Revenue</label>
          <div className="flex items-center gap-3">
            <input type="range" min="200000" max="1000000" step="25000" value={storeVolume}
              onChange={e => setStoreVolume(Number(e.target.value))} className="flex-1" />
            <span className="text-xl font-bold w-24 text-right" style={{color: NAVY}}>{fmt(storeVolume)}</span>
          </div>
          <div className="text-xs mt-2" style={{color:'#8899aa'}}>Our stores currently range from ~$220k to ~$770k</div>
        </div>
        <div className="rounded-xl p-5" style={{background:'white', border:'1px solid #dde4ed'}}>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{color:'#6b7a99'}}>Monthly Year-Over-Year Growth</label>
          <div className="flex items-center gap-3">
            <input type="range" min="0" max="35" step="5" value={myGrowth}
              onChange={e => setMyGrowth(Number(e.target.value))} className="flex-1" />
            <span className="text-xl font-bold w-16 text-right" style={{color: myGrowth > 5 ? '#1a6b3a' : NAVY}}>
              {myGrowth > 0 ? '+' : ''}{myGrowth}%
            </span>
          </div>
          <div className="text-xs mt-2" style={{color:'#8899aa'}}>Growth above 5% YoY unlocks tiered bonus payouts</div>
        </div>
      </div>

      {/* Payout Breakdown */}
      <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #dde4ed', background:'white'}}>
        <div className="px-5 py-4" style={{background:'#f7f9fc', borderBottom:'1px solid #dde4ed'}}>
          <div className="text-sm font-bold" style={{color: NAVY}}>Your Payout Breakdown</div>
          <div className="text-xs" style={{color:'#6b7a99'}}>How your revenue share is calculated on {fmt(storeVolume)} annual revenue</div>
        </div>
        <div className="p-5">
          <div className="space-y-2 mb-4">
            {results.tierBreakdown.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 text-xs" style={{color:'#8899aa'}}>{t.range}</div>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{background:'#eef1f6'}}>
                  <div className="h-full rounded-full" style={{width: Math.max(2, (t.share / results.totalPayout) * 100) + '%', background: '#1a6b8a'}} />
                </div>
                <div className="w-12 text-xs text-right" style={{color:'#8899aa'}}>{(t.pct * 100)}%</div>
                <div className="w-20 text-xs text-right font-semibold" style={{color:'#1a6b8a'}}>{fmt(t.share)}</div>
              </div>
            ))}
            {results.accelBonus > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-32 text-xs" style={{color:'#1a6b3a'}}>Growth bonus</div>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{background:'#eef1f6'}}>
                  <div className="h-full rounded-full" style={{width: Math.max(2, (results.accelBonus / results.totalPayout) * 100) + '%', background: '#1a6b3a'}} />
                </div>
                <div className="w-12 text-xs text-right" style={{color:'#1a6b3a'}}>+{myGrowth}%</div>
                <div className="w-20 text-xs text-right font-semibold" style={{color:'#1a6b3a'}}>+{fmt(results.accelBonus)}</div>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-3" style={{borderTop:'2px solid #dde4ed'}}>
            <span className="text-sm font-bold" style={{color: NAVY}}>Fjord pays you</span>
            <span className="text-lg font-bold" style={{color:'#1a6b3a'}}>{fmt(results.totalPayout)}/year &mdash; {fmt(results.dailyPayout)}/day</span>
          </div>
        </div>
      </div>

      {/* What You Run */}
      <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
        <div className="text-sm font-bold mb-3" style={{color: NAVY}}>What You Run From Your Share</div>
        <p className="text-xs mb-4" style={{color:'#6b7a99'}}>
          As an independent owner-operator, you pay your own business expenses from the revenue share Fjord deposits daily.
          How efficiently you manage these costs directly impacts your take-home income.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4" style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:'#8a5c1a'}}>Ingredients &amp; Supplies (COGS)</div>
            <div className="text-sm" style={{color:'#445566'}}>Typically 18&ndash;22% of store revenue. At {fmt(storeVolume)}, that&apos;s roughly {fmt(storeVolume * 0.20)}/year.</div>
          </div>
          <div className="rounded-lg p-4" style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:'#3a4a8a'}}>Staff Payroll</div>
            <div className="text-sm" style={{color:'#445566'}}>
              {storeVolume >= 400000
                ? 'Higher-volume stores need a 2-person crew every day. Expect ~$120k/year in staff costs.'
                : 'Lower-volume stores run solo with coverage for your day off. Expect ~$20k/year in staff costs.'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Scenarios */}
      <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
        <div className="text-sm font-bold mb-4" style={{color: NAVY}}>Quick Scenarios</div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Growing Store', rev: 500000, growth: 10, desc: 'Mid-volume store with steady 10% growth' },
            { label: 'Strong Performer', rev: 700000, growth: 10, desc: 'High-volume store with solid growth' },
            { label: 'Top Operator', rev: 800000, growth: 20, desc: 'High-volume store crushing it' },
          ].map(sc => {
            let t = 0, p = 0;
            for (const tier of BASE_TIERS) {
              const tierRev = Math.min(sc.rev, tier.upTo) - p;
              if (tierRev <= 0) break;
              t += tierRev * tier.pct;
              p = tier.upTo;
            }
            let bonus = 0;
            const gRate = sc.growth / 100;
            if (gRate > GROWTH_ACCEL_TIERS[0].above) {
              for (const tier of GROWTH_ACCEL_TIERS) {
                if (gRate <= tier.above) continue;
                bonus += sc.rev * (Math.min(gRate, tier.upTo) - tier.above) * tier.pct;
              }
            }
            const payoutVal = t + bonus;
            return (
              <div key={sc.label} className="rounded-lg p-5 text-center cursor-pointer hover:shadow-md transition-shadow"
                style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}
                onClick={() => { setStoreVolume(sc.rev); setMyGrowth(sc.growth); }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{color:'#6b7a99'}}>{sc.label}</div>
                <div className="text-2xl font-bold mb-1" style={{color:'#1a6b3a'}}>{fmt(payoutVal)}</div>
                <div className="text-xs" style={{color:'#8899aa'}}>{fmt(sc.rev)} revenue &middot; +{sc.growth}% growth</div>
                <div className="text-xs mt-1" style={{color:'#8899aa'}}>{sc.desc}</div>
                <div className="text-xs mt-2 font-medium" style={{color:'#1a6b8a'}}>Click to load</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fine Print */}
      <div className="rounded-xl p-5" style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}>
        <div className="text-xs leading-relaxed" style={{color:'#8899aa'}}>
          <strong style={{color:'#6b7a99'}}>Note:</strong> Figures shown are the revenue share Fjord deposits into your LLC&apos;s bank account.
          Your take-home income will be this payout minus your business expenses (ingredients, staff, supplies).
          Revenue share is based on annualized store revenue. Growth bonuses are calculated monthly by comparing
          each calendar month to the same month in the prior year.
        </div>
      </div>
    </div>
  );
}

/* ── MODEL COMPARISON ── */
const STORE_HRS_WEEK = 62; // Mon-Sat 9hrs + Sun 8hrs
const CREW_SIZE = { brooklyn: 1, larchmont: 1, 'cos cob': 2, darien: 2, westport: 2, 'new canaan': 2 };

// Total person-hours needed per week
function storePersonHrs(storeKey) { return STORE_HRS_WEEK * CREW_SIZE[storeKey]; }

// Additional staff hours beyond what the operator covers (50 hrs/wk across 6 days)
function additionalStaffHrs(storeKey) { return storePersonHrs(storeKey) - 50; }

const CURRENT_MODELS = {
  brooklyn:     { type: 'concession', pct: 0.70,  label: 'Concession 70%' },
  darien:       { type: 'concession', pct: 0.525, label: 'Concession 52.5%' },
  'cos cob':    { type: 'inhouse', emps: 1, empHrs: 50, cogsRate: 0.18, label: '1 emp + temps, 18% COGS' },
  larchmont:    { type: 'inhouse', emps: 0, empHrs: 0,  cogsRate: 0.18, label: 'All temps, 18% COGS' },
  westport:     { type: 'inhouse', emps: 1, empHrs: 50, cogsRate: 0.18, label: '1 emp + temps, 18% COGS' },
  'new canaan': { type: 'inhouse', emps: 2, empHrs: 50, cogsRate: 0.18, label: '2 emps + temps, 18% COGS' },
};

function calcCurrentCosts(storeKey, revenue) {
  const m = CURRENT_MODELS[storeKey];
  if (m.type === 'concession') {
    const operatorPay = revenue * m.pct;
    return { labor: operatorPay, cogs: 0, fjord: revenue - operatorPay, laborLabel: 'Operator ' + (m.pct * 100) + '%' };
  }
  const WEEKS = 52, EMP_RATE = 25, TEMP_DAY = 335;
  const empWeekly = (40 * EMP_RATE + 10 * EMP_RATE * 1.5) * 1.25; // OT + burden
  const empAnnual = empWeekly * WEEKS;
  const totalEmpHrs = m.emps * m.empHrs;
  const needed = storePersonHrs(storeKey);
  const gapHrs = m.emps === 0 ? 0 : Math.max(0, needed - totalEmpHrs);
  const tempCost = m.emps === 0 ? 7 * TEMP_DAY * WEEKS : gapHrs * (TEMP_DAY / 9) * WEEKS;
  const labor = m.emps * empAnnual + tempCost;
  const cogs = revenue * m.cogsRate;
  return { labor, cogs, fjord: revenue - labor - cogs, laborLabel: m.label };
}

function calcProposedPayout(revenue) {
  let share = 0, prev = 0;
  for (const t of BASE_TIERS) {
    const tierRev = Math.min(revenue, t.upTo) - prev;
    if (tierRev <= 0) break;
    share += tierRev * t.pct;
    prev = t.upTo;
  }
  return share;
}

function calcProposedOperatorCosts(storeKey, revenue) {
  const cogs = revenue * 0.20;
  const staffHrs = additionalStaffHrs(storeKey);
  const payroll = staffHrs * 25 * 52 * 1.25;
  return { cogs, payroll };
}

function ModelComparison({ storeSales }) {
  const [proposedGrowth, setProposedGrowth] = useState(10);

  const analysis = useMemo(() => {
    return STORES.map(storeKey => {
      const sales = storeSales[storeKey] || [];
      if (sales.length === 0) return null;

      // Monthly revenue buckets
      const byMonth = {};
      sales.forEach(s => {
        const d = new Date(s.date);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        byMonth[key] = (byMonth[key] || 0) + s.gross;
      });

      // Use last complete month as end (exclude Apr 2026 partial)
      const allMonthKeys = Object.keys(byMonth).sort();
      const lastMonth = allMonthKeys[allMonthKeys.length - 1]; // e.g. 2026-04
      const lastComplete = allMonthKeys[allMonthKeys.length - 2]; // e.g. 2026-03

      // Trailing 12 complete months
      const [lcY, lcM] = lastComplete.split('-').map(Number);
      const t12Months = [];
      for (let i = 0; i < 12; i++) {
        let mo = lcM - i, yr = lcY;
        while (mo <= 0) { mo += 12; yr--; }
        t12Months.push(yr + '-' + String(mo).padStart(2, '0'));
      }

      let trailing12 = 0, prior12 = 0;
      t12Months.forEach(m => {
        trailing12 += byMonth[m] || 0;
        const [y, mo] = m.split('-');
        const priorKey = (parseInt(y) - 1) + '-' + mo;
        prior12 += byMonth[priorKey] || 0;
      });

      const actualGrowth = prior12 > 0 ? (trailing12 - prior12) / prior12 : 0;

      // Current model uses ACTUAL trailing 12 revenue
      const actualRevenue = trailing12;
      const cur = calcCurrentCosts(storeKey, actualRevenue);

      // Proposed model uses prior year × hypothetical growth
      const gRate = proposedGrowth / 100;
      const proposedRevenue = prior12 > 0 ? prior12 * (1 + gRate) : actualRevenue;
      const proposedBasePayout = calcProposedPayout(proposedRevenue);

      let growthBonus = 0;
      if (gRate > GROWTH_ACCEL_TIERS[0].above) {
        for (const t of GROWTH_ACCEL_TIERS) {
          if (gRate <= t.above) continue;
          growthBonus += proposedRevenue * (Math.min(gRate, t.upTo) - t.above) * t.pct;
        }
      }
      const proposedPayout = proposedBasePayout + growthBonus;
      const proposedFjord = proposedRevenue - proposedPayout;

      // Operator costs under proposed
      const propOp = calcProposedOperatorCosts(storeKey, proposedRevenue);
      const opTakeHome = proposedPayout - propOp.cogs - propOp.payroll;

      // Monthly YoY breakdown (exclude incomplete months)
      const monthlyYoY = [];
      const sortedMonths = Object.keys(byMonth).sort();
      sortedMonths.forEach(m => {
        if (m === lastMonth) return; // skip incomplete
        const [y, mo] = m.split('-');
        const priorKey = (parseInt(y) - 1) + '-' + mo;
        if (byMonth[priorKey]) {
          monthlyYoY.push({
            month: m,
            current: byMonth[m],
            prior: byMonth[priorKey],
            growth: (byMonth[m] - byMonth[priorKey]) / byMonth[priorKey],
          });
        }
      });

      return {
        storeKey,
        actualRevenue,
        prior12,
        actualGrowth,
        proposedRevenue,
        currentModel: CURRENT_MODELS[storeKey].label,
        curLabor: cur.labor, curCogs: cur.cogs, currentFjord: cur.fjord,
        crew: CREW_SIZE[storeKey],
        proposedPayout, proposedFjord, growthBonus,
        propCogs: propOp.cogs, propPayroll: propOp.payroll, opTakeHome,
        delta: proposedFjord - cur.fjord,
        monthlyYoY,
      };
    }).filter(Boolean);
  }, [storeSales, proposedGrowth]);

  const totals = useMemo(() => {
    const t = { actRev:0, propRev:0, curLabor:0, curCogs:0, curFjord:0, propPayout:0, propCogs:0, propPayroll:0, opTH:0, newFjord:0 };
    analysis.forEach(a => {
      t.actRev += a.actualRevenue; t.propRev += a.proposedRevenue;
      t.curLabor += a.curLabor; t.curCogs += a.curCogs; t.curFjord += a.currentFjord;
      t.propPayout += a.proposedPayout; t.propCogs += a.propCogs; t.propPayroll += a.propPayroll;
      t.opTH += a.opTakeHome; t.newFjord += a.proposedFjord;
    });
    t.delta = t.newFjord - t.curFjord;
    return t;
  }, [analysis]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{color: NAVY}}>Model Comparison</h1>
        <p className="text-sm mt-1" style={{color:'#6b7a99'}}>
          What actually happened (current model) vs what would have happened with owner-operators at a hypothetical growth rate.
          Last 12 complete months of data.
        </p>
      </div>

      {/* Growth Input + Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{background:'white', border:`2px solid ${GOLD_ACCENT}`}}>
          <div className="text-xs uppercase tracking-wide font-medium mb-2" style={{color:'#6b7a99'}}>Proposed YoY Growth</div>
          <div className="flex items-center gap-2">
            <input type="number" min="-20" max="50" step="1" value={proposedGrowth}
              onChange={e => setProposedGrowth(Number(e.target.value))}
              className="w-20 rounded-lg border px-3 py-2 text-lg font-bold text-center"
              style={{borderColor: GOLD_ACCENT, color: NAVY}} />
            <span className="text-lg font-bold" style={{color: NAVY}}>%</span>
          </div>
          <div className="text-xs mt-1" style={{color:'#8899aa'}}>Applied to all stores</div>
        </div>
        {[
          ['Current Revenue', fmt(totals.actRev), '#445566', '#f7f9fc', '#dde4ed'],
          ['Current Fjord Net', fmt(totals.curFjord), '#1a6b8a', '#edf6fb', '#b3d9eb'],
          ['Proposed Fjord Net', fmt(totals.newFjord), GOLD_ACCENT, '#fdf8ec', '#e8d38a'],
          ['Delta', (totals.delta >= 0 ? '+' : '') + fmt(totals.delta), totals.delta >= 0 ? '#1a6b3a' : '#b5282a', totals.delta >= 0 ? '#edfaf2' : '#fef2f2', totals.delta >= 0 ? '#9dd4b5' : '#f5c6c6'],
        ].map(([label, val, color, bg, border]) => (
          <div key={label} className="rounded-xl p-4" style={{background: bg, border: '1px solid ' + border}}>
            <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>{label}</div>
            <div className="text-2xl font-bold" style={{color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #dde4ed', background:'white'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr style={{background:'#f7f9fc', borderBottom:'1px solid #dde4ed'}}>
                <th rowSpan={2} className="text-left px-3 py-2 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Store</th>
                <th rowSpan={2} className="text-center px-3 py-2 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Crew</th>
                <th rowSpan={2} className="text-right px-3 py-2 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Actual YoY</th>
                <th colSpan={4} className="text-center px-3 py-2 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb', borderLeft:'2px solid #b3d9eb'}}>Current Model (Actual)</th>
                <th colSpan={5} className="text-center px-3 py-2 font-semibold uppercase tracking-wide" style={{color: GOLD_ACCENT, background:'#fdf8ec', borderLeft:'2px solid #e8d38a'}}>Proposed Model (+{proposedGrowth}% YoY)</th>
                <th rowSpan={2} className="text-right px-3 py-2 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', borderLeft:'2px solid #dde4ed'}}>Delta</th>
              </tr>
              <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#6b7a99', background:'#edf6fb', borderLeft:'2px solid #b3d9eb', fontSize:'10px'}}>Revenue</th>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#8a5c1a', background:'#edf6fb', fontSize:'10px'}}>Labor/Op</th>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#6b7a99', background:'#edf6fb', fontSize:'10px'}}>COGS</th>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#1a6b8a', background:'#edf6fb', fontSize:'10px'}}>Fjord Net</th>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#6b7a99', background:'#fdf8ec', borderLeft:'2px solid #e8d38a', fontSize:'10px'}}>Revenue</th>
                <th className="text-right px-3 py-2 font-medium" style={{color: GOLD_ACCENT, background:'#fdf8ec', fontSize:'10px'}}>Op Payout</th>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#8a5c1a', background:'#fdf8ec', fontSize:'10px'}}>Op COGS+Labor</th>
                <th className="text-right px-3 py-2 font-medium" style={{color:'#1a6b3a', background:'#fdf8ec', fontSize:'10px'}}>Op Take-Home</th>
                <th className="text-right px-3 py-2 font-medium" style={{color: GOLD_ACCENT, background:'#fdf8ec', fontSize:'10px'}}>Fjord Net</th>
              </tr>
            </thead>
            <tbody>
              {analysis.map(a => {
                const deltaColor = a.delta >= 0 ? '#1a6b3a' : '#b5282a';
                const thColor = a.opTakeHome >= 70000 ? '#1a6b3a' : '#b5282a';
                return (
                  <tr key={a.storeKey} style={{borderBottom:'1px solid #eef1f6'}} className="hover:bg-blue-50/30">
                    <td className="px-3 py-3 font-semibold" style={{color: NAVY}}>
                      {STORE_LABELS[a.storeKey]}
                      <div className="font-normal text-xs" style={{color:'#8899aa', fontSize:'10px'}}>{a.currentModel}</div>
                    </td>
                    <td className="px-3 py-3 text-center" style={{color:'#6b7a99'}}>{a.crew}</td>
                    <td className="px-3 py-3 text-right font-medium" style={{color: a.actualGrowth > 0 ? '#1a6b3a' : a.actualGrowth < 0 ? '#b5282a' : '#6b7a99'}}>
                      {a.actualGrowth > 0 ? '+' : ''}{(a.actualGrowth * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right" style={{color:'#445566', background:'rgba(237,246,251,0.4)', borderLeft:'2px solid #e0eef7'}}>{fmt(a.actualRevenue)}</td>
                    <td className="px-3 py-3 text-right" style={{color:'#8a5c1a', background:'rgba(237,246,251,0.4)'}}>{fmt(a.curLabor)}</td>
                    <td className="px-3 py-3 text-right" style={{color:'#6b7a99', background:'rgba(237,246,251,0.4)'}}>{a.curCogs > 0 ? fmt(a.curCogs) : '-'}</td>
                    <td className="px-3 py-3 text-right font-semibold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmt(a.currentFjord)}</td>
                    <td className="px-3 py-3 text-right" style={{color:'#445566', background:'rgba(253,248,236,0.4)', borderLeft:'2px solid #e8d38a'}}>{fmt(a.proposedRevenue)}</td>
                    <td className="px-3 py-3 text-right" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.4)'}}>{fmt(a.proposedPayout)}</td>
                    <td className="px-3 py-3 text-right" style={{color:'#8a5c1a', background:'rgba(253,248,236,0.4)'}}>{fmt(a.propCogs + a.propPayroll)}</td>
                    <td className="px-3 py-3 text-right font-medium" style={{color: thColor, background:'rgba(253,248,236,0.4)'}}>{fmt(a.opTakeHome)}</td>
                    <td className="px-3 py-3 text-right font-semibold" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.4)'}}>{fmt(a.proposedFjord)}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{color: deltaColor, borderLeft:'2px solid #dde4ed'}}>
                      {a.delta >= 0 ? '+' : ''}{fmt(a.delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:'#f0f4f8', borderTop:'2px solid ' + NAVY}}>
                <td className="px-3 py-3 font-bold uppercase text-xs" style={{color:'#6b7a99'}}>Total</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#445566', background:'rgba(237,246,251,0.6)', borderLeft:'2px solid #b3d9eb'}}>{fmt(totals.actRev)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#8a5c1a', background:'rgba(237,246,251,0.6)'}}>{fmt(totals.curLabor)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#6b7a99', background:'rgba(237,246,251,0.6)'}}>{fmt(totals.curCogs)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(totals.curFjord)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#445566', background:'rgba(253,248,236,0.6)', borderLeft:'2px solid #e8d38a'}}>{fmt(totals.propRev)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.6)'}}>{fmt(totals.propPayout)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#8a5c1a', background:'rgba(253,248,236,0.6)'}}>{fmt(totals.propCogs + totals.propPayroll)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:'#1a6b3a', background:'rgba(253,248,236,0.6)'}}>{fmt(totals.opTH)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color: GOLD_ACCENT, background:'rgba(253,248,236,0.6)'}}>{fmt(totals.newFjord)}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color: totals.delta >= 0 ? '#1a6b3a' : '#b5282a', borderLeft:'2px solid #dde4ed'}}>
                  {totals.delta >= 0 ? '+' : ''}{fmt(totals.delta)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Monthly YoY Detail */}
      <div className="rounded-xl overflow-hidden mb-6" style={{border:'1px solid #dde4ed', background:'white'}}>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#f7f9fc', borderBottom:'1px solid #dde4ed'}}>
          Monthly YoY Growth by Store
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
                <th className="text-left px-3 py-2 font-semibold" style={{color:'#6b7a99'}}>Month</th>
                {STORES.map(s => (
                  <th key={s} className="text-right px-3 py-2 font-semibold" style={{color: NAVY}}>{STORE_LABELS[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Collect all months that have YoY data
                const allMonths = new Set();
                analysis.forEach(a => a.monthlyYoY.forEach(m => allMonths.add(m.month)));
                const sortedMonths = [...allMonths].sort().reverse();
                return sortedMonths.map(month => (
                  <tr key={month} style={{borderBottom:'1px solid #eef1f6'}}>
                    <td className="px-3 py-2 font-medium" style={{color: NAVY}}>{month}</td>
                    {STORES.map(storeKey => {
                      const a = analysis.find(x => x.storeKey === storeKey);
                      const m = a?.monthlyYoY.find(x => x.month === month);
                      if (!m) return <td key={storeKey} className="px-3 py-2 text-right" style={{color:'#ccd4e0'}}>-</td>;
                      const g = m.growth;
                      return (
                        <td key={storeKey} className="px-3 py-2 text-right font-medium" style={{color: g > 0.05 ? '#1a6b3a' : g < -0.05 ? '#b5282a' : '#6b7a99'}}>
                          {g > 0 ? '+' : ''}{(g * 100).toFixed(1)}%
                          <span className="block font-normal" style={{color:'#8899aa', fontSize:'10px'}}>{fmt(m.current)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Insight */}
      <div className="rounded-xl p-5" style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:'#6b7a99'}}>What This Means</div>
        <div className="text-xs leading-relaxed" style={{color:'#6b7a99'}}>
          The <strong style={{color: NAVY}}>Current Model</strong> column shows what Fjord nets today under the existing mix of concessions, employees, and temps.
          The <strong style={{color: GOLD_ACCENT}}>Proposed Model</strong> shows what Fjord would net under the owner-operator revenue share.
          Positive delta means the proposed model is better for Fjord; negative means it costs more.
          The trade-off: Fjord gives up some margin but eliminates all direct labor management, temp coordination, employment liability, and COGS procurement for in-house stores.
          Adjust the growth sliders to see how different performance scenarios affect the comparison.
        </div>
      </div>
    </div>
  );
}

/* ── MAIN DASHBOARD ── */
export default function Dashboard() {
  const [tab, setTab]             = useState('overview');
  const [store, setStore]         = useState('cos cob');
  const [allSales, setAllSales]   = useState({});
  const [allPayroll, setAllPayroll] = useState({});
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [openHistory, setOpenHistory] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [salesRes, payrollRes, invoicesRes] = await Promise.all([
          fetch('/api/sales'),
          fetch('/api/payroll'),
          fetch('/api/invoices'),
        ]);
        const { stores: salesData }  = await salesRes.json();
        const { weeks: payrollData } = await payrollRes.json();
        const { invoices: invData }  = await invoicesRes.json();
        setAllSales(salesData);
        setAllPayroll(payrollData);
        setInvoices(invData);
      } catch(e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const ledger = useMemo(() => {
    const sales = allSales[store] || [];
    return buildLedger(sales);
  }, [allSales, store]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#f0f4f8'}}>
      <div className="text-center">
        <div className="text-2xl mb-3 font-semibold" style={{color: NAVY}}>Loading...</div>
        <div className="text-sm" style={{color:'#8899aa'}}>Reading sales, payroll and invoice files</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#f0f4f8'}}>
      <div className="text-center">
        <div className="text-xl mb-2 text-red-700">Could not load data</div>
        <div className="text-sm" style={{color:'#8899aa'}}>{error}</div>
      </div>
    </div>
  );

  const unpaid   = ledger.filter(r => !r.isPaid).sort((a,b) => a.pd - b.pd);
  const paidRows = ledger.filter(r => r.isPaid);
  const nextRow  = unpaid[0];
  const dOut = r => Math.round((r.pd - TODAY) / 864e5);
  const s7   = unpaid.filter(r => dOut(r) <= 7).reduce((s,r) => s + r.payout, 0);
  const s14  = unpaid.filter(r => dOut(r) <= 14).reduce((s,r) => s + r.payout, 0);
  const s21  = unpaid.reduce((s,r) => s + r.payout, 0);

  // Current effective rate and trailing growth for sidebar
  const recentDays = ledger.slice(-30);
  const avgEffRate = recentDays.length > 0
    ? recentDays.reduce((s,r) => s + r.effectiveRate, 0) / recentDays.length : 0;
  const currentGrowth = ledger.length > 0 ? (ledger[ledger.length - 1].trailingGrowth || 0) : 0;

  return (
    <div className="min-h-screen font-sans" style={{background:'#f0f4f8'}}>

      {/* HEADER */}
      <header style={{background: NAVY, borderBottom:`3px solid ${GOLD_ACCENT}`}} className="sticky top-0 z-50">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="https://fjordfishmarket.com/cdn/shop/files/Layer_1.svg?v=1757260993"
              alt="Fjord Fish Market" className="h-8 w-auto brightness-0 invert"
              onError={e => { e.target.style.display='none'; }} />
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-white text-sm font-semibold tracking-wide">Sushi Counter &mdash; Owner Portal</div>
              <div style={{color:'rgba(255,255,255,0.4)'}} className="text-xs tracking-widest uppercase flex items-center gap-2">
                <select value={store} onChange={e => { setStore(e.target.value); setOpenHistory(null); }}
                  className="bg-transparent text-white/80 border border-white/20 rounded px-2 py-0.5 text-xs uppercase tracking-widest cursor-pointer"
                  style={{outline:'none'}}>
                  {STORES.map(s => (
                    <option key={s} value={s} style={{color:'#000'}}>{STORE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{color:'rgba(255,255,255,0.35)'}}>
            Today: <strong className="text-white">{fmtDateFull(TODAY)}</strong>
          </div>
        </div>
        <div style={{background: NAVY_LIGHT, borderTop:'1px solid rgba(255,255,255,0.06)'}}
          className="px-6 h-8 flex items-center gap-6">
          {[
            {label:'POS', status:'Live', live:true},
            {label:'Ottimate', status: invoices.filter(i=>i.store===store).length + ' invoices', live: invoices.filter(i=>i.store===store).length > 0},
            {label:'ADP', status: (allPayroll[store]?.length || 0) + ' weeks', live: (allPayroll[store]?.length || 0) > 0},
          ].map((f,i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${f.live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span style={{color:'rgba(255,255,255,0.4)'}}>{f.label}</span>
              <span style={{color:'rgba(255,255,255,0.75)'}}>{f.status}</span>
            </div>
          ))}
          <div className="ml-auto text-xs" style={{color:'rgba(255,255,255,0.22)'}}>
            {ledger.length} days &middot; {paidRows.length} paid &middot; {unpaid.length} upcoming
          </div>
        </div>
      </header>

      {/* TABS */}
      <div style={{background: NAVY_LIGHT, borderBottom:'1px solid rgba(255,255,255,0.08)'}} className="px-6 flex">
        {[['overview','Overview'],['recruit','Job Opportunity'],['income','Income Calculator'],['compare','Model Comparison'],['modeler','Scenario Modeler'],['upcoming','Upcoming Payments'],['history','Payment History']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-xs font-medium tracking-widest uppercase border-b-2 transition-all ${tab === id ? 'text-white border-amber-400' : 'border-transparent'}`}
            style={{color: tab === id ? 'white' : 'rgba(255,255,255,0.35)'}}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex" style={{minHeight:'calc(100vh - 116px)'}}>

        {/* SIDEBAR */}
        {!['modeler','overview','recruit','income','compare'].includes(tab) && (
          <aside className="w-56 flex-shrink-0 border-r" style={{background:'white', borderColor:'#dde4ed'}}>
            <div className="p-4">
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b7a99'}}>
                {STORE_LABELS[store]} Payments
              </div>
              <div className="space-y-2 mb-6">
                {[
                  { label:'Next Payment', val: nextRow ? fmt(nextRow.payout) : '-', sub: nextRow ? 'Arriving '+fmtDate(nextRow.pd) : '-', accent: GOLD_ACCENT, bg:'#fdf8ec', border:'#e8d38a' },
                  { label:'Next 21 Days', val: fmt(s21), sub: unpaid.length+' payments', accent:'#1a6b8a', bg:'#edf6fb', border:'#b3d9eb' },
                  { label:'Received To Date', val: fmt(paidRows.reduce((s,r)=>s+r.payout,0)), sub: paidRows.length+' deposits', accent:'#1a6b3a', bg:'#edfaf2', border:'#9dd4b5' },
                ].map(k => (
                  <div key={k.label} className="rounded-lg p-3" style={{background:k.bg, border:`1px solid ${k.border}`}}>
                    <div className="text-xs uppercase tracking-wide mb-1" style={{color:'#8899aa'}}>{k.label}</div>
                    <div className="text-lg font-bold" style={{color:k.accent}}>{k.val}</div>
                    <div className="text-xs mt-0.5" style={{color:'#8899aa'}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#6b7a99'}}>Comp Structure</div>
              {[
                ['Base tiers', '62/55/49/43%'],
                ['Growth bonus', 'Tiered > 5% YoY'],
                ['Monthly YoY', (currentGrowth > 0 ? '+' : '') + pct(currentGrowth)],
                ['Eff. rate (30d)', pct(avgEffRate)],
                ['Payment lag', '21 days'],
                ['COGS (operator)', '~20%'],
              ].map(([l,v]) => (
                <div key={l} className="flex justify-between text-xs py-1" style={{color:'#8899aa', borderBottom:'1px solid #eef1f6'}}>
                  <span>{l}</span><strong style={{color: NAVY}}>{v}</strong>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* MAIN */}
        <main className={`flex-1 p-6 overflow-y-auto ${tab === 'modeler' ? '' : ''}`}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{color: NAVY}}>Sushi Concession Owner-Operator Program</h1>
                <p className="text-sm mt-2" style={{color:'#6b7a99'}}>Internal reference &mdash; compensation model, key terms, and program goals</p>
              </div>

              {/* What We're Building */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>What We Are Building</h2>
                <p className="text-sm leading-relaxed mb-4" style={{color:'#445566'}}>
                  A platform where sushi concession operators run their own businesses within Fjord Fish Market locations.
                  Each operator sets up their own LLC and receives a daily revenue share from their store&apos;s sales. From that payout,
                  they cover their own COGS (ingredients, supplies) and payroll (any additional staff they hire). Fjord retains the
                  remaining revenue after the operator&apos;s share is paid out.
                </p>
                <p className="text-sm leading-relaxed" style={{color:'#445566'}}>
                  The goal is to create true owner-operators who are invested in growing their store&apos;s business, working
                  50+ hours per week in-store, and thinking like entrepreneurs &mdash; not employees collecting a paycheck.
                </p>
              </div>

              {/* Goals */}
              <div className="rounded-xl p-6 mb-6" style={{background:'#edf6fb', border:'1px solid #b3d9eb'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>Program Goals</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Livable Floor', 'Operators earn at least ~$70k/year at even the lowest-volume stores, making this a viable full-time career.'],
                    ['Performance Ceiling ~$150k', 'Top-performing operators (Darien-level volume) can earn ~$150k, with continued upside beyond that.'],
                    ['No Hard Cap', 'The growth accelerator ensures operators are always incentivized to push revenue higher, even at the top tier.'],
                    ['Anti-Absentee Design', 'The tiered structure makes it economically unviable to simply hire cheap labor and step away. The math only works when the operator is in the store.'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-lg p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
                      <div className="text-sm font-bold mb-1" style={{color: NAVY}}>{title}</div>
                      <div className="text-xs leading-relaxed" style={{color:'#6b7a99'}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How It Works */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>How the Revenue Share Works</h2>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {[
                    ['62%', 'First $300k'],
                    ['55%', '$300k \u2013 $500k'],
                    ['49%', '$500k \u2013 $700k'],
                    ['43%', 'Above $700k'],
                  ].map(([rate, range]) => (
                    <div key={rate} className="rounded-lg p-4 text-center" style={{background:'#edf6fb', border:'1px solid #b3d9eb'}}>
                      <div className="text-2xl font-bold" style={{color:'#1a6b8a'}}>{rate}</div>
                      <div className="text-xs mt-1" style={{color:'#6b7a99'}}>{range}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg p-4 mb-4" style={{background:'#edfaf2', border:'1px solid #9dd4b5'}}>
                  <div className="text-sm font-bold mb-2" style={{color:'#1a6b3a'}}>YoY Growth Accelerator (Tiered)</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['+10%', '5\u201315% YoY growth'],
                      ['+18%', '15\u201325% YoY growth'],
                      ['+25%', '25%+ YoY growth'],
                    ].map(([bonus, range]) => (
                      <div key={bonus} className="rounded-lg p-3 text-center" style={{background:'white', border:'1px solid #9dd4b5'}}>
                        <div className="text-lg font-bold" style={{color:'#1a6b3a'}}>{bonus}</div>
                        <div className="text-xs" style={{color:'#6b7a99'}}>{range}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs mt-2" style={{color:'#6b7a99'}}>
                    Bonus applied to incremental revenue within each growth band. The harder you grow, the more you earn per incremental dollar.
                  </div>
                </div>
                <div className="text-xs leading-relaxed" style={{color:'#6b7a99'}}>
                  <strong style={{color: NAVY}}>Example:</strong> A store doing $700k/year pays the operator: ($300k &times; 62%) + ($200k &times; 55%) + ($200k &times; 49%) = $186k + $110k + $98k = $394k.
                  If that store grew 20% YoY, the operator earns growth bonuses: 10% on the 5&ndash;15% band ($700k &times; 10% &times; 10% = $7k) plus
                  18% on the 15&ndash;20% band ($700k &times; 5% &times; 18% = $6.3k) = $13.3k bonus. Total payout: $407.3k.
                </div>
              </div>

              {/* Money Flow */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>Daily Money Flow</h2>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  {[
                    ['Customer pays', '#445566', '#f7f9fc'],
                    ['POS captures sale', '#445566', '#f7f9fc'],
                    ['CC settles next day', '#445566', '#f7f9fc'],
                    ['21-day float', GOLD_ACCENT, '#fdf8ec'],
                    ['Daily ACH to operator LLC', '#1a6b3a', '#edfaf2'],
                  ].map(([step, color, bg], i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && <span style={{color:'#ccd4e0'}}>&rarr;</span>}
                      <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{color, background: bg, border:'1px solid #dde4ed'}}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-xs mt-3" style={{color:'#8899aa'}}>
                  Payout is initiated via Modern Treasury on day 20, arrives in operator&apos;s LLC bank account on day 21.
                </div>
              </div>

              {/* Key Terms */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-4" style={{color: NAVY}}>Key Terms</h2>
                <div className="space-y-3">
                  {[
                    ['Owner-Operator', 'An independent business owner (LLC) who runs a sushi concession inside a Fjord location. Expected to work 50+ hours/week in-store.'],
                    ['Revenue Share', 'The percentage of gross daily POS revenue paid to the operator. Uses a 4-tier structure (62% / 55% / 49% / 43%) with breakpoints at $300k, $500k, and $700k annualized revenue.'],
                    ['Growth Accelerator', 'A tiered bonus on incremental revenue when monthly YoY growth exceeds 5%: 10% on 5-15% growth, 18% on 15-25% growth, 25% on 25%+ growth. Calculated by comparing each calendar month to the same month prior year.'],
                    ['COGS (Cost of Goods Sold)', 'Ingredients, packaging, and supplies. Estimated at 20% of revenue. Paid by the operator from their revenue share.'],
                    ['Payroll', 'Wages for any additional staff the operator hires, plus ~25% burden (FICA, SUTA/FUTA, workers comp). Paid by the operator from their share.'],
                    ['21-Day Float', 'The lag between when a sale occurs and when the operator receives their payout. Fjord holds funds for 21 days after credit card settlement.'],
                    ['Take-Home', 'What the operator keeps after paying COGS and payroll from their revenue share. This is their personal income.'],
                    ['Fjord Net', 'Revenue retained by Fjord after paying out the operator\'s share. Fjord does NOT pay COGS or payroll — those are the operator\'s responsibility.'],
                    ['Effective Rate', 'The blended percentage the operator actually receives, accounting for all tiers. Decreases as revenue grows due to the tiered structure.'],
                    ['Modern Treasury', 'Payment operations platform used to automate daily ACH payouts to operator bank accounts.'],
                    ['Store Hours', 'Mon-Sat 10am-7pm, Sun 10am-6pm (62 hours/week). Operator works 50+ hours across 6 days. High-volume stores require 2 people at all times (74 hrs/wk additional staff). Low-volume stores need coverage for the operator\'s day off (12 hrs/wk).'],
                  ].map(([term, def]) => (
                    <div key={term} className="flex gap-4 py-2" style={{borderBottom:'1px solid #eef1f6'}}>
                      <div className="w-48 flex-shrink-0 text-sm font-semibold" style={{color: NAVY}}>{term}</div>
                      <div className="text-sm" style={{color:'#6b7a99'}}>{def}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div className="rounded-xl p-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>Locations</h2>
                <div className="grid grid-cols-3 gap-3">
                  {STORES.map(s => {
                    const sales = allSales[s] || [];
                    const totalRev = sales.reduce((sum, r) => sum + r.gross, 0);
                    const days = sales.length;
                    const annualized = days > 0 ? (totalRev / days) * 365 : 0;
                    const dailyAvg = days > 0 ? totalRev / days : 0;
                    const needsStaff = annualized > 400000;
                    return (
                      <div key={s} className="rounded-lg p-4" style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}>
                        <div className="text-sm font-bold mb-2" style={{color: NAVY}}>{STORE_LABELS[s]}</div>
                        <div className="space-y-1 text-xs" style={{color:'#6b7a99'}}>
                          <div className="flex justify-between">
                            <span>Annualized</span>
                            <strong style={{color:'#445566'}}>{fmt(annualized)}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Daily Avg</span>
                            <strong style={{color:'#445566'}}>{fmt(dailyAvg)}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Staffing</span>
                            <strong style={{color: needsStaff ? '#3a4a8a' : '#1a6b3a'}}>
                              {needsStaff ? '2-person crew' : 'Solo + 1 day coverage'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* UPCOMING */}
          {tab === 'upcoming' && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Upcoming Payments &mdash; {STORE_LABELS[store]}</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Scheduled ACH deposits &middot; tiered revenue share + growth accelerator</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  ['Next 7 Days',  fmt(s7),  unpaid.filter(r=>dOut(r)<=7).length+' payments',  GOLD_ACCENT, '#fdf8ec', '#e8d38a'],
                  ['Next 14 Days', fmt(s14), unpaid.filter(r=>dOut(r)<=14).length+' payments', '#1a6b8a',   '#edf6fb', '#b3d9eb'],
                  ['Next 21 Days', fmt(s21), unpaid.length+' total',                           NAVY,        '#f0f4f8', '#c8d4e4'],
                ].map(([label,val,sub,color,bg,border]) => (
                  <div key={label} className="rounded-xl p-4" style={{background:bg, border:`1px solid ${border}`}}>
                    <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>{label}</div>
                    <div className="text-2xl font-bold" style={{color}}>{val}</div>
                    <div className="text-xs mt-1" style={{color:'#8899aa'}}>{sub}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-3 mb-5 flex items-center gap-2 text-xs"
                style={{background:'#fdf8ec', border:'1px solid #e8d38a', color:'#7a5a1a'}}>
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                Amounts based on tiered revenue share (62/55/49/43%). Tiered growth accelerator applies when YoY growth exceeds 5%.
              </div>
              <div className="space-y-2">
                {unpaid.map((r, i) => {
                  const d = dOut(r);
                  return (
                    <div key={r.d} className="rounded-xl flex items-center gap-3 px-4 py-3"
                      style={{background: i===0 ? '#fdf8ec' : 'white', border: i===0 ? `1px solid ${GOLD_ACCENT}` : '1px solid #dde4ed'}}>
                      <div className="w-16 flex-shrink-0">
                        <div className="text-sm font-bold" style={{color: i===0 ? GOLD_ACCENT : NAVY}}>{fmtDate(r.pd)}</div>
                        <div className="text-xs mt-0.5" style={{color:'#8899aa'}}>{d===0?'today':d===1?'tomorrow':'in '+d+'d'}</div>
                      </div>
                      <div className="w-px self-stretch" style={{background:'#dde4ed'}} />
                      <div className="text-xs w-16 flex-shrink-0" style={{color:'#8899aa'}}>for {fmtDate(r.ed)}</div>
                      <div className="flex-1 flex items-center gap-2 flex-wrap text-xs" style={{color:'#8899aa'}}>
                        <span>POS <strong style={{color:'#445566'}}>{fmt(r.g)}</strong></span>
                        <span style={{color:'#ccd4e0'}}>&rarr;</span>
                        <span>Base <strong style={{color:'#1a6b8a'}}>{fmt(r.baseShare)}</strong></span>
                        {r.growthBonus > 0 && <>
                          <span style={{color:'#ccd4e0'}}>+</span>
                          <span>Growth <strong style={{color:'#1a6b3a'}}>{fmt(r.growthBonus)}</strong></span>
                        </>}
                      </div>
                      <div className="text-xl font-bold w-24 text-right flex-shrink-0" style={{color:'#1a6b3a'}}>{fmt(r.payout)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Payment History &mdash; {STORE_LABELS[store]}</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Confirmed ACH deposits &middot; tap any row for full breakdown</p>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  ['POS Revenue',      fmt(paidRows.reduce((s,r)=>s+r.g,0)),      '#445566', '#f7f9fc', '#dde4ed'],
                  ['Total Paid Out',   fmt(paidRows.reduce((s,r)=>s+r.payout,0)), '#1a6b3a', '#edfaf2', '#9dd4b5'],
                  ['Payments Made',    paidRows.length,                            NAVY,      '#f0f4f8', '#c8d4e4'],
                ].map(([label,val,color,bg,border]) => (
                  <div key={label} className="rounded-xl p-4" style={{background:bg, border:`1px solid ${border}`}}>
                    <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>{label}</div>
                    <div className="text-2xl font-bold" style={{color}}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[...paidRows].reverse().map((r, i) => {
                  const isOpen = openHistory === i;
                  return (
                    <div key={r.d} className="rounded-xl overflow-hidden" style={{border:'1px solid #dde4ed'}}>
                      <div className="flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-blue-50/30"
                           style={{background:'white'}}
                           onClick={() => setOpenHistory(isOpen ? null : i)}>
                        <div className="w-20 flex-shrink-0">
                          <div className="text-sm font-bold" style={{color:'#1a6b3a'}}>{fmtDate(r.pd)}</div>
                          <div className="text-xs" style={{color:'#8899aa'}}>deposited</div>
                        </div>
                        <div className="text-xs w-20 flex-shrink-0" style={{color:'#8899aa'}}>for {fmtDate(r.ed)}</div>
                        <div className="text-xs flex-shrink-0" style={{color:'#8899aa'}}>POS <strong style={{color:'#445566'}}>{fmt(r.g)}</strong></div>
                        <div className="flex-1 text-xl font-bold" style={{color:'#1a6b3a'}}>{fmt(r.payout)}</div>
                        <Badge status="paid" />
                        <span className="ml-2 text-sm" style={{color:'#8899aa'}}>{isOpen ? '\u2191' : '\u203A'}</span>
                      </div>
                      {isOpen && (
                        <div style={{background:'#f7f9fc', borderTop:'1px solid #dde4ed'}} className="px-4 py-4">
                          <div className="grid grid-cols-4 gap-3">
                            {[
                              ['POS Revenue',  fmtD(r.g),          '#445566',  'POS'],
                              ['Base Share',   fmtD(r.baseShare),  '#1a6b8a',  pct(r.effectiveRate) + ' eff.'],
                              ['Growth Bonus', r.growthBonus > 0 ? '+' + fmtD(r.growthBonus) : '-', r.growthBonus > 0 ? '#1a6b3a' : '#8899aa', pct(r.trailingGrowth) + ' monthly YoY'],
                              ['Your Payout',  fmt(r.payout),      '#1a6b3a',  'ACH deposit'],
                            ].map(([label,val,color,source]) => (
                              <div key={label} className="rounded-lg p-3" style={{background:'white', border:'1px solid #dde4ed'}}>
                                <div className="text-xs uppercase tracking-wide mb-1" style={{color:'#8899aa'}}>{label}</div>
                                <div className="font-bold text-sm" style={{color}}>{val}</div>
                                <div className="text-xs mt-1 flex items-center gap-1" style={{color:'#8899aa'}}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                  {source}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs mt-3" style={{color:'#8899aa'}}>MT Transfer &middot; {fmtDateFull(r.pd)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODEL COMPARISON */}
          {tab === 'compare' && (
            <ModelComparison storeSales={allSales} />
          )}

          {/* SCENARIO MODELER */}
          {tab === 'modeler' && (
            <ScenarioModeler storeSales={allSales} />
          )}

          {/* JOB OPPORTUNITY */}
          {tab === 'recruit' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color: GOLD_ACCENT}}>Now Recruiting</div>
                <h1 className="text-3xl font-bold" style={{color: NAVY}}>Sushi Concession Owner-Operator</h1>
                <p className="text-sm mt-2" style={{color:'#6b7a99'}}>Fjord Fish Market &middot; Multiple Locations in CT &amp; NY</p>
              </div>

              {/* Hero Card */}
              <div className="rounded-xl p-6 mb-6" style={{background: NAVY, border:`2px solid ${GOLD_ACCENT}`}}>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold text-white">$150k+</div>
                    <div className="text-xs mt-1" style={{color:'rgba(255,255,255,0.5)'}}>Annual earning potential</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold" style={{color: GOLD_ACCENT}}>Be Your Own Boss</div>
                    <div className="text-xs mt-1" style={{color:'rgba(255,255,255,0.5)'}}>Run your own LLC</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white">Daily Pay</div>
                    <div className="text-xs mt-1" style={{color:'rgba(255,255,255,0.5)'}}>Revenue share deposited daily</div>
                  </div>
                </div>
              </div>

              {/* The Opportunity */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>The Opportunity</h2>
                <p className="text-sm leading-relaxed mb-4" style={{color:'#445566'}}>
                  Fjord Fish Market is looking for entrepreneurial sushi chefs to run their own sushi concession inside
                  our premium retail locations. This is not a job &mdash; it&apos;s your own business. You&apos;ll operate as an
                  independent owner through your own LLC, receiving a daily revenue share from your store&apos;s sales.
                </p>
                <p className="text-sm leading-relaxed" style={{color:'#445566'}}>
                  We provide the location, the foot traffic, the brand, and the platform. You bring the craft,
                  the hustle, and the ownership mentality. The more you grow the business, the more you earn.
                </p>
              </div>

              {/* Why Fjord */}
              <div className="rounded-xl p-6 mb-6" style={{background: NAVY, border:`2px solid ${GOLD_ACCENT}`}}>
                <h2 className="text-lg font-bold mb-4 text-white">Why Fjord Fish Market?</h2>
                <p className="text-sm leading-relaxed mb-5" style={{color:'rgba(255,255,255,0.7)'}}>
                  Fjord isn&apos;t a grocery store with a sushi counter &mdash; it&apos;s a premium seafood marketplace where customers
                  come specifically for quality. That distinction matters for your business.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Premium Customer Base',
                      'Our locations are in some of the highest-income communities in the Northeast &mdash; Darien, New Canaan, Cos Cob, Westport, and Larchmont. These customers expect quality and are willing to pay for it. Your average ticket is higher here than at any conventional grocery sushi counter.'],
                    ['Built-In Foot Traffic',
                      'Fjord is a destination. Customers drive past other stores to shop here. You inherit that traffic from day one &mdash; no need to build an audience from scratch or spend money on marketing.'],
                    ['Reputation for Quality',
                      'Fjord has spent years building a reputation for the freshest seafood in the market. Your sushi concession benefits from that halo. When customers trust the fish counter, they trust the sushi counter.'],
                    ['Premium Sourcing Network',
                      'As part of the Fjord ecosystem, you have access to our seafood sourcing relationships. The same fish buyers who stock our retail cases can help you access top-quality product at competitive wholesale pricing.'],
                    ['No Competition for Attention',
                      'Unlike a supermarket where sushi is an afterthought next to the deli, at Fjord your counter is a centerpiece. Customers walk in looking for seafood &mdash; sushi is a natural extension of why they&apos;re here.'],
                    ['Growing Brand, Growing Locations',
                      'Fjord is expanding. As we open new locations, successful operators get first consideration for additional stores. Build a track record at one location and grow with us.'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-lg p-4" style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)'}}>
                      <div className="text-sm font-bold mb-1" style={{color: GOLD_ACCENT}}>{title}</div>
                      <div className="text-xs leading-relaxed" style={{color:'rgba(255,255,255,0.6)'}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What You Get */}
              <div className="rounded-xl p-6 mb-6" style={{background:'#edf6fb', border:'1px solid #b3d9eb'}}>
                <h2 className="text-lg font-bold mb-4" style={{color: NAVY}}>What You Get</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Daily Revenue Share', 'You receive a percentage of your store\'s daily gross sales, deposited directly into your business bank account every day.'],
                    ['Established Locations', 'Step into a store with existing customer traffic, an established brand, and proven demand. No building from scratch.'],
                    ['Growth Bonuses', 'The harder you grow your store, the higher your bonus percentage. Our tiered accelerator rewards aggressive growth disproportionately.'],
                    ['Full Autonomy', 'You run your business your way. Hire your own staff, manage your own schedule, control your own inventory and menu.'],
                    ['Technology Platform', 'Real-time dashboard showing your revenue, payouts, expenses, and upcoming payments. Full visibility into your business.'],
                    ['No Rent or Overhead', 'No lease, no build-out costs, no utility bills. You focus on making great sushi and growing your customer base.'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-lg p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
                      <div className="text-sm font-bold mb-1" style={{color: NAVY}}>{title}</div>
                      <div className="text-xs leading-relaxed" style={{color:'#6b7a99'}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What We're Looking For */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-4" style={{color: NAVY}}>What We&apos;re Looking For</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {[
                    ['Experienced sushi chef', 'Minimum 3 years preparing sushi in a professional setting'],
                    ['Entrepreneurial mindset', 'You think like a business owner, not an employee'],
                    ['Hands-on operator', 'You\'ll work 50+ hours per week in your store, leading from the front'],
                    ['Business-ready', 'Willing to set up your own LLC, handle payroll, and manage expenses'],
                    ['Growth-oriented', 'You see a revenue target as a starting point, not a ceiling'],
                    ['Customer-focused', 'Quality and consistency drive everything you do'],
                  ].map(([title, desc]) => (
                    <div key={title} className="py-2" style={{borderBottom:'1px solid #eef1f6'}}>
                      <div className="text-sm font-semibold" style={{color: NAVY}}>{title}</div>
                      <div className="text-xs" style={{color:'#6b7a99'}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How It Works */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-4" style={{color: NAVY}}>How the Economics Work</h2>
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{background: NAVY}}>1</div>
                    <div>
                      <div className="text-sm font-bold" style={{color: NAVY}}>Customers buy sushi at your store</div>
                      <div className="text-xs" style={{color:'#6b7a99'}}>All sales are captured through the POS system. You can see your numbers in real-time.</div>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{background: NAVY}}>2</div>
                    <div>
                      <div className="text-sm font-bold" style={{color: NAVY}}>You receive your revenue share daily</div>
                      <div className="text-xs" style={{color:'#6b7a99'}}>21 days after each sale, your share is deposited directly into your LLC&apos;s bank account via ACH. No invoicing, no waiting for checks.</div>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{background: NAVY}}>3</div>
                    <div>
                      <div className="text-sm font-bold" style={{color: NAVY}}>You pay your own expenses from your share</div>
                      <div className="text-xs" style={{color:'#6b7a99'}}>Ingredients, supplies, and any staff you hire are your responsibility. You control your costs, which means you control your profit.</div>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{background:'#1a6b3a', color:'white'}}>$</div>
                    <div>
                      <div className="text-sm font-bold" style={{color:'#1a6b3a'}}>What&apos;s left is yours</div>
                      <div className="text-xs" style={{color:'#6b7a99'}}>Revenue share minus COGS minus payroll = your take-home income. Top operators earn $150k+.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div className="rounded-xl p-6 mb-6" style={{background:'white', border:'1px solid #dde4ed'}}>
                <h2 className="text-lg font-bold mb-3" style={{color: NAVY}}>Available Locations</h2>
                <p className="text-xs mb-4" style={{color:'#6b7a99'}}>We have openings across our Connecticut and New York locations. Store hours: Mon&ndash;Sat 10am&ndash;7pm, Sun 10am&ndash;6pm.</p>
                <div className="grid grid-cols-3 gap-3">
                  {STORES.map(s => (
                    <div key={s} className="rounded-lg p-4 text-center" style={{background:'#f7f9fc', border:'1px solid #dde4ed'}}>
                      <div className="text-sm font-bold" style={{color: NAVY}}>{STORE_LABELS[s]}</div>
                      <div className="text-xs mt-1" style={{color: GOLD_ACCENT}}>Now Recruiting</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-xl p-8 text-center" style={{background: NAVY, border:`2px solid ${GOLD_ACCENT}`}}>
                <div className="text-2xl font-bold text-white mb-2">Ready to run your own sushi business?</div>
                <div className="text-sm mb-4" style={{color:'rgba(255,255,255,0.6)'}}>
                  Check out the Income Calculator tab to see what you could earn, or reach out to start the conversation.
                </div>
                <div className="inline-flex gap-3">
                  <button onClick={() => setTab('income')}
                    className="px-6 py-3 rounded-lg text-sm font-bold"
                    style={{background: GOLD_ACCENT, color: NAVY}}>
                    Calculate Your Income
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INCOME CALCULATOR */}
          {tab === 'income' && (
            <IncomeCalculator />
          )}

        </main>
      </div>

      <footer className="px-6 py-4 flex items-center justify-between text-xs"
        style={{background: NAVY, color:'rgba(255,255,255,0.3)'}}>
        <span>&copy; 2026 Fjord Fish Market &middot; Sushi Counter Owner Portal</span>
        <span>{STORES.length} stores &middot; POS + Ottimate + ADP</span>
      </footer>
    </div>
  );
}
