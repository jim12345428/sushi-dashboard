'use client';
import { useState, useEffect, useMemo } from 'react';

const NAVY = '#0f1f3d';
const NAVY_LIGHT = '#1a2f52';
const GOLD_ACCENT = '#c9a84c';
const TODAY = new Date();
const fmtDateFull = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const DEBT_ENTITIES = ['Fish Island', '5th Ave BK', 'NEF', 'Fish Co Mgmt'];
const DEBT_TYPES = ['Term Loan', 'SBA Loan', 'LOC', 'Demand Note', 'Promissory Note', 'Convertible Note', 'Vehicle Loan', 'Credit Card', 'Merchant Cash Advance', 'Other'];
const DEBT_TYPE_COLORS = {
  'Term Loan': { bg:'#f0f4f8', fg:'#445566', border:'#cbd5e0' },
  'SBA Loan': { bg:'#edf6fb', fg:'#1a6b8a', border:'#b3d9eb' },
  'LOC': { bg:'#edfaf2', fg:'#1a6b3a', border:'#9dd4b5' },
  'Demand Note': { bg:'#fef2f2', fg:'#b5282a', border:'#f5c6c6' },
  'Promissory Note': { bg:'#fdf8ec', fg:'#8a5c1a', border:'#e8d38a' },
  'Convertible Note': { bg:'#f3e8ff', fg:'#6b21a8', border:'#d8b4fe' },
  'Vehicle Loan': { bg:'#ecfeff', fg:'#0e7490', border:'#a5e6f0' },
  'Credit Card': { bg:'#fff1f2', fg:'#9f1239', border:'#fecdd3' },
  'Merchant Cash Advance': { bg:'#fff7ed', fg:'#9a3412', border:'#fed7aa' },
  'Other': { bg:'#f7f9fc', fg:'#445566', border:'#dde4ed' },
};
function debtTypeColor(t) { return DEBT_TYPE_COLORS[t] || DEBT_TYPE_COLORS['Other']; }
const DEBT_TYPE_BY_ID = {
  d1: 'Vehicle Loan', d2: 'Convertible Note', d3: 'Merchant Cash Advance',
  d5: 'SBA Loan', d6: 'Promissory Note', d7: 'Promissory Note', d8: 'Promissory Note',
  d10: 'LOC', d11: 'SBA Loan', d12: 'Vehicle Loan', d13: 'Vehicle Loan',
  d14: 'Vehicle Loan',
};
const DEBT_SEED = [
  { id: 'd2', lender: 'Acquisition Partners (Fish Acquisition Partners LLC)', entity: 'Fish Co Mgmt', debtType: 'Convertible Note', cleanup: false, active: false, originalAmount: 800000, originationDate: '2025-10-16', maturityDate: '2026-01-05', interestRate: null, termMonths: null, monthlyPayment: null, balance: 0, payoff: null, notes: 'FULLY CONVERTED to 16% Class B Membership Interest in Fish Company Management, LLC on 1/5/2026 per Note Conversion Agreement (DocuSign F45BF3E7-D5CA-40F6-A35F-9BA4CC7BF840). Acceptance of the Membership Interest constitutes "accord and satisfaction and payment in full" of the Notes — debt balance is $0.\n\nDebtor (Company) per agreement: FISH COMPANY MANAGEMENT, LLC (Delaware). Investor: Fish Acquisition Partners LLC (Maxwell Capital Group LLC, Managing Member — Alex Weiss). Company signatory: James Thistle, Manager. Governed by Delaware law.\n\nUnderlying $800k aggregate notes surrendered for cancellation:\n  • $300k Promissory Note dated 10/16/2025\n  • $150k Promissory Note dated 10/31/2025\n  • $150k Senior Secured Note dated 11/12/2025\n  • $200k Senior Secured Promissory Note dated 11/19/2025\n\nBookkeeping: any residual BS balance (prior $350K liability) must be reclassed — full $800K to equity (Class B MI in Fish Co Mgmt).', docFiles: ['acquisition-partners-note-conversion.pdf'] },
  { id: 'd3', lender: 'American Express Line of Credit', entity: 'Fish Island', debtType: 'LOC', cleanup: false, originalAmount: 75000, originationDate: '', maturityDate: '', interestRate: 0.18, termMonths: null, monthlyPayment: 782.03, balance: 52135.00, payoff: null, notes: 'American Express Business Line of Credit. Account #303230. Borrowers: Fish Island LLC; D Thistle, James.\n\nStructured as multiple per-draw installment plans (each with its own factor-rate "Cost") rather than a unified APR — see plan numbers in transaction history. Auto-pay enabled.\n\nRate/monthly assumption for dashboard: 18.00% APR placeholder; monthly interest only ≈ $782.03 ($52,135 × 18% ÷ 12). The actual minimum payment per statement is $11,168.34 (mixes principal + per-plan factor-rate fees) — full schedule details in attached statement.\n\nLatest statement (04/15/2026, period 03/16–04/15):\n  • Previous balance $52,480.80\n  • Loans/debits +$9,800.00 (Direct Deposit Loan #3136582 on 04/13)\n  • Costs and fees +$1,810.00 (loan charges across plans #3136582, #3097673, #3058639, #2989755)\n  • Payments/credits −$11,955.80 (auto-draft on 04/05)\n  • New balance $52,135.00\n\nCurrent payment due: $11,168.34 by 05/06/2026. Contact 1-888-986-8263.', docFiles: ['amex-business-line-of-credit-statement-2026-04-15.pdf'] },
  { id: 'd5', lender: 'Newtek Bank SBA Loan #2742643', entity: 'Fish Island', debtType: 'SBA Loan', cleanup: false, originalAmount: 2250000, originationDate: '2025-04-10', maturityDate: '2035-04-02', interestRate: 0.0975, termMonths: 120, monthlyPayment: 29767, balance: 2129022.17, payoff: null, notes: 'SBA Loan #2742643 / SBA #7284969104. Borrowers: Fish Island LLC + 5th Ave Brooklyn LLC (joint & several). Guarantors: Northeast Fish Co (unlimited), Fish Co Mgmt (unlimited), Fish Acquisition Partners (unlimited), Sea Company (unlimited), James Thistle (unlimited), Dana Thistle (limited).\n\nRate 9.750%. Monthly P&I $29,767. Late fee $1,488.35 if paid after the 15th. 2025 interest paid: $158,226.86 (1098-C).\n\nCollateral includes mortgage on 9 Lillian Terrace, Darien CT 06820 (personal property). Newtek Bank depository required for ACH.\n\nServicer mailing: Newtek Bank N.A., Payment Processing, 200 S. Orange Ave, Suite 1175, Orlando, FL 32801. Customer service 212-356-9500 / ACH signup 1-800-749-8707.\n\nRecent payment activity:\n  • 04/15/2026 — $29,767.00 ($15,248.50 P / $14,518.50 I)\n  • 03/20/2026 — $28,278.65 ($9,611.67 P / $18,666.98 I) [short payment, late fee accrued]\n  • 02/18/2026 — $31,290.35 ($15,392.53 P / $15,862.82 I)\n\nPrincipal balance: $2,129,022.17 as of 04/27/2026 (per latest statement).', docFiles: ['newtek-sba-2742643-statement-2026-04-27.pdf', 'newtek-sba-2742643-statement-2026-03-24.pdf', 'newtek-sba-2742643-1098c-2025.pdf'] },
  { id: 'd6', lender: 'Notes Payable', entity: 'Fish Island', debtType: 'Promissory Note', cleanup: false, originalAmount: 100000, originationDate: '', maturityDate: '', interestRate: null, termMonths: null, monthlyPayment: null, balance: 100000, payoff: null, notes: '', docFiles: [] },
  { id: 'd7', lender: 'Oren Sauberman - $250K Note (Fish Co Mgmt)', entity: 'Fish Co Mgmt', debtType: 'Promissory Note', cleanup: false, originalAmount: 250000, originationDate: '2024-11-13', maturityDate: '2026-11-13', interestRate: 0.10, termMonths: null, monthlyPayment: 2083.33, balance: 250000, payoff: null, notes: 'Debtor: Fish Co Mgmt LLC. Lender: Oren Sauberman (34 Ranch Road, Woodbridge, CT 16525-1912). Subordinated to all Senior Indebtedness.\n\nSecured by: (i) guarantees from Fish Island LLC, Northeast Fish Co LLC, 5th Ave Brooklyn LLC w/ subordinated lien on their assets (Guaranty and Security Agreement); (ii) 1st priority pledge of Debtor\'s MIs in the three Guarantors (Debtor Pledge); (iii) 1st priority pledge of SeaCo\'s MIs in Debtor (SeaCo Pledge).\n\nInterest 10.00% per annum, payable quarterly in arrears on first day of each calendar quarter (30/360 basis). Actual cash payment is $6,250/quarter; the dashboard "Monthly Pmt" column shows the monthly-equivalent ($2,083.33) so the total row stays comparable across loans. Principal balloon at 11/13/2026 maturity.\n\nLate charge: 5% of delinquent payment if >10 days late. Default rate: greater of 15% or max permitted by law. Cross-default with $568K note. CT governing law.\n\nUse of proceeds: SBA repayment, legal fees of Jusmedico Law Group, consulting fees of Adam Fishman, working capital.\n\nExecuted via DocuSign 11/13/2024 (Envelope 40DB1CE2-2E54-47A5-B112-AD1E3656A1E2). Signatories: James Thistle (Member, Fish Co Mgmt) / Oren Sauberman.', docFiles: ['oren-sauberman-250k-note-2024-11-13.pdf'] },
  { id: 'd8', lender: 'Oren Sauberman - $568K Note (Fish Co Mgmt)', entity: 'Fish Co Mgmt', debtType: 'Promissory Note', cleanup: false, originalAmount: 568000, originationDate: '2024-11-13', maturityDate: '2029-11-13', interestRate: 0.075, termMonths: 60, monthlyPayment: null, balance: 568000, payoff: null, notes: 'Debtor: Fish Co Mgmt LLC. Lender: Oren Sauberman (34 Ranch Road, Woodbridge, CT 16525-1912). Subordinated to all Senior Indebtedness.\n\nSame security package as $250K note: Guaranty and Security Agreement (Fish Island, Northeast Fish, 5th Ave Brooklyn) + Debtor Pledge (MIs in Guarantors) + SeaCo Pledge (SeaCo\'s MIs in Debtor).\n\nInterest 7.50% per annum (30/360 basis). First 24 months: PIK — interest capitalized monthly into principal balance. From 11/01/2026: monthly cash P&I, with principal payments calculated on a 5-year (60-month) amortization schedule. Maturity 11/13/2029 — entire remaining principal (incl. capitalized PIK) + accrued interest balloons at maturity (i.e. only ~36 of 60 amort payments occur before balloon).\n\nLate charge: 5% of delinquent payment if >10 days late. Default rate: greater of 15% or max permitted by law. Cross-default with $250K note. CT governing law.\n\nUse of proceeds: SBA repayment, Jusmedico legal fees, Adam Fishman consulting fees, working capital.\n\nExecuted via DocuSign 11/13/2024 (Envelope 75F63916-3D67-4390-8FEB-150BCF3C38BB). Signatories: James Thistle (Member, Fish Co Mgmt) / Oren Sauberman.', docFiles: ['oren-sauberman-568k-note-2024-11-13.pdf'] },
  { id: 'd10', lender: 'Newtek Bank Line of Credit ($500K)', entity: 'Fish Island', debtType: 'LOC', cleanup: false, originalAmount: 500000, originationDate: '', maturityDate: '', interestRate: 0.10, termMonths: null, monthlyPayment: 4163.69, balance: 499642.61, payoff: null, notes: 'Newtek Bank revolving line of credit. $500K commitment; current draw $499,642.61 as of 04/15/2026 (running balance after $3,473.40 LOAN ADVANCE, ref #703685778) = ~$357 available. Effectively fully drawn.\n\nRate assumption: 10.00% APR (placeholder pending LOC agreement). Monthly interest payment estimate: $4,163.69 ($499,642.61 × 10% ÷ 12). Refine once LOC agreement is in hand.\n\nStill need LOC agreement for actual rate, term, covenants.', docFiles: ['newtek-loc-loan-advance-2026-04-15.jpg'] },
  { id: 'd11', lender: 'Wells Fargo SBA Loan - 5th Ave Brooklyn', entity: '5th Ave BK', debtType: 'SBA Loan', cleanup: false, originalAmount: 483000, originationDate: '2019-03-06', maturityDate: '2029-03-06', interestRate: 0.0670, termMonths: 120, monthlyPayment: 5967.70, balance: 166721.82, payoff: null, notes: 'Wells Fargo SBA Loan. Borrower: 5th Ave Brooklyn, LLC. Loan Customer #5470338268, Obligation #26 (existing records also reference Loan #711849860 from earlier docs).\n\nOriginated 03/06/2019, maturity 03/06/2029 (120-month term). Rate 6.700%. Monthly P&I $5,967.70 auto-debited from account ending 4375 on the 15th of each month.\n\nLatest statement (05/05/2026):\n  • Principal balance forward (04/05/2026): $171,712.40\n  • Principal payment 04/15/2026: −$4,990.58\n  • Current principal balance: $166,721.82\n  • Next payment due 05/15/2026: $5,967.70 ($5,049.59 P + $918.11 I)\n  • Interest paid YTD 2026: $3,981.55 / Interest paid 2025: $14,588.65\n\nCollateral: inventory, chattel paper, accounts, equipment, general intangibles, fixtures (Commercial Security Agreement 3/6/2019).\n\nServicer: Wells Fargo SBA Lend East Coast, MAC T7422-012, P.O. Box 659713, San Antonio, TX 78265-9827. Customer service 1-866-470-5793.', docFiles: ['wells-fargo-sba-5470338268-statement-2026-05-05.pdf'] },
  { id: 'd12', lender: 'First Citizens - 2x RAM 2500 ProMaster (Veh #1, #2)', entity: 'NEF', debtType: 'Vehicle Loan', cleanup: true, originalAmount: 188641.80, originationDate: '2025-05-30', maturityDate: '2030-05-30', interestRate: 0.0525, termMonths: 60, monthlyPayment: 3144.03, balance: 150913.44, payoff: 139221.18, notes: '2x 2023 RAM 2500 ProMaster (VINs 3C6LRVVG5PE542063, 3C6LRVVG4PE542474). Branded Fjord. Combined payoff estimate $165,597; expected sale value $120,000; net equity ($45,597).\n\nEXECUTED CONTRACT TERMS (First-Citizens Bank & Trust, Master EFA #ME02124006 / Equipment Schedule #DCC-1928294, signed 5/30/2025):\n  • Customer: Northeast Fish Co., LLC DBA Fjord Fish Market (800 Food Center Dr, Bronx NY 10474)\n  • Corporate Guarantor: FISH ISLAND, LLC (160 E Putnam Ave, Cos Cob CT 06807, Tax ID 46-1421520)\n  • Vehicle Owner: Northeast Fish Co.; Lienholder: First-Citizens Bank (PO Box 26592 DAC 20, Raleigh NC 27611-6592; ELT Code 81948)\n  • Commencement Date: 5/30/2025; Term: 60 months\n  • Monthly Payment: $3,144.03 (per Equipment Schedule)\n  • Rate Factor per contract: 0.03383 — back-solves to ~5.25% APR via amortization on $165,597 principal\n  • Processing Fees: $699.00 (included in first invoice)\n  • Late fee: greater of 5% or $15 if not paid within 3 days of due date; 18% APR interest on past-due amounts\n  • Prepayment: in whole only — discounted PV at 4% APR (first half of term) or contract rate (second half); no prepayment penalty\n  • Signed by: James Thistle, Managing Member; Benjamin Oppici for First-Citizens Bank\n  • DocuSign Envelope: 99EC9769-134E-4491-8911-400C2AB6AD17\n\nRate interpretation note: Master EFA §11 literally says "Equipment cost = Payment / Rate Factor" → $3,144.03 / 0.03383 = $92,937. That gives an implausible ~32% implied APR for a secured bank vehicle loan; preserving the prior $165,597 figure as principal yields a more credible 5.25% APR. Verify against an actual payoff letter or statement when available.\n\nBalance/Payoff estimated assuming ~12 of 60 payments made since 5/30/2025 commencement:\n  • Balance (sum of 48 remaining × $3,144.03): $150,913.44\n  • Payoff per Prepayment Addendum (PV of 48 remaining payments discounted at 4%/12 monthly, first-half-of-term rate): $139,221.18\n  • Saves ~$11,700 vs. continuing to pay if retired today; refine with statement.\n\nPer addendum: prepayment in whole only (not in part); discount rate 4% during first half of term, contract rate during second half; no prepayment penalty added.', docFiles: ['first-citizens-efa-dcc-1928294-2025-05-30.pdf'] },
  { id: 'd13', lender: 'Ameris (Balboa) - 2x RAM 2500 ProMaster (Veh #3, #4)', entity: 'NEF', debtType: 'Vehicle Loan', cleanup: false, originalAmount: 192300.00, originationDate: '2025-08-29', maturityDate: '2030-08-29', interestRate: 0.08, termMonths: 60, monthlyPayment: 3205.00, balance: 166660.00, payoff: 167605.52, notes: 'STATUS: KEEPING THESE VANS — financed through Ameris and remaining in service; not part of vehicle-sale cleanup plan.\n\n2x 2023 RAM 2500 ProMaster (VINs 3C6LRVVG1PE562519, 3C6LRVVG3PE533006). Branded Fjord. Current payoff ~$167,605 (per 5/13/2026 quote) if ever needed.\n\nEXECUTED CONTRACT TERMS (Ameris Bank EFA #546134-000, signed 07/29-31/2025 via DocuSign):\n  • Debtor: Northeast Fish Co., LLC (800 Food Center Dr, Bronx NY 10474)\n  • Collateral location: 160 East Putnam Ave, Cos Cob CT 06807\n  • Equipment Cost: $157,586.84 (cash to supplier Emerald Transportation Solutions; +$495 Balboa doc fee)\n  • Total Original Balance (sum of 60 scheduled payments): $192,300.00 ($3,205 × 60)\n  • Commencement Date: 08/29/2025; Maturity: 08/29/2030\n  • Term: 60 months. Monthly P&I: $3,205.00\n  • Implied APR: ~8.00% (back-solved from Equipment Cost / Payment / Term)\n  • Late fee: 18% of late payment + 18% APR interest from due date (3-day grace)\n  • Prepayment: 1% of net investment × full 12-month periods remaining\n  • Personal Guarantor: James Thistle (9 Lillian Terrace, Darien CT)\n  • Auto-debit: Bank of America acct ending 8080 (enrolled in recurring ACH + Go Green paperless)\n  • Insurance carrier: The Hartford\n  • Governing law: California (Orange County)\n\nCURRENT STATUS (per Balboa Capital portal, 05/13/2026):\n  • Payments Made: 8 of 60 (Last payment $3,205 on 04/29/2026)\n  • Payments Left: 52\n  • Total Paid to date: $25,640.00\n  • Current Balance: $166,660.00 (sum of remaining 52 × $3,205 — EFA shows scheduled balance, not amortized principal)\n  • Next payment due: $4,150.52 on 05/29/2026 (includes extra fees/late charges?)\n  • Payoff if paid by 05/28/2026: $167,605.52 (per Payoff Quote — includes 1% × full 12-month periods remaining prepayment fee)', docFiles: ['ameris-balboa-account-portal-2026-05-13.png', 'ameris-balboa-payoff-quote-2026-05-13.pdf', 'ameris-balboa-efa-546134-000-2025-07-31.pdf'] },
  { id: 'd14', lender: 'BMO Bank - 2x GMC Savana 3500 + Thermo King (Veh #5, #6)', entity: 'NEF', debtType: 'Vehicle Loan', cleanup: true, originalAmount: 150590.86, originationDate: '2025-10-29', maturityDate: '2030-11-10', interestRate: 0.0825, termMonths: 60, monthlyPayment: 3100.46, balance: 139349.12, payoff: 139349.12, notes: '2x 2025 GMC Savana 3500 (VINs 1GTZ7HF78S1257846, 1GTZ7HF78S1257927) + 2x 2025 Thermo King V320 refrigeration units (S/Ns HTG1462699, HTG148386). Branded Fjord; seafood transport.\n\nTWO SEPARATE EXECUTED CONTRACTS (BMO Bank N.A. Loan and Security Agreements, both dated 10/29/2025):\n\nContract 9399971001 (Savana VIN …7846 + Thermo King HTG1462699):\n  • Cash to supplier: $75,295.43; Admin fee: $650.00\n  • Total Amount (60 installments): $93,024.00\n  • Monthly: $1,550.40 starting 12/10/2025\n\nContract 9399971002 (Savana VIN …7927 + Thermo King HTG148386):\n  • Cash to supplier: $75,295.43; Admin fee: $650.00\n  • Total Amount (60 installments): $93,003.60\n  • Monthly: $1,550.06 starting 12/09/2025\n\nCOMBINED: Principal financed $150,590.86 (cash to Milea Truck Sales Corp, 885 E 149th St, Bronx NY) + $1,300 admin fees. Combined monthly $3,100.46. Combined Total Amount (sum of all 60 installments × 2 contracts): $186,027.60.\n\nPre-computed interest at 8.25% per annum (360-day year, 30-day months). APR with admin fees: 8.54%. Delinquency charge: 5% of late installment. Acceleration interest: 1.5%/month. Equipment kept at 800 Food Center Dr, Bronx NY. Insurance required with BMO as loss payee.\n\nPrepayment: NO prepayment fee per §6.2 ("lesser of $0.00 and max allowed by law" = $0). Payoff = Total Amount outstanding minus unearned interest = amortized principal balance.\n\nGoverning law: Illinois (Cook County jurisdiction). Debtor: Northeast Fish Co., LLC (CT). Signed by James Thistle, President. NO personal guarantee (entity-only).\n\nCURRENT STATUS (estimated, ~6 of 60 payments made through May 2026):\n  • Balance (amortized principal at 8.25%): ~$139,349\n  • Payoff: ~$139,349 (no prepayment penalty)\n  • Refine with current BMO statement when available.', docFiles: ['bmo-loan-savana-1257846-2025-10-29.pdf', 'bmo-loan-savana-1257927-2025-10-29.pdf'] },
  { id: 'd18', lender: 'Wells Fargo BusinessLine ($65K)', entity: 'Fish Island', debtType: 'LOC', cleanup: false, active: true, originalAmount: 65000, originationDate: '', maturityDate: '', interestRate: 0.125, termMonths: null, monthlyPayment: 1325, balance: 64989.18, payoff: null, notes: 'Wells Fargo BusinessLine® MasterCard revolving credit line. Account #5586 6938 0001 4998. Borrower: Fish Island LLC. Authorized signer: Mark Scozzafava.\n\n$65,000 commitment; current draw $64,989.18 as of 04/23/2026 statement closing — only ~$10 available (effectively fully drawn). APR 12.500% on cash advances and purchases. 30-day billing cycle.\n\nAuto-pay active: minimum payment of $1,325.00 will be debited 05/18/2026. Latest period ($674.80 finance charges, $1,372.00 payment posted 04/17/2026).\n\nMailing: Wells Fargo SBL, PO Box 29482, Phoenix AZ 85038-8650. Payments: PO Box 51174, Los Angeles CA 90051-5474. Customer service 800-225-5935.\n\nNote: Wells Fargo Business Line Rewards program ending — final earn through May 2026 cycle, redeem 1,750 points by 06/26/2026.', docFiles: ['wells-fargo-businessline-statement-2026-04-23.pdf'] },
  { id: 'd17', lender: 'Ally Bank - 2022 Hyundai Santa Cruz (Chef Eddie)', entity: 'Fish Island', debtType: 'Vehicle Loan', cleanup: false, active: true, originalAmount: 29504.82, originationDate: '2025-03-03', maturityDate: '2030-03-03', interestRate: 0.1084, termMonths: 60, monthlyPayment: 639.15, balance: 24635.90, payoff: null, notes: 'Chef Eddie (Head of Sushi) vehicle. 2022 Hyundai Santa Cruz, VIN 5NTJBDAE2NH030970. Ally Bank account #228-4410-72135.\n\nAPR 10.84%, 60-month term, $639.15 monthly P&I. Originated 03/03/2025; original balance $29,504.82.\n\nBalance: $24,635.90 as of 05/08/2026 (17% paid off, 47 of 60 payments remaining).\n\nStatus: PAST DUE — total payment due $659.15 by 06/02/2026 (regular $639.15 + ~$20 late charges). Finance charges: $986.53 YTD 2026, $2,453.50 in 2025.', docFiles: ['ally-bank-hyundai-santa-cruz-account-2026-05-08.png'] },
];
const REMOVED_DEBT_IDS = new Set(['d1', 'd4', 'd9', 'd15', 'd16']);

