import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PDF_TOOL_LIMITS,
  formatFileSize,
  getFriendlyPdfError,
  validatePdfFiles,
} from './pdfToolUtils';

function makeFile(name: string, size: number, type = 'application/pdf') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('formatFileSize', () => {
  it('formats zero and small values defensively', () => {
    expect(formatFileSize(0)).toBe('0 KB');
    expect(formatFileSize(512)).toBe('1 KB');
  });

  it('formats megabytes and gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });
});

describe('validatePdfFiles', () => {
  it('accepts PDF files by MIME type or extension', () => {
    const pdf = makeFile('ok.pdf', 1024);
    const octetPdf = makeFile('scanned.PDF', 1024, 'application/octet-stream');

    const result = validatePdfFiles([pdf, octetPdf], {}, 'es');

    expect(result.validFiles).toEqual([pdf, octetPdf]);
    expect(result.errors).toEqual([]);
  });

  it('reports invalid, empty and oversized files with readable messages', () => {
    const result = validatePdfFiles(
      [makeFile('notes.txt', 1024, 'text/plain'), makeFile('empty.pdf', 0), makeFile('big.pdf', 12 * 1024)],
      { maxFileSize: 10 * 1024, maxTotalSize: 100 * 1024, maxFiles: 10 },
      'es',
    );

    expect(result.validFiles).toHaveLength(0);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Solo se admiten archivos PDF válidos.',
        'El archivo está vacío y no se puede procesar.',
        'El archivo pesa 12 KB. El límite recomendado para esta herramienta es 10 KB.',
      ]),
    );
  });

  it('reports total size and file count limits without dropping otherwise valid PDFs', () => {
    const files = [makeFile('one.pdf', 10 * 1024), makeFile('two.pdf', 10 * 1024), makeFile('three.pdf', 10 * 1024)];

    const result = validatePdfFiles(
      files,
      { maxFiles: 2, maxTotalSize: 20 * 1024, maxFileSize: DEFAULT_PDF_TOOL_LIMITS.maxFileSize },
      'en',
    );

    expect(result.validFiles).toEqual(files);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'You selected too many files. The recommended limit is 2.',
        'The selected files are 30 KB. Reduce the selection below 20 KB.',
      ]),
    );
  });
});

describe('getFriendlyPdfError', () => {
  it('maps common PDF failures to user friendly messages', () => {
    expect(getFriendlyPdfError(new Error('encrypted document'), '', 'es')).toContain('protegido');
    expect(getFriendlyPdfError(new Error('Invalid XRef table'), '', 'en')).toContain('damaged');
    expect(getFriendlyPdfError(new Error('Out of memory'), '', 'en')).toContain('memory');
  });

  it('uses fallback for unknown errors', () => {
    expect(getFriendlyPdfError('unknown', 'Fallback message', 'en')).toBe('Fallback message');
  });
});
