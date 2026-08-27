import { extractText as unpdfExtractText } from 'unpdf';

export async function extractTextFromPdf(data: Uint8Array | ArrayBuffer | Buffer): Promise<string> {
  try {
    const result = await unpdfExtractText(data);
    if (typeof result.text === 'string') {
      return result.text;
    }
    if (Array.isArray(result.text)) {
      return result.text.join('\n');
    }
    return '';
  } catch (err: any) {
    throw new Error(`Failed to extract text from PDF: ${err?.message || String(err)}`);
  }
}
