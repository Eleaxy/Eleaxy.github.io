(() => {
  let totalsPromise = null;

  function collection(value, name) {
    if (!Array.isArray(value)) throw new TypeError(`Invalid archive statistics source: ${name}`);
    return value;
  }

  function loadJson(url) {
    return fetch(url).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  function load() {
    if (!totalsPromise) {
      const manifest = window.ResourceArchiveStages?.loadManifest?.()
        || loadJson('/data/migrated/manifest.json');
      const tutorials = window.ResourceArchiveTutorials?.load?.() || loadJson('/data/tutorials.json');
      const videos = window.ResourceArchiveVideos?.load?.() || loadJson('/data/videos.json');
      const pending = Promise.all([
        manifest,
        tutorials,
        videos,
        loadJson('/data/plugins.json'),
      ]).then(([manifestValue, tutorials, videos, plugins]) => ({
        nodes: collection(manifestValue?.nodes, 'manifest nodes').length,
        stages: collection(manifestValue?.stages, 'manifest stages').length,
        tutorials: collection(tutorials, 'tutorials').length,
        videos: collection(videos, 'videos').length,
        plugins: collection(plugins, 'plugins').length,
      }));
      totalsPromise = pending;
      void pending.catch(() => {
        if (totalsPromise === pending) totalsPromise = null;
      });
    }
    return totalsPromise;
  }

  function translate(key, parameters = {}) {
    return window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  }

  function bindHomeStatistics() {
    const facts = document.querySelector('[data-home-facts]');
    const values = [...document.querySelectorAll('[data-archive-stat]')];
    if (!facts || !values.length) return;
    let statistics = null;
    let failed = false;
    const render = () => {
      if (statistics) {
        values.forEach(value => { value.textContent = String(statistics[value.dataset.archiveStat]); });
        facts.textContent = translate('home-facts', statistics);
        return;
      }
      const marker = translate(failed ? 'archive-stats-unavailable' : 'archive-stats-loading');
      values.forEach(value => { value.textContent = marker; });
      facts.textContent = translate(failed ? 'home-facts-unavailable' : 'home-facts-loading');
    };
    document.addEventListener('resource-archive-language-change', render);
    render();
    load().then(result => {
      statistics = result;
      render();
    }).catch(() => {
      failed = true;
      render();
    });
  }

  window.ResourceArchiveStats = Object.freeze({ load });
  if (typeof document !== 'undefined') bindHomeStatistics();
})();
