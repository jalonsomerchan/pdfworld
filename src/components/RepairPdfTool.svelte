<script lang="ts">
  import { PDFDocument } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, getFriendlyPdfError, getPdfBaseFilename, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Reparar PDF',
      intro: 'Intenta reconstruir la estructura interna de un PDF cargándolo y guardando una copia nueva.',
      warning: 'Esta reparación es básica. Puede ayudar con PDFs válidos pero problemáticos, pero no recupera archivos gravemente corruptos, incompletos o cifrados sin contraseña.',
      drop: 'Arrastra un PDF aquí',
      active: 'Suelta el PDF',
      subtitle: 'Suelta el archivo o pulsa para seleccionarlo',
      help: 'Solo PDF · procesamiento local',
      invalid: 'Selecciona un PDF válido o mínimamente legible.',
      error: 'No se pudo reparar el PDF. El archivo puede estar demasiado dañado, incompleto o protegido.',
      ready: 'PDF reconstruido correctamente. Revisa la vista previa y descarga la copia.',
      file: 'PDF seleccionado',
      change: 'Cambiar PDF',
      pages: 'Páginas detectadas',
      size: 'Tamaño original',
      repair: 'Intentar reparar PDF',
      repairing: 'Reconstruyendo PDF…',
      download: 'Descargar PDF reparado',
      previewTitle: 'Vista previa del PDF reparado',
      previewDesc: 'Revisa la copia reconstruida antes de descargarla.',
      close: 'Cerrar',
      open: 'Abrir en pestaña',
      methodTitle: 'Qué hace esta reparación',
      methodText: 'Carga el PDF con pdf-lib, copia sus páginas en un documento nuevo y lo guarda de nuevo para regenerar referencias y estructura básica.',
    },
    en: {
      title: 'Repair PDF',
      intro: 'Try to rebuild the internal structure of a PDF by loading it and saving a new copy.',
      warning: 'This is a basic repair. It may help with valid but problematic PDFs, but it does not recover severely corrupted, incomplete or encrypted files without a password.',
      drop: 'Drag a PDF here',
      active: 'Drop the PDF',
      subtitle: 'Drop the file or click to select it',
      help: 'PDF only · local processing',
      invalid: 'Select a valid or minimally readable PDF.',
      error: 'The PDF could not be repaired. The file may be too damaged, incomplete or protected.',
      ready: 'PDF rebuilt successfully. Review the preview and download the copy.',
      file: 'Selected PDF',
      change: 'Change PDF',
      pages: 'Detected pages',
      size: 'Original size',
      repair: 'Try to repair PDF',
      repairing: 'Rebuilding PDF…',
      download: 'Download repaired PDF',
      previewTitle: 'Repaired PDF preview',
      previewDesc: 'Review the rebuilt copy before downloading it.',
      close: 'Close',
      open: 'Open in tab',
      methodTitle: 'What this repair does',
      methodText: 'It loads the PDF with pdf-lib, copies its pages into a new document and saves it again to regenerate references and basic structure.',
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let isRepairing = false;
  let statusMessage = '';
  let errorMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;

  $: t = copy[lang] ?? copy.es;
  $: canRepair = Boolean(file && pageCount > 0) && !isRepairing;
  $: downloadName = `${getPdfBaseFilename(file, lang === 'en' ? 'repaired-pdf' : 'pdf-reparado')}-reparado.pdf`;

  async function addFiles(files: File[]) {
    const selectedFile = files[0];
    if (!selectedFile) return;

    clearResult();
    statusMessage = '';
    errorMessage = '';

    try {
      const pdf = await PDFDocument.load(await selectedFile.arrayBuffer(), {
        ignoreEncryption: false,
        updateMetadata: false,
      });

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

  async function repairPdf() {
    if (!file) return;

    isRepairing = true;
    statusMessage = '';
    errorMessage = '';
    clearResult();

    try {
      const sourcePdf = await PDFDocument.load(await file.arrayBuffer(), {
        ignoreEncryption: false,
        updateMetadata: false,
      });
      const repairedPdf = await PDFDocument.create();
      const copiedPages = await repairedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

      for (const page of copiedPages) {
        repairedPdf.addPage(page);
        await yieldToBrowser();
      }

      repairedPdf.setTitle(sourcePdf.getTitle() || file.name.replace(/\.pdf$/i, ''));
      repairedPdf.setAuthor(sourcePdf.getAuthor() || '');
      repairedPdf.setSubject(sourcePdf.getSubject() || '');
      repairedPdf.setKeywords(sourcePdf.getKeywords() || []);
      repairedPdf.setCreator('FácilPDF');
      repairedPdf.setProducer('FácilPDF');
      repairedPdf.setModificationDate(new Date());

      previewUrl = createPdfObjectUrl(await repairedPdf.save({ useObjectStreams: true }));
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch (error) {
      errorMessage = getFriendlyPdfError(error, t.error);
    } finally {
      isRepairing = false;
    }
  }

  function clearFile() {
    file = null;
    pageCount = 0;
    statusMessage = '';
    errorMessage = '';
    clearResult();
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    isPreviewOpen = false;
  }
</script>

<section class="repair-tool" aria-labelledby="repair-title">
  <header class="tool-head">
    <div>
      <span>FácilPDF</span>
      <h2 id="repair-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>
    <strong aria-hidden="true">🩹</strong>
  </header>

  <p class="warning" role="note">{t.warning}</p>

  <PdfDropzone title={t.drop} activeTitle={t.active} subtitle={t.subtitle} help={t.help} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />

  {#if errorMessage}<p class="message error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="message success" role="status">{statusMessage}</p>{/if}

  {#if file}
    <div class="panel">
      <aside>
        <span>{t.file}</span>
        <strong>{file.name}</strong>
        <small>{t.size}: {formatFileSize(file.size)}</small>
        <small>{t.pages}: {pageCount}</small>
        <button type="button" on:click={clearFile}>{t.change}</button>
      </aside>

      <div class="repair-card">
        <h3>{t.methodTitle}</h3>
        <p>{t.methodText}</p>
        <div class="actions">
          <button class="primary" type="button" disabled={!canRepair} on:click={repairPdf}>{isRepairing ? t.repairing : t.repair}</button>
          <button class="secondary" type="button" disabled={!previewUrl} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
        </div>
      </div>
    </div>
  {/if}
</section>

<PdfResultModal open={isPreviewOpen && Boolean(previewUrl)} pdfUrl={previewUrl} filename={downloadName} title={t.previewTitle} description={t.previewDesc} downloadLabel={t.download} closeLabel={t.close} openLabel={t.open} on:close={() => (isPreviewOpen = false)} />

<style>
  .repair-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 30px 90px rgba(15,23,42,.11)}.tool-head{display:flex;align-items:center;justify-content:space-between;gap:18px}.tool-head h2{margin:0;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.04em}.tool-head p{margin:.45rem 0 0;color:#64748b}.tool-head span{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:.78rem;font-weight:950}.tool-head>strong{display:grid;width:96px;height:96px;place-items:center;border-radius:24px;background:#f0fdf4;font-size:2.8rem;box-shadow:0 20px 48px rgba(15,23,42,.12);transform:rotate(-6deg)}.warning{margin:0;padding:14px 16px;border:1px solid #bbf7d0;border-radius:18px;background:#f0fdf4;color:#166534;font-weight:850}.message{margin:0;padding:13px 15px;border-radius:16px;font-weight:850}.message.error{background:#fff1f2;color:#991b1b}.message.success{background:#ecfdf5;color:#166534}.panel{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}.panel aside,.repair-card{border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.07)}.panel aside{display:grid;gap:12px;padding:18px}.panel aside strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.panel span{color:#475569;font-size:.86rem;font-weight:900}.panel small,.repair-card p{color:#64748b}.repair-card{display:grid;gap:12px;padding:18px}.repair-card h3{margin:0}.repair-card p{margin:0}.panel button{min-height:46px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:950}.panel button:disabled{cursor:not-allowed;opacity:.45}.panel aside button,.secondary{background:#e2e8f0;color:#0f172a}.primary{background:linear-gradient(135deg,#22c55e,#15803d);color:#fff}.actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:850px){.tool-head,.panel{display:grid;grid-template-columns:1fr}.tool-head>strong{width:82px;height:82px}.actions{grid-template-columns:1fr}}
</style>
