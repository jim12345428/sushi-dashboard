import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('file');

  if (!filename || filename.includes('..') || !filename.endsWith('.pdf')) {
    return new NextResponse('Invalid file', { status: 400 });
  }

  const filepath = path.join(process.cwd(), 'data', 'invoices', filename);

  if (!fs.existsSync(filepath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = fs.readFileSync(filepath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}