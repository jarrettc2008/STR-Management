import { createWorker } from 'tesseract.js';
export async function recognizeReceipt(uri: string, progress: (value: number) => void): Promise<{ text: string; engine: string }> {
  const worker = await createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', logger: event => { if (event.status === 'recognizing text') progress(event.progress); } });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([worker.recognize(uri), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Receipt reading took too long. Your original is safe; enter the details manually or try a smaller, clearer image.')), 120000); })]);
    if (!result.data.text.trim()) throw new Error('No readable text found. Try a clearer photo or enter details manually.');
    return { text: result.data.text, engine: 'Tesseract English (local browser)' };
  } finally { if (timer) clearTimeout(timer); await worker.terminate(); }
}
