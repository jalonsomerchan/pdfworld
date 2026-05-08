<script lang="ts">
  import { PDFDocument } from 'pdf-lib';
  import { saveAs } from 'file-saver';

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
      description: 'Selecciona dos o más archivos PDF, ordénalos y descarga un único documento combinado. Todo ocurre en tu navegador.',
      dropText: 'Arrastra aquí tus PDF o pulsa para seleccionarlos',
      fileHelp: 'Solo archivos PDF. No se suben a ningún servidor.',
      selectedFiles: 'Archivos seleccionados',
      noFiles: 'Todavía no has seleccionado ningún PDF.',
      pages: 'páginas',
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
      description: 'Select two or more PDF files, arrange them and download one combined document. Everything happens in your browser.',
      dropText: 'Drop your PDFs here or click to select them',
      fileHelp: 'PDF files only. They are never uploaded to any server.',
      selectedFiles: 'Selected files',
      noFiles: 'No PDF files selected yet.',
      pages: 'pages',
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

  let files: PdfFileItem[] = [];
  let inputElement: HTMLInputElement;
  let isDragging = false;
  let isMerging = false;
  let statusMessage = '';
  let errorMessage = '';

  function openFileDialog() {
    inputElement?.click();
  }

  async function handleInputChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    await addFiles(input.files);
    input.value = '';
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    await addFiles(event.dataTransfer?.files ?? null);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    errorMessage = '';
    statusMessage = '';

    const selectedFiles = Array.from(fileList);
    const pdfFiles = selectedFiles.filter((file) => isPdf(file));

    if (pdfFiles.length !== selectedFiles.length) {
      errorMessage = t.invalidFiles;
    }

    const nextItems: PdfFileItem[] = pdfFiles.map((file) => ({
      id: crypto.randomUUID?.() ?? `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }));

    files = [...files, ...nextItems];
    await loadPageCounts(nextItems);
  }

  function isPdf(file: File) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
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
    <h2 id="merge-tool-title">{t.title}</h2>
    <p>{t.description}</p>
  </div>

  <button
    type="button"
    class={`merge-tool__dropzone${isDragging ? ' merge-tool__dropzone--active' : ''}`}
    on:click={openFileDialog}
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
  >
    <span aria-hidden="true">📄</span>
    <strong>{t.dropText}</strong>
    <small>{t.fileHelp}</small>
  </button>

  <input
    bind:this={inputElement}
    class="merge-tool__input"
    type="file"
    accept="application/pdf,.pdf"
    multiple
    on:change={handleInputChange}
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
              <div>
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
    {isMerging ? t.merging : t.merge}
  </button>
</section>

<style>
  .merge-tool {
    display: grid;
    gap: 22px;
    margin: 32px 0 48px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }

  .merge-tool__intro h2,
  .merge-tool__files-header h3 {
    margin: 0;
  }

  .merge-tool__intro p,
  .merge-tool__empty,
  .merge-tool__file-main p {
    margin-bottom: 0;
    color: #64748b;
  }

  .merge-tool__dropzone {
    display: grid;
    min-height: 190px;
    place-items: center;
    gap: 8px;
    width: 100%;
    padding: 28px;
    border: 2px dashed #cbd5e1;
    border-radius: 24px;
    background: #f8fafc;
    color: #0f172a;
    cursor: pointer;
    text-align: center;
    font: inherit;
  }

  .merge-tool__dropzone--active,
  .merge-tool__dropzone:focus-visible,
  .merge-tool__dropzone:hover {
    border-color: #ef4444;
    background: #fff1f2;
    outline: none;
  }

  .merge-tool__dropzone span {
    font-size: 2.3rem;
  }

  .merge-tool__dropzone small {
    color: #64748b;
  }

  .merge-tool__input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
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
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: #fff;
  }

  .merge-tool__file--error {
    border-color: #fecaca !important;
    background: #fff1f2 !important;
  }

  .merge-tool__file-index {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    place-items: center;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    font-weight: 900;
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
    font-weight: 800;
  }

  .merge-tool__file-actions button,
  .merge-tool__secondary {
    padding: 8px 11px;
    background: #e2e8f0;
    color: #334155;
  }

  .merge-tool__file-actions button:disabled,
  .merge-tool__primary:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .merge-tool__primary {
    justify-self: start;
    padding: 13px 20px;
    background: #ef4444;
    color: #fff;
  }

  .merge-tool__message {
    margin: 0;
    font-weight: 800;
  }

  .merge-tool__message--success {
    color: #166534;
  }

  @media (max-width: 720px) {
    .merge-tool {
      padding: 18px;
    }

    .merge-tool__list li,
    .merge-tool__files-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .merge-tool__file-actions {
      justify-content: flex-start;
    }
  }
</style>
