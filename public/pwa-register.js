(() => {
  const addManifestLink = () => {
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.append(link);
  };

  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      window.dispatchEvent(new CustomEvent('facilpdf:offline-ready'));
    } catch (error) {
      if (location.hostname === 'localhost') {
        console.warn('[FácilPDF] No se pudo registrar el service worker', error);
      }
    }
  };

  addManifestLink();
  window.addEventListener('load', () => {
    void registerServiceWorker();
  }, { once: true });
})();
