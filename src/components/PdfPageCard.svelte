<script lang="ts">
  export let pageNumber: number;
  export let title = `Página ${pageNumber}`;
  export let thumbnailUrl = '';
  export let thumbnailStatus: 'pending' | 'ready' | 'failed' = 'pending';
  export let selected = true;
  export let removed = false;
  export let rotation = 0;
  export let selectLabel = 'Seleccionar página';
  export let rotateLeftLabel = 'Girar izquierda';
  export let rotateRightLabel = 'Girar derecha';
  export let removeLabel = 'Eliminar';
  export let restoreLabel = 'Restaurar';
  export let showRotate = true;
  export let showRemove = true;
  export let onToggle: () => void = () => {};
  export let onRotateLeft: () => void = () => {};
  export let onRotateRight: () => void = () => {};
  export let onRemove: () => void = () => {};

  $: normalizedRotation = ((rotation % 360) + 360) % 360;
  $: thumbScale = normalizedRotation === 90 || normalizedRotation === 270 ? 0.72 : 1;
  $: thumbStyle = `transform: rotate(${normalizedRotation}deg) scale(${thumbScale});`;
</script>

<article
  class:pdf-page-card={true}
  class:pdf-page-card--selected={selected}
  class:pdf-page-card--removed={removed}
>
  <button
    type="button"
    class="pdf-page-card__preview"
    aria-pressed={selected}
    aria-label={`${selectLabel} ${pageNumber}`}
    on:click|stopPropagation={onToggle}
  >
    {#if thumbnailStatus === 'ready' && thumbnailUrl}
      <img src={thumbnailUrl} alt={title} style={thumbStyle} loading="lazy" />
    {:else}
      <span class:pdf-page-card__placeholder={true} class:pdf-page-card__placeholder--loading={thumbnailStatus === 'pending'}>
        {thumbnailStatus === 'pending' ? '...' : pageNumber}
      </span>
    {/if}
  </button>

  <div class="pdf-page-card__meta">
    <strong>{title}</strong>
    <span>{normalizedRotation}°</span>
  </div>

  {#if showRotate || showRemove}
    <div class="pdf-page-card__actions">
      {#if showRotate}
        <button type="button" on:click|stopPropagation={onRotateLeft} aria-label={`${rotateLeftLabel} ${pageNumber}`}>↶</button>
        <button type="button" on:click|stopPropagation={onRotateRight} aria-label={`${rotateRightLabel} ${pageNumber}`}>↷</button>
      {/if}
      {#if showRemove}
        <button type="button" class="pdf-page-card__danger" on:click|stopPropagation={onRemove}>
          {removed || !selected ? restoreLabel : removeLabel}
        </button>
      {/if}
    </div>
  {/if}
</article>

<style>
  .pdf-page-card {
    display: grid;
    gap: 10px;
    padding: 10px;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    background: #fff;
    color: #0f172a;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
    transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
  }

  .pdf-page-card:hover {
    transform: translateY(-1px);
  }

  .pdf-page-card--selected {
    border-color: #ef4444;
    background: #fff1f2;
    box-shadow: 0 16px 34px rgba(239, 68, 68, 0.14);
  }

  .pdf-page-card--removed {
    opacity: 0.58;
    border-color: #fecaca;
  }

  .pdf-page-card__preview {
    display: grid;
    min-height: 150px;
    place-items: center;
    overflow: hidden;
    width: 100%;
    padding: 0;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fafc;
    color: #94a3b8;
    cursor: pointer;
    font: inherit;
    font-weight: 950;
  }

  .pdf-page-card__preview img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    transition: transform 180ms ease;
  }

  .pdf-page-card__placeholder {
    display: grid;
    width: 100%;
    min-height: 130px;
    place-items: center;
    background: #f1f5f9;
    font-size: 1.2rem;
  }

  .pdf-page-card__placeholder--loading {
    background: linear-gradient(100deg, #f1f5f9 20%, #fff 45%, #f1f5f9 70%);
    background-size: 220% 100%;
    animation: pdf-page-loading 1.4s ease-in-out infinite;
  }

  .pdf-page-card__meta,
  .pdf-page-card__actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .pdf-page-card__meta span {
    padding: 5px 8px;
    border-radius: 999px;
    background: #fee2e2;
    color: #991b1b;
    font-weight: 950;
    font-size: 0.8rem;
  }

  .pdf-page-card__actions {
    flex-wrap: wrap;
  }

  .pdf-page-card__actions button {
    flex: 1 1 auto;
    min-height: 36px;
    padding: 6px 8px;
    border: 0;
    border-radius: 999px;
    background: #e2e8f0;
    color: #334155;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
  }

  .pdf-page-card__actions .pdf-page-card__danger {
    background: #fee2e2;
    color: #991b1b;
  }

  @keyframes pdf-page-loading {
    0% { background-position: 120% 0; }
    100% { background-position: -120% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pdf-page-card,
    .pdf-page-card__preview img,
    .pdf-page-card__placeholder--loading {
      animation: none;
      transition: none;
    }
  }
</style>
