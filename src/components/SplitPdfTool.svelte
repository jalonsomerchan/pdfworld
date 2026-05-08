<script lang="ts">
  import { PDFDocument } from 'pdf-lib';
  import { saveAs } from 'file-saver';
  import JSZip from 'jszip';
  import PdfDropzone from './PdfDropzone.svelte';

  type Lang = 'es' | 'en';

  type ParsedRange = {
    label: string;
    pages: number[];
  };

  export let lang: Lang = 'es';

  const labels = {
    es: {
      eyebrow: 'Procesamiento local',
      title: 'Divide tu PDF por páginas',
      description: 'Carga un único PDF, selecciona visualmente las páginas que quieres extraer y descarga un documento único o un ZIP con PDFs separados. El archivo no se sube a ningún servidor.',
      dropTitle: 'Arrastra tu PDF aquí',
      dropActive: 'Suelta el PDF para cargarlo',
      dropText: 'Suelta el archivo o pulsa para seleccionarlo',
      fileHelp: 'Un solo PDF · privado · sin subida · navegador',
      invalidFile: 'Selecciona un archivo PDF válido.',
      readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o no ser compatible.',
      loaded: 'PDF cargado correctamente.',
      pages: 'páginas',
      page: 'Página',
      pageCountLabel: 'Páginas detectadas',
      selectedFile: 'Archivo seleccionado',
      selectorTitle: 'Selecciona las páginas',
      selectorHelp: 'Pulsa sobre cada página para incluirla o quitarla de la exportación. El orden será siempre el orden original del PDF.',
      selectedSummary: 'páginas seleccionadas',
      selectAll: 'Seleccionar todas',
      selectNone: 'Quitar selección',
      invertSelection: 'Invertir selección',
      rangeLabel: 'Atajo por rangos opcional',
      rangePlaceholder: 'Ejemplo: 1-3,5,8-10',
      rangeHelp: 'También puedes escribir rangos para marcar páginas automáticamente.',
      previewTitle: 'Páginas que se exportarán',
      noPreview: 'Selecciona una o varias páginas para activar la descarga.',
      splitSingle: 'Descargar como un único PDF',
      splitSeparate: 'Separar en PDFs individuales',
      splitting: 'Creando PDF…',
      splittingZip: 'Creando ZIP…',
      clear: 'Limpiar',
      ready: 'PDF creado correctamente. La descarga debería comenzar automáticamente.',
      zipReady: 'ZIP creado correctamente con los PDF separados. La descarga debería comenzar automáticamente.',
      needFile: 'Primero carga un PDF.',
      needRange: 'Selecciona al menos una página.',
      badFormat: 'Formato no válido. Usa páginas o rangos como 1-3,5,8-10.',
      invalidNumber: 'Los rangos solo pueden contener números de página mayores que cero.',
      reversedRange: 'El rango {range} no es válido: el inicio debe ser menor o igual que el final.',
      outOfBounds: 'La página {page} está fuera de límite. Este PDF tiene {total} páginas.',
      duplicated: 'La página {page} está repetida. Elimina duplicados para evitar resultados ambiguos.',
      createError: 'No se pudo crear el PDF. Revisa que el archivo no esté protegido o dañado.',
      zipError: 'No se pudieron crear los PDF separados. Revisa que el archivo no esté protegido o dañado.',
      downloadName: 'pdfworld-dividido.pdf',
      zipDownloadName: 'pdfworld-paginas-separadas.zip',
    },
    en: {
      eyebrow: 'Local processing',
      title: 'Split your PDF by pages',
      description: 'Load a single PDF, visually select the pages you want to extract and download one document or a ZIP with separate PDFs. The file is never uploaded to a server.',
      dropTitle: 'Drag your PDF here',
      dropActive: 'Drop the PDF to load it',
      dropText: 'Drop the file or click to select it',
      fileHelp: 'Single PDF · private · no upload · browser',
      invalidFile: 'Select a valid PDF file.',
      readError: 'The PDF could not be read. It may be damaged, protected or unsupported.',
      loaded: 'PDF loaded successfully.',
      pages: 'pages',
      page: 'Page',
      pageCountLabel: 'Detected pages',
      selectedFile: 'Selected file',
      selectorTitle: 'Select pages',
      selectorHelp: 'Click each page to include it or remove it from the export. The output keeps the original PDF order.',
      selectedSummary: 'selected pages',
      selectAll: 'Select all',
      selectNone: 'Clear selection',
      invertSelection: 'Invert selection',
      rangeLabel: 'Optional range shortcut',
      rangePlaceholder: 'Example: 1-3,5,8-10',
      rangeHelp: 'You can also type ranges to mark pages automatically.',
      previewTitle: 'Pages to export',
      noPreview: 'Select one or more pages to enable downloads.',
      splitSingle: 'Download as one PDF',
      splitSeparate: 'Split into separate PDFs',
      splitting: 'Creating PDF…',
      splittingZip: 'Creating ZIP…',
      clear: 'Clear',
      ready: 'PDF created successfully. The download should start automatically.',
      zipReady: 'ZIP created successfully with the separate PDFs. The download should start automatically.',
      needFile: 'Load a PDF first.',
      needRange: 'Select at least one page.',
      badFormat: 'Invalid format. Use pages or ranges such as 1-3,5,8-10.',
      invalidNumber: 'Ranges can only contain page numbers greater than zero.',
      reversedRange: 'Range {range} is invalid: the start must be less than or equal to the end.',
      outOfBounds: 'Page {page} is out of bounds. This PDF has {total} pages.',
      duplicated: 'Page {page} is duplicated. Remove duplicates to avoid ambiguous output.',
      createError: 'The PDF could not be created. Check that the file is not protected or damaged.',
      zipError: 'The separate PDFs could not be created. Check that the file is not protected or damaged.',
      downloadName: 'pdfworld-split.pdf',
      zipDownloadName: 'pdfworld-separated-pages.zip',
    },
  } as const;

  let file: File | null = null;
  let sourceBytes: Uint8Array | null = null;
  let pageCount = 0;
  let rangeInput = '';
  let selectedPages: number[] = [];
  let parsedRanges: ParsedRange[] = [];
  let isLoading = false;
  let isSplitting = false;
  let isCreatingZip = false;
  let errorMessage = '';
  let statusMessage = '';

  $: t = labels[lang] ?? labels.es;
  $: pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  $: selectedCount = selectedPages.length;
  $: canExport = Boolean(file && sourceBytes && pageCount > 0 && selectedCount > 0 && !errorMessage && !isLoading && !isSplitting && !isCreatingZip);
  $: selectionLabel = selectedPages.length > 0 ? selectedPages.join(', ') : '';

  async function handleDropzoneFiles(files: File[]) {
    await loadFile(files[0] ?? null);
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFile;
    statusMessage = '';
  }

  async function loadFile(nextFile: File | null) {
    file = nextFile;
    sourceBytes = null;
    pageCount = 0;
    rangeInput = '';
    selectedPages = [];
    parsedRanges = [];
    errorMessage = '';
    statusMessage = '';

    if (!nextFile) return;

    isLoading = true;

    try {
      const buffer = await nextFile.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0));
      const pdf = await PDFDocument.load(bytes.slice(), { ignoreEncryption: false });

      sourceBytes = bytes;
      pageCount = pdf.getPageCount();
      selectedPages = Array.from({ length: pageCount }, (_, index) => index + 1);
      parsedRanges = [{ label: `1-${pageCount}`, pages: selectedPages }];
      statusMessage = `${t.loaded} ${pageCount} ${t.pages}.`;
    } catch {
      file = null;
      sourceBytes = null;
      pageCount = 0;
      errorMessage = t.readError;
    } finally {
      isLoading = false;
    }
  }

  function togglePage(page: number) {
    clearMessagesForSelection();

    if (selectedPages.includes(page)) {
      selectedPages = selectedPages.filter((selectedPage) => selectedPage !== page);
    } else {
      selectedPages = [...selectedPages, page].sort((a, b) => a - b);
    }

    syncRangesFromSelection();
  }

  function selectAllPages() {
    clearMessagesForSelection();
    selectedPages = [...pageNumbers];
    syncRangesFromSelection();
  }

  function clearSelection() {
    clearMessagesForSelection();
    selectedPages = [];
    parsedRanges = [];
    rangeInput = '';
  }

  function invertSelection() {
    clearMessagesForSelection();
    const selectedSet = new Set(selectedPages);
    selectedPages = pageNumbers.filter((page) => !selectedSet.has(page));
    syncRangesFromSelection();
  }

  function clearMessagesForSelection() {
    errorMessage = '';
    statusMessage = file && pageCount > 0 ? `${t.pageCountLabel}: ${pageCount}.` : '';
  }

  function syncRangesFromSelection() {
    parsedRanges = pagesToRanges(selectedPages);
    rangeInput = parsedRanges.map((range) => range.label).join(',');
  }

  function handleRangeInput(event: Event) {
    rangeInput = (event.currentTarget as HTMLInputElement).value;
    validateCurrentRange();
  }

  function validateCurrentRange() {
    statusMessage = file && pageCount > 0 ? `${t.pageCountLabel}: ${pageCount}.` : '';

    const result = parseRanges(rangeInput, pageCount);
    selectedPages = result.pages;
    parsedRanges = result.ranges;
    errorMessage = result.error;
  }

  function parseRanges(input: string, totalPages: number) {
    const value = input.trim();
    const pages: number[] = [];
    const ranges: ParsedRange[] = [];
    const seen = new Set<number>();

    if (!value) {
      return { pages, ranges, error: '' };
    }

    if (!totalPages) {
      return { pages, ranges, error: t.needFile };
    }

    const chunks = value.split(',').map((chunk) => chunk.trim());

    if (chunks.some((chunk) => !chunk)) {
      return { pages: [], ranges: [], error: t.badFormat };
    }

    for (const chunk of chunks) {
      const match = chunk.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

      if (!match) {
        return { pages: [], ranges: [], error: t.badFormat };
      }

      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1) {
        return { pages: [], ranges: [], error: t.invalidNumber };
      }

      if (start > end) {
        return { pages: [], ranges: [], error: t.reversedRange.replace('{range}', chunk) };
      }

      const rangePages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

      for (const page of rangePages) {
        if (page > totalPages) {
          return {
            pages: [],
            ranges: [],
            error: t.outOfBounds.replace('{page}', String(page)).replace('{total}', String(totalPages)),
          };
        }

        if (seen.has(page)) {
          return { pages: [], ranges: [], error: t.duplicated.replace('{page}', String(page)) };
        }

        seen.add(page);
      }

      pages.push(...rangePages);
      ranges.push({ label: start === end ? String(start) : `${start}-${end}`, pages: rangePages });
    }

    return { pages, ranges, error: '' };
  }

  function pagesToRanges(pages: number[]): ParsedRange[] {
    if (pages.length === 0) return [];

    const sortedPages = [...pages].sort((a, b) => a - b);
    const ranges: ParsedRange[] = [];
    let start = sortedPages[0];
    let previous = sortedPages[0];

    for (const page of sortedPages.slice(1)) {
      if (page === previous + 1) {
        previous = page;
        continue;
      }

      ranges.push(createRange(start, previous));
      start = page;
      previous = page;
    }

    ranges.push(createRange(start, previous));
    return ranges;
  }

  function createRange(start: number, end: number): ParsedRange {
    return {
      label: start === end ? String(start) : `${start}-${end}`,
      pages: Array.from({ length: end - start + 1 }, (_, index) => start + index),
    };
  }

  async function splitPdf() {
    const pages = getPagesForExport();
    if (!pages) return;

    isSplitting = true;
    statusMessage = '';

    try {
      const pdfBytes = await createPdfWithPages(pages);
      saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), getSingleOutputFilename(pages));
      statusMessage = t.ready;
    } catch {
      errorMessage = t.createError;
    } finally {
      isSplitting = false;
    }
  }

  async function splitIntoSeparatePdfs() {
    const pages = getPagesForExport();
    if (!pages) return;

    isCreatingZip = true;
    statusMessage = '';

    try {
      const zip = new JSZip();
      const baseName = getBaseFilename();

      for (const page of pages) {
        const pdfBytes = await createPdfWithPages([page]);
        zip.file(`${baseName}-pagina-${String(page).padStart(3, '0')}.pdf`, pdfBytes);
        await yieldToBrowser();
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, getZipOutputFilename());
      statusMessage = t.zipReady;
    } catch {
      errorMessage = t.zipError;
    } finally {
      isCreatingZip = false;
    }
  }

  function getPagesForExport() {
    if (!file || !sourceBytes) {
      errorMessage = t.needFile;
      return null;
    }

    if (selectedPages.length === 0) {
      errorMessage = t.needRange;
      return null;
    }

    errorMessage = '';
    return [...selectedPages].sort((a, b) => a - b);
  }

  async function createPdfWithPages(pages: number[]) {
    if (!sourceBytes || !file) throw new Error(t.needFile);

    const sourcePdf = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
    const outputPdf = await PDFDocument.create();
    const copiedPages = await outputPdf.copyPages(
      sourcePdf,
      pages.map((page) => page - 1),
    );

    copiedPages.forEach((page) => outputPdf.addPage(page));
    outputPdf.setTitle(`${file.name} - ${pages.length === 1 ? `${t.page} ${pages[0]}` : selectionLabel}`);
    outputPdf.setProducer('PDFWorld');
    outputPdf.setCreator('PDFWorld');

    return outputPdf.save();
  }

  function clearTool() {
    file = null;
    sourceBytes = null;
    pageCount = 0;
    rangeInput = '';
    selectedPages = [];
    parsedRanges = [];
    isLoading = false;
    isSplitting = false;
    isCreatingZip = false;
    errorMessage = '';
    statusMessage = '';
  }

  function getBaseFilename() {
    if (!file?.name) return 'pdfworld';
    return file.name.replace(/\.pdf$/i, '').trim() || 'documento';
  }

  function getSingleOutputFilename(pages: number[]) {
    if (!file?.name) return t.downloadName;
    return `${getBaseFilename()}-paginas-${pages.join('_')}.pdf`;
  }

  function getZipOutputFilename() {
    if (!file?.name) return t.zipDownloadName;
    return `${getBaseFilename()}-paginas-separadas.zip`;
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => {
      window.requestIdleCallback?.(() => resolve(), { timeout: 120 }) ?? window.setTimeout(resolve, 0);
    });
  }
