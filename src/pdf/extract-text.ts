// PDF text extraction using unpdf.
// This module is importable now so a real PDF can be wired in later.
// For Phase 0-1, the merchant-statement parser works on raw text.

export async function extractTextFromPdf(data: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function extractTextFromPdfFile(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const buffer = await readFile(filePath);
  return extractTextFromPdf(new Uint8Array(buffer));
}