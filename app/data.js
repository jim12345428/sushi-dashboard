export const STORES = ['brooklyn', 'cos cob', 'darien', 'larchmont', 'new canaan', 'westport'];

export const STORE_LABELS = {
  'brooklyn': 'Brooklyn',
  'cos cob': 'Cos Cob',
  'darien': 'Darien',
  'larchmont': 'Larchmont',
  'new canaan': 'New Canaan',
  'westport': 'Westport',
};

export async function loadSales() {
  const res = await fetch('/api/sales');
  const { stores } = await res.json();
  return stores;
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
