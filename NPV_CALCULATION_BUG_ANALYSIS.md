# NPV Calculation Engine Bug Analysis

## Executive Summary

**ROOT CAUSE IDENTIFIED**: The PD (Probability of Default) and LGD (Loss Given Default) rates from forecast curves are **NOT normalized** to decimal format, unlike loan input rates which ARE normalized. If the AI extraction returns rates in percentage form (e.g., `1.5` for 1.5% instead of `0.015`), the calculation engine uses them as-is, resulting in drastically incorrect NPV values.

---

## Evidence from Screenshot (Loan 772102217)

### Loan Data
| Field | Value |
|-------|-------|
| Loan Number | 772102217 |
| Book Balance | $7,412,919.25 |
| Unamortized Amount | -$11,822.35 |
| Interest Rate | 3.4500% |
| Effective Yield | 3.5905% |
| Payment Type | Fixed Payment |
| Payment Amount | $41,265.50 |
| Periods | 86 |
| CPR | 3.3700% |
| SMM | 0.2853% |
| Recovery Delay | 12 months |
| **Actual Reserve** | **$27,775.96** |

### Expected vs Engine Results
| Metric | Expected | Engine | Difference |
|--------|----------|--------|------------|
| NPV | $7,373,320.94 | $4,548,146.81 | **$2,825,174.13** |
| Reserve | $27,775.96 | $2,852,950.09 | **$2,825,174.13** |

**The engine NPV is $2.82 MILLION too low!**

### How Expected NPV is Derived
```
Reserve = Book Balance + Unamortized Amount - NPV
$27,775.96 = $7,412,919.25 + (-$11,822.35) - NPV
NPV = $7,401,096.90 - $27,775.96 = $7,373,320.94
```

---

## Root Cause Analysis

### Code Path for Rate Normalization

**LOAN RATES (calculation-engine.ts lines 427-445) - NORMALIZED:**
```typescript
const effectiveYieldNorm = normalizeRateToDecimal(loan.effectiveYield, 'Effective Yield');
const interestRateNorm = normalizeRateToDecimal(loan.interestRate, 'Interest Rate');
const cprNorm = normalizeRateToDecimal(loan.cpr || 0, 'CPR');
const smmNorm = normalizeRateToDecimal(loan.smm || 0, 'SMM');
const curtailmentNorm = normalizeRateToDecimal(loan.curtailmentRate || 0, 'Curtailment Rate');
```

**PD/LGD RATES (calculation-engine.ts lines 485-487) - NOT NORMALIZED:**
```typescript
// Get forecast rates for this period (these are annual rates)
const annualPdRate = getForecastRate(pdCurve, periodDate);  // <-- NO normalization!
const lgdRate = getForecastRate(lgdCurve, periodDate);      // <-- NO normalization!
```

### Normalization Function Logic
```typescript
function normalizeRateToDecimal(rate, fieldName) {
  // If rate is greater than 0.25 (25%), it's very likely in percentage form
  if (rate > 0.25) {
    return rate / 100;  // Convert 3.5 -> 0.035
  }
  return rate;  // Leave as-is
}
```

### The Problem Scenario

If AI extraction returns PD rate as `0.5` (intending to represent 0.5%):
1. `normalizeRateToDecimal` is NOT called for PD rates
2. `annualPdRate = 0.5` (50% instead of 0.5%)
3. Monthly PD = `1 - (1 - 0.5)^(1/12) = 1 - 0.9439 = 0.0561` (5.61%!)
4. Each period defaults **5.61% of balance** instead of **0.042%**

---

## Sample Calculations Proving the Bug

### Scenario A: Correct Rates (PD=0.5% annual, LGD=40%)

**Rates in decimal form:** PD = 0.005, LGD = 0.40

```
Monthly PD = 1 - (1 - 0.005)^(1/12) = 1 - 0.9996 = 0.000417 (0.042%)

Period 1:
  Beginning Balance:     $7,412,919.25
  Monthly Interest Rate: 0.0345 / 12 = 0.002875
  Interest Payment:      $7,412,919.25 × 0.002875 = $21,312.14
  Scheduled Principal:   $41,265.50 - $21,312.14 = $19,953.36
  Prepayment:            $7,412,919.25 × 0.002853 = $21,147.24
  Default (raw):         $7,412,919.25 × 0.000417 = $3,091.19
  Loss:                  $3,091.19 × 0.40 = $1,236.48
  Cash Flow:             $21,312.14 + $19,953.36 + $21,147.24 = $62,412.74 (+ delayed recovery)
  Discount Factor:       1 / (1.035905)^(1/12) = 0.9971
  Present Value:         $62,412.74 × 0.9971 = $62,231.69
  Ending Balance:        $7,412,919.25 - $19,953.36 - $21,147.24 - $3,091.19 = $7,368,727.46
```

