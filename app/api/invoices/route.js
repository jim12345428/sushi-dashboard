import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';

const STORE_ALIASES = {
  'cos cob':    ['cos cob', 'coscob', 'cos-cob', 'cos cob location'],
  'greenwich':  ['greenwich', 'greenwich location'],
  'darien':     ['darien', 'darien location'],
  'larchmont':  ['larchmont', 'larchmont location'],
  'new canaan': ['new canaan', 'newcanaan', 'new-canaan', 'new canaan location'],
  'westport':   ['westport', 'westport location'],
};

function matchStore(raw) {
  if (!raw) return null;
  const clean = raw.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(STORE_ALIASES)) {
    if (aliases.some(a => clean === a || clean.includes(a))) return canonical;
  }
  return clean;
}

function parsePdfText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');
  const errors = [];

  // STORE
  const storePatterns = [
    /^Store[:\s]+(.+)/i,
    /^Bill\s*To[:\s]+(.+)/i,
    /^Location[:\s]+(.+)/i,
    /^Ship\s*To[:\s]+(.+)/i,
    /^Customer[:\s]+(.+)/i,
    /^Client[:\s]+(.+)/i,
  ];
  let store = null;
  for (const pattern of storePatterns) {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) { store = matchStore(m[1].trim()); break; }
    }
    if (store) break;
  }
  if (!store) {
    for (const line of lines) {
      const matched = matchStore(line);
      if (Object.keys(STORE_ALIASES).includes(matched)) { store = matched; break; }
    }
  }
  if (!store) errors.push('Could not find store name — looked for: Store, Bill To, Location, Ship To');

  // DELIVERY DATE
  const datePatterns = [
    /Delivery\s*Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /Invoice\s*Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /Order\s*Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /Ship\s*Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  let deliveryDate = null;
  for (const pattern of datePatterns) {
    const m = fullText.match(pattern);
    if (m) {
      const raw = m[1];
      if (raw.includes('/')) {
        const parts = raw.split('/');
        deliveryDate = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
      } else {
        deliveryDate = raw;
      }
      break;
    }
  }
  if (!deliveryDate) errors.push('Could not find delivery date');

  // TOTAL
  const totalPatterns = [
    /Total\s*Due[:\s]+\$?([\d,]+\.?\d*)/i,
    /Amount\s*Due[:\s]+\$?([\d,]+\.?\d*)/i,
    /Balance\s*Due[:\s]+\$?([\d,]+\.?\d*)/i,
    /Grand\s*Total[:\s]+\$?([\d,]+\.?\d*)/i,
    /Invoice\s*Total[:\s]+\$?([\d,]+\.?\d*)/i,
    /Total[:\s]+\$?([\d,]+\.?\d*)/i,
    /Amount[:\s]+\$?([\d,]+\.?\d*)/i,
  ];
  let total = null;
  for (const pattern of totalPatterns) {
    const matches = [...fullText.matchAll(new RegExp(pattern.source, 'gi'))];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const val = parseFloat(lastMatch[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) { total = val; break; }
    }
  }
  if (!total) {
    const allAmounts = [...fullText.matchAll(/\$\s*([\d,]+\.\d{2})/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(v => !isNaN(v) && v > 0);
    if (allAmounts.length > 0) {
      total = Math.max(...allAmounts);
      errors.push(`Total not explicitly labeled — used largest dollar amount ($${total.toFixed(2)}). Please verify.`);
    }
  }
  if (!total) errors.push('Could not find invoice total');

  // VENDOR
  const vendorPatterns = [
    /^Vendor[:\s]+(.+)/i,
    /^From[:\s]+(.+)/i,
    /^Supplier[:\s]+(.+)/i,
    /^Sold\s*By[:\s]+(.+)/i,
  ];
  let vendor = null;
  for (const pattern of vendorPatterns) {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) { vendor = m[1].trim(); break; }
    }
    if (vendor) break;
  }
  if (!vendor && lines.length > 0) vendor = lines[0];

  return { store, deliveryDate, total, vendor, errors };
}

function extractTextFromPdf(filepath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()));
    parser.on('pdfParser_dataError', reject);
    parser.loadPDF(filepath);
  });
}

export async function GET() {
  const invoicesDir = path.join(process.cwd(), 'data', 'invoices');

  if (!fs.existsSync(invoicesDir)) {
    return NextResponse.json({ invoices: [], failed: [] });
  }

  const files = fs.readdirSync(invoicesDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  const invoices = [];
  const failed   = [];

  for (const filename of files) {
    try {
      const filepath = path.join(process.cwd(), 'data', 'invoices', filename);
      const text   = await extractTextFromPdf(filepath);
      const parsed = parsePdfText(text);

      if (parsed.store && parsed.deliveryDate && parsed.total) {
        invoices.push({
          filename,
          vendor:       parsed.vendor || 'Unknown Vendor',
          store:        parsed.store,
          deliveryDate: parsed.deliveryDate,
          totalAmount:  parsed.total,
          warnings:     parsed.errors.length > 0 ? parsed.errors : null,
        });
      } else {
        failed.push({
          filename,
          errors: parsed.errors,
          partialData: {
            store:        parsed.store        || null,
            deliveryDate: parsed.deliveryDate || null,
            total:        parsed.total        || null,
            vendor:       parsed.vendor       || null,
          }
        });
      }
    } catch(e) {
      failed.push({
        filename,
        errors: [`File could not be read: ${e.message}`],
        partialData: {},
      });
    }
  }

  invoices.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));

  for (let i = 0; i < invoices.length; i++) {
    invoices[i].windowStart = invoices[i].deliveryDate;
    if (i + 1 < invoices.length) {
      const next = new Date(invoices[i + 1].deliveryDate);
      next.setDate(next.getDate() - 1);
      invoices[i].windowEnd = next.toISOString().split('T')[0];
    } else {
      const end = new Date(invoices[i].deliveryDate);
      end.setDate(end.getDate() + 6);
      invoices[i].windowEnd = end.toISOString().split('T')[0];
    }
  }

  return NextResponse.json({ invoices, failed });
}