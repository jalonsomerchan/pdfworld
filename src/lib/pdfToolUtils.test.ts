import { describe, expect, it } from 'vitest';
import { formatFileSize, getFriendlyPdfError, getPdfBaseFilename } from './pdfToolUtils';

describe('formatFileSize', () => {
  it('formats small byte values as at least 1 KB', () => {
    expect(formatFileSize(0)).toBe('1 KB');
    expect(formatFileSize(512)).toBe('1 KB');
  });

  it('formats kilobytes without decimals', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('2 KB');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('getPdfBaseFilename', () => {
  it('returns fallback when there is no file', () => {
    expect(getPdfBaseFilename(null)).toBe('documento');
    expect(getPdfBaseFilename(null, 'archivo')).toBe('archivo');
  });

  it('removes the pdf extension case-insensitively', () => {
    const file = new File(['test'], 'Contrato.PDF', { type: 'application/pdf' });

    expect(getPdfBaseFilename(file)).toBe('Contrato');
  });

  it('returns fallback for empty filenames after cleanup', () => {
    const file = new File(['test'], '.pdf', { type: 'application/pdf' });

    expect(getPdfBaseFilename(file, 'sin-nombre')).toBe('sin-nombre');
  });
});

describe('getFriendlyPdfError', () => {
  it('returns a password message for encrypted PDFs', () => {
    expect(getFriendlyPdfError(new Error('Password required'), 'Fallback')).toBe(
      'El PDF está protegido con contraseña o no permite esta operación en navegador.',
    );
  });

  it('returns a damaged PDF message for invalid or corrupt PDFs', () => {
    expect(getFriendlyPdfError(new Error('Invalid PDF structure'), 'Fallback')).toBe(
      'El PDF parece estar dañado o no tiene un formato válido.',
    );
  });

  it('returns fallback for unknown non-error values', () => {
    expect(getFriendlyPdfError('unknown', 'Error genérico')).toBe('Error genérico');
  });
});
