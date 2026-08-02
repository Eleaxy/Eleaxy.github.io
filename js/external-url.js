(() => {
  const PLUGIN_SOURCE_HOSTS = new Set(['github.com', 'pan.quark.cn', 'www.bilibili.com']);

  function safePluginSourceUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && PLUGIN_SOURCE_HOSTS.has(url.hostname) ? url.href : null;
    } catch {
      return null;
    }
  }

  window.ResourceArchiveExternalUrl = Object.freeze({ safePluginSourceUrl });
})();
