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

export async function rotatePdfWithMapInBrowser({ file, rotations }: RotatePdfWithMapOptions): Promise<RotatePdfResult> {
  const sourceBytes = await fileToBytes(file);
  const pdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  const pageCount = pdf.getPageCount();
  const normalizedRotations = normalizeRotationMap(rotations, pageCount);
  const rotatedPages = Object.keys(normalizedRotations).map(Number).sort((a, b) => a - b);

  rotatedPages.forEach((pageNumber) => {
    const page = pdf.getPage(pageNumber - 1);
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees(normalizeDegrees(currentRotation + normalizedRotations[pageNumber])));
  });

  pdf.setTitle(`Rotado - ${file.name}`);
  pdf.setCreator('PDFWorld');
  pdf.setProducer('PDFWorld');

  const outputBytes = await pdf.save({ useObjectStreams: true });

  return {
    bytes: outputBytes,
    originalSize: sourceBytes.byteLength,
    outputSize: outputBytes.byteLength,
    pageCount,
    rotatedPages,
    rotations: normalizedRotations,
  };
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
