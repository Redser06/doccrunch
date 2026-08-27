/**
 * PDF -> text. Thin wrapper over `unpdf` so the parsers only ever see strings.
 *
 * `unpdf` is imported lazily: the CSV classes (and the plain-text merchant
 * fixture) never pay for loading a PDF engine.
 */
export async function extractTextFromPdf(data: Uint8Array): Promise<string> {
  let extractText: (typeof import('unpdf'))['extractText'];
  let getDocumentProxy: (typeof import('unpdf'))['getDocumentProxy'];
  try {
    ({ extractText, getDocumentProxy } = await import('unpdf'));
  } catch (cause) {
    throw new Error(
      'PDF support requires the optional "unpdf" dependency. Install it, or pass the extracted text to parseText().',
      { cause },
    );
  }

  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

/** Byte sniff — PDFs start with `%PDF-`. */
export function looksLikePdf(data: Uint8Array): boolean {
  return (
    data.length >= 5 &&
    data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d
  );
}
