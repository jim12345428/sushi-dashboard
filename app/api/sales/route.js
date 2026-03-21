import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const STORE_NAME = 'cos cob';

export async function GET() {
  const filepath = path.join(process.cwd(), 'data', 'sales', 'sales.xlsx');

  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ sales: [] });
  }

  try {
    const buffer = fs.readFileSync(filepath);
    const wb   = XLSX.read(buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const headerIdx = rows.findIndex(r =>
      r.some(c => c?.toString().toLowerCase() === 'date')
    );
    if (headerIdx < 0) return NextResponse.json({ sales: [] });

    const headers = rows[headerIdx].map(h => h?.toString().trim().toLowerCase() || '');
    const storeCol = headers.findIndex(h => h === STORE_NAME);
    if (storeCol < 0) return NextResponse.json({ sales: [] });

    const sales = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const dateVal = row[0];
      if (!dateVal) continue;

      let date;
      if (typeof dateVal === 'number') {
        date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      } else {
        date = new Date(dateVal);
      }
      if (isNaN(date.getTime())) continue;

      const gross = parseFloat(row[storeCol]);
      if (isNaN(gross) || gross <= 0) continue;

      sales.push({
        date:  date.toISOString().split('T')[0],
        gross: Math.round(gross * 100) / 100,
      });
    }

    return NextResponse.json({ sales });
  } catch(e) {
    console.error('Error reading sales file:', e.message);
    return NextResponse.json({ sales: [] });
  }
}