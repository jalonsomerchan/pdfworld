<script lang="ts">
  import { PDFDocument } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, getFriendlyPdfError, getPdfBaseFilename, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Editar metadatos PDF',
      intro: 'Consulta y modifica título, autor, asunto, palabras clave, creador y productor de un PDF.',
      warning: 'Algunos metadatos internos o personalizados pueden no leerse o conservarse según cómo se creó el PDF.',
      drop: 'Arrastra un PDF aquí',
      active: 'Suelta el PDF',
      subtitle: 'Suelta el archivo o pulsa para seleccionarlo',
      help: 'Solo PDF · procesamiento local',
      invalid: 'Selecciona un PDF válido.',
      error: 'No se pudieron editar los metadatos del PDF.',
      ready: 'Metadatos actualizados correctamente. Se ha abierto la vista previa.',
      file: 'PDF seleccionado',
      change: 'Cambiar PDF',
      titleField: 'Título',
      author: 'Autor',
      subject: 'Asunto',
      keywords: 'Palabras clave',
      keywordsHelp: 'Sepáralas por comas.',
      creator: 'Creador',
      producer: 'Productor',
      generate: 'Guardar metadatos',
      generating: 'Guardando metadatos…',
      download: 'Descargar PDF actualizado',
      previewTitle: 'Vista previa del PDF actualizado',
      previewDesc: 'Revisa la copia antes de descargarla.',
      close: 'Cerrar',
      open: 'Abrir en pestaña',
      empty: 'Vacío',
    },
    en: {
      title: 'Edit PDF metadata',
      intro: 'View and modify title, author, subject, keywords, creator and producer in a PDF.',
      warning: 'Some internal or custom metadata may not be readable or preserved depending on how the PDF was created.',
      drop: 'Drag a PDF here',
      active: 'Drop the PDF',
      subtitle: 'Drop the file or click to select it',
      help: 'PDF only · local processing',
      invalid: 'Select a valid PDF.',
      error: 'The PDF metadata could not be edited.',
      ready: 'Metadata updated successfully. The preview has opened.',
      file: 'Selected PDF',
      change: 'Change PDF',
      titleField: 'Title',
      author: 'Author',
      subject: 'Subject',
      keywords: 'Keywords',
      keywordsHelp: 'Separate them with commas.',
      creator: 'Creator',
      producer: 'Producer',
      generate: 'Save metadata',
      generating: 'Saving metadata…',
      download: 'Download updated PDF',
      previewTitle: 'Updated PDF preview',
      previewDesc: 'Review the copy before downloading it.',
      close: 'Close',
      open: 'Open in tab',
      empty: 'Empty',
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let title = '';
  let author = '';
  let subject = '';
  let keywords = '';
  let creator = '';
  let producer = '';
  let isGenerating = false;
  let statusMessage = '';
  let errorMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;

  $: t = copy[lang] ?? copy.es;
  $: canGenerate = Boolean(file) && !isGenerating;
  $: downloadName = `${getPdfBaseFilename(file, lang === 'en' ? 'metadata-pdf' : 'pdf-metadatos')}-metadatos.pdf`;

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
      title = pdf.getTitle() || '';
      author = pdf.getAuthor() || '';
      subject = pdf.getSubject() || '';
      keywords = (pdf.getKeywords() || []).join(', ');
      creator = pdf.getCreator() || '';
      producer = pdf.getProducer() || '';
    } catch (error) {
      clearFile();
      errorMessage = getFriendlyPdfError(error, t.invalid);
    }
  }

  function handleInvalidFiles() {
    errorMessage = t.invalid;
  }

  async function generatePdf() {
    if (!file) return;

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      pdf.setTitle(title.trim());
      pdf.setAuthor(author.trim());
      pdf.setSubject(subject.trim());
      pdf.setKeywords(keywords.split(',').map((item) => item.trim()).filter(Boolean));
      pdf.setCreator(creator.trim());
      pdf.setProducer(producer.trim());
      pdf.setModificationDate(new Date());
      await yieldToBrowser();

      previewUrl = createPdfObjectUrl(await pdf.save({ useObjectStreams: true }));
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch (error) {
      errorMessage = getFriendlyPdfError(error, t.error);
    } finally {
      isGenerating = false;
    }
  }

  function clearFile() {
    file = null;
    pageCount = 0;
    title = '';
    author = '';
    subject = '';
    keywords = '';
    creator = '';
    producer = '';
    statusMessage = '';
    clearResult();
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    isPreviewOpen = false;
  }
