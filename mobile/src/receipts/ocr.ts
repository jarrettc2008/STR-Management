import { requireOptionalNativeModule } from 'expo-modules-core';

export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrUnavailableError';
  }
}

export async function recognizeReceipt(uri: string, progress: (value: number) => void): Promise<{ text: string; engine: string }> {
  const extractor = requireOptionalNativeModule<{ isSupported: boolean; extractTextFromImage: (path: string) => Promise<string[]> }>('ExpoTextExtractor');
  if (!extractor?.isSupported) {
    throw new OcrUnavailableError('On-device OCR is not available in Expo Go for this build. Your original is saved — enter details manually, or load a sample receipt to demo autofill.');
  }
  progress(0.15);
  const text = (await extractor.extractTextFromImage(uri.replace('file://', ''))).join('\n');
  if (!text.trim()) throw new Error('No readable text found. Try a clearer, well-lit photo or enter the details manually.');
  progress(1);
  return { text, engine: 'On-device text recognition' };
}