</script>

<section class="split-tool" aria-labelledby="split-tool-title">
  <div class="split-tool__upload-panel">
    <div class="split-tool__intro">
      <span class="split-tool__eyebrow">{t.eyebrow}</span>
      <h2 id="split-tool-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>

    <PdfDropzone
      title={t.dropTitle}
      activeTitle={t.dropActive}
      subtitle={t.dropText}
      help={t.fileHelp}
      selectedLabel={file?.name ?? ''}
      onFiles={handleDropzoneFiles}
      onInvalidFiles={handleInvalidFiles}
    />
  </div>

  {#if errorMessage}
    <div class="split-tool__alert split-tool__alert--error" role="alert">{errorMessage}</div>
  {/if}

  {#if statusMessage}
    <div class="split-tool__alert split-tool__alert--success" role="status">{statusMessage}</div>
  {/if}

  {#if isLoading}
    <div class="split-tool__alert" role="status">Cargando PDF…</div>
  {/if}

  {#if file && pageCount > 0}
    <div class="split-tool__workspace">
      <section class="split-tool__file-card" aria-labelledby="split-file-title">
        <div>
          <span class="split-tool__file-icon" aria-hidden="true">PDF</span>
        </div>
        <div>
          <h3 id="split-file-title">{t.selectedFile}</h3>
          <strong>{file.name}</strong>
          <p>{formatSize(file.size)} · {pageCount} {t.pages}</p>
        </div>
      </section>

      <section class="split-tool__selector-card" aria-labelledby="split-selector-title">
        <div class="split-tool__selector-header">
          <div>
            <h3 id="split-selector-title">{t.selectorTitle}</h3>
            <p>{t.selectorHelp}</p>
          </div>
          <strong aria-live="polite">{selectedCount} {t.selectedSummary}</strong>
        </div>

        <div class="split-tool__quick-actions" aria-label={t.selectorTitle}>
          <button type="button" on:click={selectAllPages}>{t.selectAll}</button>
          <button type="button" on:click={clearSelection}>{t.selectNone}</button>
          <button type="button" on:click={invertSelection}>{t.invertSelection}</button>
        </div>

        <div class="split-tool__page-grid" aria-label={t.selectorTitle}>
          {#each pageNumbers as page}
            <button
              type="button"
              class:split-tool__page-button={true}
              class:split-tool__page-button--selected={selectedPages.includes(page)}
              aria-pressed={selectedPages.includes(page)}
              on:click={() => togglePage(page)}
            >
              <span>{t.page}</span>
              <strong>{page}</strong>
            </button>
          {/each}
        </div>
      </section>

      <section class="split-tool__form-card" aria-labelledby="split-range-title">
        <div class="split-tool__field">
          <label id="split-range-title" for="split-range-input">{t.rangeLabel}</label>
          <input
            id="split-range-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            spellcheck="false"
            value={rangeInput}
            placeholder={t.rangePlaceholder}
            aria-describedby="split-range-help"
            aria-invalid={Boolean(errorMessage)}
            on:input={handleRangeInput}
          />
          <p id="split-range-help">{t.rangeHelp}</p>
        </div>

        <div class="split-tool__preview" aria-live="polite">
          <h3>{t.previewTitle}</h3>
          {#if parsedRanges.length > 0}
            <div class="split-tool__chips" aria-label={t.previewTitle}>
              {#each parsedRanges as range}
                <span>{range.label}</span>
              {/each}
            </div>
            <p>{selectedCount} {t.pages}</p>
          {:else}
            <p>{t.noPreview}</p>
          {/if}
        </div>

        <div class="split-tool__actions">
          <button type="button" class="split-tool__secondary" on:click={clearTool}>{t.clear}</button>
          <button type="button" class="split-tool__primary" disabled={!canExport} on:click={splitPdf}>
            {isSplitting ? t.splitting : t.splitSingle}
          </button>
          <button type="button" class="split-tool__primary split-tool__primary--dark" disabled={!canExport} on:click={splitIntoSeparatePdfs}>
            {isCreatingZip ? t.splittingZip : t.splitSeparate}
          </button>
        </div>
      </section>
    </div>
  {/if}
</section>

<style>
  .split-tool {
    display: grid;
    gap: 20px;
    margin: 32px 0 64px;
  }

  .split-tool__upload-panel,
  .split-tool__workspace,
  .split-tool__file-card,
  .split-tool__selector-card,
  .split-tool__form-card,
  .split-tool__alert {
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }

  .split-tool__upload-panel {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
    gap: 20px;
    align-items: center;
    overflow: hidden;
    padding: 24px;
    border-radius: 32px;
    background:
      radial-gradient(circle at top right, rgba(239, 68, 68, 0.14), transparent 36%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.88));
    box-shadow: 0 30px 90px rgba(15, 23, 42, 0.11);
  }

  .split-tool__upload-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, transparent 20%, rgba(255, 255, 255, 0.62), transparent 80%);
    transform: translateX(-110%);
    animation: split-upload-sheen 7s ease-in-out infinite;
  }

  .split-tool__upload-panel > * {
    position: relative;
    z-index: 1;
  }

  .split-tool__intro h2 {
    margin: 0 0 8px;
    letter-spacing: -0.04em;
  }

  .split-tool__intro p,
  .split-tool__file-card p,
  .split-tool__field p,
  .split-tool__preview p,
  .split-tool__selector-header p {
    margin: 0;
    color: #64748b;
  }

  .split-tool__eyebrow {
    display: inline-flex;
    margin-bottom: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 0.8rem;
    font-weight: 900;
  }

  .split-tool__alert {
    padding: 16px 18px;
    color: #475569;
    font-weight: 850;
  }

  .split-tool__alert--error {
    border-color: #fecaca;
    background: #fff1f2;
    color: #991b1b;
  }

  .split-tool__alert--success {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .split-tool__workspace {
    display: grid;
    grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr);
    gap: 18px;
    padding: 18px;
  }

  .split-tool__file-card,
  .split-tool__selector-card,
  .split-tool__form-card {
    padding: 18px;
  }

  .split-tool__selector-card,
  .split-tool__form-card {
    grid-column: 1 / -1;
  }

  .split-tool__file-card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .split-tool__file-card h3,
  .split-tool__preview h3,
  .split-tool__selector-card h3 {
    margin: 0 0 8px;
  }

  .split-tool__file-card strong {
    display: block;
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .split-tool__file-icon {
    display: grid;
    width: 52px;
    height: 64px;
    place-items: center;
    border-radius: 16px;
    background: #fff1f2;
    color: #dc2626;
    font-size: 0.75rem;
    font-weight: 950;
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.14);
  }

  .split-tool__selector-card,
  .split-tool__form-card {
    display: grid;
    gap: 18px;
  }

  .split-tool__selector-header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
  }

  .split-tool__selector-header strong {
    flex: 0 0 auto;
    padding: 8px 11px;
    border-radius: 999px;
    background: #fef3c7;
    color: #92400e;
    font-size: 0.88rem;
  }

  .split-tool__quick-actions,
  .split-tool__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .split-tool__quick-actions button,
  .split-tool__primary,
  .split-tool__secondary,
  .split-tool__page-button {
    border: 0;
    cursor: pointer;
    font: inherit;
    font-weight: 950;
    transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease, border-color 140ms ease;
  }

  .split-tool__quick-actions button {
    min-height: 40px;
    padding: 9px 13px;
    border-radius: 999px;
    background: #e2e8f0;
    color: #334155;
  }

  .split-tool__page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 10px;
    max-height: 420px;
    overflow: auto;
    padding: 4px;
  }

  .split-tool__page-button {
    display: grid;
    min-height: 86px;
    place-items: center;
    gap: 4px;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 18px;
    background: #fff;
    color: #0f172a;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  }

  .split-tool__page-button span {
    color: #64748b;
    font-size: 0.76rem;
    text-transform: uppercase;
  }

  .split-tool__page-button strong {
    font-size: 1.35rem;
  }

  .split-tool__page-button--selected {
    border-color: #ef4444;
    background: #fff1f2;
    color: #991b1b;
    box-shadow: 0 16px 34px rgba(239, 68, 68, 0.16);
  }

  .split-tool__page-button:hover,
  .split-tool__quick-actions button:hover:not(:disabled),
  .split-tool__primary:hover:not(:disabled),
  .split-tool__secondary:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .split-tool__field {
    display: grid;
    gap: 8px;
  }

  .split-tool__field label {
    color: #0f172a;
    font-weight: 950;
  }

  .split-tool__field input {
    width: 100%;
    min-height: 52px;
    box-sizing: border-box;
    border: 2px solid #e2e8f0;
    border-radius: 18px;
    background: #fff;
    color: #0f172a;
    font: inherit;
    font-size: 1.08rem;
    font-weight: 850;
    padding: 12px 14px;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .split-tool__field input:focus {
    border-color: #ef4444;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12);
    outline: none;
  }

  .split-tool__field input[aria-invalid='true'] {
    border-color: #ef4444;
  }

  .split-tool__preview {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 18px;
    background: #f8fafc;
  }

  .split-tool__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .split-tool__chips span {
    display: inline-flex;
    padding: 7px 10px;
    border-radius: 999px;
    background: #fee2e2;
    color: #991b1b;
    font-weight: 950;
  }

  .split-tool__actions {
    justify-content: flex-end;
  }

  .split-tool__primary,
  .split-tool__secondary {
    min-height: 46px;
    padding: 12px 16px;
    border-radius: 999px;
  }

  .split-tool__primary {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: #fff;
    box-shadow: 0 16px 34px rgba(239, 68, 68, 0.24);
  }

  .split-tool__primary--dark {
    background: linear-gradient(135deg, #0f172a, #334155);
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.22);
  }

  .split-tool__secondary {
    background: #e2e8f0;
    color: #334155;
  }

  .split-tool__primary:disabled,
  .split-tool__secondary:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @keyframes split-upload-sheen {
    0%, 55% { transform: translateX(-110%); }
    100% { transform: translateX(110%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .split-tool__upload-panel::before {
      animation: none;
    }

    .split-tool__field input,
    .split-tool__quick-actions button,
    .split-tool__primary,
    .split-tool__secondary,
    .split-tool__page-button {
      transition: none;
    }
  }

  @media (max-width: 760px) {
    .split-tool__upload-panel,
    .split-tool__workspace {
      grid-template-columns: 1fr;
    }

    .split-tool__upload-panel {
      padding: 18px;
      border-radius: 24px;
    }

    .split-tool__selector-header {
      flex-direction: column;
    }

    .split-tool__page-grid {
      grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
      max-height: 360px;
    }

    .split-tool__actions {
      justify-content: stretch;
    }

    .split-tool__primary,
    .split-tool__secondary {
      flex: 1 1 180px;
    }
  }
</style>