</script>

<section class="metadata-tool" aria-labelledby="metadata-title">
  <header class="tool-head">
    <div>
      <span>FácilPDF</span>
      <h2 id="metadata-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>
    <strong aria-hidden="true">🏷️</strong>
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
        <small>{formatFileSize(file.size)} · {pageCount} páginas</small>
        <button type="button" on:click={clearFile}>{t.change}</button>
      </aside>

      <div class="form-grid">
        <label><span>{t.titleField}</span><input bind:value={title} placeholder={t.empty} /></label>
        <label><span>{t.author}</span><input bind:value={author} placeholder={t.empty} /></label>
        <label><span>{t.subject}</span><input bind:value={subject} placeholder={t.empty} /></label>
        <label><span>{t.keywords}</span><input bind:value={keywords} placeholder="pdf, documento" /><small>{t.keywordsHelp}</small></label>
        <label><span>{t.creator}</span><input bind:value={creator} placeholder={t.empty} /></label>
        <label><span>{t.producer}</span><input bind:value={producer} placeholder={t.empty} /></label>

        <div class="actions">
          <button class="primary" type="button" disabled={!canGenerate} on:click={generatePdf}>{isGenerating ? t.generating : t.generate}</button>
          <button class="secondary" type="button" disabled={!previewUrl} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
        </div>
      </div>
    </div>
  {/if}
</section>

<PdfResultModal open={isPreviewOpen && Boolean(previewUrl)} pdfUrl={previewUrl} filename={downloadName} title={t.previewTitle} description={t.previewDesc} downloadLabel={t.download} closeLabel={t.close} openLabel={t.open} on:close={() => (isPreviewOpen = false)} />

<style>
  .metadata-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 30px 90px rgba(15,23,42,.11)}
  .tool-head{display:flex;align-items:center;justify-content:space-between;gap:18px}.tool-head h2{margin:0;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.04em}.tool-head p{margin:.45rem 0 0;color:#64748b}.tool-head span{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:.78rem;font-weight:950}.tool-head>strong{display:grid;width:96px;height:96px;place-items:center;border-radius:24px;background:#fffbeb;font-size:2.8rem;box-shadow:0 20px 48px rgba(15,23,42,.12);transform:rotate(6deg)}
  .warning{margin:0;padding:14px 16px;border:1px solid #fde68a;border-radius:18px;background:#fffbeb;color:#92400e;font-weight:850}.message{margin:0;padding:13px 15px;border-radius:16px;font-weight:850}.message.error{background:#fff1f2;color:#991b1b}.message.success{background:#ecfdf5;color:#166534}.panel{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}.panel aside,.form-grid{border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.07)}.panel aside{display:grid;gap:12px;padding:18px}.panel aside strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.panel span,label span{color:#475569;font-size:.86rem;font-weight:900}.panel small{color:#64748b}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:18px}.form-grid label{display:grid;gap:8px}.form-grid input{width:100%;box-sizing:border-box;min-height:48px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:16px;background:#fff;color:#0f172a;font:inherit;font-weight:750}.panel button{min-height:46px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:950}.panel button:disabled{cursor:not-allowed;opacity:.45}.panel aside button,.secondary{background:#e2e8f0;color:#0f172a}.primary{background:linear-gradient(135deg,#f59e0b,#b45309);color:#fff}.actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:850px){.tool-head,.panel{display:grid;grid-template-columns:1fr}.tool-head>strong{width:82px;height:82px}.form-grid,.actions{grid-template-columns:1fr}}
</style>
