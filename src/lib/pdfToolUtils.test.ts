import { describe, expect, it } from 'vitest';
import { formatFileSize, getFriendlyPdfError, validatePdfFiles } from './pdfToolUtils';

function makeFile(name: string, size: number, type = 'application/pdf') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('pdfToolUtils', () => {
  it('formats file sizes defensively', () => {
    expect(formatFileSize(0)).toBe('0 KB');
    expect(formatFileSize(512)).toBe('1 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('keeps valid PDF files and reports invalid files', () => {
    const pdf = makeFile('ok.pdf', 1024);
    const txt = makeFile('notes.txt', 1024, 'text/plain');

    const result = validatePdfFiles([pdf, txt], {}, 'es');

    expect(result.validFiles).toEqual([pdf]);
    expect(result.errors).toContain('Solo se admiten archivos PDF válidos.');
  });

  it('reports size limits in the selected language', () => {
    const bigPdf = makeFile('big.pdf', 12 * 1024);

    const result = validatePdfFiles([bigPdf], { maxFileSize: 10 * 1024 }, 'en');

    expect(result.validFiles).toHaveLength(0);
    expect(result.errors[0]).toContain('recommended limit');
  });

  it('maps common PDF failures to user friendly messages', () => {
    expect(getFriendlyPdfError(new Error('encrypted document'), '', 'es')).toContain('protegido');
    expect(getFriendlyPdfError(new Error('Invalid PDF structure'), '', 'en')).toContain('damaged');
  });
});
