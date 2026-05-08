import { PDFDocument, degrees } from 'pdf-lib';

export type RotationDegrees = 90 | 180 | 270;
export type PageRotationMap = Record<number, number>;

export interface RotatePdfOptions {
  file: File;
  pages: number[];
  rotation: RotationDegrees;
}

export interface RotatePdfWithMapOptions {
  file: File;
  rotations: PageRotationMap;
  pages?: number[];
}

export interface RotatePdfResult {
  bytes: Uint8Array;
  originalSize: number;
  outputSize: number;
  pageCount: number;
  rotatedPages: number[];
  rotation?: RotationDegrees;
  rotations?: PageRotationMap;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const sourceBytes = await fileToBytes(file);
  const pdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  return pdf.getPageCount();
}

export async function rotatePdfInBrowser({ file, pages, rotation }: RotatePdfOptions): Promise<RotatePdfResult> {
  const rotations = Object.fromEntries([...new Set(pages)].map((page) => [page, rotation]));
  const result = await rotatePdfWithMapInBrowser({ file, rotations });

  return {
    ...result,
    rotation,
  };
}

export async function rotatePdfWithMapInBrowser({ file, rotations, pages }: RotatePdfWithMapOptions): Promise<RotatePdfResult> {
  const sourceBytes = await fileToBytes(file);
  const sourcePdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  const pageCount = sourcePdf.getPageCount();
  const selectedPages = normalizePages(pages, pageCount);
  const normalizedRotations = normalizeRotationMap(rotations, pageCount);
  const rotatedPages = Object.keys(normalizedRotations).map(Number).sort((a, b) => a - b);
  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, selectedPages.map((page) => page - 1));

  copiedPages.forEach((page, index) => {
    const pageNumber = selectedPages[index];
    const rotation = normalizedRotations[pageNumber] ?? 0;
    if (rotation) {
      page.setRotation(degrees(normalizeDegrees(page.getRotation().angle + rotation)));
    }
    outputPdf.addPage(page);
  });

  outputPdf.setTitle(`Rotado - ${file.name}`);
  outputPdf.setCreator('FácilPDF');
  outputPdf.setProducer('FácilPDF');

  const outputBytes = await outputPdf.save({ useObjectStreams: true });

  return {
    bytes: outputBytes,
    originalSize: sourceBytes.byteLength,
    outputSize: outputBytes.byteLength,
    pageCount: selectedPages.length,
    rotatedPages,
    rotations: normalizedRotations,
  };
}

function normalizePages(pages: number[] | undefined, totalPages: number) {
  const selected = pages?.length ? [...new Set(pages)].sort((a, b) => a - b) : Array.from({ length: totalPages }, (_, index) => index + 1);

  selected.forEach((page) => {
    if (!Number.isSafeInteger(page) || page < 1 || page > totalPages) {
      throw new Error(`Page ${page} is outside the PDF page range.`);
    }
  });

  if (selected.length === 0) {
    throw new Error('At least one page is required.');
  }

  return selected;
}

function normalizeRotationMap(rotations: PageRotationMap, pageCount: number) {
  const normalized: PageRotationMap = {};

  Object.entries(rotations).forEach(([pageKey, rotationValue]) => {
    const pageNumber = Number(pageKey);
    const normalizedRotation = normalizeDegrees(rotationValue);

    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Page ${pageNumber} is outside the PDF page range.`);
    }

    if (normalizedRotation === 0) return;
    normalized[pageNumber] = normalizedRotation;
  });

  return normalized;
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

async function fileToBytes(file: File) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer.slice(0));
}
