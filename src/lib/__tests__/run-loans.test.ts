// ============================================================================
// CECL DCF Calculation - Run Specific Loans from Screenshots
// ============================================================================

import { calculateDCF } from '../calculation-engine';
import { LoanInput, ForecastCurve, AmortizationDays } from '@/types';

// ----------------------------------------------------------------------------
// PD Forecasts (same for all loans - from user screenshots)
// These are quarterly annualized rates
// ----------------------------------------------------------------------------
const pdCurve: ForecastCurve = {
  id: 'pd-curve-shared',
  type: 'PD',
  periods: [
    { startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30'), rateDecimal: 0.005449, confidence: 1 },
    { startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), rateDecimal: 0.006000, confidence: 1 },
    { startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), rateDecimal: 0.005945, confidence: 1 },
    { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), rateDecimal: 0.005891, confidence: 1 },
    { startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), rateDecimal: 0.006175, confidence: 1 },
    { startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), rateDecimal: 0.006459, confidence: 1 },
    { startDate: new Date('2027-01-01'), endDate: new Date('2027-03-31'), rateDecimal: 0.006743, confidence: 1 },
    { startDate: new Date('2027-04-01'), endDate: new Date('2027-06-30'), rateDecimal: 0.007028, confidence: 1 },
    { startDate: new Date('2027-07-01'), endDate: new Date('2027-09-30'), rateDecimal: 0.007312, confidence: 1 },
    { startDate: new Date('2027-10-01'), endDate: new Date('2027-12-31'), rateDecimal: 0.007596, confidence: 1 },
    { startDate: new Date('2028-01-01'), endDate: new Date('2028-03-31'), rateDecimal: 0.007881, confidence: 1 },
    { startDate: new Date('2028-04-01'), endDate: new Date('2028-06-30'), rateDecimal: 0.008165, confidence: 1 },
  ],
  extractedAt: new Date(),
  ratePeriod: 'quarterly', // Quarterly annualized rates - convert using compound formula
  conversionMethod: 'compound', // Excel/Abrigo: 1-(1-rate)^(1/12)
};

// ----------------------------------------------------------------------------
// LGD Forecasts (same for all loans - from user screenshots)
// LGD is NOT a periodic rate - it's the loss percentage at default
// ----------------------------------------------------------------------------
const lgdCurve: ForecastCurve = {
  id: 'lgd-curve-shared',
  type: 'LGD',
  periods: [
    { startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30'), rateDecimal: 0.078015, confidence: 1 },
    { startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), rateDecimal: 0.079967, confidence: 1 },
    { startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), rateDecimal: 0.079778, confidence: 1 },
    { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), rateDecimal: 0.079588, confidence: 1 },
    { startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), rateDecimal: 0.080563, confidence: 1 },
    { startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), rateDecimal: 0.081509, confidence: 1 },
    { startDate: new Date('2027-01-01'), endDate: new Date('2027-03-31'), rateDecimal: 0.082429, confidence: 1 },
    { startDate: new Date('2027-04-01'), endDate: new Date('2027-06-30'), rateDecimal: 0.083324, confidence: 1 },
    { startDate: new Date('2027-07-01'), endDate: new Date('2027-09-30'), rateDecimal: 0.084197, confidence: 1 },
    { startDate: new Date('2027-10-01'), endDate: new Date('2027-12-31'), rateDecimal: 0.085049, confidence: 1 },
    { startDate: new Date('2028-01-01'), endDate: new Date('2028-03-31'), rateDecimal: 0.085881, confidence: 1 },
    { startDate: new Date('2028-04-01'), endDate: new Date('2028-06-30'), rateDecimal: 0.086694, confidence: 1 },
  ],
  extractedAt: new Date(),
};

