// Verification script to compare calculation engine against Excel template
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, 'Template.xlsm');

  console.log('Reading Excel template:', templatePath);
  await workbook.xlsx.readFile(templatePath);

  console.log('\n=== WORKSHEETS IN TEMPLATE ===');
  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`Sheet ${sheetId}: "${worksheet.name}" (${worksheet.rowCount} rows, ${worksheet.columnCount} cols)`);
  });

  // Read each sheet and output structure
  for (const worksheet of workbook.worksheets) {
    console.log(`\n\n=== SHEET: ${worksheet.name} ===`);

    // Print first 30 rows to understand structure
    const maxRows = Math.min(worksheet.rowCount, 40);
    for (let rowNum = 1; rowNum <= maxRows; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 20) { // Limit columns
          let val = cell.value;
          if (typeof val === 'object' && val !== null) {
            if (val.formula) {
              val = `[F:${val.formula.substring(0, 30)}...]=${val.result}`;
            } else if (val.result !== undefined) {
              val = val.result;
            }
          }
          values.push(val);
        }
      });
      if (values.some(v => v !== null && v !== undefined && v !== '')) {
        console.log(`Row ${rowNum}: ${JSON.stringify(values.slice(0, 15))}`);
      }
    }
  }
}

async function readTestingWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const testPath = path.join(__dirname, '3.2 Technical Implementation Testing - DCF Replication CRE - NOO (2).xlsm');

  console.log('\n\nReading testing workbook:', testPath);
  await workbook.xlsx.readFile(testPath);

  console.log('\n=== WORKSHEETS IN TESTING WORKBOOK ===');
  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`Sheet ${sheetId}: "${worksheet.name}" (${worksheet.rowCount} rows)`);
  });

  // Find sheets with "DCF" or "Loan" in name
  for (const worksheet of workbook.worksheets) {
    const name = worksheet.name.toLowerCase();
    if (name.includes('dcf') || name.includes('loan') || name.includes('input') || name.includes('result') || name.includes('calc')) {
      console.log(`\n\n=== RELEVANT SHEET: ${worksheet.name} ===`);

      const maxRows = Math.min(worksheet.rowCount, 50);
      for (let rowNum = 1; rowNum <= maxRows; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const values = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 20) {
            let val = cell.value;
            if (typeof val === 'object' && val !== null) {
              if (val.formula) {
                val = `[F]=${val.result}`;
              } else if (val.result !== undefined) {
                val = val.result;
              }
            }
            values.push(val);
          }
        });
        if (values.some(v => v !== null && v !== undefined && v !== '')) {
          console.log(`Row ${rowNum}: ${JSON.stringify(values.slice(0, 18))}`);
        }
      }
    }
  }
}

async function main() {
  try {
    await readExcelTemplate();
    await readTestingWorkbook();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