/* ── CLEANUP TAB ── */
const CLEANUP_CATEGORIES = ['Debt', 'Litigation', 'Payables', 'Receivable', 'Asset Sale', 'Other'];
const CLEANUP_SEED = [
  { id: 'c1', label: 'Sushi Litigation Settlement', category: 'Litigation', type: 'liability', amount: 400000, entity: 'Fish Island', resolved: false, notes: '' },
  { id: 'c2', label: 'Payables Payoff Balance', category: 'Payables', type: 'liability', amount: 250000, entity: 'Fish Island', resolved: false, notes: '' },
  { id: 'c3', label: 'Outstanding Receivables', category: 'Receivable', type: 'asset', amount: 115000, entity: 'Fish Island', resolved: false, notes: 'Approximate balance of accounts receivable to collect.' },
  { id: 'c4', label: 'Vehicle Sale Proceeds', category: 'Asset Sale', type: 'asset', amount: 247000, entity: 'NEF', resolved: false, notes: 'Expected proceeds from selling NEF vehicles (RAM ProMasters + GMC Savanas) to fund cleanup.' },
];

function CleanupTab() {
  const [items, setItems] = useState(() => {
    const migrate = arr => arr.map(i => ({ ...i, type: i.type || 'liability' }));
    if (typeof window === 'undefined') return migrate(CLEANUP_SEED);
    try {
      const v = localStorage.getItem('cleanup_items');
      if (!v) return migrate(CLEANUP_SEED);
      const parsed = JSON.parse(v);
      // Auto-add asset seed items if missing (one-time migration)
      const hasReceivables = parsed.some(i => i.id === 'c3');
      const hasVehicleSale = parsed.some(i => i.id === 'c4');
      const merged = [...parsed];
      if (!hasReceivables) merged.push(CLEANUP_SEED[2]);
      if (!hasVehicleSale) merged.push(CLEANUP_SEED[3]);
      return migrate(merged);
    } catch { return migrate(CLEANUP_SEED); }
  });
  const [debts, setDebts] = useState(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('debt_schedule'); return v ? JSON.parse(v) : DEBT_SEED; } catch { return DEBT_SEED; }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', category: 'Other', type: 'liability', amount: 0, entity: 'Fish Island', notes: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => { localStorage.setItem('cleanup_items', JSON.stringify(items)); }, [items]);

  // Re-read debts when window regains focus (in case Debt tab updated them)
  useEffect(() => {
    function refresh() {
      try { const v = localStorage.getItem('debt_schedule'); if (v) setDebts(JSON.parse(v)); } catch {}
    }
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const cleanupDebts = useMemo(() => debts.filter(d => d.cleanup), [debts]);
  const nefVehicleDebts = useMemo(
    () => cleanupDebts.filter(d => d.entity === 'NEF').sort((a, b) => (b.balance || 0) - (a.balance || 0)),
    [cleanupDebts]
  );

  const allRows = useMemo(() => {
    // Non-NEF cleanup debts render individually
    const debtRows = cleanupDebts.filter(d => d.entity !== 'NEF').map(d => ({
      id: 'debt:' + d.id,
      label: d.lender,
      category: 'Debt',
      type: 'liability',
      amount: d.balance || 0,
      entity: d.entity,
      resolved: !d.active,
      notes: d.notes || '',
      isDebt: true,
      sourceDebt: d,
    }));
    // NEF vehicle loans roll up to a single summary row so the main
    // table foots — granular detail lives in the NEF section below.
    const nefActive = nefVehicleDebts.filter(d => d.active);
    const nefSummaryRow = nefVehicleDebts.length > 0 ? [{
      id: 'nef-vehicle-summary',
      label: 'NEF Vehicle Loans (' + nefVehicleDebts.length + ' loan' + (nefVehicleDebts.length > 1 ? 's' : '') + ')',
      category: 'Debt',
      type: 'liability',
      amount: nefActive.reduce((s, d) => s + ((d.payoff != null ? d.payoff : d.balance) || 0), 0),
      entity: 'NEF',
      resolved: nefActive.length === 0,
      notes: 'Vehicles slated for sale to retire these loans. Detail in the NEF Vehicle Loans section below.',
      isDebt: true,
      isNefSummary: true,
    }] : [];
    const itemRows = items.map(i => ({ ...i, type: i.type || 'liability', isDebt: false }));
    // Sort: liabilities first, then assets
    return [...debtRows, ...nefSummaryRow, ...itemRows].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'liability' ? -1 : 1;
      return 0;
    });
  }, [cleanupDebts, nefVehicleDebts, items]);

  const totals = useMemo(() => {
    const liab = { total: 0, resolved: 0, pending: 0 };
    const asset = { total: 0, resolved: 0, pending: 0 };
    const byCategory = { Debt: 0, Litigation: 0, Payables: 0, Receivable: 0, 'Asset Sale': 0, Other: 0 };
    allRows.forEach(r => {
      const bucket = r.type === 'asset' ? asset : liab;
      bucket.total += r.amount || 0;
      if (r.resolved) bucket.resolved += r.amount || 0;
      else bucket.pending += r.amount || 0;
      byCategory[r.category] = (byCategory[r.category] || 0) + (r.amount || 0);
    });
    const netNeeded = liab.pending - asset.pending;
    return { liab, asset, byCategory, netNeeded };
  }, [allRows]);

  function addItem() {
    if (!newItem.label || !newItem.amount) return;
    setItems(prev => [...prev, { id: 'c' + Date.now(), ...newItem, amount: Number(newItem.amount), resolved: false }]);
    setNewItem({ label: '', category: 'Other', type: 'liability', amount: 0, entity: 'Fish Island', notes: '' });
    setShowAddForm(false);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditForm({ ...item });
  }

  function saveEdit() {
    setItems(prev => prev.map(i => i.id === editForm.id ? { ...editForm, amount: Number(editForm.amount) } : i));
    setEditingId(null);
    setEditForm(null);
  }

  function deleteItem(id) {
    if (!confirm('Delete this cleanup item?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function toggleResolved(row) {
    if (row.isDebt) {
      // Toggle the underlying debt's active flag
      const updated = debts.map(d => d.id === row.sourceDebt.id ? { ...d, active: !d.active } : d);
      setDebts(updated);
      localStorage.setItem('debt_schedule', JSON.stringify(updated));
    } else {
      setItems(prev => prev.map(i => i.id === row.id ? { ...i, resolved: !i.resolved } : i));
    }
  }

  function toggleDebtActive(d) {
    const updated = debts.map(x => x.id === d.id ? { ...x, active: !x.active } : x);
    setDebts(updated);
    localStorage.setItem('debt_schedule', JSON.stringify(updated));
  }

  const fmtNum = v => v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US');
  const fmtRate = r => r == null ? '—' : (r * 100).toFixed(2) + '%';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color: NAVY}}>Balance Sheet Cleanup</h1>
          <p className="text-sm mt-1" style={{color:'#6b7a99'}}>Balance sheet items being resolved through paydown, reclassification, or asset recovery — and the resources lined up against them.</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{background: showAddForm ? '#6b7a99' : NAVY, border:'1px solid '+GOLD_ACCENT}}>
          {showAddForm ? 'Cancel' : '+ Add Cleanup Item'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-xl p-4 mb-5" style={{background:'white', border:'2px solid '+GOLD_ACCENT}}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{color:'#6b7a99'}}>New Cleanup Item</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{color:'#6b7a99'}}>Label</label>
              <input value={newItem.label} onChange={e => setNewItem({...newItem, label: e.target.value})} className="w-full text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'#6b7a99'}}>Type</label>
              <select value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} className="w-full text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}}>
                <option value="liability">Liability (need to pay off)</option>
                <option value="asset">Asset (need to collect/sell)</option>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'#6b7a99'}}>Category</label>
              <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}}>
                {CLEANUP_CATEGORIES.filter(c => c !== 'Debt').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'#6b7a99'}}>Entity</label>
              <select value={newItem.entity} onChange={e => setNewItem({...newItem, entity: e.target.value})} className="w-full text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}}>
                {DEBT_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'#6b7a99'}}>Amount</label>
              <input type="number" value={newItem.amount} onChange={e => setNewItem({...newItem, amount: e.target.value})} className="w-full text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}} />
            </div>
            <div className="col-span-6">
              <label className="text-xs block mb-1" style={{color:'#6b7a99'}}>Notes</label>
              <textarea value={newItem.notes} onChange={e => setNewItem({...newItem, notes: e.target.value})} rows={2} className="w-full text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}} />
            </div>
          </div>
          <button onClick={addItem} className="mt-3 px-4 py-1.5 rounded text-xs font-semibold text-white" style={{background: NAVY}}>Add</button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{background:'white', border:'1px solid #f5c6c6'}}>
          <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>Open Liabilities</div>
          <div className="text-2xl font-bold" style={{color:'#b5282a'}}>{fmtNum(totals.liab.pending)}</div>
          <div className="text-xs mt-1" style={{color:'#8899aa'}}>{fmtNum(totals.liab.total)} total · {allRows.filter(r => r.type === 'liability').length} items</div>
        </div>
        <div className="rounded-xl p-4" style={{background:'white', border:'1px solid #9dd4b5'}}>
          <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>Offsetting Assets</div>
          <div className="text-2xl font-bold" style={{color:'#1a6b3a'}}>{fmtNum(totals.asset.pending)}</div>
          <div className="text-xs mt-1" style={{color:'#8899aa'}}>{fmtNum(totals.asset.total)} total · {allRows.filter(r => r.type === 'asset').length} items</div>
        </div>
        <div className="rounded-xl p-4" style={{background: NAVY, border:`2px solid ${GOLD_ACCENT}`}}>
          <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'rgba(255,255,255,0.5)'}}>Estimated Exposure</div>
          <div className="text-2xl font-bold" style={{color: totals.netNeeded > 0 ? GOLD_ACCENT : '#9dd4b5'}}>{fmtNum(totals.netNeeded)}</div>
          <div className="text-xs mt-1" style={{color:'rgba(255,255,255,0.5)'}}>{totals.netNeeded < 0 ? 'Surplus after offsets' : 'After offsetting assets'}</div>
        </div>
        <div className="rounded-xl p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
          <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>By Category</div>
          <div className="space-y-0.5 text-xs">
            {CLEANUP_CATEGORIES.map(c => totals.byCategory[c] > 0 && (
              <div key={c} className="flex justify-between">
                <span style={{color:'#445566'}}>{c}</span>
                <strong style={{color: NAVY}}>{fmtNum(totals.byCategory[c])}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-x-auto" style={{border:'1px solid #dde4ed', background:'white'}}>
        <table className="w-full text-xs" style={{minWidth: 900}}>
          <thead><tr style={{background: NAVY, color:'white'}}>
            <th className="text-center px-2 py-2 font-semibold">Resolved</th>
            <th className="text-center px-2 py-2 font-semibold">Type</th>
            <th className="text-left px-3 py-2 font-semibold">Item</th>
            <th className="text-left px-3 py-2 font-semibold">Category</th>
            <th className="text-left px-3 py-2 font-semibold">Entity</th>
            <th className="text-right px-3 py-2 font-semibold">Amount</th>
            <th className="text-left px-3 py-2 font-semibold">Notes</th>
            <th className="text-center px-2 py-2 font-semibold">Actions</th>
          </tr></thead>
          <tbody>
            {allRows.map(r => {
              const isEditing = editingId === r.id;
              const isAsset = r.type === 'asset';
              const amountColor = isAsset ? '#1a6b3a' : NAVY;
              return (
                <tr key={r.id} style={{borderBottom:'1px solid #f0f4f8', textDecoration: r.resolved ? 'line-through' : 'none', opacity: r.resolved ? 0.6 : 1, background: isAsset ? '#f9fdf9' : 'white'}}>
                  <td className="px-2 py-2 text-center">
                    {r.isNefSummary
                      ? <input type="checkbox" checked={r.resolved} disabled title="Resolve individually in the NEF Vehicle Loans section below" style={{opacity: 0.4}} />
                      : <input type="checkbox" checked={r.resolved} onChange={() => toggleResolved(r)} title={r.resolved ? 'Mark unresolved' : 'Mark resolved'} />}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isEditing ? (
                      <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} className="text-xs rounded border px-1 py-0.5" style={{borderColor:'#dde4ed', color: NAVY}}>
                        <option value="liability">Liab</option>
                        <option value="asset">Asset</option>
                      </select>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{
                        background: isAsset ? '#edfaf2' : '#fef2f2',
                        color: isAsset ? '#1a6b3a' : '#b5282a',
                        border: '1px solid ' + (isAsset ? '#9dd4b5' : '#f5c6c6'),
                      }}>{isAsset ? 'Asset' : 'Liab'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold" style={{color: NAVY}}>
                    {isEditing ? <input value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} className="w-full text-xs rounded border px-1 py-0.5" style={{borderColor:'#dde4ed', color: NAVY}} /> : r.label}
                  </td>
                  <td className="px-3 py-2" style={{color:'#445566'}}>
                    {isEditing ? (
                      <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="text-xs rounded border px-1 py-0.5" style={{borderColor:'#dde4ed', color: NAVY}}>
                        {CLEANUP_CATEGORIES.filter(c => c !== 'Debt').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{
                        background: r.category === 'Debt' ? '#edf6fb' : r.category === 'Litigation' ? '#fef2f2' : r.category === 'Payables' ? '#fef3c7' : r.category === 'Receivable' ? '#edfaf2' : r.category === 'Asset Sale' ? '#edfaf2' : '#f7f9fc',
                        color: r.category === 'Debt' ? '#1a6b8a' : r.category === 'Litigation' ? '#b5282a' : r.category === 'Payables' ? '#8a5c1a' : (r.category === 'Receivable' || r.category === 'Asset Sale') ? '#1a6b3a' : '#445566',
                      }}>{r.category}</span>
                    )}
                  </td>
                  <td className="px-3 py-2" style={{color:'#445566'}}>
                    {isEditing ? (
                      <select value={editForm.entity} onChange={e => setEditForm({...editForm, entity: e.target.value})} className="text-xs rounded border px-1 py-0.5" style={{borderColor:'#dde4ed', color: NAVY}}>
                        {DEBT_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    ) : r.entity}
                  </td>
                  <td className="px-3 py-2 text-right font-bold" style={{color: amountColor}}>
                    {isEditing ? <input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} className="w-24 text-xs rounded border px-1 py-0.5 text-right" style={{borderColor:'#dde4ed', color: NAVY}} /> : (isAsset ? '+' : '') + fmtNum(r.amount)}
                  </td>
                  <td className="px-3 py-2 text-xs" style={{color:'#6b7a99', maxWidth: 400}}>
                    {isEditing ? <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2} className="w-full text-xs rounded border px-1 py-0.5" style={{borderColor:'#dde4ed', color: NAVY}} /> : (r.notes ? <span title={r.notes}>{r.notes.length > 80 ? r.notes.slice(0, 80) + '…' : r.notes}</span> : '—')}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.isDebt ? (
                      <span className="text-xs" style={{color:'#8899aa'}}>(debt)</span>
                    ) : isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={saveEdit} className="text-xs px-1.5 py-0.5 rounded" style={{background:'#1a6b3a', color:'white'}}>Save</button>
                        <button onClick={() => { setEditingId(null); setEditForm(null); }} className="text-xs px-1.5 py-0.5 rounded" style={{background:'#6b7a99', color:'white'}}>×</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(r)} className="text-xs px-1.5 py-0.5 rounded" style={{background:'#fdf8ec', color:'#8a5c1a', border:'1px solid #e8d38a'}}>Edit</button>
                        <button onClick={() => deleteItem(r.id)} className="text-xs px-1.5 py-0.5 rounded" style={{background:'#fef2f2', color:'#b5282a', border:'1px solid #f5c6c6'}}>Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr style={{background:'#fef2f2', borderTop:'2px solid #f5c6c6'}}>
              <td colSpan={5} className="px-3 py-2 font-bold" style={{color:'#b5282a'}}>Total Open Liabilities</td>
              <td className="px-3 py-2 text-right font-bold" style={{color:'#b5282a'}}>{fmtNum(totals.liab.pending)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr style={{background:'#edfaf2'}}>
              <td colSpan={5} className="px-3 py-2 font-bold" style={{color:'#1a6b3a'}}>Total Offsetting Assets</td>
              <td className="px-3 py-2 text-right font-bold" style={{color:'#1a6b3a'}}>+{fmtNum(totals.asset.pending)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr style={{background: NAVY, color:'white', borderTop:'2px solid '+GOLD_ACCENT}}>
              <td colSpan={5} className="px-3 py-2 font-bold">Estimated Exposure</td>
              <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(totals.netNeeded)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-xs mt-3" style={{color:'#8899aa'}}>
        Cleanup-flagged debts are pulled from the Debt Schedule. Mark a debt as inactive there to mark it resolved here. Litigation, payables, and other items can be added manually.
      </div>

      {/* NEF Vehicle Loans (Cleanup) */}
      {nefVehicleDebts.length > 0 && (() => {
        const nefTotals = nefVehicleDebts.reduce((acc, d) => ({
          original: acc.original + (d.originalAmount || 0),
          monthly: acc.monthly + (d.monthlyPayment || 0),
          balance: acc.balance + (d.balance || 0),
          payoff: acc.payoff + (d.payoff || 0),
        }), { original: 0, monthly: 0, balance: 0, payoff: 0 });
        return (
          <div className="mt-8">
            <div className="mb-3">
              <h2 className="text-lg font-bold" style={{color: NAVY}}>NEF Vehicle Loans</h2>
              <p className="text-xs mt-1" style={{color:'#6b7a99'}}>
                Vehicles slated for sale to pay down debt. Payoff figures below come from quoted payoff letters or contract addenda — discount vs. running out the loan is shown. Expected sale proceeds tracked separately on c4 above.
              </p>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{border:'1px solid #dde4ed', background:'white'}}>
              <table className="w-full text-xs" style={{minWidth: 1200}}>
                <thead><tr style={{background: NAVY, color:'white'}}>
                  <th className="text-center px-2 py-2 font-semibold">Resolved</th>
                  <th className="text-left px-3 py-2 font-semibold">Lender / Loan</th>
                  <th className="text-left px-3 py-2 font-semibold">Type</th>
                  <th className="text-right px-3 py-2 font-semibold">Original</th>
                  <th className="text-center px-3 py-2 font-semibold">Origin Date</th>
                  <th className="text-center px-3 py-2 font-semibold">Maturity</th>
                  <th className="text-center px-2 py-2 font-semibold">Rate</th>
                  <th className="text-center px-2 py-2 font-semibold">Term</th>
                  <th className="text-right px-3 py-2 font-semibold">Mthly Pmt</th>
                  <th className="text-right px-3 py-2 font-semibold">Balance</th>
                  <th className="text-right px-3 py-2 font-semibold">Payoff</th>
                  <th className="text-center px-2 py-2 font-semibold">Doc</th>
                </tr></thead>
                <tbody>
                  {nefVehicleDebts.map(d => {
                    const inactive = !d.active;
                    const txtColor = inactive ? '#a0aec0' : '#445566';
                    const navyColor = inactive ? '#a0aec0' : NAVY;
                    const dt = d.debtType || 'Other';
                    const tc = debtTypeColor(dt);
                    return (
                      <tr key={d.id} style={{borderBottom:'1px solid #f0f4f8', textDecoration: inactive ? 'line-through' : 'none', opacity: inactive ? 0.7 : 1}}>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={inactive} onChange={() => toggleDebtActive(d)} title={inactive ? 'Mark unresolved (active again)' : 'Mark resolved (set inactive)'} />
                        </td>
                        <td className="px-3 py-2 font-semibold" style={{color: navyColor}}>{d.lender}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{background: tc.bg, color: tc.fg, border:'1px solid '+tc.border}}>{dt}</span>
                        </td>
                        <td className="px-3 py-2 text-right" style={{color: txtColor}}>{fmtNum(d.originalAmount)}</td>
                        <td className="px-3 py-2 text-center" style={{color: txtColor}}>{fmtDate(d.originationDate)}</td>
                        <td className="px-3 py-2 text-center" style={{color: txtColor}}>{fmtDate(d.maturityDate)}</td>
                        <td className="px-2 py-2 text-center" style={{color: txtColor}}>{fmtRate(d.interestRate)}</td>
                        <td className="px-2 py-2 text-center" style={{color: txtColor}}>{d.termMonths || '—'}</td>
                        <td className="px-3 py-2 text-right" style={{color: txtColor}}>{fmtNum(d.monthlyPayment)}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{color: navyColor}}>{fmtNum(d.balance)}</td>
                        <td className="px-3 py-2 text-right" style={{color: txtColor}}>{d.payoff != null ? fmtNum(d.payoff) : '—'}</td>
                        <td className="px-2 py-2 text-center">{d.docFiles?.length ? <span style={{color: GOLD_ACCENT}}>📄{d.docFiles.length > 1 ? ' ×' + d.docFiles.length : ''}</span> : <span style={{color:'#cbd5e0'}}>—</span>}</td>
                      </tr>
                    );
                  })}
                  <tr style={{background: NAVY, color:'white', borderTop:'2px solid '+GOLD_ACCENT}}>
                    <td colSpan={3} className="px-3 py-2 font-bold">Total NEF Vehicle Debt</td>
                    <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(nefTotals.original)}</td>
                    <td colSpan={4}></td>
                    <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(nefTotals.monthly)}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(nefTotals.balance)}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{nefTotals.payoff > 0 ? fmtNum(nefTotals.payoff) : '—'}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DebtScheduleTab() {
  const [debts, setDebts] = useState(() => {
    const seed = DEBT_SEED.map(d => ({ active: d.active !== false, ...d, active: d.active !== false }));
    if (typeof window === 'undefined') return seed;
    try {
      const v = localStorage.getItem('debt_schedule');
      if (!v) return seed;
      const parsed = JSON.parse(v);
      const existingIds = new Set(parsed.map(d => d.id));
      // Migrate legacy records — drop removed IDs, fill missing fields
      const migrated = parsed
        .filter(d => !REMOVED_DEBT_IDS.has(d.id))
        // Drop abandoned "+ Add Debt" rows: empty lender, no original/balance, no notes
        .filter(d => !(
          (!d.lender || !d.lender.trim()) &&
          (d.originalAmount == null || d.originalAmount === 0) &&
          (d.balance == null || d.balance === 0) &&
          (!d.notes || !d.notes.trim()) &&
          (!d.docFiles || d.docFiles.length === 0)
        ))
        .map(d => {
          const out = { ...d, active: d.active === undefined ? true : d.active };
          // Add payoff field if missing (new field added 2026-05-13)
          if (!('payoff' in out)) out.payoff = null;
          // Migrate legacy docFile (string) → docFiles (array)
          if (!Array.isArray(out.docFiles)) {
            out.docFiles = out.docFile ? [out.docFile] : [];
          }
          delete out.docFile;
          // Auto-link Acquisition Partners doc if not yet referenced
          if (d.id === 'd2' && out.docFiles.length === 0) {
            out.docFiles = ['acquisition-partners-note-conversion.pdf'];
          }
          // Acquisition Partners $800K note: fully converted to equity 1/5/2026
          // per Note Conversion Agreement. Force inactive, balance 0, correct
          // entity to Fish Co Mgmt (the actual debtor per the agreement).
          if (d.id === 'd2') {
            out.active = false;
            out.balance = 0;
            out.entity = 'Fish Co Mgmt';
          }
          // Ameris (Balboa) ProMasters d13: keeping these vans — clear the
          // cleanup flag so they show on the Debt Schedule, not Cleanup tab.
          if (d.id === 'd13') {
            out.cleanup = false;
          }
          // AmEx LOC d3: removed from cleanup track — ongoing operating LOC.
          if (d.id === 'd3') {
            out.cleanup = false;
          }
          // Newtek SBA: sync to latest statement values when balance still looks
          // like the legacy BS-derived figure (~$2.5M). Idempotent — once balance
          // is the correct ~$2.13M, condition is false and nothing changes.
          if (d.id === 'd5' && (out.balance == null || (out.balance >= 2400000 && out.balance < 2700000))) {
            out.docFiles = [
              'newtek-sba-2742643-statement-2026-04-27.pdf',
              'newtek-sba-2742643-statement-2026-03-24.pdf',
              'newtek-sba-2742643-1098c-2025.pdf',
            ];
            out.interestRate = 0.0975;
            out.monthlyPayment = 29767;
            out.balance = 2129022.17;
          }
          // Newtek LOC: sync to current draw when balance still on the stale
          // 1/31/2026 BS figure ($66,287). Idempotent.
          if (d.id === 'd10' && out.balance != null && out.balance < 100000) {
            out.balance = 499642.61;
          }
          // Newtek LOC: backfill assumed rate + monthly interest payment
          // (10% APR placeholder — pending LOC agreement). Idempotent: only fills
          // when the field is still null, so a manual edit won't get overwritten.
          if (d.id === 'd10') {
            if (out.interestRate == null) out.interestRate = 0.10;
            if (out.monthlyPayment == null) out.monthlyPayment = 4163.69;
          }
          // Auto-link Newtek LOC + Ally Bank screenshot docs if not yet referenced
          if (d.id === 'd10' && !out.docFiles.includes('newtek-loc-loan-advance-2026-04-15.jpg')) {
            out.docFiles = ['newtek-loc-loan-advance-2026-04-15.jpg', ...out.docFiles];
          }
          if (d.id === 'd17' && !out.docFiles.includes('ally-bank-hyundai-santa-cruz-account-2026-05-08.png')) {
            out.docFiles = ['ally-bank-hyundai-santa-cruz-account-2026-05-08.png', ...out.docFiles];
          }
          // AmEx LOC (formerly "Kabbage Loan"): rename + refresh from 04/15/2026 statement
          // Detect legacy record by old lender string or stale Merchant Cash Advance type
          if (d.id === 'd3' && (/Kabbage/i.test(out.lender || '') || out.debtType === 'Merchant Cash Advance' || out.balance === 32567)) {
            out.lender = 'American Express Line of Credit';
            out.debtType = 'LOC';
            out.balance = 52135.00;
            if (!out.docFiles.includes('amex-business-line-of-credit-statement-2026-04-15.pdf')) {
              out.docFiles = ['amex-business-line-of-credit-statement-2026-04-15.pdf', ...out.docFiles];
            }
          }
          // AmEx LOC: convert payment from min-payment ($11,168.34) or null to
          // interest-only at 18% APR placeholder ($782.03/mo). Idempotent: only
          // touches if the field is null OR still on the prior $11,168.34 value.
          if (d.id === 'd3') {
            if (out.interestRate == null) out.interestRate = 0.18;
            if (out.monthlyPayment == null || out.monthlyPayment === 11168.34) {
              out.monthlyPayment = 782.03;
            }
          }
          // Wells Fargo Brooklyn SBA: refresh from 05/05/2026 statement when
          // balance still on the legacy $0 figure. Idempotent.
          if (d.id === 'd11' && (out.balance == null || out.balance === 0)) {
            out.balance = 166721.82;
            out.maturityDate = '2029-03-06';
            if (!out.docFiles.includes('wells-fargo-sba-5470338268-statement-2026-05-05.pdf')) {
              out.docFiles = ['wells-fargo-sba-5470338268-statement-2026-05-05.pdf', ...out.docFiles];
            }
          }
          // Sauberman $250K note: attach executed PDF
          if (d.id === 'd7' && !out.docFiles.includes('oren-sauberman-250k-note-2024-11-13.pdf')) {
            out.docFiles = ['oren-sauberman-250k-note-2024-11-13.pdf', ...out.docFiles];
          }
          // Sauberman notes: correct entity to Fish Co Mgmt (was incorrectly
          // Fish Island; actual Debtor per note is Fish Company Management LLC)
          if ((d.id === 'd7' || d.id === 'd8') && out.entity === 'Fish Island') {
            out.entity = 'Fish Co Mgmt';
          }
          // Sauberman $250K note: convert legacy "monthly" of $6,250 (which was
          // actually the quarterly payment) to the monthly equivalent $2,083.33
          // so the Mthly Pmt total column is apples-to-apples.
          if (d.id === 'd7' && out.monthlyPayment === 6250) {
            out.monthlyPayment = 2083.33;
          }
          // Vehicle loans (d12/d13/d14): backfill assumption-based fields
          // (5-year amort at 9% APR, origin 2026-05-08). Idempotent: only fills
          // null/empty fields, won't overwrite manual edits or future actuals.
          if (d.id === 'd12' || d.id === 'd13' || d.id === 'd14') {
            if (out.interestRate == null) out.interestRate = 0.09;
            if (out.termMonths == null) out.termMonths = 60;
            if (!out.originationDate) out.originationDate = '2026-05-08';
            if (!out.maturityDate) out.maturityDate = '2031-05-08';
            if (out.originalAmount == null) out.originalAmount = out.balance;
            if (out.monthlyPayment == null) {
              if (d.id === 'd12') out.monthlyPayment = 3437.45;
              else if (d.id === 'd13') out.monthlyPayment = 3321.34;
              else if (d.id === 'd14') out.monthlyPayment = 2906.18;
            }
          }
          // Ameris/Balboa (d13): replace prior 9%/$3,321.34 placeholder with
          // executed-contract terms (EFA 546134-000). Idempotent: detects the
          // exact prior placeholder values; won't touch records already updated
          // or with user edits to different values.
          if (d.id === 'd13' && out.interestRate === 0.09 && out.monthlyPayment === 3321.34) {
            out.originalAmount = 157586.84;
            out.originationDate = '2025-08-29';
            out.maturityDate = '2030-08-29';
            out.interestRate = 0.08;
            out.monthlyPayment = 3205.00;
            out.balance = 166660.00;
            if (!out.docFiles.includes('ameris-balboa-efa-546134-000-2025-07-31.pdf')) {
              out.docFiles = ['ameris-balboa-efa-546134-000-2025-07-31.pdf', ...out.docFiles];
            }
          }
          // Ameris/Balboa (d13): refresh records that landed on the prior wrong
          // values (origin 07/31, balance/originalAmount $158,081.84) to the
          // actual portal values (origin 08/29, originalAmount $157,586.84,
          // current balance $166,660 from sum of remaining payments).
          if (d.id === 'd13' && out.originationDate === '2025-07-31') {
            out.originationDate = '2025-08-29';
            out.originalAmount = 157586.84;
            out.balance = 166660.00;
          }
          // Ameris/Balboa (d13): attach payoff quote + portal screenshot
          if (d.id === 'd13') {
            if (!out.docFiles.includes('ameris-balboa-payoff-quote-2026-05-13.pdf')) {
              out.docFiles = ['ameris-balboa-payoff-quote-2026-05-13.pdf', ...out.docFiles];
            }
            if (!out.docFiles.includes('ameris-balboa-account-portal-2026-05-13.png')) {
              out.docFiles = ['ameris-balboa-account-portal-2026-05-13.png', ...out.docFiles];
            }
          }
          // First Citizens (d12): replace prior 9%/$3,437.45 placeholder with
          // executed-contract terms (Master EFA ME02124006 / Schedule DCC-1928294).
          // Preserves user's $165,597 principal; back-solves rate to 5.25% APR.
          if (d.id === 'd12' && out.interestRate === 0.09 && out.monthlyPayment === 3437.45) {
            out.originationDate = '2025-05-30';
            out.maturityDate = '2030-05-30';
            out.interestRate = 0.0525;
            out.monthlyPayment = 3144.03;
            if (!out.docFiles.includes('first-citizens-efa-dcc-1928294-2025-05-30.pdf')) {
              out.docFiles = ['first-citizens-efa-dcc-1928294-2025-05-30.pdf', ...out.docFiles];
            }
          }
          // First Citizens (d12): switch placeholder $165,597 balance to
          // computed EFA-style balance (48 remaining × $3,144.03) + addendum-
          // based payoff (PV at 4% discount during first half of term).
          if (d.id === 'd12' && out.balance === 165597) out.balance = 150913.44;
          if (d.id === 'd12' && out.payoff == null) out.payoff = 139221.18;
          // BMO (d14): replace prior 9%/$2,906.18 placeholder with executed
          // contract terms from two separate Loan and Security Agreements
          // (BMO Doc Requests 9399971001 + 9399971002, both dated 10/29/2025).
          if (d.id === 'd14' && out.monthlyPayment === 2906.18) {
            out.lender = 'BMO Bank - 2x GMC Savana 3500 + Thermo King (Veh #5, #6)';
            out.originalAmount = 150590.86;
            out.originationDate = '2025-10-29';
            out.maturityDate = '2030-11-10';
            out.interestRate = 0.0825;
            out.monthlyPayment = 3100.46;
            out.balance = 139349.12;
            out.payoff = 139349.12;
            const bmoFiles = ['bmo-loan-savana-1257846-2025-10-29.pdf', 'bmo-loan-savana-1257927-2025-10-29.pdf'];
            for (const f of bmoFiles) {
              if (!out.docFiles.includes(f)) out.docFiles = [...out.docFiles, f];
            }
          }
          // Sauberman $568K note: attach PDF + correct legacy maturity/term values
          // (legacy seed had 2031-11-22 / 84mo; doc says 2029-11-13 / 60mo)
          if (d.id === 'd8') {
            if (out.maturityDate === '2031-11-22') out.maturityDate = '2029-11-13';
            if (out.termMonths === 84) out.termMonths = 60;
            if (out.balance === 353875) out.balance = 568000;
            if (!out.docFiles.includes('oren-sauberman-568k-note-2024-11-13.pdf')) {
              out.docFiles = ['oren-sauberman-568k-note-2024-11-13.pdf', ...out.docFiles];
            }
          }
          // Auto-populate debtType using the seed lookup
          if (!out.debtType) out.debtType = DEBT_TYPE_BY_ID[d.id] || 'Other';
          // 2026-05-13: shift "Original" semantics to total scheduled payments
          // at inception ONLY for EFAs (where the lender presents it that way).
          // SBAs, promissory notes, and consumer auto loans keep principal.
          if (d.id === 'd3' && out.originalAmount == null) out.originalAmount = 75000;
          if (d.id === 'd12' && out.originalAmount === 165597) out.originalAmount = 188641.80;
          if (d.id === 'd13' && out.originalAmount === 157586.84) out.originalAmount = 192300.00;
          // Revert lifetime-cost values that an earlier migration applied to
          // non-EFA loans back to principal (user clarified only EFAs should
          // use M × n; traditional bank loans show principal).
          if (d.id === 'd5' && out.originalAmount === 3572040) out.originalAmount = 2250000;
          if (d.id === 'd7' && out.originalAmount === 300000) out.originalAmount = 250000;
          if (d.id === 'd11' && out.originalAmount === 716124) out.originalAmount = 483000;
          if (d.id === 'd14' && out.originalAmount === 174370.80) out.originalAmount = 140000;
          if (d.id === 'd17' && out.originalAmount === 38349.00) out.originalAmount = 29504.82;
          // d13 payoff: set if known from 5/13/2026 quote
          if (d.id === 'd13' && out.payoff == null) out.payoff = 167605.52;
          return out;
        });
      // Add any new seed entries that aren't in localStorage yet (so adding rows
      // to DEBT_SEED takes effect without requiring users to clear localStorage)
      const newFromSeed = seed.filter(d => !existingIds.has(d.id) && !REMOVED_DEBT_IDS.has(d.id));
      return [...migrated, ...newFromSeed];
    } catch { return seed; }
  });
  const [selected, setSelected] = useState(null);
  const [filterEntity, setFilterEntity] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [showCleanupOnly, setShowCleanupOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Active'); // Active | Inactive | All
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => { localStorage.setItem('debt_schedule', JSON.stringify(debts)); }, [debts]);

  const filtered = useMemo(() => {
    return debts.filter(d => {
      // NEF cleanup-flagged debts (vehicle loans being sold) live on the Cleanup tab
      if (d.cleanup && d.entity === 'NEF') return false;
      if (filterEntity !== 'All' && d.entity !== filterEntity) return false;
      if (filterType !== 'All' && (d.debtType || 'Other') !== filterType) return false;
      if (showCleanupOnly && !d.cleanup) return false;
      if (statusFilter === 'Active' && !d.active) return false;
      if (statusFilter === 'Inactive' && d.active) return false;
      return true;
    });
  }, [debts, filterEntity, filterType, showCleanupOnly, statusFilter]);

  // Totals only include ACTIVE debts (regardless of current filter view)
  const totals = useMemo(() => {
    const byEntity = {};
    DEBT_ENTITIES.forEach(e => { byEntity[e] = 0; });
    let grand = 0;
    debts.forEach(d => {
      if (!d.active) return;
      if (d.cleanup && d.entity === 'NEF') return; // shown on Cleanup tab
      byEntity[d.entity] = (byEntity[d.entity] || 0) + (d.balance || 0);
      grand += d.balance || 0;
    });
    return { byEntity, grand };
  }, [debts]);

  function openDetails(d) {
    setSelected(d);
    setEditForm({ ...d });
    setEditing(false);
  }

  function saveEdit() {
    setDebts(prev => prev.map(d => d.id === editForm.id ? editForm : d));
    setSelected(editForm);
    setEditing(false);
  }

  function deleteDebt(id) {
    if (!confirm('Delete this debt entry?')) return;
    setDebts(prev => prev.filter(d => d.id !== id));
    setSelected(null);
  }

  function addNewDebt() {
    const newDebt = {
      id: 'd' + Date.now(),
      lender: '', entity: 'Fish Island', debtType: 'Term Loan', cleanup: false, active: true,
      originalAmount: null, originationDate: '', maturityDate: '',
      interestRate: null, termMonths: null, monthlyPayment: null,
      balance: 0, payoff: null, notes: '', docFiles: [],
    };
    setDebts(prev => [...prev, newDebt]);
    openDetails(newDebt);
    setEditing(true);
    setShowAddForm(false);
  }

  const fmtRate = r => r == null ? '—' : (r * 100).toFixed(2) + '%';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '—';
  const fmtNum = v => v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US');

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color: NAVY}}>Debt Schedule</h1>
          <p className="text-sm mt-1" style={{color:'#6b7a99'}}>All debts across {DEBT_ENTITIES.join(', ')}. Click any row for details and loan documents.</p>
        </div>
        <button onClick={addNewDebt} className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{background: NAVY, border:'1px solid '+GOLD_ACCENT}}>+ Add Debt</button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{background: NAVY, border:`2px solid ${GOLD_ACCENT}`}}>
          <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'rgba(255,255,255,0.5)'}}>Total Debt</div>
          <div className="text-2xl font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(totals.grand)}</div>
        </div>
        {DEBT_ENTITIES.map(ent => (
          <div key={ent} className="rounded-xl p-4" style={{background:'white', border:'1px solid #dde4ed'}}>
            <div className="text-xs uppercase tracking-wide font-medium mb-1" style={{color:'#8899aa'}}>{ent}</div>
            <div className="text-2xl font-bold" style={{color: NAVY}}>{fmtNum(totals.byEntity[ent] || 0)}</div>
            <div className="text-xs mt-1" style={{color:'#8899aa'}}>{totals.grand > 0 ? ((totals.byEntity[ent] / totals.grand) * 100).toFixed(1) : 0}% of total</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3" style={{background:'white', border:'1px solid #dde4ed'}}>
        <span className="text-xs font-semibold" style={{color:'#6b7a99'}}>Status:</span>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}}>
          <option value="Active">Active only</option>
          <option value="Inactive">Inactive only</option>
          <option value="All">All</option>
        </select>
        <span className="text-xs font-semibold ml-3" style={{color:'#6b7a99'}}>Entity:</span>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}}>
          <option value="All">All</option>
          {DEBT_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs font-semibold ml-3" style={{color:'#6b7a99'}}>Type:</span>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs rounded border px-2 py-1" style={{borderColor:'#dde4ed', color: NAVY}}>
          <option value="All">All</option>
          {DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs cursor-pointer ml-3" style={{color:'#445566'}}>
          <input type="checkbox" checked={showCleanupOnly} onChange={e => setShowCleanupOnly(e.target.checked)} />
          Show cleanup-flagged only
        </label>
        <span className="text-xs ml-auto" style={{color:'#8899aa'}}>
          {filtered.length} of {debts.length} <span style={{color:'#cbd5e0'}}>·</span> {debts.filter(d => d.active).length} active, {debts.filter(d => !d.active).length} inactive
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-x-auto" style={{border:'1px solid #dde4ed', background:'white'}}>
        <table className="w-full text-xs" style={{minWidth: 1400}}>
          <thead><tr style={{background: NAVY, color:'white'}}>
            <th className="text-center px-2 py-2 font-semibold">Status</th>
            <th className="text-left px-3 py-2 font-semibold">Lender / Loan</th>
            <th className="text-left px-3 py-2 font-semibold">Type</th>
            <th className="text-left px-3 py-2 font-semibold">Entity</th>
            <th className="text-center px-2 py-2 font-semibold">Cleanup</th>
            <th className="text-right px-3 py-2 font-semibold">Original</th>
            <th className="text-center px-3 py-2 font-semibold">Origin Date</th>
            <th className="text-center px-3 py-2 font-semibold">Maturity</th>
            <th className="text-center px-2 py-2 font-semibold">Rate</th>
            <th className="text-center px-2 py-2 font-semibold">Term</th>
            <th className="text-right px-3 py-2 font-semibold">Mthly Pmt</th>
            <th className="text-right px-3 py-2 font-semibold">Balance</th>
            <th className="text-right px-3 py-2 font-semibold">Payoff</th>
            <th className="text-right px-2 py-2 font-semibold">% Total</th>
            <th className="text-center px-2 py-2 font-semibold">Doc</th>
          </tr></thead>
          <tbody>
            {filtered.map(d => {
              const inactive = !d.active;
              const txtColor = inactive ? '#a0aec0' : '#445566';
              const navyColor = inactive ? '#a0aec0' : NAVY;
              return (
                <tr key={d.id} onClick={() => openDetails(d)} className="cursor-pointer hover:bg-gray-50" style={{borderBottom:'1px solid #f0f4f8', textDecoration: inactive ? 'line-through' : 'none', opacity: inactive ? 0.7 : 1}}>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={d.active} onClick={e => e.stopPropagation()} onChange={e => setDebts(prev => prev.map(x => x.id === d.id ? {...x, active: e.target.checked} : x))} title={d.active ? 'Active — uncheck to mark inactive' : 'Inactive — check to mark active'} />
                  </td>
                  <td className="px-3 py-2 font-semibold" style={{color: navyColor}}>{d.lender}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const dt = d.debtType || 'Other';
                      const tc = debtTypeColor(dt);
                      return <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{background: tc.bg, color: tc.fg, border:'1px solid '+tc.border}}>{dt}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2" style={{color: txtColor}}>{d.entity}</td>
                  <td className="px-2 py-2 text-center">{d.cleanup && <span className="text-xs px-1.5 py-0.5 rounded" style={{background:'#fef3c7', color:'#8a5c1a', border:'1px solid #e8d38a'}}>Y</span>}</td>
                  <td className="px-3 py-2 text-right" style={{color: txtColor}}>{fmtNum(d.originalAmount)}</td>
                  <td className="px-3 py-2 text-center" style={{color: txtColor}}>{fmtDate(d.originationDate)}</td>
                  <td className="px-3 py-2 text-center" style={{color: txtColor}}>{fmtDate(d.maturityDate)}</td>
                  <td className="px-2 py-2 text-center" style={{color: txtColor}}>{fmtRate(d.interestRate)}</td>
                  <td className="px-2 py-2 text-center" style={{color: txtColor}}>{d.termMonths || '—'}</td>
                  <td className="px-3 py-2 text-right" style={{color: txtColor}}>{fmtNum(d.monthlyPayment)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{color: navyColor}}>{fmtNum(d.balance)}</td>
                  <td className="px-3 py-2 text-right" style={{color: txtColor}}>{d.payoff != null ? fmtNum(d.payoff) : '—'}</td>
                  <td className="px-2 py-2 text-right" style={{color: inactive ? '#cbd5e0' : '#8899aa'}}>{d.active && totals.grand > 0 && d.balance ? ((d.balance / totals.grand) * 100).toFixed(1) + '%' : '—'}</td>
                  <td className="px-2 py-2 text-center">{d.docFiles?.length ? <span style={{color: GOLD_ACCENT}}>📄{d.docFiles.length > 1 ? ' ×' + d.docFiles.length : ''}</span> : <span style={{color:'#cbd5e0'}}>—</span>}</td>
                </tr>
              );
            })}
            <tr style={{background: NAVY, color:'white', borderTop:'2px solid '+GOLD_ACCENT}}>
              <td className="px-3 py-2 font-bold" colSpan={5}>Total {filterEntity !== 'All' ? '(' + filterEntity + ')' : 'Long-Term Debt'} {statusFilter !== 'All' ? '— ' + statusFilter : ''}{filterType !== 'All' ? ' — ' + filterType : ''}</td>
              <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(filtered.reduce((s, d) => s + (d.originalAmount || 0), 0))}</td>
              <td colSpan={4}></td>
              <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(filtered.reduce((s, d) => s + (d.monthlyPayment || 0), 0))}</td>
              <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{fmtNum(filtered.reduce((s, d) => s + (d.balance || 0), 0))}</td>
              <td className="px-3 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{(() => { const s = filtered.reduce((acc, d) => acc + (d.payoff || 0), 0); return s > 0 ? fmtNum(s) : '—'; })()}</td>
              <td className="px-2 py-2 text-right font-bold" style={{color: GOLD_ACCENT}}>{statusFilter === 'Active' && filterType === 'All' && filterEntity === 'All' ? '100.0%' : '—'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{background:'rgba(15,31,61,0.7)'}} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} className="rounded-xl overflow-hidden flex flex-col" style={{background:'white', border:'1px solid #dde4ed', width:'95vw', maxWidth:1400, height:'90vh'}}>
            <div className="px-5 py-3 flex items-center justify-between" style={{background: NAVY, color:'white', borderBottom:'2px solid '+GOLD_ACCENT}}>
              <div>
                <div className="text-base font-bold">{selected.lender || 'New Debt'}</div>
                <div className="text-xs" style={{color:'rgba(255,255,255,0.6)'}}>{selected.entity}</div>
              </div>
              <div className="flex gap-2">
                {!editing && <button onClick={() => setEditing(true)} className="px-3 py-1 rounded text-xs font-semibold" style={{background: GOLD_ACCENT, color: NAVY}}>Edit</button>}
                {editing && <>
                  <button onClick={saveEdit} className="px-3 py-1 rounded text-xs font-semibold" style={{background:'#1a6b3a', color:'white'}}>Save</button>
                  <button onClick={() => { setEditing(false); setEditForm({...selected}); }} className="px-3 py-1 rounded text-xs font-semibold" style={{background:'#6b7a99', color:'white'}}>Cancel</button>
                </>}
                <button onClick={() => deleteDebt(selected.id)} className="px-3 py-1 rounded text-xs font-semibold" style={{background:'#b5282a', color:'white'}}>Delete</button>
                <button onClick={() => setSelected(null)} className="px-2 py-1 rounded text-sm" style={{background:'rgba(255,255,255,0.2)', color:'white'}}>✕</button>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 overflow-hidden" style={{minHeight:0}}>
              {/* Details Pane */}
              <div className="overflow-y-auto p-5 border-r" style={{borderColor:'#dde4ed'}}>
                {!editing ? (
                  <div className="space-y-3 text-xs">
                    <DetailRow label="Lender / Loan" value={selected.lender} />
                    <DetailRow label="Type" value={selected.debtType || 'Other'} />
                    <DetailRow label="Entity" value={selected.entity} />
                    <DetailRow label="Status" value={selected.active ? 'Active' : 'Inactive'} bold />
                    <DetailRow label="Cleanup Required" value={selected.cleanup ? 'Yes' : 'No'} />
                    <DetailRow label="Original Amount" value={fmtNum(selected.originalAmount)} />
                    <DetailRow label="Origination Date" value={fmtDate(selected.originationDate)} />
                    <DetailRow label="Maturity Date" value={fmtDate(selected.maturityDate)} />
                    <DetailRow label="Interest Rate" value={fmtRate(selected.interestRate)} />
                    <DetailRow label="Term (Months)" value={selected.termMonths || '—'} />
                    <DetailRow label="Monthly Payment" value={fmtNum(selected.monthlyPayment)} />
                    <DetailRow label="Current Balance" value={fmtNum(selected.balance)} bold />
                    <DetailRow label="Early Payoff" value={selected.payoff != null ? fmtNum(selected.payoff) : '—'} />
                    <DetailRow label="Documents" value={selected.docFiles?.length ? selected.docFiles.length + ' file' + (selected.docFiles.length > 1 ? 's' : '') : '— (drop PDFs in /public/loan-docs/ and reference by filename)'} />
                    {selected.notes && (
                      <div className="pt-3 mt-3" style={{borderTop:'1px solid #dde4ed'}}>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{color:'#6b7a99'}}>Notes</div>
                        <div className="text-xs leading-relaxed" style={{color:'#445566', whiteSpace:'pre-wrap'}}>{selected.notes}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <FormField label="Lender / Loan" value={editForm.lender} onChange={v => setEditForm({...editForm, lender: v})} />
                    <FormSelect label="Type" value={editForm.debtType || 'Other'} onChange={v => setEditForm({...editForm, debtType: v})} options={DEBT_TYPES} />
                    <FormSelect label="Entity" value={editForm.entity} onChange={v => setEditForm({...editForm, entity: v})} options={DEBT_ENTITIES} />
                    <FormCheckbox label="Active (uncheck if paid off, converted, or otherwise inactive)" value={editForm.active} onChange={v => setEditForm({...editForm, active: v})} />
                    <FormCheckbox label="Cleanup Required" value={editForm.cleanup} onChange={v => setEditForm({...editForm, cleanup: v})} />
                    <FormField label="Original Amount" type="number" value={editForm.originalAmount} onChange={v => setEditForm({...editForm, originalAmount: v === '' ? null : Number(v)})} />
                    <FormField label="Origination Date" type="date" value={editForm.originationDate} onChange={v => setEditForm({...editForm, originationDate: v})} />
                    <FormField label="Maturity Date" type="date" value={editForm.maturityDate} onChange={v => setEditForm({...editForm, maturityDate: v})} />
                    <FormField label="Interest Rate (decimal, e.g. 0.10 for 10%)" type="number" step="0.0001" value={editForm.interestRate} onChange={v => setEditForm({...editForm, interestRate: v === '' ? null : Number(v)})} />
                    <FormField label="Term (Months)" type="number" value={editForm.termMonths} onChange={v => setEditForm({...editForm, termMonths: v === '' ? null : Number(v)})} />
                    <FormField label="Monthly Payment" type="number" value={editForm.monthlyPayment} onChange={v => setEditForm({...editForm, monthlyPayment: v === '' ? null : Number(v)})} />
                    <FormField label="Current Balance" type="number" value={editForm.balance} onChange={v => setEditForm({...editForm, balance: v === '' ? 0 : Number(v)})} />
                    <FormField label="Early Payoff Amount (leave blank if no quote)" type="number" value={editForm.payoff} onChange={v => setEditForm({...editForm, payoff: v === '' ? null : Number(v)})} />
                    <FormTextarea label="Document Filenames (one per line, e.g. newtek-sba.pdf)" value={(editForm.docFiles || []).join('\n')} onChange={v => setEditForm({...editForm, docFiles: v.split('\n').map(s => s.trim()).filter(Boolean)})} />
                    <FormTextarea label="Notes" value={editForm.notes} onChange={v => setEditForm({...editForm, notes: v})} />
                  </div>
                )}
              </div>
              {/* Doc Preview Pane */}
              <div className="overflow-hidden flex flex-col" style={{background:'#f7f9fc'}}>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{color:'#6b7a99', borderBottom:'1px solid #dde4ed'}}>Loan Documents</div>
                <DocPreview key={selected.id} files={selected.docFiles || []} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-3 pb-2" style={{borderBottom:'1px solid #f0f4f8'}}>
      <span className="text-xs" style={{color:'#8899aa'}}>{label}</span>
      <span className="text-xs text-right" style={{color: bold ? NAVY : '#445566', fontWeight: bold ? 700 : 400}}>{value}</span>
    </div>
  );
}
function FormField({ label, value, onChange, type = 'text', step }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{color:'#6b7a99'}}>{label}</label>
      <input type={type} step={step} value={value == null ? '' : value} onChange={e => onChange(e.target.value)}
        className="w-full rounded border px-2 py-1 text-xs" style={{borderColor:'#dde4ed', color: NAVY}} />
    </div>
  );
}
function FormSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{color:'#6b7a99'}}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded border px-2 py-1 text-xs" style={{borderColor:'#dde4ed', color: NAVY}}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function FormCheckbox({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{color:'#445566'}}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
      <span className="font-semibold" style={{color:'#6b7a99'}}>{label}</span>
    </label>
  );
}
function FormTextarea({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{color:'#6b7a99'}}>{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={6}
        className="w-full rounded border px-2 py-1 text-xs" style={{borderColor:'#dde4ed', color: NAVY}} />
    </div>
  );
}

