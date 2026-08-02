(() => {
  window.__resourceArchiveContributorsCleanup?.();

  const container = document.getElementById('contributors-list') || document.getElementById('contributors');
  if (!container) return;

  const state = window.__resourceArchiveContributorsState || { records: [] };
  window.__resourceArchiveContributorsState = state;
  let disposed = false;
  let suspended = false;
  let controller = null;
  let languageListenerAttached = false;
  let resumePendingRequest = false;
  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const language = () => window.resourceArchiveI18n?.language === 'zh' ? 'zh' : 'en';

  function httpsSourceUrl(value) {
    if (
      typeof value !== 'string'
      || !value.startsWith('https://')
      || /\s/u.test(value)
    ) return null;

    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname ? url.href : null;
    } catch {
      return null;
    }
  }

  function relationshipCopy(record) {
    const pluginIds = Array.isArray(record.plugin_ids) ? record.plugin_ids : [];
    if (!pluginIds.length) return null;
    return language() === 'zh'
      ? { kind: '插件提供者', label: '关联插件：' }
      : { kind: 'Plugin providers', label: 'Related plugin:' };
  }

  function contributorRow(record, index) {
    const article = document.createElement('article');
    article.className = 'contributor-row';
    article.dataset.contributor = record.id;

    const number = document.createElement('span');
    number.className = 'source-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const kind = document.createElement('span');
    kind.className = 'source-kind';
    const relation = relationshipCopy(record);
    const sourceUrl = httpsSourceUrl(record.url);
    kind.textContent = relation?.kind || translate('contributors-card-kind');

    const heading = document.createElement('h3');
    heading.textContent = record.handle && record.handle !== record.name
      ? `${record.name} / ${record.handle}`
      : record.name;

    const note = document.createElement('p');
    if (relation) {
      note.append(document.createTextNode(`${relation.label} `));
      const pluginIds = record.plugin_ids || [];
      pluginIds.forEach((pluginId, pluginIndex) => {
        if (pluginIndex) note.append(document.createTextNode(', '));
        const plugin = document.createElement('span');
        plugin.dataset.pluginRef = pluginId;
        plugin.textContent = pluginId;
        note.append(plugin);
      });
    }
    if (sourceUrl) {
      const link = document.createElement('a');
      link.href = sourceUrl;
      link.textContent = translate('contributors-card-visit', { name: record.name });
      if (relation) note.append(document.createTextNode(' · '));
      note.append(link);
    } else if (!relation) {
      note.textContent = translate('contributors-card-no-url');
    }
    article.append(number, kind, heading, note);
    return article;
  }

  function render() {
    container.replaceChildren(...state.records.map(contributorRow));
  }

  function renderError(error) {
    if (disposed || suspended) return;
    const message = error?.message || '';
    if (error?.name === 'AbortError') return;
    state.error = error;

    const panel = document.createElement('section');
    panel.className = 'error-state';
    const label = document.createElement('p');
    label.className = 'status-label';
    label.textContent = translate('contributors-error-status');
    const heading = document.createElement('h2');
    heading.textContent = translate('contributors-error-heading');
    const reason = document.createElement('p');
    reason.textContent = message.startsWith('HTTP ')
      ? translate('contributors-error-http', { message })
      : translate('contributors-error-unavailable');
    const retry = document.createElement('button');
    retry.className = 'button-secondary';
    retry.dataset.pixelFlicker = '';
    retry.type = 'button';
    retry.append(Object.assign(document.createElement('span'), {
      className: 'pixel-button-label',
      textContent: translate('contributors-retry'),
    }));
    retry.addEventListener('click', () => location.reload());
    panel.append(label, heading, reason, retry);
    container.replaceChildren(panel);
  }

  function onLanguageChange() {
    if (disposed || suspended) return;
    if (state.records.length) render();
    else if (state.error) renderError(state.error);
  }

  function attachLanguageListener() {
    if (languageListenerAttached) return;
    document.addEventListener('resource-archive-language-change', onLanguageChange);
    languageListenerAttached = true;
  }

  function detachLanguageListener() {
    if (!languageListenerAttached) return;
    document.removeEventListener('resource-archive-language-change', onLanguageChange);
    languageListenerAttached = false;
  }

  function loadRecords() {
    if (disposed || suspended || controller || state.records.length) return;
    const requestController = new AbortController();
    controller = requestController;
    fetch('/data/contributors.json', { signal: requestController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((records) => {
        if (disposed || suspended || controller !== requestController) return;
        state.records = records;
        state.error = null;
        render();
      })
      .catch((error) => {
        if (disposed || suspended || controller !== requestController || error?.name === 'AbortError') return;
        renderError(error);
      })
      .finally(() => {
        if (controller === requestController) controller = null;
      });
  }

  function suspend() {
    if (disposed || suspended) return;
    suspended = true;
    resumePendingRequest = Boolean(controller);
    controller?.abort();
    controller = null;
    detachLanguageListener();
  }

  function resume(event) {
    if (disposed || !suspended || !event.persisted) return;
    suspended = false;
    attachLanguageListener();
    if (resumePendingRequest) {
      resumePendingRequest = false;
      loadRecords();
    }
  }

  function onPageHide(event) {
    if (event.persisted) suspend();
    else cleanup();
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    suspended = true;
    controller?.abort();
    controller = null;
    detachLanguageListener();
    removeEventListener('pagehide', onPageHide);
    removeEventListener('pageshow', resume);
    if (window.__resourceArchiveContributorsCleanup === cleanup) {
      delete window.__resourceArchiveContributorsCleanup;
    }
  }

  window.__resourceArchiveContributorsCleanup = cleanup;
  attachLanguageListener();
  addEventListener('pagehide', onPageHide);
  addEventListener('pageshow', resume);

  if (state.records.length) render();
  else if (state.error) renderError(state.error);
  else loadRecords();
})();