// ----------------------------------------------------------------------------
// PD Forecasts for Residential - Residential Real Estate loans
// ----------------------------------------------------------------------------
const pdCurveResidential: ForecastCurve = {
  id: 'pd-curve-residential',
  type: 'PD',
  periods: [
    { startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30'), rateDecimal: 0.006279, confidence: 1 },
    { startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), rateDecimal: 0.006867, confidence: 1 },
    { startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), rateDecimal: 0.006829, confidence: 1 },
    { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), rateDecimal: 0.006790, confidence: 1 },
    { startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), rateDecimal: 0.007227, confidence: 1 },
    { startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), rateDecimal: 0.007664, confidence: 1 },
    { startDate: new Date('2027-01-01'), endDate: new Date('2027-03-31'), rateDecimal: 0.008101, confidence: 1 },
    { startDate: new Date('2027-04-01'), endDate: new Date('2027-06-30'), rateDecimal: 0.008538, confidence: 1 },
    { startDate: new Date('2027-07-01'), endDate: new Date('2027-09-30'), rateDecimal: 0.008975, confidence: 1 },
    { startDate: new Date('2027-10-01'), endDate: new Date('2027-12-31'), rateDecimal: 0.009412, confidence: 1 },
    { startDate: new Date('2028-01-01'), endDate: new Date('2028-03-31'), rateDecimal: 0.009849, confidence: 1 },
    { startDate: new Date('2028-04-01'), endDate: new Date('2028-06-30'), rateDecimal: 0.010286, confidence: 1 },
  ],
  extractedAt: new Date(),
  ratePeriod: 'quarterly',
  conversionMethod: 'compound',
};

// ----------------------------------------------------------------------------
// LGD Forecasts for Residential - Residential Real Estate loans
// ----------------------------------------------------------------------------
const lgdCurveResidential: ForecastCurve = {
  id: 'lgd-curve-residential',
  type: 'LGD',
  periods: [
    { startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30'), rateDecimal: 0.054445, confidence: 1 },
    { startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), rateDecimal: 0.055912, confidence: 1 },
    { startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), rateDecimal: 0.055820, confidence: 1 },
    { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), rateDecimal: 0.055727, confidence: 1 },
    { startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), rateDecimal: 0.056776, confidence: 1 },
    { startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), rateDecimal: 0.057789, confidence: 1 },
    { startDate: new Date('2027-01-01'), endDate: new Date('2027-03-31'), rateDecimal: 0.058768, confidence: 1 },
    { startDate: new Date('2027-04-01'), endDate: new Date('2027-06-30'), rateDecimal: 0.059716, confidence: 1 },
    { startDate: new Date('2027-07-01'), endDate: new Date('2027-09-30'), rateDecimal: 0.060636, confidence: 1 },
    { startDate: new Date('2027-10-01'), endDate: new Date('2027-12-31'), rateDecimal: 0.061531, confidence: 1 },
    { startDate: new Date('2028-01-01'), endDate: new Date('2028-03-31'), rateDecimal: 0.062401, confidence: 1 },
    { startDate: new Date('2028-04-01'), endDate: new Date('2028-06-30'), rateDecimal: 0.063250, confidence: 1 },
  ],
  extractedAt: new Date(),
};

// ----------------------------------------------------------------------------
// Loan Definitions from Screenshots
// ----------------------------------------------------------------------------

function createLoan(overrides: Partial<LoanInput>): LoanInput {
  return {
    id: '',
    segmentId: 'cre-nonowner-occupied',
    loanNumber: '',
    calculationDate: new Date('2025-06-30'),
    bookBalance: 0,
    unamortizedAmount: 0,
    interestRate: 0,
    effectiveYield: 0,
    amortizationDays: 'Actual 360' as AmortizationDays,
    paymentType: 'Fixed Payment',
    paymentAmount: 0,
    paymentFrequency: 'Monthly',
    maturityDate: new Date(),
    periods: 0,
    reamortize: false,
    cpr: 0.0337, // 3.37% for all loans
    curtailmentRate: 0.0208, // 2.08% for all loans
    smm: 0.002853, // 0.2853% for all loans
    recoveryDelay: 12,
    actualPresentValue: 0,
    actualReserve: 0,
    actualReservePercent: 0,
    extractedAt: new Date(),
    confidence: 1,
    corrected: false,
    ...overrides,
  };
}

