<script lang="ts">
  import SplitPdfToolWithPreviewClient from './SplitPdfToolWithPreviewClient.svelte';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';
</script>

<SplitPdfToolWithPreviewClient {lang} />
