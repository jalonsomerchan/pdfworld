<script lang="ts">
  import { PDFDocument } from 'pdf-lib';
  import { saveAs } from 'file-saver';
  import PdfDropzone from './PdfDropzone.svelte';

  type Lang = 'es' | 'en';

  interface PdfFileItem {
    id: string;
    file: File;
    pageCount?: number;
    error?: string;
  }

  export let lang: Lang = 'es';

  const labels = {
    es: {
      title: 'Sube tus PDF',
      description: 'Selecciona dos o más archivos PDF, arrástralos, ordénalos y descarga un único documento combinado. Todo ocurre en tu navegador.',
      dropTitle: 'Arrastra tus PDF aquí',
      dropText: 'Suelta los archivos o pulsa para seleccionarlos',
      dropActive: 'Suelta para añadirlos a la lista',
      fileHelp: 'Solo PDF. Privado, local y sin subir nada a servidores.',
      selectedFiles: 'Archivos seleccionados',
      noFiles: 'Todavía no has seleccionado ningún PDF.',
      pages: 'páginas',
      filesReady: 'PDF listos',
      moveUp: 'Subir',
      moveDown: 'Bajar',
      remove: 'Eliminar',
      clear: 'Limpiar',
      merge: 'Unir PDF',
      merging: 'Uniendo PDF…',
      downloadName: 'pdfworld-unido.pdf',
      needTwoFiles: 'Selecciona al menos dos archivos PDF para unirlos.',
      invalidFiles: 'Algunos archivos no son PDF y se han ignorado.',
      readError: 'No se pudo leer este PDF. Puede estar dañado o protegido.',
      mergeError: 'No se pudieron unir los PDF. Revisa que no estén dañados o protegidos.',
      ready: 'PDF generado correctamente. La descarga debería comenzar automáticamente.',
    },
    en: {
      title: 'Upload your PDFs',
      description: 'Select two or more PDF files, drag them in, arrange them and download one combined document. Everything happens in your browser.',
      dropTitle: 'Drag your PDFs here',
      dropText: 'Drop files or click to select them',
      dropActive: 'Drop to add them to the list',
      fileHelp: 'PDF only. Private, local and no server uploads.',
      selectedFiles: 'Selected files',
      noFiles: 'No PDF files selected yet.',
      pages: 'pages',
      filesReady: 'PDF files ready',
      moveUp: 'Move up',
      moveDown: 'Move down',
      remove: 'Remove',
      clear: 'Clear',
      merge: 'Merge PDF',
      merging: 'Merging PDF…',
      downloadName: 'pdfworld-merged.pdf',
      needTwoFiles: 'Select at least two PDF files to merge them.',
      invalidFiles: 'Some files were not PDFs and were ignored.',
      readError: 'This PDF could not be read. It may be damaged or protected.',
      mergeError: 'The PDFs could not be merged. Check that they are not damaged or protected.',
      ready: 'PDF created successfully. The download should start automatically.',
    },
  } as const;

  $: t = labels[lang] ?? labels.es;
  $: canMerge = files.length >= 2 && files.every((item) => !item.error) && !isMerging;
  $: totalPages = files.reduce((sum, item) => sum + (item.pageCount ?? 0), 0);

  let files: PdfFileItem[] = [];
  let isMerging = false;
  let statusMessage = '';
  let errorMessage = '';

  async function addFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;

    errorMessage = '';
    statusMessage = '';

    const nextItems: PdfFileItem[] = selectedFiles.map((file) => ({
      id: crypto.randomUUID?.() ?? `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }));

    files = [...files, ...nextItems];
    await loadPageCounts(nextItems);
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFiles;
  }

  async function loadPageCounts(items: PdfFileItem[]) {
    await Promise.all(
      items.map(async (item) => {
        try {
          const buffer = await item.file.arrayBuffer();
          const pdf = await PDFDocument.load(buffer, { ignoreEncryption: false });
          updateFile(item.id, { pageCount: pdf.getPageCount() });
        } catch {
          updateFile(item.id, { error: t.readError });
        }
      }),
    );
  }

  function updateFile(id: string, patch: Partial<PdfFileItem>) {
    files = files.map((item) => (item.id === id ? { ...item, ...patch } : item));
  }

  function moveFile(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= files.length) return;

    const nextFiles = [...files];
    const [item] = nextFiles.splice(index, 1);
    nextFiles.splice(nextIndex, 0, item);
    files = nextFiles;
  }

  function removeFile(id: string) {
    files = files.filter((item) => item.id !== id);
    statusMessage = '';
  }

  function clearFiles() {
    files = [];
    statusMessage = '';
    errorMessage = '';
  }

  async function mergePdfFiles() {
    if (files.length < 2) {
      errorMessage = t.needTwoFiles;
      return;
    }

    if (files.some((item) => item.error)) {
      errorMessage = t.mergeError;
      return;
    }

    isMerging = true;
    errorMessage = '';
    statusMessage = '';

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        const sourceBytes = await item.file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        await yieldToBrowser();
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      saveAs(blob, t.downloadName);
      statusMessage = t.ready;
    } catch {
      errorMessage = t.mergeError;
    } finally {
      isMerging = false;
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
</script>

<section class="merge-tool" aria-labelledby="merge-tool-title">
  <div class="merge-tool__intro">
    <div>
      <span class="merge-tool__eyebrow">PDFWorld</span>
      <h2 id="merge-tool-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>

    {#if files.length > 0}
      <div class="merge-tool__summary" aria-label={t.filesReady}>
        <strong>{files.length}</strong>
        <span>{t.filesReady}</span>
        {#if totalPages > 0}
          <small>{totalPages} {t.pages}</small>
        {/if}
      </div>
    {/if}
  </div>

  <PdfDropzone
    multiple
    title={t.dropTitle}
    activeTitle={t.dropActive}
    subtitle={t.dropText}
    help={t.fileHelp}
    onFiles={addFiles}
    onInvalidFiles={handleInvalidFiles}
  />

  {#if errorMessage}
    <p class="merge-tool__message merge-tool__message--error" role="alert">{errorMessage}</p>
  {/if}

  {#if statusMessage}
    <p class="merge-tool__message merge-tool__message--success" role="status">{statusMessage}</p>
  {/if}

  <div class="merge-tool__files" aria-live="polite">
    <div class="merge-tool__files-header">
      <h3>{t.selectedFiles}</h3>
      {#if files.length > 0}
        <button type="button" class="merge-tool__secondary" on:click={clearFiles}>{t.clear}</button>
      {/if}
    </div>

    {#if files.length === 0}
      <p class="merge-tool__empty">{t.noFiles}</p>
    {:else}
      <ol class="merge-tool__list">
        {#each files as item, index (item.id)}
          <li class={item.error ? 'merge-tool__file--error' : undefined}>
            <div class="merge-tool__file-main">
              <span class="merge-tool__file-index">{index + 1}</span>
              <span class="merge-tool__file-icon" aria-hidden="true">PDF</span>
              <div class="merge-tool__file-text">
                <strong>{item.file.name}</strong>
                <p>
                  {formatSize(item.file.size)}
                  {#if item.pageCount}
                    · {item.pageCount} {t.pages}
                  {/if}
                </p>
                {#if item.error}
                  <p class="merge-tool__file-error">{item.error}</p>
                {/if}
              </div>
            </div>

            <div class="merge-tool__file-actions">
              <button type="button" on:click={() => moveFile(index, -1)} disabled={index === 0}>{t.moveUp}</button>
              <button type="button" on:click={() => moveFile(index, 1)} disabled={index === files.length - 1}>{t.moveDown}</button>
              <button type="button" on:click={() => removeFile(item.id)}>{t.remove}</button>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <button type="button" class="merge-tool__primary" disabled={!canMerge} on:click={mergePdfFiles}>
    <span>{isMerging ? t.merging : t.merge}</span>
  </button>
</section>

<style>
  .merge-tool {
    position: relative;
    display: grid;
    gap: 24px;
    margin: 34px 0 52px;
    padding: clamp(20px, 3vw, 32px);
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 32px;
    background:
      radial-gradient(circle at top left, rgba(239, 68, 68, 0.12), transparent 34%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.88));
    box-shadow: 0 30px 90px rgba(15, 23, 42, 0.11);
  }

  .merge-tool::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, transparent 20%, rgba(255, 255, 255, 0.65), transparent 80%);
    transform: translateX(-110%);
    animation: merge-tool-sheen 7s ease-in-out infinite;
  }

  .merge-tool__intro,
  .merge-tool__files,
  .merge-tool__message,
  .merge-tool__primary {
    position: relative;
    z-index: 1;
  }

  .merge-tool__intro {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .merge-tool__intro h2,
  .merge-tool__files-header h3 {
    margin: 0;
  }

  .merge-tool__intro h2 {
    font-size: clamp(1.65rem, 3vw, 2.25rem);
    letter-spacing: -0.04em;
  }

  .merge-tool__eyebrow {
    display: inline-flex;
    margin-bottom: 8px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.1);
    color: #b91c1c;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .merge-tool__intro p,
  .merge-tool__empty,
  .merge-tool__file-main p {
    margin-bottom: 0;
    color: #64748b;
  }

  .merge-tool__summary {
    display: grid;
    min-width: 132px;
    gap: 2px;
    padding: 14px 16px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.78);
    text-align: right;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  }

  .merge-tool__summary strong {
    color: #0f172a;
    font-size: 1.8rem;
    line-height: 1;
  }

  .merge-tool__summary span,
  .merge-tool__summary small {
    color: #64748b;
    font-weight: 800;
  }

  .merge-tool__files {
    display: grid;
    gap: 14px;
  }

  .merge-tool__files-header,
  .merge-tool__file-main,
  .merge-tool__file-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .merge-tool__files-header {
    justify-content: space-between;
  }

  .merge-tool__list {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .merge-tool__list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06);
    animation: merge-tool-item-in 260ms ease both;
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .merge-tool__list li:hover {
    border-color: rgba(239, 68, 68, 0.28);
    box-shadow: 0 18px 44px rgba(15, 23, 42, 0.1);
    transform: translateY(-1px);
  }

  .merge-tool__file--error {
    border-color: #fecaca !important;
    background: #fff1f2 !important;
  }

  .merge-tool__file-index,
  .merge-tool__file-icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    font-weight: 950;
  }

  .merge-tool__file-index {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
  }

  .merge-tool__file-icon {
    width: 42px;
    height: 48px;
    border-radius: 12px;
    background: #fff1f2;
    color: #dc2626;
    font-size: 0.72rem;
    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.14);
  }

  .merge-tool__file-text {
    min-width: 0;
  }

  .merge-tool__file-text strong {
    display: block;
    overflow: hidden;
    max-width: min(48vw, 520px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .merge-tool__file-error,
  .merge-tool__message--error {
    color: #991b1b !important;
  }

  .merge-tool__file-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .merge-tool__file-actions button,
  .merge-tool__secondary,
  .merge-tool__primary {
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-weight: 850;
    transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }

  .merge-tool__file-actions button,
  .merge-tool__secondary {
    padding: 8px 12px;
    background: #e2e8f0;
    color: #334155;
  }

  .merge-tool__file-actions button:hover:not(:disabled),
  .merge-tool__secondary:hover {
    background: #cbd5e1;
    transform: translateY(-1px);
  }

  .merge-tool__file-actions button:disabled,
  .merge-tool__primary:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .merge-tool__primary {
    justify-self: start;
    padding: 14px 22px;
    overflow: hidden;
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: #fff;
    box-shadow: 0 16px 34px rgba(239, 68, 68, 0.28);
  }

  .merge-tool__primary:not(:disabled):hover {
    box-shadow: 0 20px 42px rgba(239, 68, 68, 0.34);
    transform: translateY(-2px);
  }

  .merge-tool__message {
    margin: 0;
    padding: 12px 14px;
    border-radius: 16px;
    font-weight: 850;
  }

  .merge-tool__message--error {
    background: #fff1f2;
  }

  .merge-tool__message--success {
    background: #ecfdf5;
    color: #166534;
  }

  @keyframes merge-tool-sheen {
    0%, 55% { transform: translateX(-110%); }
    100% { transform: translateX(110%); }
  }

  @keyframes merge-tool-item-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .merge-tool::before,
    .merge-tool__list li {
      animation: none;
    }

    .merge-tool__list li,
    .merge-tool__file-actions button,
    .merge-tool__secondary,
    .merge-tool__primary {
      transition: none;
    }
  }

  @media (max-width: 720px) {
    .merge-tool {
      padding: 18px;
      border-radius: 24px;
    }

    .merge-tool__intro,
    .merge-tool__list li,
    .merge-tool__files-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .merge-tool__summary {
      width: 100%;
      text-align: left;
    }

    .merge-tool__file-main {
      align-items: flex-start;
    }

    .merge-tool__file-actions {
      justify-content: flex-start;
    }

    .merge-tool__file-text strong {
      max-width: 62vw;
    }
  }
</style>