// Loan 1: 772102217
const loan1 = createLoan({
  id: 'loan-772102217',
  loanNumber: '772102217',
  bookBalance: 7412919.25,
  unamortizedAmount: -11822.35,
  interestRate: 0.0345, // 3.45%
  effectiveYield: 0.035905, // 3.5905%
  paymentType: 'Fixed Payment',
  paymentAmount: 41265.50,
  maturityDate: new Date('2031-09-24'),
  periods: 86,
  reamortize: true, // Enable reamortization for Fixed Payment loans
  actualPresentValue: 7373320.94,
  actualReserve: 27775.96,
  actualReservePercent: 0.003747,
});

// Loan 2: 772400892
const loan2 = createLoan({
  id: 'loan-772400892',
  loanNumber: '772400892',
  bookBalance: 7816559.59,
  unamortizedAmount: -34898.48,
  interestRate: 0.06751, // 6.751%
  effectiveYield: 0.071497, // 7.1497%
  paymentType: 'Fixed Payment',
  paymentAmount: 56752.65,
  maturityDate: new Date('2035-01-01'),
  periods: 126,
  reamortize: true, // Enable reamortization for Fixed Payment loans
  actualPresentValue: 7736972.79,
  actualReserve: 44688.32,
  actualReservePercent: 0.005717,
});

// Loan 3: 772400484
// NOTE: This loan requires explicit amortization term to match Abrigo results.
// Our inference algorithm finds term=350 (based on payment/balance/rate), but
// Abrigo's reamortization behavior matches a 384-month (32-year) schedule.
// This may be due to original loan structuring (fees, different rate used, etc.)
const loan3 = createLoan({
  id: 'loan-772400484',
  loanNumber: '772400484',
  bookBalance: 8687693.51,
  unamortizedAmount: -20465.76,
  interestRate: 0.0705, // 7.05%
  effectiveYield: 0.074312, // 7.4312%
  paymentType: 'Fixed Payment',
  paymentAmount: 59128.33,
  maturityDate: new Date('2034-09-01'),
  periods: 122,
  reamortize: true,
  amortizationTerm: 384, // Explicit 32-year term matches Abrigo behavior
  actualPresentValue: 8614897.96,
  actualReserve: 52329.79,
  actualReservePercent: 0.006023,
});

// Loan 4: 772500277 (Interest Only)
const loan4 = createLoan({
  id: 'loan-772500277',
  loanNumber: '772500277',
  bookBalance: 6615575.43,
  unamortizedAmount: -34351.74,
  interestRate: 0.069491, // 6.9491%
  effectiveYield: 0.074202, // 7.4202%
  paymentType: 'Interest Only',
  paymentAmount: 39127.65, // Interest payment (approx bookBalance * monthlyRate)
  maturityDate: new Date('2030-04-01'),
  periods: 69,
  actualPresentValue: 6555412.74,
  actualReserve: 25810.95,
  actualReservePercent: 0.003902,
});

// Loan 5: 772400581 (Interest Only)
const loan5 = createLoan({
  id: 'loan-772400581',
  loanNumber: '772400581',
  bookBalance: 2589190.33,
  unamortizedAmount: -5160.00,
  interestRate: 0.0724, // 7.24%
  effectiveYield: 0.077536, // 7.7536%
  paymentType: 'Interest Only',
  paymentAmount: 15621.72, // Approx interest: 2589190.33 * 0.0724 / 12
  maturityDate: new Date('2026-11-01'),
  periods: 28,
  actualPresentValue: 2581261.57,
  actualReserve: 2768.76,
  actualReservePercent: 0.001069,
});

// ============================================================================
// NEW LOANS - Residential Real Estate Segment
// ============================================================================

