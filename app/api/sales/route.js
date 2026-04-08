import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET() {
  const filepath = path.join(process.cwd(), 'data', 'sales', 'sales.xlsx');

  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ stores: {} });
  }

  try {
    const buffer = fs.readFileSync(filepath);
    const wb   = XLSX.read(buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const headerIdx = rows.findIndex(r =>
      r.some(c => c?.toString().toLowerCase() === 'date')
    );
    if (headerIdx < 0) return NextResponse.json({ stores: {} });

    const headers = rows[headerIdx].map(h => h?.toString().trim().toLowerCase() || '');

    // Find all store columns (skip 'date' and 'grand total')
    const storeCols = [];
    for (let c = 1; c < headers.length; c++) {
      if (headers[c] && headers[c] !== 'grand total') {
        storeCols.push({ idx: c, name: headers[c] });
      }
    }

    const stores = {};
    for (const sc of storeCols) {
      stores[sc.name] = [];
    }

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const dateVal = row[0];
      if (!dateVal || dateVal.toString().toLowerCase().includes('grand total')) continue;

      let date;
      if (typeof dateVal === 'number') {
        date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      } else {
        date = new Date(dateVal);
      }
      if (isNaN(date.getTime())) continue;

      const dateStr = date.toISOString().split('T')[0];

      for (const sc of storeCols) {
        const gross = parseFloat(row[sc.idx]);
        if (isNaN(gross) || gross <= 0) continue;
        stores[sc.name].push({
          date: dateStr,
          gross: Math.round(gross * 100) / 100,
        });
      }
    }

    return NextResponse.json({ stores });
  } catch(e) {
    console.error('Error reading sales file:', e.message);
    return NextResponse.json({ stores: {} });
  }
}
