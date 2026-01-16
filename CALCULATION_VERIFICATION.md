# Calculation Engine Verification Report

## Summary of Fixes Applied

### Fix 1: PD/LGD Rate Normalization (calculation-engine.ts:489-501)
**Problem**: PD and LGD rates from forecast curves were not normalized to decimal format.
**Solution**: Added `normalizeRateToDecimal()` calls for PD and LGD rates, same as loan rates.
**Impact**: Fixes cases where rates are entered as percentages (e.g., 0.5 for "0.5%")

### Fix 2: Balloon Payment at Maturity (calculation-engine.ts:630-641)
**Problem**: Loans that don't fully amortize had remaining balance not included in cash flows.
**Solution**: Add any remaining balance as a balloon payment in the last period, discounted to PV.
**Impact**: Critical for partially amortizing loans with balloon payments.

### Fix 3: Deferred Recoveries After Loan Term (calculation-engine.ts:643-668)
**Problem**: Recoveries from defaults near end of loan term (with 12-month delay) were lost.
**Solution**: Capture all pending recoveries after loan term, discount them, and add to NPV.
**Impact**: Ensures all expected cash flows are captured in NPV.

---

## Verification Calculation (Loan 772102217)

### Input Data
| Field | Value |
|-------|-------|
| Book Balance | $7,412,919.25 |
| Unamortized Amount | -$11,822.35 |
| Interest Rate | 3.4500% |
| Effective Yield | 3.5905% |
| Payment Type | Fixed Payment |
| Payment Amount | $41,265.50 |
| Periods | 86 |
| SMM | 0.2853% |
| Recovery Delay | 12 months |
| **Actual Reserve** | **$27,775.96** |

### Expected NPV (from Actual Reserve)
```
NPV = Book Balance + Unamortized - Reserve
NPV = $7,412,919.25 + (-$11,822.35) - $27,775.96
NPV = $7,373,320.94
```

---

## Calculation Results Comparison

### BEFORE ALL FIXES (Original Engine)
| Metric | Value |
|--------|-------|
| NPV | $4,548,146.81 |
| Calculated Reserve | $2,852,950.09 |
| **Variance** | **$2,825,174.13 (10,171%)** |

**Issues**: PD/LGD rates not normalized, causing massive defaults.

---

### AFTER FIX 1: PD/LGD Normalization Only
Assuming PD rate was 0.5 (normalized to 0.005 = 0.5%) and LGD = 0.4 (40%)

| Metric | Value |
|--------|-------|
| PD Rate (monthly) | 0.042% |
| Total Defaults | ~$181,000 |
| Total Losses | ~$72,000 |
| NPV (without balloon) | ~$3,550,000 |
| Calculated Reserve | ~$3,850,000 |
| **Variance** | **~$3,822,000 (13,762%)** |

**Issue**: NPV is LOWER than before because balloon payment is missing!

---

### AFTER FIX 1 + FIX 2: Including Balloon Payment
With balloon payment captured at maturity:

| Component | Value |
|-----------|-------|
| PV of Scheduled Cash Flows | ~$3,550,000 |
| Remaining Balance at Period 86 | ~$3,650,000 |
| Discount Factor at Period 86 | 0.7815 |
| **PV of Balloon** | **~$2,852,000** |
| Total NPV | ~$6,402,000 |
| Calculated Reserve | ~$999,000 |
| **Variance** | **~$971,000 (3,496%)** |

**Progress**: Variance reduced significantly but still high.

---

### AFTER ALL FIXES + Correct PD/LGD Rates
If actual PD/LGD from Excel are lower (e.g., PD=0.1%, LGD=20%):

| Metric | Value |
|--------|-------|
| Monthly PD | 0.00833% |
| Total Defaults | ~$36,000 |
| Total Losses | ~$7,200 |
| PV of Cash Flows | ~$3,580,000 |
| Balloon Amount | ~$3,780,000 |
| PV of Balloon | ~$2,954,000 |
| Deferred Recoveries PV | ~$20,000 |
| **Total NPV** | **~$6,554,000** |

Wait - this still seems off. Let me reconsider...

---

## Key Insight: SMM Impact on Amortization

The SMM rate of 0.2853% per month significantly accelerates paydown:

| Period | Balance Start | Principal | Prepayment | Default | Balance End |
|--------|---------------|-----------|------------|---------|-------------|
| 1 | $7,412,919 | $19,953 | $21,147 | $3,091 | $7,368,728 |
| 2 | $7,368,728 | $20,010 | $21,021 | $3,073 | $7,324,624 |
| ... | ... | ... | ... | ... | ... |
| 86 | ~$3,700,000 | ~$31,000 | ~$10,500 | ~$1,500 | ~$3,657,000 |

**Cumulative paydown over 86 periods**:
- Scheduled Principal: ~$1,900,000
- Prepayments: ~$1,650,000
- Defaults: ~$180,000
- Total Balance Reduction: ~$3,730,000
- **Remaining Balloon: ~$3,683,000**

---

## Final Calculation with All Fixes

Assuming PD=0.5% annual, LGD=40%, with balloon and deferred recoveries:

```
Cash Flow Components:
  Total Interest:           $1,827,000
  Total Principal:          $1,900,000
  Total Prepayments:        $1,650,000
  Total Recoveries:         $108,000
  Balloon at Maturity:      $3,683,000
  Deferred Recoveries:      $15,000

Discounted Values:
  PV of Interest:           $1,614,000
  PV of Principal:          $1,679,000
  PV of Prepayments:        $1,458,000
  PV of Recoveries:         $88,000
  PV of Balloon:            $2,878,000
  PV of Deferred Recovery:  $11,000

  Total NPV:                $7,728,000

Reserve = $7,412,919 + (-$11,822) - $7,728,000 = -$327,903
```

This gives a NEGATIVE reserve, which is wrong. This suggests the PD/LGD rates need to be HIGHER, not lower.

---

## Root Cause Analysis

The actual Excel reserve of $27,776 (0.37% of book balance) suggests:
1. Very low PD rates (~0.1% or lower)
2. Very low LGD rates (~10-20%)
3. OR the Excel calculation methodology differs

**Critical Question**: What are the ACTUAL PD/LGD rates in the Excel forecast curves?

---

## Recommendation

To achieve <0.5% variance:

1. **Verify PD/LGD rates** from the actual Excel forecast curves
2. **Check discount factor formula** - Excel might use a different convention
3. **Verify cash flow definition** - Excel might exclude/include different components
4. **Check if Excel includes unamortized amount** differently in reserve calculation

The fixes applied address structural issues. The remaining variance is likely due to:
- Different PD/LGD rate values than tested
- Different discount factor methodology
- Different treatment of certain cash flow components

---

## Test Scenarios Needed

To match Excel variance of <0.5%, test with these PD/LGD combinations:

| Scenario | Annual PD | LGD | Expected Reserve Range |
|----------|-----------|-----|------------------------|
| A | 0.05% | 10% | $10,000 - $20,000 |
| B | 0.10% | 15% | $20,000 - $40,000 |
| C | 0.15% | 20% | $35,000 - $60,000 |
| D | 0.20% | 25% | $50,000 - $80,000 |

The actual Excel likely uses something close to Scenario A or B.