function DocPreview({ files }) {
  const [idx, setIdx] = useState(0);
  if (!files || files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <div className="text-4xl mb-3" style={{color:'#cbd5e0'}}>📄</div>
          <div className="text-sm font-semibold mb-2" style={{color:'#445566'}}>No documents linked</div>
          <div className="text-xs leading-relaxed max-w-xs mx-auto" style={{color:'#8899aa'}}>
            Drop loan PDFs into <code style={{background:'white', padding:'1px 4px', borderRadius:3, color: NAVY}}>public/loan-docs/</code> and click Edit to reference them by filename (one per line).
          </div>
        </div>
      </div>
    );
  }
  const safeIdx = Math.min(idx, files.length - 1);
  const currentFile = files[safeIdx];
  const ext = currentFile.split('.').pop().toLowerCase();
  const isImage = ['png','jpg','jpeg','gif','webp'].includes(ext);
  return (
    <>
      {files.length > 1 && (
        <div className="px-2 py-2 flex gap-1 overflow-x-auto" style={{borderBottom:'1px solid #dde4ed', background:'white'}}>
          {files.map((f, i) => (
            <button key={f + i} onClick={() => setIdx(i)} title={f}
              className="px-2 py-1 rounded text-xs whitespace-nowrap"
              style={{
                background: i === safeIdx ? NAVY : 'white',
                color: i === safeIdx ? 'white' : NAVY,
                border: '1px solid ' + (i === safeIdx ? NAVY : '#dde4ed'),
                fontWeight: i === safeIdx ? 600 : 400,
              }}>
              {f}
            </button>
          ))}
        </div>
      )}
      {isImage ? (
        <div className="flex-1 overflow-auto flex items-start justify-center p-4" style={{background:'#f7f9fc'}}>
          <img src={'/loan-docs/' + currentFile} alt={currentFile} style={{maxWidth:'100%', height:'auto', display:'block'}} />
        </div>
      ) : (
        <iframe src={'/loan-docs/' + currentFile} className="flex-1 w-full" style={{border:'none'}} title={currentFile} />
      )}
    </>
  );
}


