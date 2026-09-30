// Optional integration check against a local, non-app receipt fixture.
const { createWorker } = require('tesseract.js');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const worker = await createWorker('eng', 1, { langPath: path.resolve('node_modules/@tesseract.js-data/eng/4.0.0'), cachePath: path.resolve('.expo') });
  try {
    const { data } = await worker.recognize(path.resolve('tests/fixtures/receipt.png'));
    const { parseReceipt } = await import('../src/receipts/extract.ts');
    const { allocateReceipt } = await import('../src/receipts/domain.ts');
    const fields = parseReceipt(data.text, 'test-property');
    assert.equal(fields.merchant, 'HOME DEPOT');
    assert.equal(fields.items.length, 2);
    fields.items[1].included = false;
    assert.equal(allocateReceipt(fields).eligibleTotal, 8800);
    console.log('Local OCR → structured extraction → exclude personal item → $88.00: passed.');
  } finally { await worker.terminate(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

