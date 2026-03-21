'use client';
import { useState, useEffect } from 'react';

const SPLIT = 0.525;
const OTHER_R = 0.03;
const LAG = 21;
const TODAY = new Date();
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const fmt = v => '$' + Math.round(v).toLocaleString('en-US');
const fmtD = v => '$' + v.toFixed(2);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateFull = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateStr = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dowIdx = d => (d.getDay() + 6) % 7;

const NAVY = '#0f1f3d';
const NAVY_LIGHT = '#1a2f52';
const GOLD_ACCENT = '#c9a84c';

function buildLedger(sales, payrollWeeks, invoices) {
  const posMap = {};
  sales.forEach(s => posMap[s.date] = s.gross);

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

  const sortedDates = Object.keys(posMap).sort();
  const confirmedDates = sortedDates.filter(d => cogsByDay[d] && laborByDay[d]);
  const rollWindow = confirmedDates.slice(-21);
  const rollRev   = rollWindow.reduce((s, d) => s + posMap[d] * SPLIT, 0);
  const rollCogs  = rollWindow.reduce((s, d) => s + cogsByDay[d], 0);
  const rollLabor = rollWindow.reduce((s, d) => s + laborByDay[d], 0);
  const COGS_RATE = rollRev > 0 ? rollCogs / rollRev : 0.168;
  const LABOR_AVG = rollWindow.length > 0 ? rollLabor / rollWindow.length : 308;

  return sortedDates.map(d => {
    const g = posMap[d];
    const ed = new Date(d);
    const pd = addDays(ed, LAG);
    const rev = g * SPLIT, other = rev * OTHER_R;
    const act_cogs  = cogsByDay[d]  ?? null;
    const act_labor = laborByDay[d] ?? null;
    const cogs  = act_cogs  !== null ? act_cogs  : rev * COGS_RATE;
    const labor = act_labor !== null ? act_labor : LABOR_AVG;
    const net   = rev - cogs - labor - other;
    const cogsAct = act_cogs !== null, laborAct = act_labor !== null;
    const recon = cogsAct && laborAct ? 'confirmed' : cogsAct || laborAct ? 'partial' : 'estimated';
    const isPaid = pd < TODAY;
    return { d, ed, pd, g, rev, cogs, labor, other, net, cogsAct, laborAct, recon, payStatus: isPaid ? 'paid' : recon, isPaid, dow: DOW[dowIdx(ed)] };
  });
}