// Helper for Residential loans with different CPR/Curtailment/SMM
function createResidentialLoan(overrides: Partial<LoanInput>): LoanInput {
  return {
    id: '',
    segmentId: 'residential-real-estate',
    loanNumber: '',
    calculationDate: new Date('2025-06-30'),
    bookBalance: 0,
    unamortizedAmount: 0,
    interestRate: 0,
    effectiveYield: 0,
    amortizationDays: 'Actual 360' as AmortizationDays,
    paymentType: 'Fixed Payment',
    paymentAmount: 0,
    paymentFrequency: 'Monthly',
    maturityDate: new Date(),
    periods: 0,
    reamortize: false,
    cpr: 0.0593, // 5.93% for residential loans
    curtailmentRate: 0.1257, // 12.57% for residential loans
    smm: 0.005081, // 0.5081% for residential loans
    recoveryDelay: 12,
    actualPresentValue: 0,
    actualReserve: 0,
    actualReservePercent: 0,
    extractedAt: new Date(),
    confidence: 1,
    corrected: false,
    ...overrides,
  };
}

// Loan 6: 772001794 (Fixed Payment, Variable Rate)
const loan6 = createResidentialLoan({
  id: 'loan-772001794',
  loanNumber: '772001794',
  bookBalance: 903647.07,
  unamortizedAmount: -229.20,
  interestRate: 0.0319, // 3.19%
  effectiveYield: 0.032895, // 3.2895%
  amortizationDays: 'Actual 360' as AmortizationDays,
  paymentType: 'Fixed Payment',
  paymentAmount: 5060.49,
  maturityDate: new Date('2030-10-29'),
  periods: 75,
  reamortize: true,
  actualPresentValue: 900761.35,
  actualReserve: 2656.52,
  actualReservePercent: 0.002940,
});

// Loan 7: 772202465 (Interest Only, Variable Rate)
const loan7 = createResidentialLoan({
  id: 'loan-772202465',
  loanNumber: '772202465',
  bookBalance: 52863.23,
  unamortizedAmount: 871.45,
  interestRate: 0.0595, // 5.95%
  effectiveYield: 0.058365, // 5.8365%
  amortizationDays: 'Actual 360' as AmortizationDays,
  paymentType: 'Interest Only',
  paymentAmount: 827.87,
  maturityDate: new Date('2037-10-05'),
  periods: 159,
  actualPresentValue: 53455.14,
  actualReserve: 279.54,
  actualReservePercent: 0.005288,
});

// Loan 8: 839000304 (Line of Credit, Variable Rate)
const loan8 = createResidentialLoan({
  id: 'loan-839000304',
  loanNumber: '839000304',
  bookBalance: 59247.13,
  unamortizedAmount: 0.00,
  interestRate: 0.075, // 7.50%
  effectiveYield: 0.077632, // 7.7632%
  amortizationDays: 'Actual 365' as AmortizationDays,
  paymentType: 'Line of Credit',
  paymentAmount: 686.88,
  maturityDate: new Date('2040-12-05'),
  periods: 197,
  actualPresentValue: 58938.91,
  actualReserve: 308.22,
  actualReservePercent: 0.005202,
});

// Loan 9: 772300912 (Fixed Payment, Variable Rate)
const loan9 = createResidentialLoan({
  id: 'loan-772300912',
  loanNumber: '772300912',
  bookBalance: 1568067.55,
  unamortizedAmount: -4656.22,
  interestRate: 0.0625, // 6.25%
  effectiveYield: 0.065889, // 6.5889%
  amortizationDays: 'Actual 360' as AmortizationDays,
  paymentType: 'Fixed Payment',
  paymentAmount: 9964.23,
  maturityDate: new Date('2033-08-30'),
  periods: 109,
  reamortize: true,
  actualPresentValue: 1555555.79,
  actualReserve: 7855.54,
  actualReservePercent: 0.005010,
});

