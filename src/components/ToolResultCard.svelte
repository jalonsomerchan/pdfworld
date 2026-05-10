<script lang="ts">
  export let title = 'PDF listo';
  export let description = 'El archivo se ha generado correctamente.';
  export let downloadUrl = '';
  export let filename = 'facilpdf.pdf';
  export let downloadLabel = 'Descargar PDF';
  export let secondaryLabel = '';
</script>

<section class="tool-result" aria-live="polite">
  <div class="tool-result__icon" aria-hidden="true">✓</div>
  <div class="tool-result__content">
    <strong>{title}</strong>
    <p>{description}</p>
    <div class="tool-result__actions">
      {#if downloadUrl}
        <a class="tool-result__download" href={downloadUrl} download={filename}>{downloadLabel}</a>
      {/if}
      {#if secondaryLabel}
        <slot name="secondary"><span class="tool-result__secondary">{secondaryLabel}</span></slot>
      {/if}
    </div>
  </div>
</section>

<style>
  .tool-result {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    padding: clamp(1rem, 2.5vw, 1.35rem);
    border: 1px solid color-mix(in srgb, var(--color-success, #16a34a) 24%, var(--color-border, #e2e8f0));
    border-radius: var(--radius-xl, 1.25rem);
    background: color-mix(in srgb, var(--color-success, #16a34a) 9%, var(--color-surface, #fff));
    box-shadow: var(--shadow-sm, 0 14px 36px rgb(15 23 42 / .08));
  }

  .tool-result__icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border-radius: 999px;
    background: var(--color-success, #16a34a);
    color: #fff;
    font-weight: 950;
    box-shadow: 0 12px 24px color-mix(in srgb, var(--color-success, #16a34a) 28%, transparent);
  }

  .tool-result__content {
    display: grid;
    gap: .4rem;
    min-width: 0;
  }

  .tool-result strong {
    color: var(--color-text, #0f172a);
    font-size: clamp(1rem, 2vw, 1.12rem);
  }

  .tool-result p {
    margin: 0;
    color: var(--color-text-muted, #64748b);
    font-weight: 750;
  }

  .tool-result__actions {
    display: flex;
    flex-wrap: wrap;
    gap: .65rem;
    align-items: center;
    padding-top: .2rem;
  }

  .tool-result__download,
  .tool-result__secondary {
    min-height: 2.55rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: .62rem 1rem;
    border-radius: 999px;
    font-weight: 900;
    text-decoration: none;
  }

  .tool-result__download {
    background: var(--color-text, #0f172a);
    color: var(--color-surface, #fff);
  }

  .tool-result__secondary {
    border: 1px solid var(--color-border, #e2e8f0);
    color: var(--color-text, #0f172a);
  }

  @media (max-width: 520px) {
    .tool-result {
      grid-template-columns: 1fr;
    }
  }
</style>
