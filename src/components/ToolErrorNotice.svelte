<script lang="ts">
  export let title = 'No se pudo completar la operación';
  export let message = '';
  export let details: string[] = [];
  export let resetLabel = 'Volver a empezar';
  export let variant: 'error' | 'warning' | 'info' = 'error';
  export let onReset: (() => void) | undefined = undefined;
</script>

<section class={`tool-error tool-error--${variant}`} role={variant === 'error' ? 'alert' : 'status'} aria-live={variant === 'error' ? 'assertive' : 'polite'}>
  <span class="tool-error__icon" aria-hidden="true">{variant === 'error' ? '⚠️' : variant === 'warning' ? '💡' : 'ℹ️'}</span>
  <div class="tool-error__body">
    <h3>{title}</h3>
    {#if message}<p>{message}</p>{/if}
    {#if details.length > 0}
      <ul>
        {#each details as detail}
          <li>{detail}</li>
        {/each}
      </ul>
    {/if}
    {#if onReset}
      <button type="button" on:click={() => onReset?.()}>{resetLabel}</button>
    {/if}
  </div>
</section>

<style>
  .tool-error{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;width:100%;max-width:100%;min-width:0;padding:16px;border:1px solid color-mix(in srgb,var(--tool-error-color,#dc2626) 28%,#e2e8f0);border-radius:18px;background:color-mix(in srgb,var(--tool-error-color,#dc2626) 8%,#fff);color:#0f172a;animation:tool-error-in 220ms ease-out both}.tool-error--warning{--tool-error-color:#d97706}.tool-error--info{--tool-error-color:#2563eb}.tool-error__icon{display:grid;width:42px;height:42px;place-items:center;border-radius:14px;background:#fff;box-shadow:0 8px 18px rgb(15 23 42 / .08);animation:tool-error-icon 360ms ease-out 80ms both}.tool-error__body{display:grid;gap:8px;min-width:0}.tool-error h3,.tool-error p,.tool-error ul{margin:0}.tool-error h3{font-size:1.02rem;letter-spacing:-.02em;overflow-wrap:anywhere}.tool-error p,.tool-error li{color:#475569;overflow-wrap:anywhere}.tool-error ul{padding-left:1.2rem}.tool-error button{width:fit-content;min-height:44px;padding:10px 15px;border:0;border-radius:999px;background:var(--tool-error-color,#dc2626);color:#fff;cursor:pointer;font:inherit;font-weight:900;transition:transform 150ms ease,box-shadow 150ms ease,filter 150ms ease}.tool-error button:hover,.tool-error button:focus-visible{transform:translateY(-1px);box-shadow:0 12px 24px color-mix(in srgb,var(--tool-error-color,#dc2626) 22%,transparent);filter:saturate(1.04);outline:none}@keyframes tool-error-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes tool-error-icon{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}@media (prefers-reduced-motion:reduce){.tool-error,.tool-error__icon{animation:none}.tool-error button{transition:none}}@media (max-width:520px){.tool-error{grid-template-columns:1fr;border-radius:var(--radius-lg,1rem)}.tool-error button{width:100%}}
</style>
