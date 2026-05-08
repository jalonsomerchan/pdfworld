import { PDFDocument, degrees } from 'pdf-lib';

export type RotationDegrees = 90 | 180 | 270;

export interface RotatePdfOptions {
  file: File;
  pages: number[];
  rotation: RotationDegrees;
}

export interface RotatePdfResult {
  bytes: Uint8Array;
  originalSize: number;
  outputSize: number;
  pageCount: number;
  rotatedPages: number[];
  rotation: RotationDegrees;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const sourceBytes = await fileToBytes(file);
  const pdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  return pdf.getPageCount();
}

export async function rotatePdfInBrowser({ file, pages, rotation }: RotatePdfOptions): Promise<RotatePdfResult> {
  const sourceBytes = await fileToBytes(file);
  const pdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
  const pageCount = pdf.getPageCount();
  const uniquePages = [...new Set(pages)].sort((a, b) => a - b);

  uniquePages.forEach((pageNumber) => {
    if (pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`Page ${pageNumber} is outside the PDF page range.`);
    }

    const page = pdf.getPage(pageNumber - 1);
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees(normalizeDegrees(currentRotation + rotation)));
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
    rotatedPages: uniquePages,
    rotation,
  };
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

async function fileToBytes(file: File) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer.slice(0));
}
