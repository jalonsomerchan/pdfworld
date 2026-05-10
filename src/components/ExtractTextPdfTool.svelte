<script lang="ts">
  import { onDestroy } from 'svelte';
  import PdfDropzone from './PdfDropzone.svelte';
  import { formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';

  interface PageText {
    pageNumber: number;
    text: string;
    charCount: number;
  }

  export let lang: Lang = 'es';

  const labels = {
    es: {
      title: 'Extrae el texto seleccionable de un PDF',
      description: 'Carga un PDF con capa de texto, revisa el contenido por páginas, cópialo al portapapeles o descárgalo como archivo TXT.',
      dropTitle: 'Arrastra tu PDF aquí',
      dropActive: 'Suelta para extraer el texto',
      dropText: 'Suelta el archivo o pulsa para seleccionarlo',
      fileHelp: 'Solo PDF · privado · procesamiento local en navegador · sin OCR',
      invalidFiles: 'El archivo seleccionado no es un PDF válido.',
      reading: 'Leyendo PDF y extrayendo texto…',
      ready: 'Texto extraído correctamente.',
      noText: 'No se ha encontrado texto seleccionable. Puede ser un PDF escaneado o formado solo por imágenes. Esta herramienta no aplica OCR.',
      readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o tener una estructura incompatible.',
      copy: 'Copiar texto',
      copied: 'Texto copiado al portapapeles.',
      copyError: 'No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.',
      download: 'Descargar TXT',
      clear: 'Limpiar',
      selectedFile: 'Archivo cargado',
      pages: 'páginas',
      characters: 'caracteres',
      page: 'Página',
      emptyPage: 'Sin texto seleccionable en esta página.',
      resultTitle: 'Texto extraído',
      downloadName: 'facilpdf-texto-extraido.txt',
      textAreaLabel: 'Texto completo extraído del PDF',
      pageListLabel: 'Texto extraído por páginas',
    },
    en: {
      title: 'Extract selectable text from a PDF',
      description: 'Load a PDF with a text layer, review the content page by page, copy it to the clipboard or download it as a TXT file.',
      dropTitle: 'Drag your PDF here',
      dropActive: 'Drop to extract text',
      dropText: 'Drop the file or click to select it',
      fileHelp: 'PDF only · private · local browser processing · no OCR',
      invalidFiles: 'The selected file is not a valid PDF.',
      reading: 'Reading PDF and extracting text…',
      ready: 'Text extracted successfully.',
      noText: 'No selectable text was found. This may be a scanned PDF or image-only document. This tool does not run OCR.',
      readError: 'The PDF could not be read. It may be damaged, protected or have an incompatible structure.',
      copy: 'Copy text',
      copied: 'Text copied to clipboard.',
      copyError: 'Automatic copy failed. Select the text and copy it manually.',
      download: 'Download TXT',
      clear: 'Clear',
      selectedFile: 'Loaded file',
      pages: 'pages',
      characters: 'characters',
      page: 'Page',
      emptyPage: 'No selectable text on this page.',
      resultTitle: 'Extracted text',
      downloadName: 'facilpdf-extracted-text.txt',
      textAreaLabel: 'Full text extracted from the PDF',
      pageListLabel: 'Text extracted page by page',
    },
  } as const;

  let pdfJsPromise: Promise<any> | null = null;
  let file: File | null = null;
  let pageTexts: PageText[] = [];
  let isReading = false;
  let statusMessage = '';
  let errorMessage = '';
  let warningMessage = '';

  $: t = labels[lang] ?? labels.es;
  $: totalCharacters = pageTexts.reduce((sum, page) => sum + page.charCount, 0);
  $: pageCount = pageTexts.length;
  $: fullText = buildFullText(pageTexts, t.page);
  $: hasText = totalCharacters > 0;
  $: canExport = hasText && !isReading;

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
      ]).then(([pdfJs, worker]) => {
        pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfJs;
      });
    }

    return pdfJsPromise;
  }

  async function addFiles(files: File[]) {
    const selectedFile = files[0];
    if (!selectedFile) return;

    file = selectedFile;
    pageTexts = [];
    errorMessage = '';
    warningMessage = '';
    statusMessage = '';
    isReading = true;

    try {
      const pdfJs = await loadPdfJs();
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const pdf = await pdfJs.getDocument({
        data: bytes,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      }).promise;

      const extractedPages: PageText[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        await yieldToBrowser();
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent({ includeMarkedContent: false });
        const text = normalizeTextContent(content.items ?? []);
        page.cleanup();
        extractedPages.push({ pageNumber, text, charCount: text.replace(/\s/g, '').length });
        pageTexts = [...extractedPages];
      }

      await pdf.destroy();

      if (extractedPages.reduce((sum, page) => sum + page.charCount, 0) === 0) {
        warningMessage = t.noText;
        statusMessage = '';
      } else {
        statusMessage = t.ready;
      }
    } catch {
      pageTexts = [];
      errorMessage = t.readError;
    } finally {
      isReading = false;
    }
  }

  function normalizeTextContent(items: Array<{ str?: string; hasEOL?: boolean }>) {
    const lines: string[] = [];
    let currentLine = '';

    for (const item of items) {
      const value = String(item.str ?? '');
      if (value) {
        currentLine += currentLine && !currentLine.endsWith(' ') ? ` ${value}` : value;
      }

      if (item.hasEOL) {
        lines.push(currentLine.trimEnd());
        currentLine = '';
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }

    return lines
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  function buildFullText(pages: PageText[], pageLabel: string) {
    return pages
      .map((page) => `--- ${pageLabel} ${page.pageNumber} ---\n${page.text}`.trim())
      .join('\n\n');
  }

  async function copyText() {
    if (!canExport) return;

    try {
      await navigator.clipboard.writeText(fullText);
      statusMessage = t.copied;
      errorMessage = '';
    } catch {
      errorMessage = t.copyError;
    }
  }

  function downloadText() {
    if (!canExport) return;

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file ? `${file.name.replace(/\.pdf$/i, '')}.txt` : t.downloadName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFiles;
  }

  function clearTool() {
    file = null;
    pageTexts = [];
    isReading = false;
    statusMessage = '';
    errorMessage = '';
    warningMessage = '';
  }

  onDestroy(clearTool);
</script>

<section class="extract-text" aria-labelledby="extract-text-title">
  <div class="extract-text__hero">
    <div>
      <span class="extract-text__eyebrow">FácilPDF</span>
      <h2 id="extract-text-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>
    <div class="extract-text__summary" aria-live="polite">
      <strong>{pageCount}</strong>
      <span>{t.pages}</span>
      <small>{totalCharacters.toLocaleString(lang)} {t.characters}</small>
    </div>
  </div>

  <PdfDropzone
    title={t.dropTitle}
    activeTitle={t.dropActive}
    subtitle={t.dropText}
    help={t.fileHelp}
    multiple={false}
    onFiles={addFiles}
    onInvalidFiles={handleInvalidFiles}
  />

  {#if file}
    <div class="extract-text__file-card">
      <div>
        <span>{t.selectedFile}</span>
        <strong>{file.name}</strong>
        <small>{formatFileSize(file.size)}</small>
      </div>
      <button type="button" on:click={clearTool}>{t.clear}</button>
    </div>
  {/if}

  {#if isReading}<p class="extract-text__message" role="status">{t.reading}</p>{/if}
  {#if errorMessage}<p class="extract-text__message extract-text__message--error" role="alert">{errorMessage}</p>{/if}
  {#if warningMessage}<p class="extract-text__message extract-text__message--warning" role="alert">{warningMessage}</p>{/if}
  {#if statusMessage}<p class="extract-text__message extract-text__message--success" role="status">{statusMessage}</p>{/if}

  {#if pageTexts.length > 0}
    <div class="extract-text__actions">
      <button type="button" class="extract-text__primary" disabled={!canExport} on:click={copyText}>{t.copy}</button>
      <button type="button" class="extract-text__primary extract-text__primary--dark" disabled={!canExport} on:click={downloadText}>{t.download}</button>
    </div>

    <section class="extract-text__result" aria-labelledby="extract-result-title">
      <div class="extract-text__result-head">
        <h3 id="extract-result-title">{t.resultTitle}</h3>
        <span>{pageCount} {t.pages} · {totalCharacters.toLocaleString(lang)} {t.characters}</span>
      </div>

      <textarea readonly aria-label={t.textAreaLabel} value={fullText}></textarea>

      <div class="extract-text__pages" aria-label={t.pageListLabel}>
        {#each pageTexts as page (page.pageNumber)}
          <article class:extract-text__page={true} class:extract-text__page--empty={!page.text}>
            <h4>{t.page} {page.pageNumber}</h4>
            {#if page.text}
              <pre>{page.text}</pre>
            {:else}
              <p>{t.emptyPage}</p>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}
</section>

<style>
  .extract-text{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:radial-gradient(circle at top left,rgba(14,165,233,.14),transparent 34%),linear-gradient(135deg,rgba(255,255,255,.97),rgba(248,250,252,.9));box-shadow:0 30px 90px rgba(15,23,42,.11)}
  .extract-text__hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.extract-text__hero h2,.extract-text__result h3,.extract-text__page h4{margin:0}.extract-text__hero h2{font-size:clamp(1.65rem,3vw,2.25rem);letter-spacing:-.04em}.extract-text__hero p{margin:0;color:#64748b}.extract-text__eyebrow{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:rgba(14,165,233,.12);color:#0369a1;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.extract-text__summary{display:grid;min-width:148px;gap:2px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:22px;background:rgba(255,255,255,.78);text-align:right}.extract-text__summary strong{font-size:1.9rem;line-height:1}.extract-text__summary span,.extract-text__summary small{color:#64748b;font-weight:800}.extract-text__file-card{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 16px;border:1px solid #e2e8f0;border-radius:20px;background:#fff}.extract-text__file-card div{display:grid;gap:2px;min-width:0}.extract-text__file-card span,.extract-text__file-card small{color:#64748b;font-weight:800}.extract-text__file-card strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.extract-text button{border:0;cursor:pointer;font:inherit;font-weight:900;transition:transform 140ms ease,opacity 140ms ease}.extract-text button:hover:not(:disabled){transform:translateY(-1px)}.extract-text button:disabled{cursor:not-allowed;opacity:.45}.extract-text__file-card button{padding:9px 12px;border-radius:999px;background:#e2e8f0;color:#334155}.extract-text__message{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.extract-text__message--error{background:#fff1f2;color:#991b1b}.extract-text__message--warning{background:#fffbeb;color:#92400e}.extract-text__message--success{background:#ecfdf5;color:#166534}.extract-text__actions{display:flex;flex-wrap:wrap;gap:10px}.extract-text__primary{min-height:48px;padding:12px 18px;border-radius:999px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;box-shadow:0 16px 34px rgba(14,165,233,.25)}.extract-text__primary--dark{background:linear-gradient(135deg,#0f172a,#334155);box-shadow:0 16px 34px rgba(15,23,42,.22)}.extract-text__result{display:grid;gap:14px}.extract-text__result-head{display:flex;justify-content:space-between;gap:12px;align-items:end}.extract-text__result-head span{color:#64748b;font-weight:850}.extract-text textarea{width:100%;min-height:260px;box-sizing:border-box;padding:16px;border:1px solid #cbd5e1;border-radius:20px;background:#fff;color:#0f172a;font:500 .94rem/1.55 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;resize:vertical}.extract-text__pages{display:grid;gap:12px}.extract-text__page{display:grid;gap:10px;padding:16px;border:1px solid #e2e8f0;border-radius:20px;background:#fff}.extract-text__page h4{color:#0369a1}.extract-text__page pre{overflow:auto;max-height:360px;margin:0;white-space:pre-wrap;word-break:break-word;color:#1e293b;font:500 .92rem/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.extract-text__page p{margin:0;color:#64748b;font-weight:800}.extract-text__page--empty{background:#f8fafc}@media (prefers-reduced-motion:reduce){.extract-text button{transition:none}}@media (max-width:760px){.extract-text__hero,.extract-text__result-head{display:grid}.extract-text__summary{text-align:left}.extract-text__actions{display:grid}.extract-text__primary{width:100%}.extract-text__file-card{display:grid}}
</style>
