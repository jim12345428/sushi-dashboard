import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const TARGET_DEPT = 'sushi';

function normalizeStore(name) {
  return name?.toString().toLowerCase()
    .replace('location','').replace(/-/g,' ').trim() || '';
}

function parseExcelDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'number') return new Date(Math.round((d - 25569) * 86400 * 1000));
  return new Date(d);
}

export async function GET() {
  const payrollDir = path.join(process.cwd(), 'data', 'payroll');

  if (!fs.existsSync(payrollDir)) {
    return NextResponse.json({ weeks: {} });
  }

  const files = fs.readdirSync(payrollDir)
    .filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
    .sort();

  const storeWeeks = {};

  for (const filename of files) {
    try {
      const filepath = path.join(process.cwd(), 'data', 'payroll', filename);
      const fileBuffer = fs.readFileSync(filepath);
      const wb = XLSX.read(fileBuffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const headers = rows[0].map(h => h?.toString().trim());
      const idx = {
        store:   headers.indexOf('Store'),
        dept:    headers.indexOf('Department'),
        payDate: headers.indexOf('Pay Date'),
        expense: headers.indexOf('Total Employer Expense'),
      };

      if (idx.store < 0 || idx.expense < 0) continue;

      const byStoreDate = {};
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const store = normalizeStore(row[idx.store]?.toString());
        const dept  = row[idx.dept]?.toString().trim().toLowerCase();
        if (dept !== TARGET_DEPT) continue;

        const exp = parseFloat(row[idx.expense]);
        if (isNaN(exp)) continue;

        const payDate = row[idx.payDate] ? parseExcelDate(row[idx.payDate]) : null;
        if (!payDate || isNaN(payDate.getTime())) continue;

        const key = store + '|' + payDate.toISOString();
        if (!byStoreDate[key]) byStoreDate[key] = { store, payDate, total: 0 };
        byStoreDate[key].total += exp;
      }

      for (const entry of Object.values(byStoreDate)) {
        const pd = new Date(entry.payDate);
        const dayOfWeek = pd.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(pd);
        weekStart.setDate(pd.getDate() + diffToMon);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        if (!storeWeeks[entry.store]) storeWeeks[entry.store] = [];
        storeWeeks[entry.store].push({
          filename,
          payDate:              pd.toISOString().split('T')[0],
          weekStart:            weekStart.toISOString().split('T')[0],
          weekEnd:              weekEnd.toISOString().split('T')[0],
          totalEmployerExpense: Math.round(entry.total * 100) / 100,
        });
      }
    } catch(e) {
      console.error('Error reading payroll file ' + filename + ':', e.message);
    }
  }

  return NextResponse.json({ weeks: storeWeeks });
}
