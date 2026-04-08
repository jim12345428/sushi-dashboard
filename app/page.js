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
  { upTo: 400000, pct: 0.52 },
  { upTo: 700000, pct: 0.40 },
  { upTo: Infinity, pct: 0.25 },
];
const GROWTH_THRESHOLD = 0.05;
const GROWTH_ACCEL_PCT = 0.15;

function calcTieredShare(annualizedRevenue, dailyGross) {
  // Calculate effective blended rate from tiers applied to annualized revenue
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

function calcGrowthBonus(dailyGross, priorYearDayGross) {
  if (!priorYearDayGross || priorYearDayGross <= 0) return 0;
  const growthRate = (dailyGross - priorYearDayGross) / priorYearDayGross;
  if (growthRate <= GROWTH_THRESHOLD) return 0;
  const thresholdValue = priorYearDayGross * (1 + GROWTH_THRESHOLD);
  return (dailyGross - thresholdValue) * GROWTH_ACCEL_PCT;
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
function buildLedger(sales, payrollWeeks, invoices, cogsRate) {
  const posMap = {};
  sales.forEach(s => posMap[s.date] = s.gross);

  // Build a map of same-day-last-year for growth accelerator
  const priorYearMap = {};
  sales.forEach(s => {
    const d = new Date(s.date);
    const priorDate = new Date(d);
    priorDate.setFullYear(priorDate.getFullYear() + 1);
    const key = priorDate.toISOString().split('T')[0];
    priorYearMap[key] = s.gross;
  });

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

  // COGS from invoices
  const cogsByDay = {};
  for (const inv of invoices) {
    if (!inv.windowStart || !inv.windowEnd) continue;
    const days = [];
    let cur = new Date(inv.windowStart);
    const end = new Date(inv.windowEnd);
    while (cur <= end) {
      const d = cur.toISOString().split('T')[0];
      if (posMap[d]) days.push(d);
      cur.setDate(cur.getDate() + 1);
    }
    const windowGross = days.reduce((s, d) => s + posMap[d], 0);
    if (windowGross > 0) {
      days.forEach(d => {
        cogsByDay[d] = (cogsByDay[d] || 0) + inv.totalAmount * (posMap[d] / windowGross);
      });
    }
  }

  // Labor from payroll
  const laborByDay = {};
  for (const week of payrollWeeks) {
    const days = [];
    let cur = new Date(week.weekStart);
    const end = new Date(week.weekEnd);
    while (cur <= end) {
      const d = cur.toISOString().split('T')[0];
      if (posMap[d]) days.push(d);
      cur.setDate(cur.getDate() + 1);
    }
    const weekGross = days.reduce((s, d) => s + posMap[d], 0);
    if (weekGross > 0) {
      days.forEach(d => {
        laborByDay[d] = (laborByDay[d] || 0) + week.totalEmployerExpense * (posMap[d] / weekGross);
      });
    }
  }

  // Estimate COGS rate and labor avg from confirmed data
  const confirmedDates = sortedDates.filter(d => cogsByDay[d] && laborByDay[d]);
  const rollWindow = confirmedDates.slice(-21);
  const rollRev   = rollWindow.reduce((s, d) => s + posMap[d], 0);
  const rollCogs  = rollWindow.reduce((s, d) => s + cogsByDay[d], 0);
  const rollLabor = rollWindow.reduce((s, d) => s + laborByDay[d], 0);
  const estCogsRate = rollRev > 0 ? rollCogs / rollRev : cogsRate;
  const estLaborAvg = rollWindow.length > 0 ? rollLabor / rollWindow.length : 0;

  return sortedDates.map(d => {
    const g = posMap[d];
    const ed = new Date(d);
    const pd = addDays(ed, LAG);
    const annualized = annualizedMap[d] || 0;
    const priorYearGross = priorYearMap[d] || null;

    const baseShare = calcTieredShare(annualized, g);
    const growthBonus = calcGrowthBonus(g, priorYearGross);
    const rev = baseShare + growthBonus;

    const act_cogs  = cogsByDay[d]  ?? null;
    const act_labor = laborByDay[d] ?? null;
    const cogs  = act_cogs  !== null ? act_cogs  : g * cogsRate;
    const labor = act_labor !== null ? act_labor : estLaborAvg;
    const net   = rev - cogs - labor;

    const cogsAct = act_cogs !== null, laborAct = act_labor !== null;
    const recon = cogsAct && laborAct ? 'confirmed' : cogsAct || laborAct ? 'partial' : 'estimated';
    const isPaid = pd < TODAY;

    const effectiveRate = g > 0 ? rev / g : 0;

    return {
      d, ed, pd, g, rev, baseShare, growthBonus, cogs, labor, net,
      cogsAct, laborAct, recon,
      payStatus: isPaid ? 'paid' : recon,
      isPaid,
      dow: DOW[dowIdx(ed)],
      annualized,
      effectiveRate,
      priorYearGross,
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

function SourceDot({ isActual, isPartial }) {
  const color = isActual ? 'bg-emerald-500' : isPartial ? 'bg-violet-400' : 'bg-amber-400';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${color}`} />;
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
    brooklyn: 0, 'cos cob': 30, darien: 25, larchmont: 0, 'new canaan': 25, westport: 20,
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

      // Growth accelerator
      let accelBonus = 0;
      if (growthPct / 100 > GROWTH_THRESHOLD) {
        const thresholdRev = annualized * (1 + GROWTH_THRESHOLD);
        accelBonus = (grownAnnual - thresholdRev) * GROWTH_ACCEL_PCT;
      }

      const totalShare = tieredTotal + accelBonus;
      const effRate = grownAnnual > 0 ? totalShare / grownAnnual : 0;
      const cogs = grownAnnual * (cogsRate / 100);
      const payroll = (staffHrs[store] || 0) * staffRate * 52 * BURDEN;
      const takeHome = totalShare - cogs - payroll;
      const dailyPayout = days > 0 ? takeHome / 365 : 0;

      return {
        store, annualized, grownAnnual, tieredTotal, accelBonus, totalShare,
        effRate, cogs, payroll, takeHome, dailyPayout,
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

      {/* Results Table */}
      <div className="rounded-xl overflow-hidden" style={{border:'1px solid #dde4ed', background:'white'}}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Store</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Annualized Rev</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>w/ Growth</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Base Share</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Growth Bonus</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Total Share</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Eff. Rate</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#8a5c1a'}}>COGS</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#3a4a8a'}}>Payroll</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edfaf2'}}>Take-Home</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edfaf2'}}>Daily Payout</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const thColor = r.takeHome >= 70000 ? '#1a6b3a' : '#b5282a';
              return (
                <tr key={r.store} style={{borderBottom:'1px solid #eef1f6'}} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-semibold" style={{color: NAVY}}>{STORE_LABELS[r.store]}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#445566'}}>{fmt(r.annualized)}</td>
                  <td className="px-4 py-3 text-right font-medium" style={{color:'#445566'}}>{fmt(r.grownAnnual)}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmt(r.tieredTotal)}</td>
                  <td className="px-4 py-3 text-right" style={{color: r.accelBonus > 0 ? '#1a6b3a' : '#8899aa', background:'rgba(237,246,251,0.4)'}}>
                    {r.accelBonus > 0 ? '+' + fmt(r.accelBonus) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmt(r.totalShare)}</td>
                  <td className="px-4 py-3 text-right" style={{color:'#6b7a99'}}>{pct(r.effRate)}</td>
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
              <td className="px-4 py-3 text-right font-bold" style={{color:'#445566'}}>{fmt(results.reduce((s,r) => s+r.annualized, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#445566'}}>{fmt(results.reduce((s,r) => s+r.grownAnnual, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(results.reduce((s,r) => s+r.tieredTotal, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b3a', background:'rgba(237,246,251,0.6)'}}>{fmt(results.reduce((s,r) => s+r.accelBonus, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(results.reduce((s,r) => s+r.totalShare, 0))}</td>
              <td className="px-4 py-3 text-right" style={{color:'#6b7a99'}}>-</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#8a5c1a'}}>{fmt(results.reduce((s,r) => s+r.cogs, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#3a4a8a'}}>{fmt(results.reduce((s,r) => s+r.payroll, 0))}</td>
              <td className="px-4 py-3 text-right font-bold text-sm" style={{color:'#1a6b3a', background:'rgba(237,250,242,0.6)'}}>{fmt(results.reduce((s,r) => s+r.takeHome, 0))}</td>
              <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b3a', background:'rgba(237,250,242,0.6)'}}>{fmt(results.reduce((s,r) => s+r.dailyPayout, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Compensation Structure Reference */}
      <div className="mt-6 rounded-xl p-5" style={{background:'white', border:'1px solid #dde4ed'}}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{color:'#6b7a99'}}>Compensation Structure</div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium mb-2" style={{color: NAVY}}>Base Revenue Share (Tiered)</div>
            <div className="space-y-1">
              {BASE_TIERS.map((t, i) => (
                <div key={i} className="flex justify-between text-xs py-1" style={{borderBottom:'1px solid #eef1f6'}}>
                  <span style={{color:'#8899aa'}}>
                    {i === 0 ? 'First' : 'Next'} {t.upTo === Infinity ? '$700k+' : '$' + (t.upTo/1000) + 'k'}
                  </span>
                  <strong style={{color: NAVY}}>{(t.pct * 100)}%</strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium mb-2" style={{color: NAVY}}>YoY Growth Accelerator</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs py-1" style={{borderBottom:'1px solid #eef1f6'}}>
                <span style={{color:'#8899aa'}}>Threshold</span>
                <strong style={{color: NAVY}}>{(GROWTH_THRESHOLD * 100)}% YoY</strong>
              </div>
              <div className="flex justify-between text-xs py-1" style={{borderBottom:'1px solid #eef1f6'}}>
                <span style={{color:'#8899aa'}}>Bonus on incremental revenue</span>
                <strong style={{color: NAVY}}>{(GROWTH_ACCEL_PCT * 100)}%</strong>
              </div>
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

/* ── MAIN DASHBOARD ── */
export default function Dashboard() {
  const [tab, setTab]             = useState('upcoming');
  const [store, setStore]         = useState('cos cob');
  const [allSales, setAllSales]   = useState({});
  const [allPayroll, setAllPayroll] = useState({});
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [openHistory, setOpenHistory] = useState(null);
  const [cogsRate, setCogsRate]   = useState(0.20);

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
    const payroll = allPayroll[store] || [];
    const storeInvoices = invoices.filter(inv => inv.store === store);
    return buildLedger(sales, payroll, storeInvoices, cogsRate);
  }, [allSales, allPayroll, invoices, store, cogsRate]);

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
  const s7   = unpaid.filter(r => dOut(r) <= 7).reduce((s,r) => s + r.net, 0);
  const s14  = unpaid.filter(r => dOut(r) <= 14).reduce((s,r) => s + r.net, 0);
  const s21  = unpaid.reduce((s,r) => s + r.net, 0);

  // Current effective rate for sidebar
  const recentDays = ledger.slice(-30);
  const avgEffRate = recentDays.length > 0
    ? recentDays.reduce((s,r) => s + r.effectiveRate, 0) / recentDays.length : 0;

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
        {[['upcoming','Upcoming Payments'],['ledger','Daily Ledger'],['history','Payment History'],['invoices','Invoices'],['modeler','Scenario Modeler']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-xs font-medium tracking-widest uppercase border-b-2 transition-all ${tab === id ? 'text-white border-amber-400' : 'border-transparent'}`}
            style={{color: tab === id ? 'white' : 'rgba(255,255,255,0.35)'}}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex" style={{minHeight:'calc(100vh - 116px)'}}>

        {/* SIDEBAR */}
        {tab !== 'modeler' && (
          <aside className="w-56 flex-shrink-0 border-r" style={{background:'white', borderColor:'#dde4ed'}}>
            <div className="p-4">
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b7a99'}}>
                {STORE_LABELS[store]} Payments
              </div>
              <div className="space-y-2 mb-6">
                {[
                  { label:'Next Payment', val: nextRow ? fmt(nextRow.net) : '-', sub: nextRow ? 'Arriving '+fmtDate(nextRow.pd) : '-', accent: GOLD_ACCENT, bg:'#fdf8ec', border:'#e8d38a' },
                  { label:'Next 21 Days', val: fmt(s21), sub: unpaid.length+' payments', accent:'#1a6b8a', bg:'#edf6fb', border:'#b3d9eb' },
                  { label:'Received To Date', val: fmt(paidRows.reduce((s,r)=>s+r.net,0)), sub: paidRows.length+' deposits', accent:'#1a6b3a', bg:'#edfaf2', border:'#9dd4b5' },
                ].map(k => (
                  <div key={k.label} className="rounded-lg p-3" style={{background:k.bg, border:`1px solid ${k.border}`}}>
                    <div className="text-xs uppercase tracking-wide mb-1" style={{color:'#8899aa'}}>{k.label}</div>
                    <div className="text-lg font-bold" style={{color:k.accent}}>{k.val}</div>
                    <div className="text-xs mt-0.5" style={{color:'#8899aa'}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#6b7a99'}}>Sources</div>
              <div className="space-y-1.5 mb-6">
                {[
                  {dot:'bg-emerald-500', label:'Confirmed actual'},
                  {dot:'bg-violet-400',  label:'Partially confirmed'},
                  {dot:'bg-amber-400',   label:'Estimated'},
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2 text-xs" style={{color:'#8899aa'}}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    {s.label}
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#6b7a99'}}>Comp Structure</div>
              {[
                ['Base tiers', '52/40/25%'],
                ['Growth bonus', '15% > 5% YoY'],
                ['Eff. rate (30d)', pct(avgEffRate)],
                ['Payment lag', '21 days'],
                ['COGS estimate', pct(cogsRate)],
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
                Amounts based on tiered revenue share (52/40/25%). Growth accelerator applies when YoY growth exceeds 5%.
              </div>
              <div className="space-y-2">
                {unpaid.map((r, i) => {
                  const d = dOut(r);
                  const nc = r.net >= 0 ? '#1a6b3a' : '#b5282a';
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
                        <span>Share <strong style={{color:'#1a6b8a'}}>{fmt(r.rev)}</strong>
                          {r.growthBonus > 0 && <span style={{color:'#1a6b3a'}}> (+{fmt(r.growthBonus)})</span>}
                        </span>
                        <span style={{color:'#ccd4e0'}}>&minus;</span>
                        <span>COGS <strong style={{color:'#8a5c1a'}}>{fmt(r.cogs)}</strong>{!r.cogsAct && <SourceDot />}</span>
                        <span style={{color:'#ccd4e0'}}>&minus;</span>
                        <span>Labor <strong style={{color:'#3a4a8a'}}>{fmt(r.labor)}</strong>{!r.laborAct && <SourceDot />}</span>
                      </div>
                      <div className="text-xl font-bold w-20 text-right flex-shrink-0" style={{color:nc}}>{fmt(r.net)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEDGER */}
          {tab === 'ledger' && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Daily Ledger &mdash; {STORE_LABELS[store]}</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>{ledger.length} days &middot; tiered share &middot; costs &middot; net &middot; pay date</p>
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #dde4ed', background:'white'}}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[960px]">
                    <thead>
                      <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
                        <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Day</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#edf6fb', borderLeft:'2px solid #b3d9eb'}}>POS Revenue</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Base Share</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edf6fb'}}>Growth</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Eff %</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', borderLeft:'2px solid #e8e0d0'}}>COGS</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Labor</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edfaf2', borderLeft:'2px solid #9dd4b5'}}>Net</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#edfaf2'}}>Paid On</th>
                        <th className="text-center px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#edfaf2'}}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ledger].reverse().map(r => {
                        const nc = r.net >= 0 ? '#1a6b3a' : '#b5282a';
                        return (
                          <tr key={r.d} className="hover:bg-blue-50/30 transition-colors"
                            style={{borderBottom:'1px solid #eef1f6', opacity: r.isPaid ? 0.55 : 1}}>
                            <td className="px-4 py-2.5 font-semibold whitespace-nowrap" style={{color: NAVY}}>
                              {fmtDate(r.ed)}<span className="ml-2 font-normal" style={{color:'#8899aa'}}>{r.dow}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right" style={{color:'#445566', background:'rgba(237,246,251,0.4)', borderLeft:'2px solid #e0eef7'}}>{fmtD(r.g)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmtD(r.baseShare)}</td>
                            <td className="px-4 py-2.5 text-right" style={{color: r.growthBonus > 0 ? '#1a6b3a' : '#ccd4e0', background:'rgba(237,246,251,0.4)'}}>
                              {r.growthBonus > 0 ? '+' + fmtD(r.growthBonus) : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-right" style={{color:'#8899aa'}}>{pct(r.effectiveRate)}</td>
                            <td className="px-4 py-2.5 text-right" style={{borderLeft:'2px solid #f0ece0'}}>
                              <span style={{color:'#8a5c1a'}}>{fmtD(r.cogs)}</span><SourceDot isActual={r.cogsAct} />
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span style={{color:'#3a4a8a'}}>{fmtD(r.labor)}</span><SourceDot isActual={r.laborAct} isPartial={r.recon==='partial'} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-base" style={{color:nc, background:'rgba(237,250,242,0.4)', borderLeft:'2px solid #c8edda'}}>{fmt(r.net)}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{color: r.isPaid ? '#1a6b3a' : NAVY, background:'rgba(237,250,242,0.4)', fontWeight: r.isPaid ? 600 : 400}}>{fmtDate(r.pd)}</td>
                            <td className="px-4 py-2.5 text-center" style={{background:'rgba(237,250,242,0.4)'}}><Badge status={r.payStatus} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{background:'#f0f4f8', borderTop:`2px solid ${NAVY}`}}>
                        <td className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{color:'#6b7a99'}}>Total</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#445566', background:'rgba(237,246,251,0.6)', borderLeft:'2px solid #b3d9eb'}}>{fmt(ledger.reduce((s,r)=>s+r.g,0))}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(ledger.reduce((s,r)=>s+r.baseShare,0))}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b3a', background:'rgba(237,246,251,0.6)'}}>{fmt(ledger.reduce((s,r)=>s+r.growthBonus,0))}</td>
                        <td className="px-4 py-3 text-right" style={{color:'#8899aa'}}>{pct(avgEffRate)}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#8a5c1a', borderLeft:'2px solid #e8e0d0'}}>{fmt(ledger.reduce((s,r)=>s+r.cogs,0))}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#3a4a8a'}}>{fmt(ledger.reduce((s,r)=>s+r.labor,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-base" style={{color:'#1a6b3a', background:'rgba(237,250,242,0.6)', borderLeft:'2px solid #9dd4b5'}}>{fmt(ledger.reduce((s,r)=>s+r.net,0))}</td>
                        <td colSpan={2} style={{background:'rgba(237,250,242,0.6)'}} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
                  ['POS Revenue',      fmt(paidRows.reduce((s,r)=>s+r.g,0)),   '#445566', '#f7f9fc', '#dde4ed'],
                  ['Your Share',       fmt(paidRows.reduce((s,r)=>s+r.rev,0)), '#1a6b8a', '#edf6fb', '#b3d9eb'],
                  ['Total Received',   fmt(paidRows.reduce((s,r)=>s+r.net,0)), '#1a6b3a', '#edfaf2', '#9dd4b5'],
                  ['Payments Made',    paidRows.length,                         NAVY,      '#f0f4f8', '#c8d4e4'],
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
                  const nc = r.net >= 0 ? '#1a6b3a' : '#b5282a';
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
                        <div className="text-xs w-32 flex-shrink-0">share <strong style={{color:'#1a6b8a'}}>{fmt(r.rev)}</strong></div>
                        <div className="flex-1 text-xl font-bold" style={{color:nc}}>{fmt(r.net)}</div>
                        <Badge status="paid" />
                        <span className="ml-2 text-sm" style={{color:'#8899aa'}}>{isOpen ? '\u2191' : '\u203A'}</span>
                      </div>
                      {isOpen && (
                        <div style={{background:'#f7f9fc', borderTop:'1px solid #dde4ed'}} className="px-4 py-4">
                          <div className="grid grid-cols-6 gap-3">
                            {[
                              ['POS Revenue',  fmtD(r.g),          '#445566',  'POS'],
                              ['Base Share',   fmtD(r.baseShare),  '#1a6b8a',  pct(r.effectiveRate) + ' eff.'],
                              ['Growth Bonus', r.growthBonus > 0 ? '+' + fmtD(r.growthBonus) : '-', r.growthBonus > 0 ? '#1a6b3a' : '#8899aa', 'YoY accel.'],
                              ['COGS',         fmtD(r.cogs),       '#8a5c1a',  r.cogsAct ? 'Ottimate' : 'Estimated'],
                              ['Labor',        fmtD(r.labor),      '#3a4a8a',  r.laborAct ? 'ADP' : 'Estimated'],
                              ['Net Paid',     fmt(r.net),         r.net>=0?'#1a6b3a':'#b5282a', 'ACH confirmed'],
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

          {/* INVOICES */}
          {tab === 'invoices' && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Invoices &mdash; {STORE_LABELS[store]}</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Supplier invoices for {STORE_LABELS[store]}</p>
              </div>
              <InvoicesTab invoices={invoices} store={store} />
            </div>
          )}

          {/* SCENARIO MODELER */}
          {tab === 'modeler' && (
            <ScenarioModeler storeSales={allSales} />
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