/* ── MAIN DASHBOARD ── */
export default function Dashboard() {
  const [tab, setTab] = useState('debt');

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
            <div className="text-white text-sm font-semibold tracking-wide">Debt Schedule</div>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{color:'rgba(255,255,255,0.35)'}}>
            Today: <strong className="text-white">{fmtDateFull(TODAY)}</strong>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div style={{background: NAVY_LIGHT, borderBottom:'1px solid rgba(255,255,255,0.08)'}} className="px-6 flex">
        {[['debt','Debt Schedule'],['cleanup','Cleanup']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-3 text-xs font-medium tracking-widest uppercase border-b-2 transition-all ${tab === id ? 'text-white border-amber-400' : 'border-transparent'}`}
            style={{color: tab === id ? 'white' : 'rgba(255,255,255,0.35)'}}>
            {label}
          </button>
        ))}
      </div>

      <main className="p-3 md:p-4 lg:p-6 overflow-y-auto" style={{minHeight:'calc(100vh - 116px)'}}>
        {tab === 'debt' && <DebtScheduleTab />}
        {tab === 'cleanup' && <CleanupTab />}
      </main>

      <footer className="px-6 py-4 text-xs"
        style={{background: NAVY, color:'rgba(255,255,255,0.3)'}}>
        &copy; 2026 Fjord Fish Market &middot; Debt Schedule
      </footer>
    </div>
  );
}
