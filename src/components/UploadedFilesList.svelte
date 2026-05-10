<script lang="ts">
  export type UploadedFileItem = {
    id: string;
    name: string;
    size: string;
    type?: string;
    status?: 'ready' | 'warning' | 'error' | 'processing' | 'done';
    statusLabel?: string;
  };

  type Props = {
    files?: UploadedFileItem[];
    title?: string;
    emptyText?: string;
    summaryLabel?: string;
    removable?: boolean;
    reorderable?: boolean;
    removeLabel?: string;
    moveUpLabel?: string;
    moveDownLabel?: string;
    onRemove?: ((file: UploadedFileItem) => void) | null;
    onMoveUp?: ((file: UploadedFileItem) => void) | null;
    onMoveDown?: ((file: UploadedFileItem) => void) | null;
  };

  let {
    files = [],
    title = 'Archivos cargados',
    emptyText = 'Todavía no has seleccionado ningún archivo.',
    summaryLabel = 'archivos preparados',
    removable = true,
    reorderable = false,
    removeLabel = 'Eliminar',
    moveUpLabel = 'Subir',
    moveDownLabel = 'Bajar',
    onRemove = null,
    onMoveUp = null,
    onMoveDown = null,
  }: Props = $props();

  const totalFiles = $derived(files.length);
</script>

<section class="uploaded-files" aria-labelledby="uploaded-files-title">
  <div class="uploaded-files__header">
    <div>
      <h2 id="uploaded-files-title">{title}</h2>
      <p>{totalFiles} {summaryLabel}</p>
    </div>
  </div>

  {#if files.length === 0}
    <p class="uploaded-files__empty">{emptyText}</p>
  {:else}
    <ul class="uploaded-files__list">
      {#each files as file, index (file.id)}
        <li class={`uploaded-file uploaded-file--${file.status ?? 'ready'}`}>
          <span class="uploaded-file__icon" aria-hidden="true">{file.type?.startsWith('image/') ? '🖼️' : '📄'}</span>

          <div class="uploaded-file__main">
            <strong title={file.name}>{file.name}</strong>
            <span>{file.size}{file.type ? ` · ${file.type}` : ''}</span>
          </div>

          {#if file.statusLabel}
            <span class="uploaded-file__status">{file.statusLabel}</span>
          {/if}

          <div class="uploaded-file__actions">
            {#if reorderable && onMoveUp}
              <button type="button" onclick={() => onMoveUp?.(file)} disabled={index === 0}>{moveUpLabel}</button>
            {/if}
            {#if reorderable && onMoveDown}
              <button type="button" onclick={() => onMoveDown?.(file)} disabled={index === files.length - 1}>{moveDownLabel}</button>
            {/if}
            {#if removable && onRemove}
              <button class="uploaded-file__remove" type="button" onclick={() => onRemove?.(file)}>{removeLabel}</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .uploaded-files {
    display: grid;
    gap: 1rem;
    width: 100%;
  }

  .uploaded-files__header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  .uploaded-files h2,
  .uploaded-files p {
    margin: 0;
  }

  .uploaded-files h2 {
    color: var(--color-text, #0f172a);
    font-size: clamp(1.2rem, 2vw, 1.55rem);
    line-height: 1.1;
  }

  .uploaded-files__header p,
  .uploaded-files__empty {
    color: var(--color-text-muted, #475569);
  }

  .uploaded-files__empty {
    padding: 1rem;
    border: 1px dashed var(--color-border, #e2e8f0);
    border-radius: var(--radius-xl, 1.25rem);
    background: var(--color-surface-soft, #f1f5f9);
  }

  .uploaded-files__list {
    display: grid;
    gap: .75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .uploaded-file {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: .85rem;
    align-items: center;
    padding: .85rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-xl, 1.25rem);
    background: var(--color-surface, #fff);
    box-shadow: var(--shadow-xs, 0 1px 2px rgb(15 23 42 / .06));
  }

  .uploaded-file__icon {
    display: grid;
    width: 2.7rem;
    height: 2.7rem;
    place-items: center;
    border-radius: var(--radius-lg, 1rem);
    background: var(--color-primary-soft, #dbeafe);
    font-size: 1.15rem;
  }

  .uploaded-file__main {
    display: grid;
    gap: .15rem;
    min-width: 0;
  }

  .uploaded-file__main strong,
  .uploaded-file__main span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .uploaded-file__main strong {
    color: var(--color-text, #0f172a);
  }

  .uploaded-file__main span {
    color: var(--color-text-soft, #64748b);
    font-size: .9rem;
  }

  .uploaded-file__status {
    width: fit-content;
    padding: .35rem .55rem;
    border-radius: var(--radius-full, 999px);
    background: var(--color-surface-soft, #f1f5f9);
    color: var(--color-text-muted, #475569);
    font-size: .78rem;
    font-weight: 850;
  }

  .uploaded-file--done .uploaded-file__status {
    background: var(--color-success-soft, #dcfce7);
    color: var(--color-success, #16a34a);
  }

  .uploaded-file--warning .uploaded-file__status {
    background: var(--color-warning-soft, #fef3c7);
    color: var(--color-warning, #d97706);
  }

  .uploaded-file--error .uploaded-file__status {
    background: var(--color-danger-soft, #fee2e2);
    color: var(--color-danger, #dc2626);
  }

  .uploaded-file--processing .uploaded-file__status {
    background: var(--color-primary-soft, #dbeafe);
    color: var(--color-primary, #2563eb);
  }

  .uploaded-file__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: .4rem;
  }

  .uploaded-file__actions button {
    min-height: 2.2rem;
    padding: .45rem .65rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-full, 999px);
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
    cursor: pointer;
    font-size: .82rem;
    font-weight: 850;
  }

  .uploaded-file__actions button:hover:not(:disabled) {
    background: var(--color-surface-soft, #f1f5f9);
  }

  .uploaded-file__actions button:disabled {
    cursor: not-allowed;
    opacity: .45;
  }

  .uploaded-file__actions .uploaded-file__remove {
    color: var(--color-danger, #dc2626);
  }

  @media (max-width: 720px) {
    .uploaded-file {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .uploaded-file__status,
    .uploaded-file__actions {
      grid-column: 2;
      justify-content: flex-start;
    }
  }

  @media (max-width: 420px) {
    .uploaded-file__actions button {
      flex: 1 1 auto;
    }
  }
</style>
