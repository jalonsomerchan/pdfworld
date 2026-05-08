import { PDFDocument } from 'pdf-lib';

export interface DeletePagesPdfOptions {
  file: File;
  pagesToDelete: number[];
}

export interface DeletePagesPdfResult {
  bytes: Uint8Array;
  originalSize: number;
  outputSize: number;
  originalPageCount: number;
  outputPageCount: number;
  deletedPages: number[];
  keptPages: number[];
}

export async function getPdfPageCount(file: File): Promise<number> {
  const sourceBytes = await fileToBytes(file);
  const pdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  return pdf.getPageCount();
}

export async function deletePagesFromPdfInBrowser({ file, pagesToDelete }: DeletePagesPdfOptions): Promise<DeletePagesPdfResult> {
  const sourceBytes = await fileToBytes(file);
  const sourcePdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  const originalPageCount = sourcePdf.getPageCount();
  const deletedPages = normalizePages(pagesToDelete, originalPageCount);
  const deletedSet = new Set(deletedPages);
  const keptPages = Array.from({ length: originalPageCount }, (_, index) => index + 1).filter((page) => !deletedSet.has(page));

  if (keptPages.length === 0) {
    throw new Error('Cannot delete all PDF pages.');
  }

  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, keptPages.map((page) => page - 1));
  copiedPages.forEach((page) => outputPdf.addPage(page));
  outputPdf.setTitle(`Sin páginas - ${file.name}`);
  outputPdf.setCreator('PDFWorld');
  outputPdf.setProducer('PDFWorld');

  const outputBytes = await outputPdf.save({ useObjectStreams: true });

  return {
    bytes: outputBytes,
    originalSize: sourceBytes.byteLength,
    outputSize: outputBytes.byteLength,
    originalPageCount,
    outputPageCount: keptPages.length,
    deletedPages,
    keptPages,
  };
}

function normalizePages(pages: number[], totalPages: number) {
  const uniquePages = [...new Set(pages)].sort((a, b) => a - b);

  uniquePages.forEach((page) => {
    if (!Number.isSafeInteger(page) || page < 1 || page > totalPages) {
      throw new Error(`Page ${page} is outside the PDF page range.`);
    }
  });

  return uniquePages;
}

async function fileToBytes(file: File) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer.slice(0));
}
