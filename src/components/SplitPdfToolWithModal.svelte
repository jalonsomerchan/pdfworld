<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { PDFDocument, degrees } from 'pdf-lib';
  import { saveAs } from 'file-saver';
  import JSZip from 'jszip';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfPageCard from './PdfPageCard.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type ThumbStatus = 'pending' | 'ready' | 'failed';
  type Range = { label: string; pages: number[] };

  export let lang: Lang = 'es';

  const labels = {
    es: {
      title: 'Divide tu PDF por páginas',
      intro: 'Selecciona páginas visualmente, genera una vista previa del PDF extraído y descárgalo cuando lo hayas revisado.',
      dropTitle: 'Arrastra tu PDF aquí', dropActive: 'Suelta el PDF para cargarlo', dropText: 'Suelta el archivo o pulsa para seleccionarlo', fileHelp: 'Un solo PDF · privado · sin subida',
      invalidFile: 'Selecciona un archivo PDF válido.', readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o no ser compatible.', loaded: 'PDF cargado correctamente.', loading: 'Cargando PDF…', rendering: 'Generando miniaturas…',
      selectedFile: 'Archivo seleccionado', pages: 'páginas', page: 'Página', selected: 'páginas seleccionadas', selectAll: 'Seleccionar todas', selectNone: 'Quitar selección', invert: 'Invertir selección', rotateLeft: 'Girar izquierda', rotateRight: 'Girar derecha',
      rangeLabel: 'Atajo por rangos opcional', rangePlaceholder: 'Ejemplo: 1-3,5,8-10', rangeHelp: 'Puedes escribir rangos o seleccionar páginas con las miniaturas.',
      summaryTitle: 'Páginas que se exportarán', noSelection: 'Selecciona una o varias páginas para generar la vista previa.',
      generatePreview: 'Generar vista previa', generating: 'Generando PDF…', download: 'Descargar PDF', splitZip: 'Separar en PDFs individuales', generatingZip: 'Creando ZIP…', clear: 'Limpiar',
      previewTitle: 'Vista previa del PDF dividido', closePreview: 'Cerrar vista previa', previewFallback: 'Tu navegador no puede mostrar la vista previa del PDF. Descárgalo para revisarlo.',
      ready: 'PDF generado correctamente. Revisa la vista previa antes de descargar.', zipReady: 'ZIP generado correctamente. La descarga debería comenzar automáticamente.',
      needFile: 'Primero carga un PDF.', needRange: 'Selecciona al menos una página.', badFormat: 'Formato no válido. Usa páginas o rangos como 1-3,5,8-10.', invalidNumber: 'Los rangos solo pueden contener números de página mayores que cero.', reversedRange: 'El rango {range} no es válido: el inicio debe ser menor o igual que el final.', outOfBounds: 'La página {page} está fuera de límite. Este PDF tiene {total} páginas.', duplicated: 'La página {page} está repetida. Elimina duplicados.', createError: 'No se pudo crear el PDF. Revisa que el archivo no esté protegido o dañado.', zipError: 'No se pudieron crear los PDFs separados.',
      downloadName: 'pdfworld-dividido.pdf', zipDownloadName: 'pdfworld-paginas-separadas.zip',
    },
    en: {
      title: 'Split your PDF by pages',
      intro: 'Select pages visually, generate a preview of the extracted PDF and download it after review.',
      dropTitle: 'Drag your PDF here', dropActive: 'Drop the PDF to load it', dropText: 'Drop the file or click to select it', fileHelp: 'Single PDF · private · no upload',
      invalidFile: 'Select a valid PDF file.', readError: 'The PDF could not be read. It may be damaged, protected or unsupported.', loaded: 'PDF loaded successfully.', loading: 'Loading PDF…', rendering: 'Generating thumbnails…',
      selectedFile: 'Selected file', pages: 'pages', page: 'Page', selected: 'selected pages', selectAll: 'Select all', selectNone: 'Clear selection', invert: 'Invert selection', rotateLeft: 'Rotate left', rotateRight: 'Rotate right',
      rangeLabel: 'Optional range shortcut', rangePlaceholder: 'Example: 1-3,5,8-10', rangeHelp: 'You can type ranges or select pages with thumbnails.',
      summaryTitle: 'Pages to export', noSelection: 'Select one or more pages to generate the preview.',
      generatePreview: 'Generate preview', generating: 'Generating PDF…', download: 'Download PDF', splitZip: 'Split into separate PDFs', generatingZip: 'Creating ZIP…', clear: 'Clear',
      previewTitle: 'Split PDF preview', closePreview: 'Close preview', previewFallback: 'Your browser cannot display the PDF preview. Download it to review it.',
      ready: 'PDF created successfully. Review the preview before downloading.', zipReady: 'ZIP created successfully. The download should start automatically.',
      needFile: 'Load a PDF first.', needRange: 'Select at least one page.', badFormat: 'Invalid format. Use pages or ranges such as 1-3,5,8-10.', invalidNumber: 'Ranges can only contain page numbers greater than zero.', reversedRange: 'Range {range} is invalid: the start must be less than or equal to the end.', outOfBounds: 'Page {page} is out of bounds. This PDF has {total} pages.', duplicated: 'Page {page} is duplicated. Remove duplicates.', createError: 'The PDF could not be created. Check that the file is not protected or damaged.', zipError: 'The separate PDFs could not be created.',
      downloadName: 'pdfworld-split.pdf', zipDownloadName: 'pdfworld-separated-pages.zip',
    },
  } as const;

  let file: File | null = null;
  let sourceBytes: Uint8Array | null = null;
  let pageCount = 0;
  let selectedPages: number[] = [];
  let ranges: Range[] = [];
  let rangeInput = '';
  let thumbUrls: Record<number, string> = {};
  let thumbStatus: Record<number, ThumbStatus> = {};
  let rotations: Record<number, number> = {};
  let pdfJsPromise: Promise<any> | null = null;
  let previewDoc: any = null;
  let renderToken = 0;
  let resultBytes: Uint8Array | null = null;
  let previewUrl = '';
  let isPreviewOpen = false;
  let isLoading = false;
  let isRendering = false;
  let isGenerating = false;
  let isGeneratingZip = false;
  let errorMessage = '';
  let statusMessage = '';
  let workspaceRegion: HTMLDivElement;

  $: t = labels[lang] ?? labels.es;
  $: pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
  $: canGenerate = Boolean(file && sourceBytes && selectedPages.length > 0 && !errorMessage && !isLoading && !isGenerating);
  $: canDownload = Boolean(resultBytes && !isGenerating);

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')]).then(([pdfJs, worker]) => {
        pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfJs;
      });
    }
    return pdfJsPromise;
  }

  async function handleDropzoneFiles(files: File[]) { await loadFile(files[0] ?? null); }
  function handleInvalidFiles() { errorMessage = t.invalidFile; statusMessage = ''; }

  async function loadFile(nextFile: File | null) {
    renderToken += 1;
    cleanupThumbnails(); cleanupPreview(); await destroyPreviewDoc();
    file = nextFile; sourceBytes = null; pageCount = 0; selectedPages = []; ranges = []; rangeInput = ''; thumbUrls = {}; thumbStatus = {}; rotations = {}; errorMessage = ''; statusMessage = '';
    if (!nextFile) return;
    isLoading = true;
    try {
      const bytes = new Uint8Array((await nextFile.arrayBuffer()).slice(0));
      const pdf = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false });
      sourceBytes = bytes;
      pageCount = pdf.getPageCount();
      selectedPages = pageNumbersFromCount(pageCount);
      ranges = pagesToRanges(selectedPages);
      rangeInput = ranges.map((range) => range.label).join(',');
      thumbStatus = Object.fromEntries(selectedPages.map((page) => [page, 'pending']));
      statusMessage = `${t.loaded} ${pageCount} ${t.pages}.`;
      void renderThumbnails(bytes);
      await scrollToWorkspace();
    } catch {
      file = null; sourceBytes = null; pageCount = 0; errorMessage = t.readError;
    } finally { isLoading = false; }
  }

  async function renderThumbnails(bytes: Uint8Array) {
    const token = ++renderToken;
    isRendering = true;
    try {
      const pdfJs = await loadPdfJs();
      previewDoc = await pdfJs.getDocument({ data: bytes.slice(), useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true, disableStream: true }).promise;
      for (let page = 1; page <= previewDoc.numPages; page += 1) {
        if (token !== renderToken || !previewDoc) return;
        await yieldToBrowser();
        try {
          const pdfPage = await previewDoc.getPage(page);
          const url = await renderThumb(pdfPage);
          pdfPage.cleanup();
          if (token !== renderToken) { URL.revokeObjectURL(url); return; }
          if (thumbUrls[page]) URL.revokeObjectURL(thumbUrls[page]);
          thumbUrls = { ...thumbUrls, [page]: url };
          thumbStatus = { ...thumbStatus, [page]: 'ready' };
        } catch { thumbStatus = { ...thumbStatus, [page]: 'failed' }; }
      }
    } catch { thumbStatus = Object.fromEntries(pageNumbers.map((page) => [page, 'failed'])); }
    finally { if (token === renderToken) isRendering = false; }
  }

  async function renderThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.24 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.76));
    if (!blob) throw new Error('No thumbnail blob');
    return URL.createObjectURL(blob);
  }

  function togglePage(page: number) {
    clearResult(); errorMessage = ''; statusMessage = '';
    selectedPages = selectedPages.includes(page) ? selectedPages.filter((item) => item !== page) : [...selectedPages, page].sort((a, b) => a - b);
    syncRanges();
  }
  function selectAll() { clearResult(); selectedPages = [...pageNumbers]; syncRanges(); }
  function clearSelection() { clearResult(); selectedPages = []; ranges = []; rangeInput = ''; }
  function invertSelection() { clearResult(); const set = new Set(selectedPages); selectedPages = pageNumbers.filter((page) => !set.has(page)); syncRanges(); }
  function syncRanges() { ranges = pagesToRanges(selectedPages); rangeInput = ranges.map((range) => range.label).join(','); }

  function handleRangeInput(event: Event) {
    clearResult();
    rangeInput = (event.currentTarget as HTMLInputElement).value;
    const parsed = parseRanges(rangeInput, pageCount);
    selectedPages = parsed.pages;
    ranges = parsed.ranges;
    errorMessage = parsed.error;
    statusMessage = '';
  }

  function parseRanges(input: string, total: number) {
    const value = input.trim();
    const pages: number[] = [];
    const parsedRanges: Range[] = [];
    const seen = new Set<number>();
    if (!value) return { pages, ranges: parsedRanges, error: '' };
    if (!total) return { pages, ranges: parsedRanges, error: t.needFile };
    const chunks = value.split(',').map((chunk) => chunk.trim());
    if (chunks.some((chunk) => !chunk)) return { pages: [], ranges: [], error: t.badFormat };
    for (const chunk of chunks) {
      const match = chunk.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) return { pages: [], ranges: [], error: t.badFormat };
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1) return { pages: [], ranges: [], error: t.invalidNumber };
      if (start > end) return { pages: [], ranges: [], error: t.reversedRange.replace('{range}', chunk) };
      const chunkPages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      for (const page of chunkPages) {
        if (page > total) return { pages: [], ranges: [], error: t.outOfBounds.replace('{page}', String(page)).replace('{total}', String(total)) };
        if (seen.has(page)) return { pages: [], ranges: [], error: t.duplicated.replace('{page}', String(page)) };
        seen.add(page);
      }
      pages.push(...chunkPages);
      parsedRanges.push({ label: start === end ? String(start) : `${start}-${end}`, pages: chunkPages });
    }
    return { pages, ranges: parsedRanges, error: '' };
  }

  function pagesToRanges(pages: number[]): Range[] {
    if (!pages.length) return [];
    const sorted = [...pages].sort((a, b) => a - b);
    const output: Range[] = [];
    let start = sorted[0]; let prev = sorted[0];
    for (const page of sorted.slice(1)) {
      if (page === prev + 1) { prev = page; continue; }
      output.push(makeRange(start, prev)); start = page; prev = page;
    }
    output.push(makeRange(start, prev));
    return output;
  }
  function makeRange(start: number, end: number): Range { return { label: start === end ? String(start) : `${start}-${end}`, pages: Array.from({ length: end - start + 1 }, (_, index) => start + index) }; }
  function pageNumbersFromCount(count: number) { return Array.from({ length: count }, (_, index) => index + 1); }

  function getPagesForExport() {
    if (!file || !sourceBytes) { errorMessage = t.needFile; return null; }
    if (!selectedPages.length) { errorMessage = t.needRange; return null; }
    errorMessage = '';
    return [...selectedPages].sort((a, b) => a - b);
  }

  async function createPdfWithPages(pages: number[]) {
    if (!sourceBytes || !file) throw new Error(t.needFile);
    const sourcePdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
    const outputPdf = await PDFDocument.create();
    const copiedPages = await outputPdf.copyPages(sourcePdf, pages.map((page) => page - 1));
    copiedPages.forEach((page) => outputPdf.addPage(page));
    pages.forEach((pageNumber, index) => {
      const rotation = normalizeRotation(rotations[pageNumber] ?? 0);
      if (!rotation) return;
      const page = outputPdf.getPage(index);
      page.setRotation(degrees(normalizeRotation(page.getRotation().angle + rotation)));
    });
    outputPdf.setTitle(`${file.name} - ${pages.length === 1 ? `${t.page} ${pages[0]}` : pages.join(', ')}`);
    outputPdf.setCreator('PDFWorld'); outputPdf.setProducer('PDFWorld');
    return outputPdf.save({ useObjectStreams: true });
  }

  async function generatePreview() {
    const pages = getPagesForExport();
    if (!pages) return;
    isGenerating = true; statusMessage = ''; clearResult();
    try {
      const bytes = await createPdfWithPages(pages);
      resultBytes = new Uint8Array(bytes);
      previewUrl = createPdfObjectUrl(resultBytes);
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch { errorMessage = t.createError; }
    finally { isGenerating = false; }
  }

  async function splitIntoSeparatePdfs() {
    const pages = getPagesForExport();
    if (!pages) return;
    isGeneratingZip = true; statusMessage = '';
    try {
      const zip = new JSZip();
      const baseName = getBaseFilename();
      for (const page of pages) {
        const pdfBytes = await createPdfWithPages([page]);
        zip.file(`${baseName}-pagina-${String(page).padStart(3, '0')}.pdf`, pdfBytes);
        await yieldToBrowser();
      }
      saveAs(await zip.generateAsync({ type: 'blob' }), getZipOutputFilename());
      statusMessage = t.zipReady;
    } catch { errorMessage = t.zipError; }
    finally { isGeneratingZip = false; }
  }

  function closePreview() { isPreviewOpen = false; }
  function clearTool() { renderToken += 1; cleanupThumbnails(); cleanupPreview(); void destroyPreviewDoc(); file = null; sourceBytes = null; pageCount = 0; selectedPages = []; ranges = []; rangeInput = ''; thumbUrls = {}; thumbStatus = {}; isLoading = false; isRendering = false; isGenerating = false; isGeneratingZip = false; errorMessage = ''; statusMessage = ''; }
  function getBaseFilename() { return file?.name ? file.name.replace(/\.pdf$/i, '').trim() || 'documento' : 'pdfworld'; }
  function getSingleOutputFilename(pages: number[]) { return file?.name ? `${getBaseFilename()}-paginas-${pages.join('_')}.pdf` : t.downloadName; }
  function getZipOutputFilename() { return file?.name ? `${getBaseFilename()}-paginas-separadas.zip` : t.zipDownloadName; }
  function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  function rotatePage(page: number, delta: 90 | -90) { rotations = { ...rotations, [page]: normalizeRotation((rotations[page] ?? 0) + delta) }; if (rotations[page] === 0) { const { [page]: _removed, ...rest } = rotations; rotations = rest; } clearResult(); }
  function thumbStyle(page: number) { const rotation = normalizeRotation(rotations[page] ?? 0); const scale = rotation === 90 || rotation === 270 ? 0.72 : 1; return `transform: rotate(${rotation}deg) scale(${scale});`; }
  function normalizeRotation(value: number) { return ((value % 360) + 360) % 360; }
  function cleanupThumbnails() { Object.values(thumbUrls).forEach((url) => URL.revokeObjectURL(url)); thumbUrls = {}; }
  function cleanupPreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; resultBytes = null; isPreviewOpen = false; }
  async function destroyPreviewDoc() { if (!previewDoc) return; try { await previewDoc.destroy(); } catch {} finally { previewDoc = null; } }
  async function scrollToWorkspace() { await tick(); workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  onDestroy(() => { renderToken += 1; cleanupThumbnails(); cleanupPreview(); void destroyPreviewDoc(); });
</script>

<section class="split-modal-tool" aria-labelledby="split-tool-title">
  <div class="split-modal-tool__hero">
    <div><span>PDFWorld</span><h2 id="split-tool-title">{t.title}</h2><p>{t.intro}</p></div>
    <PdfDropzone title={t.dropTitle} activeTitle={t.dropActive} subtitle={t.dropText} help={t.fileHelp} selectedLabel={file?.name ?? ''} onFiles={handleDropzoneFiles} onInvalidFiles={handleInvalidFiles} />
  </div>

  {#if errorMessage}<div class="split-modal-tool__alert split-modal-tool__alert--error" role="alert">{errorMessage}</div>{/if}
  {#if statusMessage}<div class="split-modal-tool__alert split-modal-tool__alert--success" role="status">{statusMessage}</div>{/if}
  {#if isLoading}<div class="split-modal-tool__alert" role="status">{t.loading}</div>{/if}
  {#if isRendering}<div class="split-modal-tool__alert" role="status">{t.rendering}</div>{/if}

  {#if file && pageCount > 0}
    <div class="split-modal-tool__workspace" bind:this={workspaceRegion}>
      <aside class="split-modal-tool__sidebar">
        <section class="split-modal-tool__panel split-modal-tool__file"><span>PDF</span><div><h3>{t.selectedFile}</h3><strong>{file.name}</strong><p>{formatSize(file.size)} · {pageCount} {t.pages}</p></div></section>
        <section class="split-modal-tool__panel"><h3>{t.summaryTitle}</h3>{#if ranges.length}<div class="split-modal-tool__chips">{#each ranges as range}<span>{range.label}</span>{/each}</div><p>{selectedPages.length} {t.pages}</p>{:else}<p>{t.noSelection}</p>{/if}</section>
        <section class="split-modal-tool__panel"><label for="split-ranges">{t.rangeLabel}</label><input id="split-ranges" value={rangeInput} placeholder={t.rangePlaceholder} aria-invalid={Boolean(errorMessage)} on:input={handleRangeInput} /><p>{t.rangeHelp}</p></section>
        <div class="split-modal-tool__actions"><button type="button" class="split-modal-tool__secondary" on:click={clearTool}>{t.clear}</button><button type="button" class="split-modal-tool__primary" disabled={!canGenerate} on:click={generatePreview}>{isGenerating ? t.generating : t.generatePreview}</button><button type="button" class="split-modal-tool__primary split-modal-tool__primary--dark" disabled={!resultBytes || isGenerating} on:click={() => (isPreviewOpen = true)}>{t.download}</button><button type="button" class="split-modal-tool__secondary" disabled={!canGenerate} on:click={splitIntoSeparatePdfs}>{isGeneratingZip ? t.generatingZip : t.splitZip}</button></div>
      </aside>

      <section class="split-modal-tool__pages" aria-label={t.title}>
        <div class="split-modal-tool__quick"><strong>{selectedPages.length} {t.selected}</strong><div><button type="button" on:click={selectAll}>{t.selectAll}</button><button type="button" on:click={clearSelection}>{t.selectNone}</button><button type="button" on:click={invertSelection}>{t.invert}</button></div></div>
        <div class="split-modal-tool__grid">
          {#each pageNumbers as page}
            <PdfPageCard
              pageNumber={page}
              title={`${t.page} ${page}`}
              thumbnailUrl={thumbUrls[page] ?? ''}
              thumbnailStatus={thumbStatus[page] ?? 'pending'}
              selected={selectedPages.includes(page)}
              removed={!selectedPages.includes(page)}
              rotation={rotations[page] ?? 0}
              selectLabel={t.page}
              rotateLeftLabel={t.rotateLeft}
              rotateRightLabel={t.rotateRight}
              removeLabel="×"
              restoreLabel="+"
              onToggle={() => togglePage(page)}
              onRotateLeft={() => rotatePage(page, -90)}
              onRotateRight={() => rotatePage(page, 90)}
              onRemove={() => togglePage(page)}
            />
          {/each}
        </div>
      </section>
    </div>
  {/if}
</section>

<PdfResultModal
  open={isPreviewOpen && Boolean(previewUrl)}
  pdfUrl={previewUrl}
  filename={getSingleOutputFilename(selectedPages)}
  title={t.previewTitle}
  description={t.ready}
  downloadLabel={t.download}
  closeLabel={t.closePreview}
  on:close={closePreview}
/>

<style>
  .split-modal-tool{display:grid;gap:22px;margin:32px 0 64px}.split-modal-tool__hero,.split-modal-tool__workspace,.split-modal-tool__panel,.split-modal-tool__alert{border:1px solid #e2e8f0;border-radius:28px;background:rgba(255,255,255,.9);box-shadow:0 24px 70px rgba(15,23,42,.08)}.split-modal-tool__hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:22px;align-items:center;padding:24px;background:radial-gradient(circle at top right,rgba(239,68,68,.15),transparent 36%),linear-gradient(135deg,#fff,rgba(248,250,252,.92))}.split-modal-tool__hero h2{margin:0 0 8px;letter-spacing:-.04em}.split-modal-tool__hero p,.split-modal-tool__panel p{margin:0;color:#64748b}.split-modal-tool__hero span{display:inline-flex;margin-bottom:8px;padding:6px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:.78rem;font-weight:950}.split-modal-tool__alert{padding:15px 17px;color:#475569;font-weight:850}.split-modal-tool__alert--error{border-color:#fecaca;background:#fff1f2;color:#991b1b}.split-modal-tool__alert--success{border-color:#bbf7d0;background:#f0fdf4;color:#166534}.split-modal-tool__workspace{display:grid;grid-template-columns:330px minmax(0,1fr);gap:20px;padding:18px;align-items:start}.split-modal-tool__sidebar{position:sticky;top:18px;display:grid;gap:14px}.split-modal-tool__panel{padding:16px}.split-modal-tool__panel h3{margin:0 0 10px}.split-modal-tool__file{display:flex;gap:12px;align-items:flex-start}.split-modal-tool__file>span{display:grid;width:48px;height:58px;place-items:center;border-radius:14px;background:#fff1f2;color:#dc2626;font-size:.72rem;font-weight:950}.split-modal-tool__file strong{display:block;overflow:hidden;max-width:220px;text-overflow:ellipsis;white-space:nowrap}.split-modal-tool__chips{display:flex;flex-wrap:wrap;gap:8px}.split-modal-tool__chips span{display:inline-flex;padding:7px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:950}.split-modal-tool__panel label{display:block;margin-bottom:8px;font-weight:950}.split-modal-tool__panel input{width:100%;box-sizing:border-box;min-height:46px;border:2px solid #e2e8f0;border-radius:16px;padding:10px 12px;font:inherit;font-weight:850}.split-modal-tool__panel input:focus{border-color:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.12);outline:none}.split-modal-tool__panel input[aria-invalid=true]{border-color:#ef4444}.split-modal-tool__actions{display:grid;gap:10px}.split-modal-tool button{border:0;cursor:pointer;font:inherit;font-weight:950;transition:transform 140ms ease,opacity 140ms ease}.split-modal-tool__primary,.split-modal-tool__secondary{min-height:46px;padding:12px 16px;border-radius:999px}.split-modal-tool__primary{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;box-shadow:0 16px 34px rgba(239,68,68,.24)}.split-modal-tool__primary--dark{background:linear-gradient(135deg,#0f172a,#334155);box-shadow:0 16px 34px rgba(15,23,42,.22)}.split-modal-tool__secondary{background:#e2e8f0;color:#334155}.split-modal-tool button:hover:not(:disabled){transform:translateY(-1px)}.split-modal-tool button:disabled{cursor:not-allowed;opacity:.45}.split-modal-tool__pages{display:grid;gap:14px}.split-modal-tool__quick{display:flex;justify-content:space-between;gap:12px;align-items:center}.split-modal-tool__quick div{display:flex;flex-wrap:wrap;gap:8px}.split-modal-tool__quick button{padding:8px 12px;border-radius:999px;background:#e2e8f0;color:#334155}.split-modal-tool__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:12px}.split-modal-tool__page{display:grid;gap:10px;padding:10px;border:2px solid #e2e8f0;border-radius:20px;background:#fff;color:#0f172a;text-align:left;box-shadow:0 10px 24px rgba(15,23,42,.05)}.split-modal-tool__page--selected{border-color:#ef4444;background:#fff1f2;color:#991b1b;box-shadow:0 16px 34px rgba(239,68,68,.15)}.split-modal-tool__thumb{display:grid;min-height:150px;place-items:center;overflow:hidden;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.split-modal-tool__thumb img{display:block;width:100%;height:auto}.split-modal-tool__placeholder{display:grid;width:100%;min-height:130px;place-items:center;color:#94a3b8;background:#f1f5f9;font-size:1.25rem;font-weight:950}.split-modal-tool__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:split-loading 1.4s ease-in-out infinite}.split-modal-tool__page>span:last-child{display:flex;justify-content:space-between;align-items:center}.split-modal-tool__page small{color:#64748b;text-transform:uppercase;font-weight:850}.pdf-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px}.pdf-modal__backdrop{position:absolute;inset:0;background:rgba(15,23,42,.72);backdrop-filter:blur(6px)}.pdf-modal__panel{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1120px,96vw);height:min(820px,92vh);overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35)}.pdf-modal__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #e2e8f0}.pdf-modal__header h2{margin:0;font-size:1.05rem}.pdf-modal__header div{display:flex;gap:10px}.pdf-modal__viewer{width:100%;height:100%;border:0;background:#f8fafc}.pdf-modal__download,.pdf-modal__close{border:0;cursor:pointer;font:inherit;font-weight:950}.pdf-modal__download{min-height:40px;padding:9px 14px;border-radius:999px;background:#ef4444;color:#fff}.pdf-modal__close{display:grid;width:40px;height:40px;place-items:center;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:1.35rem;line-height:1}@keyframes split-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (prefers-reduced-motion:reduce){.split-modal-tool button,.split-modal-tool__placeholder--loading{transition:none;animation:none}}@media (max-width:860px){.split-modal-tool__hero,.split-modal-tool__workspace{grid-template-columns:1fr}.split-modal-tool__sidebar{position:static}.split-modal-tool__quick{align-items:flex-start;flex-direction:column}.pdf-modal{padding:10px}.pdf-modal__panel{height:94vh;border-radius:18px}}
</style>
