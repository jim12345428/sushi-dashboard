import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const TARGET_STORE = 'cos cob';
const TARGET_DEPT  = 'sushi';

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
  console.log('CWD:', process.cwd());
  console.log('Looking in:', payrollDir);
  console.log('Exists:', fs.existsSync(payrollDir));

  if (!fs.existsSync(payrollDir)) {
    return NextResponse.json({ weeks: [] });
  }

  const files = fs.readdirSync(payrollDir)
    .filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
    .sort();

  console.log('Files found:', files);

  const weeks = [];

  for (const filename of files) {
    try {
      const filepath = path.join(process.cwd(), 'data', 'payroll', filename);
      console.log('Reading:', filepath);
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

      console.log('Indexes:', idx);

      if (idx.store < 0 || idx.expense < 0) {
        console.warn(`${filename}: missing expected columns`);
        continue;
      }

      let total = 0;
      let payDate = null;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const store = normalizeStore(row[idx.store]?.toString());
        const dept  = row[idx.dept]?.toString().trim().toLowerCase();
        if (store !== TARGET_STORE) continue;
        if (dept !== TARGET_DEPT) continue;

        const exp = parseFloat(row[idx.expense]);
        if (!isNaN(exp)) total += exp;

        if (!payDate) {
          payDate = parseExcelDate(row[idx.payDate]);
        }
      }

      console.log('Total:', total, 'PayDate:', payDate);

      if (total > 0 && payDate) {
        const pd = new Date(payDate);
        const dayOfWeek = pd.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(pd);
        weekStart.setDate(pd.getDate() + diffToMon);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        weeks.push({
          filename,
          payDate:              pd.toISOString().split('T')[0],
          weekStart:            weekStart.toISOString().split('T')[0],
          weekEnd:              weekEnd.toISOString().split('T')[0],
          totalEmployerExpense: Math.round(total * 100) / 100,
        });
      }
    } catch(e) {
      console.error('Error reading payroll file ' + filename + ':', e.message);
    }
  }

  return NextResponse.json({ weeks });
}