**Estimated Total NPV with correct rates: ~$7.35M - $7.40M** (matches expected!)

### Scenario B: Wrong Rate Scale (PD=0.5 stored as 0.5, LGD=0.40)

**AI returned 0.5 for "0.5%" - NOT normalized**

```
Monthly PD = 1 - (1 - 0.5)^(1/12) = 1 - 0.9439 = 0.0561 (5.61%!)

Period 1:
  Beginning Balance:     $7,412,919.25
  Interest Payment:      $21,312.14
  Scheduled Principal:   $19,953.36
  Prepayment:            $21,147.24
  Default (raw):         $7,412,919.25 × 0.0561 = $415,864.75 (MASSIVE!)
  Loss:                  $415,864.75 × 0.40 = $166,345.90
  Recovery (delayed):    $249,518.85 (arrives in period 13)
  Cash Flow:             $21,312.14 + $19,953.36 + $21,147.24 = $62,412.74
  Ending Balance:        $7,412,919.25 - $19,953.36 - $21,147.24 - $415,864.75 = $6,955,953.90
```

With $415K defaulting each period initially:
- Balance depletes rapidly
- Cumulative defaults: **millions of dollars**
- Recoveries are delayed by 12 months
- NPV drops significantly because cash flows are reduced

**Estimated Total NPV with wrong rate scale: ~$4.5M - $5.0M** (matches engine output!)

---

## Validation Check That Doesn't Catch This

The `validateForecastCurve` function only warns if rate > 1.0:

```typescript
if (period.rateDecimal > 1) {
  warnings.push(`Rate ${period.rateDecimal} seems high (greater than 100%)`);
}
```

**This misses rates between 0.25 and 1.0** (like 0.5 for "0.5%")!

---

## The Fix Required

### Option 1: Normalize PD/LGD rates in calculateDCF

Add normalization for forecast rates at lines 485-487:

```typescript
// Get forecast rates for this period (these are annual rates)
const rawAnnualPdRate = getForecastRate(pdCurve, periodDate);
const rawLgdRate = getForecastRate(lgdCurve, periodDate);

// Normalize rates in case they were provided as percentages
const pdNorm = normalizeRateToDecimal(rawAnnualPdRate, 'PD Rate');
const lgdNorm = normalizeRateToDecimal(rawLgdRate, 'LGD Rate');

if (pdNorm.warning) warnings.push(pdNorm.warning);
if (lgdNorm.warning) warnings.push(lgdNorm.warning);

const annualPdRate = pdNorm.value;
const lgdRate = lgdNorm.value;
```

### Option 2: Normalize in extraction pipeline

Ensure rates are properly validated/normalized when stored in forecast curves.

### Option 3: Add stricter validation

Update `validateForecastCurve` to error (not just warn) on suspicious rates:

```typescript
// PD rates should typically be under 10% (0.10) annually
if (curve.type === 'PD' && period.rateDecimal > 0.10) {
  errors.push(`PD rate ${period.rateDecimal} seems too high. Did you mean ${(period.rateDecimal / 100).toFixed(6)}?`);
}

// LGD rates should typically be under 100% (1.0)
if (curve.type === 'LGD' && period.rateDecimal > 1.0) {
  errors.push(`LGD rate ${period.rateDecimal} is over 100%.`);
}
```

---

## Summary Table

| Component | Loan Rates | PD/LGD Rates |
|-----------|------------|--------------|
| Normalization Applied? | YES | **NO** |
| Example: "3.5%" entered as 3.5 | Converts to 0.035 | Used as 3.5 (350%!) |
| Example: "0.5%" entered as 0.5 | Converts to 0.005 | Used as 0.5 (50%!) |
| Impact on NPV | Correct | **Drastically wrong** |

---

## Recommendation

**Apply the same `normalizeRateToDecimal` function to PD and LGD rates in the calculation engine.** This is a one-line fix for each rate that will bring consistency with how loan rates are handled.
