/**
 * Deep Excel Analysis - Extract all calculation details
 * This script extracts the exact formulas and values from the Excel template
 * to understand the source of truth calculations
 */
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeTemplate() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, 'Template.xlsm');

  console.log('='.repeat(100));
  console.log('DEEP EXCEL ANALYSIS - Template.xlsm');
  console.log('='.repeat(100));

  await workbook.xlsx.readFile(templatePath);

  const output = [];

  for (const worksheet of workbook.worksheets) {
    output.push(`\n${'='.repeat(100)}`);
    output.push(`SHEET: ${worksheet.name} (${worksheet.rowCount} rows x ${worksheet.columnCount} cols)`);
    output.push('='.repeat(100));

    // Get column headers (first few rows)
    const headers = [];
    for (let col = 1; col <= Math.min(25, worksheet.columnCount); col++) {
      const cell = worksheet.getRow(1).getCell(col);
      let val = cell.value;
      if (typeof val === 'object' && val !== null) {
        val = val.result || val.text || JSON.stringify(val);
      }
      headers.push(val || '');
    }
    output.push(`Headers: ${JSON.stringify(headers)}`);

    // Print rows with formulas visible
    for (let rowNum = 1; rowNum <= Math.min(100, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData = [];
      let hasContent = false;

      for (let colNum = 1; colNum <= Math.min(25, worksheet.columnCount); colNum++) {
        const cell = row.getCell(colNum);
        let display = '';

        if (cell.value !== null && cell.value !== undefined) {
          hasContent = true;
          if (typeof cell.value === 'object') {
            if (cell.value.formula) {
              // Show formula and result
              display = `[${cell.value.formula}]=${cell.value.result}`;
            } else if (cell.value.result !== undefined) {
              display = cell.value.result;
            } else if (cell.value.text) {
              display = cell.value.text;
            } else {
              display = JSON.stringify(cell.value);
            }
          } else {
            display = cell.value;
          }
        }
        rowData.push(display);
      }

      if (hasContent) {
        output.push(`Row ${rowNum}: ${JSON.stringify(rowData)}`);
      }
    }
  }

  // Write to file
  const outputPath = path.join(__dirname, 'excel-analysis-template.txt');
  fs.writeFileSync(outputPath, output.join('\n'));
  console.log(`\nOutput written to: ${outputPath}`);
}

async function analyzeTestingWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const testPath = path.join(__dirname, '3.2 Technical Implementation Testing - DCF Replication CRE - NOO (2).xlsm');

  console.log('\n' + '='.repeat(100));
  console.log('DEEP EXCEL ANALYSIS - Testing Workbook');
  console.log('='.repeat(100));

  await workbook.xlsx.readFile(testPath);

  const output = [];

  // List all sheets first
  output.push('WORKSHEETS:');
  workbook.eachSheet((ws, id) => {
    output.push(`  ${id}: ${ws.name} (${ws.rowCount} rows)`);
  });

  // Find and analyze relevant sheets
  for (const worksheet of workbook.worksheets) {
    const name = worksheet.name.toLowerCase();

    // Look for sheets with calculations, inputs, or results
    const isRelevant = name.includes('dcf') ||
                       name.includes('calc') ||
                       name.includes('input') ||
                       name.includes('loan') ||
                       name.includes('forecast') ||
                       name.includes('pd') ||
                       name.includes('lgd') ||
                       name.includes('result') ||
                       name.includes('cash') ||
                       name.includes('schedule');

    if (isRelevant || worksheet.rowCount < 200) {
      output.push(`\n${'='.repeat(100)}`);
      output.push(`SHEET: ${worksheet.name}`);
      output.push('='.repeat(100));

      // Print all rows with content
      for (let rowNum = 1; rowNum <= Math.min(150, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData = [];
        let hasContent = false;

        for (let colNum = 1; colNum <= Math.min(30, worksheet.columnCount); colNum++) {
          const cell = row.getCell(colNum);
          let display = '';

          if (cell.value !== null && cell.value !== undefined) {
            hasContent = true;
            if (typeof cell.value === 'object') {
              if (cell.value.formula) {
                display = `[F:${cell.value.formula.substring(0, 50)}]=${cell.value.result}`;
              } else if (cell.value.result !== undefined) {
                display = cell.value.result;
              } else if (cell.value.text) {
                display = cell.value.text;
              } else if (cell.value.richText) {
                display = cell.value.richText.map(r => r.text).join('');
              } else {
                display = JSON.stringify(cell.value);
              }
            } else {
              display = cell.value;
            }
          }
          rowData.push(display);
        }

        if (hasContent) {
          // Trim trailing empty cells
          while (rowData.length > 0 && (rowData[rowData.length - 1] === '' || rowData[rowData.length - 1] === null)) {
            rowData.pop();
          }
          if (rowData.length > 0) {
            output.push(`R${rowNum}: ${JSON.stringify(rowData)}`);
          }
        }
      }
    }
  }

  // Write to file
  const outputPath = path.join(__dirname, 'excel-analysis-testing.txt');
  fs.writeFileSync(outputPath, output.join('\n'));
  console.log(`Output written to: ${outputPath}`);
}

async function main() {
  try {
    await analyzeTemplate();
    await analyzeTestingWorkbook();
    console.log('\nDone! Check the output files for detailed analysis.');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
