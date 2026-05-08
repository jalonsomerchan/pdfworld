<script lang="ts">
  import { onMount } from 'svelte';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';

  let Component: typeof import('./SplitPdfToolWithPreview.svelte').default | null = null;

  onMount(async () => {
    Component = (await import('./SplitPdfToolWithPreview.svelte')).default;
  });
</script>

{#if Component}
  <svelte:component this={Component} {lang} />
{:else}
  <section class="split-preview-loader" aria-live="polite">
    <strong>{lang === 'es' ? 'Preparando visualizador de páginas…' : 'Preparing page preview…'}</strong>
  </section>
{/if}

<style>
  .split-preview-loader {
    margin: 32px 0 64px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.88);
    color: #475569;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }
</style>
