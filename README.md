# CECL DCF Testing Tool

A web application for Current Expected Credit Loss (CECL) Discounted Cash Flow (DCF) testing and loan reserve analysis. Uses AI-powered extraction to read PD/LGD forecasts and loan data from screenshots, performs DCF calculations, and exports formatted Excel reports.

![CECL DCF Testing](https://img.shields.io/badge/CECL-DCF%20Testing-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/License-Private-red)

## Features

- **Two-Stage Workflow**: Segment Setup → Loan Processing
- **AI-Powered Extraction**: Uses OpenAI GPT-4o to extract data from screenshots
  - PD (Probability of Default) forecast tables
  - LGD (Loss Given Default) forecast tables
  - Loan summary/detail screens
- **DCF Calculation Engine**: Matches Excel template logic with support for:
  - Multiple day count conventions (Actual/360, 30/360, Actual/365)
  - SMM/CPR prepayment rates (SMM takes precedence)
  - Recovery delay handling
  - Effective Yield for discounting, Interest Rate for accrual
  - Automatic forecast rate extension for longer loan terms
- **Excel Export**: Formatted workbook with:
  - Summary sheet with all loans
  - Individual detail sheet per loan
  - Cash flow schedules
  - Variance analysis
- **Professional UI**: Modern design with confidence indicators and variance highlighting

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand with persistence
- **AI**: OpenAI GPT-4o API
- **Excel Generation**: ExcelJS
- **Deployment**: Vercel

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fachyuthrachur%2Fcecl-dcf-testing&env=OPENAI_API_KEY&envDescription=OpenAI%20API%20Key%20for%20image%20extraction&project-name=cecl-dcf-testing&repository-name=cecl-dcf-testing)

### Manual Deploy

1. **Fork or clone this repository**

2. **Go to [Vercel](https://vercel.com)** and sign in

3. **Import the repository**:
   - Click "Add New..." → "Project"
   - Select the `cecl-dcf-testing` repository
   - Click "Import"

4. **Configure Environment Variables**:
   - Add `OPENAI_API_KEY` with your OpenAI API key
   - (The key must have access to GPT-4o / gpt-4o model)

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete

6. **Access your app** at the provided `.vercel.app` URL

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key with GPT-4o access |

## Local Development

```bash
# Clone the repository
git clone https://github.com/achyuthrachur/cecl-dcf-testing.git
cd cecl-dcf-testing

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY

# Start development server
npm run dev

# Open http://localhost:3000
```

## Usage

### Step 1: Segment Setup

1. Enter a segment name (e.g., "Q4 2024 Commercial Loans")
2. Upload a screenshot of your PD forecast table
3. Review and correct any low-confidence extracted values
4. Upload a screenshot of your LGD forecast table
5. Review and correct extracted values
6. Click "Continue to Loan Processing"

### Step 2: Loan Processing

1. Upload a screenshot of a loan summary/detail screen
2. Review extracted loan parameters (edit any incorrect values)
3. Click "Calculate Reserve" to run DCF calculation
4. Review results: NPV, Calculated Reserve, Actual Reserve, Variance
5. Click "Store and Next Loan" to save and process another loan
6. Repeat for all loans in the segment
7. Click "Export Report & New Segment" to download Excel report

## Calculation Logic

The DCF engine replicates the logic from the provided Excel template:

- **Interest Calculation**: Uses Interest Rate with day count convention
- **Discounting**: Uses Effective Yield for present value calculation
- **Prepayments**: SMM rate applied to remaining balance after scheduled principal
- **Defaults**: PD rate applied to balance after principal and prepayments
- **Losses**: LGD rate applied to defaulted amounts
- **Recoveries**: Defaulted principal minus losses, shifted by Recovery Delay
- **Reserve**: Book Balance + Unamortized Amount - NPV

## Project Structure

```
cecl-dcf-testing/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── calculate/     # DCF calculation endpoint
│   │   │   ├── export/        # Excel export endpoint
│   │   │   └── extract/       # AI extraction endpoint
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   ├── SegmentSetup.tsx  # PD/LGD setup screen
│   │   └── LoanProcessing.tsx # Loan processing screen
│   ├── lib/
│   │   ├── calculation-engine.ts  # DCF calculation logic
│   │   ├── excel-export.ts        # Excel workbook generation
│   │   ├── extraction-pipeline.ts # OpenAI Vision extraction
│   │   ├── store.ts               # Zustand state management
│   │   └── utils.ts               # Utility functions
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/extract` | POST | Extract data from image using AI |
| `/api/extract` | PUT | Classify image type only |
| `/api/calculate` | POST | Run DCF calculation for single loan |
| `/api/calculate` | PUT | Run batch DCF calculation |
| `/api/export` | POST | Generate Excel or CSV export |

## License

Private - All rights reserved.

## Support

For issues or questions, please open a GitHub issue.
