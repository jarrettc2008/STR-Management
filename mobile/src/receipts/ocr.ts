import { requireOptionalNativeModule } from 'expo-modules-core';
export async function recognizeReceipt(uri: string, progress: (value: number) => void): Promise<{ text: string; engine: string }> {
  const extractor = requireOptionalNativeModule<{ isSupported: boolean; extractTextFromImage: (path: string) => Promise<string[]> }>('ExpoTextExtractor');
  if (!extractor?.isSupported) throw new Error('Receipt OCR requires a native development build. Your original is saved; enter the details manually or use the browser preview.');
  progress(0.15);
  const text = (await extractor.extractTextFromImage(uri.replace('file://', ''))).join('\n');
  if (!text.trim()) throw new Error('No readable text found. Try a clearer, well-lit photo or enter the details manually.');
  progress(1);
  return { text, engine: 'On-device text recognition' };
}