function Badge({ status }) {
  const styles = {
    paid:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
    confirmed: 'bg-sky-50 text-sky-700 border border-sky-200',
    partial:   'bg-violet-50 text-violet-700 border border-violet-200',
    estimated: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  const labels = { paid:'✓ Paid', confirmed:'Confirmed', partial:'Updating', estimated:'Estimated' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${styles[status]}`}>{labels[status]}</span>;
}

function SourceDot({ isActual, isPartial }) {
  const color = isActual ? 'bg-emerald-500' : isPartial ? 'bg-violet-400' : 'bg-amber-400';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${color}`} />;
}

function InvoicesTab() {
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(({ invoices }) => { setInvoices(invoices); setLoading(false); });
  }, []);

  if (loading) return <div className="text-center py-12" style={{color:'#8899aa'}}>Loading invoices...</div>;

  if (invoices.length === 0) return (
    <div className="text-center py-12 rounded-xl" style={{background:'white', border:'1px solid #dde4ed', color:'#8899aa'}}>
      No invoices found. Drop PDF invoices into the <code className="bg-gray-100 px-1 rounded">data/invoices/</code> folder.
    </div>
  );

  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-72 space-y-2">
        {invoices.map(inv => (
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
              <div>Window: <strong style={{color:'#445566'}}>{fmtDateStr(inv.windowStart)} → {fmtDateStr(inv.windowEnd)}</strong></div>
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
                {selected.filename} · {fmtDateStr(selected.deliveryDate)} · ${selected.totalAmount.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/pdf?file=${encodeURIComponent(selected.filename)}`}
                target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{background: NAVY}}>
                Open Full PDF ↗
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
            <div className="text-3xl mb-3">📄</div>
            <div className="text-sm font-medium">Select an invoice to preview</div>
            <div className="text-xs mt-1">Click any invoice on the left</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab]             = useState('upcoming');
  const [ledger, setLedger]       = useState([]);
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
        const { sales }    = await salesRes.json();
        const { weeks }    = await payrollRes.json();
        const { invoices } = await invoicesRes.json();
        setLedger(buildLedger(sales, weeks, invoices));
      } catch(e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
              <div className="text-white text-sm font-semibold tracking-wide">Sushi Counter — Owner Portal</div>
              <div style={{color:'rgba(255,255,255,0.4)'}} className="text-xs tracking-widest uppercase">Cos Cob</div>
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
            {label:'Ottimate', status:'Invoices loaded', live:true},
            {label:'ADP', status:'Payroll loaded', live:true},
          ].map((f,i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${f.live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span style={{color:'rgba(255,255,255,0.4)'}}>{f.label}</span>
              <span style={{color:'rgba(255,255,255,0.75)'}}>{f.status}</span>
            </div>
          ))}
          <div className="ml-auto text-xs" style={{color:'rgba(255,255,255,0.22)'}}>
            {ledger.length} days · {paidRows.length} paid · {unpaid.length} upcoming
          </div>
        </div>
      </header>

      {/* TABS */}
      <div style={{background: NAVY_LIGHT, borderBottom:'1px solid rgba(255,255,255,0.08)'}} className="px-6 flex">
        {[['upcoming','Upcoming Payments'],['ledger','Daily Ledger'],['history','Payment History'],['invoices','Invoices']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-xs font-medium tracking-widest uppercase border-b-2 transition-all ${tab === id ? 'text-white border-amber-400' : 'border-transparent'}`}
            style={{color: tab === id ? 'white' : 'rgba(255,255,255,0.35)'}}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex" style={{minHeight:'calc(100vh - 116px)'}}>

        {/* SIDEBAR */}
        <aside className="w-56 flex-shrink-0 border-r" style={{background:'white', borderColor:'#dde4ed'}}>
          <div className="p-4">
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'#6b7a99'}}>My Payments</div>
            <div className="space-y-2 mb-6">
              {[
                { label:'Next Payment', val: nextRow ? fmt(nextRow.net) : '—', sub: nextRow ? 'Arriving '+fmtDate(nextRow.pd) : '—', accent: GOLD_ACCENT, bg:'#fdf8ec', border:'#e8d38a' },
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

            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'#6b7a99'}}>Terms</div>
            {[['Your split','52.5%'],['Payment lag','21 days'],['ACH initiates','Day 20'],['Arrives','Day 21']].map(([l,v]) => (
              <div key={l} className="flex justify-between text-xs py-1" style={{color:'#8899aa', borderBottom:'1px solid #eef1f6'}}>
                <span>{l}</span><strong style={{color: NAVY}}>{v}</strong>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-6 overflow-y-auto">

          {/* UPCOMING */}
          {tab === 'upcoming' && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Upcoming Payments</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Scheduled ACH deposits · amounts update as actuals come in</p>
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
                Amounts shown are current best estimates. They update automatically when invoices and payroll close.
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
                        <span>Store <strong style={{color:'#445566'}}>{fmt(r.g)}</strong></span>
                        <span style={{color:'#ccd4e0'}}>→</span>
                        <span>Share <strong style={{color:'#1a6b8a'}}>{fmt(r.rev)}</strong></span>
                        <span style={{color:'#ccd4e0'}}>−</span>
                        <span>COGS <strong style={{color:'#8a5c1a'}}>{fmt(r.cogs)}</strong>{!r.cogsAct && <SourceDot />}</span>
                        <span style={{color:'#ccd4e0'}}>−</span>
                        <span>Labor <strong style={{color:'#3a4a8a'}}>{fmt(r.labor)}</strong>{!r.laborAct && <SourceDot />}</span>
                        <span style={{color:'#ccd4e0'}}>−</span>
                        <span>Other <strong style={{color:'#6b7a99'}}>{fmt(r.other)}</strong></span>
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
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Daily Ledger</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>{ledger.length} days · store revenue · your 52.5% share · costs · net · pay date</p>
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid #dde4ed', background:'white'}}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[860px]">
                    <thead>
                      <tr style={{background:'#f7f9fc', borderBottom:'2px solid #dde4ed'}}>
                        <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Day</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', background:'#edf6fb', borderLeft:'2px solid #b3d9eb'}}>Store Revenue</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b8a', background:'#edf6fb'}}>Your Share (52.5%)</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99', borderLeft:'2px solid #e8e0d0'}}>COGS</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Labor</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#6b7a99'}}>Other</th>
                        <th className="text-right px-4 py-3 font-semibold uppercase tracking-wide" style={{color:'#1a6b3a', background:'#edfaf2', borderLeft:'2px solid #9dd4b5'}}>Your Net</th>
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
                            <td className="px-4 py-2.5 text-right font-semibold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.4)'}}>{fmtD(r.rev)}</td>
                            <td className="px-4 py-2.5 text-right" style={{borderLeft:'2px solid #f0ece0'}}>
                              <span style={{color:'#8a5c1a'}}>{fmtD(r.cogs)}</span><SourceDot isActual={r.cogsAct} />
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span style={{color:'#3a4a8a'}}>{fmtD(r.labor)}</span><SourceDot isActual={r.laborAct} isPartial={r.recon==='partial'} />
                            </td>
                            <td className="px-4 py-2.5 text-right" style={{color:'#8899aa'}}>{fmtD(r.other)}</td>
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
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#1a6b8a', background:'rgba(237,246,251,0.6)'}}>{fmt(ledger.reduce((s,r)=>s+r.rev,0))}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#8a5c1a', borderLeft:'2px solid #e8e0d0'}}>{fmt(ledger.reduce((s,r)=>s+r.cogs,0))}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#3a4a8a'}}>{fmt(ledger.reduce((s,r)=>s+r.labor,0))}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{color:'#8899aa'}}>{fmt(ledger.reduce((s,r)=>s+r.other,0))}</td>
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
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Payment History</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Confirmed ACH deposits · tap any row for full breakdown</p>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  ['Total Store Revenue',  fmt(paidRows.reduce((s,r)=>s+r.g,0)),   '#445566', '#f7f9fc', '#dde4ed'],
                  ['Your Revenue (52.5%)', fmt(paidRows.reduce((s,r)=>s+r.rev,0)), '#1a6b8a', '#edf6fb', '#b3d9eb'],
                  ['Total Received',       fmt(paidRows.reduce((s,r)=>s+r.net,0)), '#1a6b3a', '#edfaf2', '#9dd4b5'],
                  ['Payments Made',        paidRows.length,                         NAVY,      '#f0f4f8', '#c8d4e4'],
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
                        <div className="text-xs flex-shrink-0" style={{color:'#8899aa'}}>store <strong style={{color:'#445566'}}>{fmt(r.g)}</strong></div>
                        <div className="text-xs w-32 flex-shrink-0">share <strong style={{color:'#1a6b8a'}}>{fmt(r.rev)}</strong></div>
                        <div className="flex-1 text-xl font-bold" style={{color:nc}}>{fmt(r.net)}</div>
                        <Badge status="paid" />
                        <span className="ml-2 text-sm" style={{color:'#8899aa'}}>{isOpen ? '↑' : '›'}</span>
                      </div>
                      {isOpen && (
                        <div style={{background:'#f7f9fc', borderTop:'1px solid #dde4ed'}} className="px-4 py-4">
                          <div className="grid grid-cols-5 gap-3">
                            {[
                              ['Store Revenue',      fmtD(r.g),     '#445566',  'POS'],
                              ['Your Share (52.5%)', fmtD(r.rev),   '#1a6b8a',  'POS'],
                              ['COGS',               fmtD(r.cogs),  '#8a5c1a',  'Ottimate'],
                              ['Labor',              fmtD(r.labor), '#3a4a8a',  'ADP'],
                              ['Net Paid',           fmt(r.net),    r.net>=0?'#1a6b3a':'#b5282a', 'ACH confirmed'],
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
                          <div className="text-xs mt-3" style={{color:'#8899aa'}}>MT Transfer · {fmtDateFull(r.pd)} · All actuals confirmed</div>
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
                <h1 className="text-xl font-bold" style={{color: NAVY}}>Invoices</h1>
                <p className="text-sm mt-1" style={{color:'#6b7a99'}}>All supplier invoices · drop new PDFs in the invoices folder to add them</p>
              </div>
              <InvoicesTab />
            </div>
          )}

        </main>
      </div>

      <footer className="px-6 py-4 flex items-center justify-between text-xs"
        style={{background: NAVY, color:'rgba(255,255,255,0.3)'}}>
        <span>© 2026 Fjord Fish Market · Sushi Counter Owner Portal</span>
        <span>{ledger.length} days · POS + Ottimate + ADP</span>
      </footer>
    </div>
  );
}