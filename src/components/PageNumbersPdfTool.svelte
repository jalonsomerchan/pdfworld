<script lang="ts">
  import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, getFriendlyPdfError, getPdfBaseFilename, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type Position = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Numerar páginas PDF',
      intro: 'Añade números de página visibles a tu PDF con formato, posición y margen personalizados.',
      drop: 'Arrastra un PDF aquí',
      active: 'Suelta el PDF',
      subtitle: 'Suelta el archivo o pulsa para seleccionarlo',
      help: 'Solo PDF · procesamiento local',
      invalid: 'Selecciona un PDF válido.',
      error: 'No se pudieron añadir los números de página.',
      ready: 'PDF numerado correctamente. Se ha abierto la vista previa.',
      file: 'PDF seleccionado',
      change: 'Cambiar PDF',
      format: 'Formato del texto',
      formatHelp: 'Puedes usar {n} para la página actual y {total} para el total.',
      position: 'Posición',
      startPage: 'Empezar en la página',
      fontSize: 'Tamaño de texto',
      margin: 'Margen',
      generate: 'Numerar PDF',
      generating: 'Añadiendo numeración…',
      download: 'Descargar PDF numerado',
      previewTitle: 'Vista previa del PDF numerado',
      previewDesc: 'Revisa la copia antes de descargarla.',
      close: 'Cerrar',
      open: 'Abrir en pestaña',
      positions: {
        'bottom-left': 'Abajo izquierda',
        'bottom-center': 'Abajo centro',
        'bottom-right': 'Abajo derecha',
        'top-left': 'Arriba izquierda',
        'top-center': 'Arriba centro',
        'top-right': 'Arriba derecha',
      },
    },
    en: {
      title: 'Add PDF page numbers',
      intro: 'Add visible page numbers to your PDF with custom format, position and margins.',
      drop: 'Drag a PDF here',
      active: 'Drop the PDF',
      subtitle: 'Drop the file or click to select it',
      help: 'PDF only · local processing',
      invalid: 'Select a valid PDF.',
      error: 'Page numbers could not be added.',
      ready: 'Page numbers added successfully. The preview has opened.',
      file: 'Selected PDF',
      change: 'Change PDF',
      format: 'Text format',
      formatHelp: 'Use {n} for the current page and {total} for the total.',
      position: 'Position',
      startPage: 'Start on page',
      fontSize: 'Text size',
      margin: 'Margin',
      generate: 'Add page numbers',
      generating: 'Adding page numbers…',
      download: 'Download numbered PDF',
      previewTitle: 'Numbered PDF preview',
      previewDesc: 'Review the copy before downloading it.',
      close: 'Close',
      open: 'Open in tab',
      positions: {
        'bottom-left': 'Bottom left',
        'bottom-center': 'Bottom center',
        'bottom-right': 'Bottom right',
        'top-left': 'Top left',
        'top-center': 'Top center',
        'top-right': 'Top right',
      },
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let textFormat = lang === 'en' ? 'Page {n} of {total}' : 'Página {n} de {total}';
  let position: Position = 'bottom-center';
  let startPage = 1;
  let fontSize = 12;
  let margin = 36;
  let isGenerating = false;
  let statusMessage = '';
  let errorMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;

  $: t = copy[lang] ?? copy.es;
  $: pageOptions = Array.from({ length: pageCount }, (_, index) => index + 1);
  $: downloadName = `${getPdfBaseFilename(file, lang === 'en' ? 'numbered-pdf' : 'pdf-numerado')}-numerado.pdf`;
  $: canGenerate = Boolean(file && pageCount > 0 && textFormat.trim()) && !isGenerating;

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
      startPage = Math.min(Math.max(startPage, 1), Math.max(pageCount, 1));
    } catch (error) {
      file = null;
      pageCount = 0;
      errorMessage = getFriendlyPdfError(error, t.invalid);
    }
  }

  function handleInvalidFiles() {
    errorMessage = t.invalid;
  }

  async function generateNumberedPdf() {
    if (!file || !textFormat.trim()) return;

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const pages = pdf.getPages();
      const total = pages.length;
      const safeStart = Math.min(Math.max(Number(startPage) || 1, 1), total);

      for (const [index, page] of pages.entries()) {
        const pageNumber = index + 1;
        if (pageNumber < safeStart) continue;

        const label = textFormat.replaceAll('{n}', String(pageNumber)).replaceAll('{total}', String(total));
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, fontSize);
        const textHeight = font.heightAtSize(fontSize);
        const x = getX(position, width, textWidth);
        const y = getY(position, height, textHeight);

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.12, 0.16, 0.22),
        });

        if (index % 10 === 0) await yieldToBrowser();
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

  function getX(pos: Position, width: number, textWidth: number) {
    if (pos.endsWith('center')) return width / 2 - textWidth / 2;
    if (pos.endsWith('right')) return width - margin - textWidth;
    return margin;
  }

  function getY(pos: Position, height: number, textHeight: number) {
    if (pos.startsWith('top')) return height - margin - textHeight;
    return margin;
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
</script>

<section class="page-number-tool" aria-labelledby="page-number-title">
  <header class="tool-head">
    <div>
      <span>FácilPDF</span>
      <h2 id="page-number-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>
    <strong aria-hidden="true">🔢</strong>
  </header>

  <PdfDropzone title={t.drop} activeTitle={t.active} subtitle={t.subtitle} help={t.help} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />

  {#if errorMessage}<p class="message error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="message success" role="status">{statusMessage}</p>{/if}

  {#if file}
    <div class="panel">
      <aside>
        <span>{t.file}</span>
        <strong>{file.name}</strong>
        <small>{formatFileSize(file.size)} · {pageCount} páginas</small>
        <button type="button" on:click={clearFile}>{t.change}</button>
      </aside>

      <div class="options">
        <label>
          <span>{t.format}</span>
          <input bind:value={textFormat} type="text" />
          <small>{t.formatHelp}</small>
        </label>

        <label>
          <span>{t.position}</span>
          <select bind:value={position}>
            {#each Object.entries(t.positions) as [value, label] (value)}
              <option value={value}>{label}</option>
            {/each}
          </select>
        </label>

        <label>
          <span>{t.startPage}</span>
          <select bind:value={startPage}>
            {#each pageOptions as page (page)}
              <option value={page}>{page}</option>
            {/each}
          </select>
        </label>

        <label>
          <span>{t.fontSize}: {fontSize}px</span>
          <input bind:value={fontSize} type="range" min="8" max="32" />
        </label>

        <label>
          <span>{t.margin}: {margin}px</span>
          <input bind:value={margin} type="range" min="12" max="96" />
        </label>

        <div class="actions">
          <button class="primary" type="button" disabled={!canGenerate} on:click={generateNumberedPdf}>{isGenerating ? t.generating : t.generate}</button>
          <button class="secondary" type="button" disabled={!previewUrl} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
        </div>
      </div>
    </div>
  {/if}
</section>

<PdfResultModal open={isPreviewOpen && Boolean(previewUrl)} pdfUrl={previewUrl} filename={downloadName} title={t.previewTitle} description={t.previewDesc} downloadLabel={t.download} closeLabel={t.close} openLabel={t.open} on:close={() => (isPreviewOpen = false)} />

<style>
  .page-number-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 30px 90px rgba(15,23,42,.11)}
  .tool-head{display:flex;align-items:center;justify-content:space-between;gap:18px}.tool-head h2{margin:0;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.04em}.tool-head p{margin:.45rem 0 0;color:#64748b}.tool-head span{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:.78rem;font-weight:950}.tool-head>strong{display:grid;width:96px;height:96px;place-items:center;border-radius:24px;background:#eff6ff;font-size:2.8rem;box-shadow:0 20px 48px rgba(15,23,42,.12);transform:rotate(-5deg)}
  .message{margin:0;padding:13px 15px;border-radius:16px;font-weight:850}.message.error{background:#fff1f2;color:#991b1b}.message.success{background:#ecfdf5;color:#166534}.panel{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}.panel aside,.options{border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.07)}.panel aside{display:grid;gap:12px;padding:18px}.panel aside strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.panel span,label span{color:#475569;font-size:.86rem;font-weight:900}.panel small{color:#64748b}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:18px}.options label{display:grid;gap:8px}.options label:first-child{grid-column:1/-1}.options input,.options select{width:100%;box-sizing:border-box;min-height:48px;border:1px solid #cbd5e1;border-radius:16px;background:#fff;color:#0f172a;font:inherit;font-weight:750}.options input[type='text'],.options select{padding:12px 14px}.options input[type='range']{accent-color:#2563eb}.panel button{min-height:46px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:950}.panel button:disabled{cursor:not-allowed;opacity:.45}.panel aside button,.secondary{background:#e2e8f0;color:#0f172a}.primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff}.actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:850px){.tool-head,.panel{display:grid;grid-template-columns:1fr}.tool-head>strong{width:82px;height:82px}.options,.actions{grid-template-columns:1fr}}
</style>
