<script lang="ts">
  import { onDestroy } from 'svelte';
  import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, getFriendlyPdfError, getPdfBaseFilename, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type Position = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Configura la marca de agua', intro: 'Añade texto visible a todas o algunas páginas sin subir el PDF.', drop: 'Arrastra un PDF aquí', active: 'Suelta el PDF', subtitle: 'Suelta el archivo o pulsa para seleccionarlo', help: 'Solo PDF · procesamiento local', text: 'Texto', placeholder: 'CONFIDENCIAL', size: 'Tamaño', opacity: 'Opacidad', rotation: 'Rotación', position: 'Posición', pages: 'Páginas', pagesHelp: 'Vacío para todas. Ejemplo: 1,3-5,8', allPages: 'Todas las páginas', selectedPages: 'Páginas seleccionadas', generate: 'Generar PDF', generating: 'Generando…', download: 'Descargar PDF', ready: 'PDF generado correctamente.', invalid: 'Selecciona un PDF válido.', missingText: 'Escribe el texto de la marca de agua.', invalidPages: 'No hay páginas válidas para ese rango.', error: 'No se pudo añadir la marca de agua.', file: 'PDF seleccionado', change: 'Cambiar PDF', preview: 'Vista previa con marca de agua', previewDesc: 'Comprueba el resultado antes de descargar.', close: 'Cerrar', open: 'Abrir en pestaña', positions: { center: 'Centro', 'top-left': 'Arriba izquierda', 'top-right': 'Arriba derecha', 'bottom-left': 'Abajo izquierda', 'bottom-right': 'Abajo derecha' } },
    en: {
      title: 'Configure the watermark', intro: 'Add visible text to all or selected pages without uploading the PDF.', drop: 'Drag a PDF here', active: 'Drop the PDF', subtitle: 'Drop the file or click to select it', help: 'PDF only · local processing', text: 'Text', placeholder: 'CONFIDENTIAL', size: 'Size', opacity: 'Opacity', rotation: 'Rotation', position: 'Position', pages: 'Pages', pagesHelp: 'Empty for all. Example: 1,3-5,8', allPages: 'All pages', selectedPages: 'Selected pages', generate: 'Generate PDF', generating: 'Generating…', download: 'Download PDF', ready: 'PDF created successfully.', invalid: 'Select a valid PDF.', missingText: 'Type the watermark text.', invalidPages: 'No valid pages found for that range.', error: 'The watermark could not be added.', file: 'Selected PDF', change: 'Change PDF', preview: 'Watermarked PDF preview', previewDesc: 'Check the result before downloading.', close: 'Close', open: 'Open in tab', positions: { center: 'Center', 'top-left': 'Top left', 'top-right': 'Top right', 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right' } },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let watermarkText = '';
  let fontSize = 54;
  let opacity = 0.22;
  let rotation = -35;
  let position: Position = 'center';
  let pageRanges = '';
  let isGenerating = false;
  let statusMessage = '';
  let errorMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;

  const positions: Position[] = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

  $: t = copy[lang] ?? copy.es;
  $: selectedPages = parsePageSelection(pageRanges, pageCount);
  $: affectedLabel = pageRanges.trim() ? `${t.selectedPages}: ${selectedPages.map((page) => page + 1).join(', ') || '—'}` : t.allPages;
  $: canGenerate = Boolean(file && watermarkText.trim()) && !isGenerating;
  $: downloadName = `${getPdfBaseFilename(file, lang === 'en' ? 'watermarked-pdf' : 'pdf-marca-agua')}-marca-de-agua.pdf`;

  async function addFiles(files: File[]) {
    const selectedFile = files[0];
    if (!selectedFile) return;
    clearResult();
    errorMessage = '';
    statusMessage = '';

    try {
      const pdf = await PDFDocument.load(await selectedFile.arrayBuffer(), { ignoreEncryption: false });
      file = selectedFile;
      pageCount = pdf.getPageCount();
    } catch (error) {
      file = null;
      pageCount = 0;
      errorMessage = getFriendlyPdfError(error, t.invalid);
    }
  }

  function handleInvalidFiles() {
    errorMessage = t.invalid;
  }

  async function generateWatermark() {
    if (!file) {
      errorMessage = t.invalid;
      return;
    }
    if (!watermarkText.trim()) {
      errorMessage = t.missingText;
      return;
    }
    if (selectedPages.length === 0) {
      errorMessage = t.invalidPages;
      return;
    }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pages = pdf.getPages();
      const text = watermarkText.trim();

      for (const pageIndex of selectedPages) {
        const page = pages[pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize, { descender: false });
        const coords = getCoordinates(position, width, height, textWidth, textHeight);
        page.drawText(text, { ...coords, size: fontSize, font, color: rgb(0.12, 0.12, 0.12), opacity, rotate: degrees(rotation) });
        await yieldToBrowser();
      }

      previewUrl = createPdfObjectUrl(await pdf.save({ useObjectStreams: true }));
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch (error) {
      errorMessage = getFriendlyPdfError(error, t.error);
    } finally {
      isGenerating = false;
    }
  }

  function parsePageSelection(value: string, total: number) {
    if (total <= 0) return [];
    if (!value.trim()) return Array.from({ length: total }, (_, index) => index);
    const selected = new Set<number>();

    for (const token of value.split(',')) {
      const part = token.trim();
      const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const from = Math.min(Number(range[1]), Number(range[2]));
        const to = Math.max(Number(range[1]), Number(range[2]));
        for (let page = from; page <= to; page += 1) addPage(selected, page, total);
      } else if (/^\d+$/.test(part)) {
        addPage(selected, Number(part), total);
      }
    }

    return [...selected].sort((a, b) => a - b);
  }

  function addPage(selected: Set<number>, page: number, total: number) {
    if (page >= 1 && page <= total) selected.add(page - 1);
  }

  function getCoordinates(target: Position, width: number, height: number, textWidth: number, textHeight: number) {
    const margin = Math.max(28, fontSize * 0.75);
    const center = { x: (width - textWidth) / 2, y: (height - textHeight) / 2 };
    const map = {
      center,
      'top-left': { x: margin, y: height - margin - textHeight },
      'top-right': { x: width - margin - textWidth, y: height - margin - textHeight },
      'bottom-left': { x: margin, y: margin },
      'bottom-right': { x: width - margin - textWidth, y: margin },
    } satisfies Record<Position, { x: number; y: number }>;
    return map[target] ?? center;
  }

  function clearFile() {
    file = null;
    pageCount = 0;
    errorMessage = '';
    statusMessage = '';
    clearResult();
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    isPreviewOpen = false;
  }

  onDestroy(clearResult);
</script>

<section class="watermark-tool" aria-labelledby="watermark-title">
  <header class="watermark-tool__header">
    <div>
      <span>FácilPDF</span>
      <h2 id="watermark-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>
    <strong aria-hidden="true">PDF</strong>
  </header>

  <PdfDropzone title={t.drop} activeTitle={t.active} subtitle={t.subtitle} help={t.help} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />

  {#if errorMessage}<p class="watermark-tool__message watermark-tool__message--error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="watermark-tool__message watermark-tool__message--success" role="status">{statusMessage}</p>{/if}

  {#if file}
    <div class="watermark-tool__panel">
      <aside>
        <span>{t.file}</span>
        <strong>{file.name}</strong>
        <small>{formatFileSize(file.size)} · {pageCount} páginas</small>
        <button type="button" on:click={clearFile}>{t.change}</button>
      </aside>

      <form on:submit|preventDefault={generateWatermark}>
        <label class="wide"><span>{t.text}</span><input bind:value={watermarkText} type="text" maxlength="120" placeholder={t.placeholder} /></label>
        <label><span>{t.size}: {fontSize}px</span><input bind:value={fontSize} type="range" min="12" max="140" /></label>
        <label><span>{t.opacity}: {Math.round(opacity * 100)}%</span><input bind:value={opacity} type="range" min="0.05" max="1" step="0.05" /></label>
        <label><span>{t.rotation}: {rotation}°</span><input bind:value={rotation} type="range" min="-90" max="90" /></label>
        <label><span>{t.position}</span><select bind:value={position}>{#each positions as item}<option value={item}>{t.positions[item]}</option>{/each}</select></label>
        <label class="wide"><span>{t.pages}</span><input bind:value={pageRanges} type="text" placeholder="1,3-5" /><small>{t.pagesHelp}</small></label>
        <p class="wide summary">{affectedLabel}</p>
        <button class="primary" type="submit" disabled={!canGenerate}>{isGenerating ? t.generating : t.generate}</button>
        <button class="secondary" type="button" disabled={!previewUrl} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
      </form>
    </div>
  {/if}
</section>

<PdfResultModal open={isPreviewOpen && Boolean(previewUrl)} pdfUrl={previewUrl} filename={downloadName} title={t.preview} description={t.previewDesc} downloadLabel={t.download} closeLabel={t.close} openLabel={t.open} on:close={() => (isPreviewOpen = false)} />

<style>
  .watermark-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 30px 90px rgba(15,23,42,.11)}.watermark-tool__header{display:flex;align-items:center;justify-content:space-between;gap:18px}.watermark-tool__header h2{margin:0;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.04em}.watermark-tool__header p{margin:.45rem 0 0;color:#64748b}.watermark-tool__header span{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:.78rem;font-weight:950}.watermark-tool__header>strong{display:grid;width:96px;height:96px;place-items:center;border:4px solid rgba(185,28,28,.35);border-radius:20px;color:#b91c1c;transform:rotate(-12deg)}.watermark-tool__message{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.watermark-tool__message--error{background:#fff1f2;color:#991b1b}.watermark-tool__message--success{background:#ecfdf5;color:#166534}.watermark-tool__panel{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}.watermark-tool aside,.watermark-tool form{border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.07)}.watermark-tool aside{display:grid;gap:8px;padding:18px}.watermark-tool aside strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.watermark-tool aside span,.watermark-tool label span{color:#475569;font-size:.86rem;font-weight:900}.watermark-tool small{color:#64748b}.watermark-tool form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:18px}.watermark-tool label{display:grid;gap:8px}.watermark-tool .wide,.watermark-tool .primary,.watermark-tool .secondary{grid-column:1/-1}.watermark-tool input,.watermark-tool select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:16px;background:#fff;color:#0f172a;font:inherit;font-weight:750}.watermark-tool input[type='text'],.watermark-tool select{min-height:48px;padding:12px 14px}.watermark-tool input[type='range']{accent-color:#ef4444}.watermark-tool button{min-height:46px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:950}.watermark-tool button:disabled{cursor:not-allowed;opacity:.45}.watermark-tool aside button,.watermark-tool .secondary{background:#e2e8f0;color:#0f172a}.watermark-tool .primary{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff}.watermark-tool .summary{margin:0;padding:12px 14px;border-radius:16px;background:#f8fafc;font-weight:900}@media (max-width:860px){.watermark-tool__header,.watermark-tool__panel{grid-template-columns:1fr;display:grid}.watermark-tool form{grid-template-columns:1fr}.watermark-tool__header>strong{width:82px;height:82px}}
</style>