// Loan 10: 2310074014 (Fixed Payment, Fixed Rate)
// Per Excel: Reamortize Each Period = Yes, Inferred Am Through = 337
const loan10 = createResidentialLoan({
  id: 'loan-2310074014',
  loanNumber: '2310074014',
  bookBalance: 1627280.67,
  unamortizedAmount: -192.42,
  interestRate: 0.03625, // 3.625%
  effectiveYield: 0.037395, // 3.7395%
  amortizationDays: '360 Days' as AmortizationDays,
  paymentType: 'Fixed Payment',
  paymentAmount: 7752.87,
  maturityDate: new Date('2053-11-01'),
  periods: 348, // From screenshot
  reamortize: true, // Per Excel: "Reamortize Each Period: Yes"
  amortizationTerm: 337, // Per Excel: "Inferred Am through: 337.0"
  actualPresentValue: 1616733.53,
  actualReserve: 10354.72,
  actualReservePercent: 0.006363,
});

// ----------------------------------------------------------------------------
// Run Tests
// ----------------------------------------------------------------------------

describe('Run Loans from Screenshots', () => {
  const loans = [loan1, loan2, loan3, loan4, loan5];

  loans.forEach((loan) => {
    test(`Loan ${loan.loanNumber}`, () => {
      const result = calculateDCF(loan, pdCurve, lgdCurve);

      console.log('\n' + '='.repeat(80));
      console.log(`LOAN: ${loan.loanNumber}`);
      console.log('='.repeat(80));

      console.log('\nINPUT SUMMARY:');
      console.log(`  Book Balance:       $${loan.bookBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Unamortized Amount: $${loan.unamortizedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Amortized Cost:     $${(loan.bookBalance + loan.unamortizedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Interest Rate:      ${(loan.interestRate * 100).toFixed(4)}%`);
      console.log(`  Effective Yield:    ${(loan.effectiveYield * 100).toFixed(4)}%`);
      console.log(`  Payment Type:       ${loan.paymentType}`);
      console.log(`  Payment Amount:     $${loan.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Maturity Date:      ${loan.maturityDate.toISOString().split('T')[0]}`);
      console.log(`  Periods:            ${loan.periods}`);
      console.log(`  CPR:                ${(loan.cpr * 100).toFixed(2)}%`);
      console.log(`  Curtailment Rate:   ${(loan.curtailmentRate * 100).toFixed(2)}%`);
      console.log(`  SMM:                ${(loan.smm * 100).toFixed(4)}%`);

      console.log('\nCALCULATED RESULTS:');
      console.log(`  Net Present Value:  $${result.netPresentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Calculated Reserve: $${result.calculatedReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      console.log('\nEXPECTED (FROM SCREENSHOT):');
      console.log(`  Present Value:      $${loan.actualPresentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Reserve $:          $${loan.actualReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      console.log('\nVARIANCE ANALYSIS:');
      const pvVariance = result.netPresentValue - loan.actualPresentValue;
      const pvVariancePct = loan.actualPresentValue !== 0 ? (pvVariance / loan.actualPresentValue) * 100 : 0;
      console.log(`  PV Variance $:      $${pvVariance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  PV Variance %:      ${pvVariancePct.toFixed(4)}%`);
      console.log(`  Reserve Variance $: $${result.varianceDollar.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Reserve Variance %: ${result.variancePercent.toFixed(4)}%`);

      console.log('\nSUMMARY METRICS:');
      console.log(`  Total Interest:     $${result.totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Principal:    $${result.totalPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Prepayment:   $${result.totalPrepayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Default:      $${result.totalDefault.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Loss:         $${result.totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Recovery:     $${result.totalRecovery.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      console.log('\nDEBUG INFO:');
      console.log(`  Derived Maturity Period: ${result.debugInfo?.derivedMaturityPeriod}`);
      console.log(`  Total Periods Calculated: ${result.debugInfo?.totalPeriods}`);
      console.log(`  Balloon Applied: ${result.debugInfo?.balloonApplied}`);
      console.log(`  Balloon Amount: $${result.debugInfo?.balloonAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Reamortization Applied: ${result.debugInfo?.reamortizationApplied}`);
      console.log(`  Effective Amort Term: ${result.debugInfo?.effectiveAmortTerm}`);
      console.log(`  Monthly Rate for PMT: ${((result.debugInfo?.monthlyRateForPMT || 0) * 100).toFixed(6)}%`);
      console.log(`  Initial Payment (Input): $${loan.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Initial Payment (Reamort): $${result.debugInfo?.initialPaymentFromReamort?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      if (result.warnings.length > 0) {
        console.log('\nWARNINGS:');
        result.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
      }

      if (result.errors.length > 0) {
        console.log('\nERRORS:');
        result.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
      }

      // First few cash flows for debugging
      console.log('\nFIRST 5 CASH FLOWS:');
      result.cashFlows.slice(0, 5).forEach((cf) => {
        const payment = cf.interestPayment + cf.scheduledPrincipal;
        console.log(`  Period ${cf.period}: Bal=$${cf.beginningBalance.toFixed(2)} PMT=$${payment.toFixed(2)} Int=$${cf.interestPayment.toFixed(2)} Prin=$${cf.scheduledPrincipal.toFixed(2)} Prepay=$${cf.prepayment.toFixed(2)} Def=$${cf.defaultAmount.toFixed(2)} EndBal=$${cf.endingBalance.toFixed(2)}`);
      });

      // Cash flows around maturity for loan 772400484
      if (loan.loanNumber === '772400484') {
        console.log('\nCASH FLOWS AROUND MATURITY (periods 108-111):');
        result.cashFlows.filter(cf => cf.period >= 108 && cf.period <= 112).forEach((cf) => {
          const payment = cf.interestPayment + cf.scheduledPrincipal;
          console.log(`  Period ${cf.period}: Bal=$${cf.beginningBalance.toFixed(2)} PMT=$${payment.toFixed(2)} Int=$${cf.interestPayment.toFixed(2)} Prin=$${cf.scheduledPrincipal.toFixed(2)} Prepay=$${cf.prepayment.toFixed(2)} Def=$${cf.defaultAmount.toFixed(2)} EndBal=$${cf.endingBalance.toFixed(2)} PV=$${cf.presentValue.toFixed(2)}`);
        });
      }

      // Last few cash flows
      console.log('\nLAST 3 CASH FLOWS:');
      result.cashFlows.slice(-3).forEach((cf) => {
        console.log(`  Period ${cf.period}: Bal=$${cf.beginningBalance.toFixed(2)} Int=$${cf.interestPayment.toFixed(2)} Prin=$${cf.scheduledPrincipal.toFixed(2)} Prepay=$${cf.prepayment.toFixed(2)} Def=$${cf.defaultAmount.toFixed(2)} PV=$${cf.presentValue.toFixed(2)}`);
      });

      // Assertions
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});

// ============================================================================
// Run Tests for Residential Real Estate Loans
// ============================================================================

describe('Run Residential Real Estate Loans', () => {
  const residentialLoans = [loan6, loan7, loan8, loan9, loan10];

  residentialLoans.forEach((loan) => {
    test(`Loan ${loan.loanNumber}`, () => {
      const result = calculateDCF(loan, pdCurveResidential, lgdCurveResidential);

      console.log('\n' + '='.repeat(80));
      console.log(`LOAN: ${loan.loanNumber} (Residential Real Estate)`);
      console.log('='.repeat(80));

      console.log('\nINPUT SUMMARY:');
      console.log(`  Book Balance:       $${loan.bookBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Unamortized Amount: $${loan.unamortizedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Amortized Cost:     $${(loan.bookBalance + loan.unamortizedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Interest Rate:      ${(loan.interestRate * 100).toFixed(4)}%`);
      console.log(`  Effective Yield:    ${(loan.effectiveYield * 100).toFixed(4)}%`);
      console.log(`  Amortization Days:  ${loan.amortizationDays}`);
      console.log(`  Payment Type:       ${loan.paymentType}`);
      console.log(`  Payment Amount:     $${loan.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Maturity Date:      ${loan.maturityDate.toISOString().split('T')[0]}`);
      console.log(`  Periods:            ${loan.periods}`);
      console.log(`  CPR:                ${(loan.cpr * 100).toFixed(2)}%`);
      console.log(`  Curtailment Rate:   ${(loan.curtailmentRate * 100).toFixed(2)}%`);
      console.log(`  SMM:                ${(loan.smm * 100).toFixed(4)}%`);

      console.log('\nCALCULATED RESULTS:');
      console.log(`  Net Present Value:  $${result.netPresentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Calculated Reserve: $${result.calculatedReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      console.log('\nEXPECTED (FROM SCREENSHOT):');
      console.log(`  Present Value:      $${loan.actualPresentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Reserve $:          $${loan.actualReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      console.log('\nVARIANCE ANALYSIS:');
      const pvVariance = result.netPresentValue - loan.actualPresentValue;
      const pvVariancePct = loan.actualPresentValue !== 0 ? (pvVariance / loan.actualPresentValue) * 100 : 0;
      console.log(`  PV Variance $:      $${pvVariance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  PV Variance %:      ${pvVariancePct.toFixed(4)}%`);
      console.log(`  Reserve Variance $: $${result.varianceDollar.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Reserve Variance %: ${result.variancePercent.toFixed(4)}%`);

      console.log('\nSUMMARY METRICS:');
      console.log(`  Total Interest:     $${result.totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Principal:    $${result.totalPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Prepayment:   $${result.totalPrepayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Default:      $${result.totalDefault.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Loss:         $${result.totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Total Recovery:     $${result.totalRecovery.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      console.log('\nDEBUG INFO:');
      console.log(`  Derived Maturity Period: ${result.debugInfo?.derivedMaturityPeriod}`);
      console.log(`  Total Periods Calculated: ${result.debugInfo?.totalPeriods}`);
      console.log(`  Balloon Applied: ${result.debugInfo?.balloonApplied}`);
      console.log(`  Balloon Amount: $${result.debugInfo?.balloonAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Reamortization Applied: ${result.debugInfo?.reamortizationApplied}`);
      console.log(`  Effective Amort Term: ${result.debugInfo?.effectiveAmortTerm}`);
      console.log(`  Monthly Rate for PMT: ${((result.debugInfo?.monthlyRateForPMT || 0) * 100).toFixed(6)}%`);
      console.log(`  Initial Payment (Input): $${loan.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`  Initial Payment (Reamort): $${result.debugInfo?.initialPaymentFromReamort?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

      if (result.warnings.length > 0) {
        console.log('\nWARNINGS:');
        result.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
      }

      if (result.errors.length > 0) {
        console.log('\nERRORS:');
        result.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
      }

      // First few cash flows for debugging
      console.log('\nFIRST 5 CASH FLOWS:');
      result.cashFlows.slice(0, 5).forEach((cf) => {
        const payment = cf.interestPayment + cf.scheduledPrincipal;
        console.log(`  Period ${cf.period}: Bal=$${cf.beginningBalance.toFixed(2)} PMT=$${payment.toFixed(2)} Int=$${cf.interestPayment.toFixed(2)} Prin=$${cf.scheduledPrincipal.toFixed(2)} Prepay=$${cf.prepayment.toFixed(2)} Def=$${cf.defaultAmount.toFixed(2)} EndBal=$${cf.endingBalance.toFixed(2)}`);
      });

      // Last few cash flows
      console.log('\nLAST 3 CASH FLOWS:');
      result.cashFlows.slice(-3).forEach((cf) => {
        console.log(`  Period ${cf.period}: Bal=$${cf.beginningBalance.toFixed(2)} Int=$${cf.interestPayment.toFixed(2)} Prin=$${cf.scheduledPrincipal.toFixed(2)} Prepay=$${cf.prepayment.toFixed(2)} Def=$${cf.defaultAmount.toFixed(2)} PV=$${cf.presentValue.toFixed(2)}`);
      });

      // Assertions
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});
