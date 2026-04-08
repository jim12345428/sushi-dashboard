import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

function loadSalesSummary() {
  const filepath = path.join(process.cwd(), 'data', 'sales', 'sales.xlsx');
  if (!fs.existsSync(filepath)) return 'No sales data available.';

  const buffer = fs.readFileSync(filepath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headerIdx = rows.findIndex(r => r.some(c => c?.toString().toLowerCase() === 'date'));
  if (headerIdx < 0) return 'No sales data available.';

  const headers = rows[headerIdx].map(h => h?.toString().trim() || '');
  const stores = headers.slice(1).filter(h => h.toLowerCase() !== 'grand total');

  const monthly = {};
  const storeAnnual = {};
  stores.forEach(s => { storeAnnual[s] = 0; });

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || r[0].toString().toLowerCase().includes('grand total')) continue;
    const d = new Date(r[0]);
    if (isNaN(d)) continue;
    const monthKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

    stores.forEach((s, idx) => {
      const val = parseFloat(r[idx + 1]) || 0;
      storeAnnual[s] += val;
      const k = s + '|' + monthKey;
      monthly[k] = (monthly[k] || 0) + val;
    });
  }

  const firstDate = rows[headerIdx + 1]?.[0];
  const lastDate = rows[rows.length - 2]?.[0];

  let summary = `Sales data from ${firstDate} to ${lastDate}.\n\n`;
  summary += 'Store totals (full period):\n';
  stores.forEach(s => {
    summary += `  ${s}: $${Math.round(storeAnnual[s]).toLocaleString()}\n`;
  });

  // Monthly breakdown for each store
  const allMonths = [...new Set(Object.keys(monthly).map(k => k.split('|')[1]))].sort();
  summary += '\nMonthly revenue by store:\n';
  summary += 'Month,' + stores.join(',') + '\n';
  allMonths.forEach(m => {
    const vals = stores.map(s => Math.round(monthly[s + '|' + m] || 0));
    summary += m + ',' + vals.join(',') + '\n';
  });

  return summary;
}

const SYSTEM_PROMPT = `You are an AI assistant for the Fjord Fish Market Sushi Counter Owner Portal. You help owner-operators and internal staff understand sales data, compensation, and business performance.

COMPENSATION MODEL:
- 4-tier revenue share based on annualized store revenue:
  - 62% on first $300k
  - 55% on $300k-$500k
  - 49% on $500k-$700k
  - 43% above $700k
- Tiered YoY growth accelerator (calculated monthly vs same month prior year):
  - 10% bonus on 5-15% monthly YoY growth
  - 18% bonus on 15-25% monthly YoY growth
  - 25% bonus on 25%+ monthly YoY growth
- Payouts deposited daily via ACH, 21-day lag from sale date
- Operators run their own LLC, pay their own COGS (~20%) and payroll
- COGS estimate: ~20% of revenue
- Staff: Low-volume stores (Brooklyn, Larchmont) need ~12 hrs/wk coverage for operator's day off. High-volume stores (Westport, New Canaan, Darien, Cos Cob) need 2-person crew = ~74 hrs/wk additional staff at $25/hr + 25% burden.
- Store hours: Mon-Sat 10am-7pm, Sun 10am-6pm (62 hrs/week)

LOCATIONS: Brooklyn, Cos Cob, Darien, Larchmont, New Canaan, Westport

SALES DATA:
{SALES_DATA}

Be concise and specific. Use actual numbers from the data. When discussing compensation, show the math. If asked about a specific store, focus on that store's data.`;

export async function POST(req) {
  const { messages } = await req.json();

  const salesData = loadSalesSummary();
  const systemPrompt = SYSTEM_PROMPT.replace('{SALES_DATA}', salesData);

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system: systemPrompt,
    messages,
  });

  return result.toUIMessageStreamResponse();
}
