export const STORE_NAME = 'cos cob';

export async function loadSales() {
  const res = await fetch('/api/sales');
  const { sales } = await res.json();
  return sales;
}

export async function loadPayroll() {
  const res = await fetch('/api/payroll');
  const { weeks } = await res.json();
  return weeks;
}

export async function loadInvoices() {
  const res = await fetch('/api/invoices');
  const { invoices } = await res.json();
  return invoices;
}