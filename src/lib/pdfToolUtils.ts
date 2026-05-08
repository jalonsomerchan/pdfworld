export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.requestIdleCallback?.(() => resolve(), { timeout: 120 }) ?? window.setTimeout(resolve, 0);
  });
}

export function createPdfObjectUrl(bytes: Uint8Array | ArrayBuffer | Blob) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getPdfBaseFilename(file: File | null, fallback = 'documento') {
  if (!file?.name) return fallback;
  return file.name.replace(/\.pdf$/i, '').trim() || fallback;
}

export function getFriendlyPdfError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const text = `${error.name} ${error.message}`;

    if (/password|encrypted/i.test(text)) {
      return 'El PDF está protegido con contraseña o no permite esta operación en navegador.';
    }

    if (/invalid|corrupt|damaged/i.test(text)) {
      return 'El PDF parece estar dañado o no tiene un formato válido.';
    }

    return error.message || fallback;
  }

  return fallback;
}
