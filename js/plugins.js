(() => {
  window.__resourceArchivePluginsCleanup?.();

  let container = document.getElementById('plugins');
  if (!container) return;

  const validIds = new Set(['automation-flow', 'autocel']);
  const shell = document.body.dataset.page === 'plugins';
  const root = document.querySelector('[data-main-content]');
  const state = window.__resourceArchivePluginsState || { records: [] };
  state.prefetchIdle ??= null;
  state.pendingFocusPlugin ??= null;
  window.__resourceArchivePluginsState = state;

  let recordsController = null;
  let disposed = false;
  let router = null;
  let cache = null;
  let activeRendererCleanup = null;
  let languageNavigationEpoch = 0;
  let contentTableRetryPromise = null;
  const transitionNames = Object.freeze({
    'automation-flow': { title: 'plugin-title-automation-flow' },
    autocel: { title: 'plugin-title-autocel', art: 'plugin-art-autocel' },
  });

  const translate = (key, parameters) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const text = () => ({
    eyebrow: translate('plugins-register-eyebrow'), title: translate('plugins-title'), lede: translate('plugins-register-lede'),
    loading: translate('plugins-loading'), verification: translate('plugins-verification'), releaseTag: translate('plugins-release-tag'),
    manifestVersion: translate('plugins-manifest-version'), compatibility: translate('plugins-compatibility'), artifact: translate('plugins-installation-artifact'),
    license: translate('plugins-license'), provider: translate('plugins-provider'), maintainer: translate('plugins-maintainer-attribution'),
    documentationClaims: translate('plugins-documentation-claims'), documentationSource: translate('plugins-documentation-source'),
    sourceSha256: translate('plugins-source-sha256'), openDetail: translate('plugins-open-detail'), sourceCount: translate('plugins-source-count'),
    destination: translate('plugins-destination'), destinationInvalid: translate('plugins-destination-invalid'), unavailable: translate('plugins-unavailable'),
    artifactUnavailable: translate('plugins-artifact-unavailable'), licenseUnavailable: translate('plugins-license-unavailable'),
    destinationUnavailable: translate('plugins-destination-unavailable'), errorStatus: translate('plugins-error-status'),
    errorHeading: translate('plugins-error-heading'), errorHttp: translate('plugins-error-http'), errorUnavailable: translate('plugins-error-unavailable'),
    retry: translate('plugins-retry'), back: translate('plugin-detail-back'), detailLoading: translate('plugin-detail-loading'),
    detailUnavailable: translate('plugin-detail-unavailable'), detailErrorHeading: translate('plugin-detail-error-heading'),
    detailErrorUnavailable: translate('plugin-detail-error-unavailable'), detailRetry: translate('plugin-detail-retry'),
    imageUnavailable: translate('plugin-detail-image-unavailable'),
  });

  function localized(value) {
    if (value && typeof value === 'object') return value[window.resourceArchiveI18n?.language || 'en'] || value.en || value.zh || '';
    return value || '';
  }

  function markSourceLanguage(element, value) {
    if ((window.resourceArchiveI18n?.language || 'en') === 'en' && /[\u3400-\u9fff]/.test(value || '')) element.lang = 'zh-CN';
    return element;
  }

  function transitionName(id, part) {
    return transitionNames[id]?.[part] || '';
  }

  function clearPluginTransitionParts() {
    root?.querySelectorAll('[data-plugin-transition-selected]').forEach(node => {
      node.removeAttribute('data-plugin-transition-selected');
      node.style.removeProperty('view-transition-name');
    });
  }

  function preparePluginTransition(event) {
    if (event.type === 'pointerdown' && (event.button !== 0 || (event.isPrimary === false && event.pointerType)
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
      clearPluginTransitionParts();
      return;
    }
    const link = event.target.closest?.('[data-plugin-detail-link]');
    if (!link || !root?.contains(link)) return clearPluginTransitionParts();
    const row = link.closest('[data-plugin]');
    if (!row) return clearPluginTransitionParts();
    clearPluginTransitionParts();
    const id = row.dataset.plugin;
    for (const [part, selector] of [['title', '[data-plugin-transition-title]'], ['art', '[data-plugin-transition-art]']]) {
      const element = row.querySelector(selector);
      if (!element) continue;
      element.dataset.pluginTransitionSelected = '';
      element.style.setProperty('view-transition-name', transitionName(id, part));
    }
  }

  function definitionTerm(value) {
    const element = document.createElement('dt');
    element.textContent = value;
    return element;
  }

  function definitionValue(value, className = '') {
    const element = document.createElement('dd');
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function safeDetailPath(value) {
    return typeof value === 'string' && /^\/plugins\.html\?plugin=(automation-flow|autocel)$/.test(value) ? value : null;
  }

  function pluginRow(record) {
    const copy = text();
    const article = document.createElement('article');
    article.className = 'plugin-row';
    article.dataset.plugin = record.id;
    const overview = document.createElement('div');
    overview.className = 'plugin-overview';
    const heading = document.createElement('h2');
    heading.textContent = record.name;
    heading.dataset.pluginTransitionTitle = record.id;
    overview.append(heading);
    if (record.id === 'autocel') {
      const art = document.createElement('img');
      art.className = 'plugin-transition-art';
      art.dataset.pluginTransitionArt = '';
      art.src = '/assets/plugins/autocel/logos/autocel-basics-logo.png';
      art.alt = 'AutoCel Basic logo';
      art.width = 88;
      art.height = 88;
      art.loading = 'eager';
      art.decoding = 'async';
      art.style.cssText = 'display:block;width:88px;height:88px;object-fit:contain;margin:0 0 16px;';
      overview.prepend(art);
    }
    const summary = localized(record.summary);
    if (summary) {
      const description = document.createElement('p');
      description.className = 'plugin-summary';
      description.textContent = summary;
      overview.append(description);
    }
    const detailPath = safeDetailPath(record.detail_path);
    if (detailPath) {
      const detail = document.createElement('a');
      detail.className = 'button-primary plugin-detail-link';
      detail.dataset.pluginDetailLink = '';
      detail.dataset.pixelFlicker = '';
      detail.href = detailPath;
      detail.append(Object.assign(document.createElement('span'), { className: 'pixel-button-label', textContent: copy.openDetail }));
      overview.append(detail);
    }
    article.append(overview);

    const definitions = document.createElement('dl');
    definitions.className = 'plugin-definitions';
    const provider = definitionValue(record.provider || copy.unavailable);
    provider.dataset.pluginProvider = '';
    markSourceLanguage(provider, record.provider);
    definitions.append(definitionTerm(copy.provider), provider);
    if (record.release_tag !== undefined) definitions.append(definitionTerm(copy.releaseTag), definitionValue(record.release_tag || copy.unavailable));
    if (record.manifest_version !== undefined) definitions.append(definitionTerm(copy.manifestVersion), definitionValue(record.manifest_version || copy.unavailable));
    if (record.compatibility) definitions.append(definitionTerm(copy.compatibility), definitionValue(localized(record.compatibility)));
    if (record.license) definitions.append(definitionTerm(copy.license), definitionValue(localized(record.license)));
    const destinations = Array.isArray(record.external_destinations) ? record.external_destinations : [];
    definitions.append(definitionTerm(copy.destination));
    if (!destinations.length) definitions.append(definitionValue(copy.destinationUnavailable, 'plugin-absence'));
    else {
      const value = document.createElement('dd');
      destinations.forEach((destination, index) => {
        if (index) value.append(document.createTextNode(' · '));
        const safeUrl = window.ResourceArchiveExternalUrl?.safePluginSourceUrl(destination.url);
        if (!safeUrl) {
          const invalid = document.createElement('span');
          invalid.className = 'plugin-invalid-destination plugin-absence';
          invalid.dataset.invalidDestination = '';
          invalid.textContent = `${localized(destination.label)} — ${copy.destinationInvalid}`;
          value.append(invalid);
        } else {
          const link = document.createElement('a');
          link.dataset.pixelFlicker = '';
          link.href = safeUrl;
          link.append(Object.assign(document.createElement('span'), { className: 'pixel-button-label', textContent: localized(destination.label) }));
          value.append(link);
        }
      });
      definitions.append(value);
    }
    article.append(definitions);
    return article;
  }

  function createListView() {
    const fragment = document.createDocumentFragment();
    const header = document.createElement('header');
    header.className = 'plugins-register-header';
    header.dataset.pluginRegisterHeader = '';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.dataset.pluginRegisterEyebrow = '';
    const heading = document.createElement('h1');
    heading.id = 'plugins-title';
    heading.dataset.pluginRegisterTitle = '';
    const lede = document.createElement('p');
    lede.className = 'lede';
    lede.dataset.pluginRegisterLede = '';
    header.append(eyebrow, heading, lede);
    const section = document.createElement('section');
    section.className = 'plugin-register';
    section.setAttribute('aria-labelledby', heading.id);
    const list = document.createElement('div');
    list.id = 'plugins';
    list.className = 'plugin-list';
    list.setAttribute('aria-live', 'polite');
    section.append(list);
    fragment.append(header, section);
    return fragment;
  }

  function renderHeader(scope = document) {
    const copy = text();
    scope.querySelector('[data-plugin-register-eyebrow]')?.replaceChildren(copy.eyebrow);
    scope.querySelector('[data-plugin-register-title]')?.replaceChildren(copy.title);
    scope.querySelector('[data-plugin-register-lede]')?.replaceChildren(copy.lede);
  }

  function renderList() {
    if (!container?.isConnected) return;
    renderHeader(root || document);
    if (!state.records.length) {
      const loading = document.createElement('p');
      loading.className = 'loading';
      loading.dataset.pluginLoading = '';
      loading.setAttribute('role', 'status');
      loading.textContent = text().loading;
      container.replaceChildren(loading);
      return;
    }
    container.replaceChildren(...state.records.map(pluginRow));
  }

  function renderListError(error) {
    if (!container?.isConnected) return;
    renderHeader(root || document);
    const copy = text();
    const panel = document.createElement('section');
    panel.className = 'error-state plugin-error-state';
    panel.append(
      Object.assign(document.createElement('p'), { className: 'status-label', textContent: copy.errorStatus }),
      Object.assign(document.createElement('h2'), { textContent: copy.errorHeading }),
      Object.assign(document.createElement('p'), { textContent: (error?.message || '').startsWith('HTTP ') ? copy.errorHttp.replace('{message}', error.message) : copy.errorUnavailable }),
    );
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button-secondary';
    retry.dataset.pluginRecordsRetry = '';
    retry.append(Object.assign(document.createElement('span'), { className: 'pixel-button-label', textContent: copy.retry }));
    panel.append(retry);
    container.replaceChildren(panel);
  }

  function pluginRouteFromUrl(url) {
    const entries = [...url.searchParams.entries()];
    if (entries.length === 1 && entries[0][0] === 'plugin' && validIds.has(entries[0][1])) {
      return { id: entries[0][1] };
    }
    if (entries.length === 2 && entries[0][0] === 'plugin' && entries[0][1] === 'automation-flow'
      && entries[1][0] === 'node' && /^AFNode[A-Za-z0-9]+$/.test(entries[1][1])) {
      return { id: 'automation-flow', nodeId: entries[1][1] };
    }
    return null;
  }

  function parseUrl(url) {
    const route = pluginRouteFromUrl(url);
    return route ? { kind: 'detail', ...route } : { kind: 'list' };
  }

  function canHandle(url) {
    return url.search === '' || pluginRouteFromUrl(url) !== null;
  }

  function capture() {
    const active = document.activeElement;
    const detailLink = active?.closest?.('[data-plugin][data-plugin] [data-plugin-detail-link]');
    const automationFlowNode = active?.closest?.('[data-automation-flow-node-trigger]');
    const detailControlAttributes = [
      'data-autocel-node-search',
      'data-autocel-node-clear',
      'data-autocel-category',
      'data-autocel-edition',
      'data-autocel-panel-mode',
      'data-automation-flow-node-back',
      'data-automation-flow-related-node',
    ];
    const detailControl = active?.closest?.(detailControlAttributes.map(attribute => `[${attribute}]`).join(', '));
    const detailControlAttribute = detailControlAttributes.find(attribute => detailControl?.hasAttribute(attribute)) || null;
    const focusPlugin = detailLink?.closest('[data-plugin]')?.dataset.plugin || state.pendingFocusPlugin;
    state.pendingFocusPlugin = null;
    return {
      x: window.scrollX,
      y: window.scrollY,
      focusPlugin,
      focusAutomationFlowNode: automationFlowNode?.dataset.automationFlowNodeTrigger || null,
      focusDetailControl: detailControlAttribute ? {
        attribute: detailControlAttribute,
        value: detailControl.getAttribute(detailControlAttribute),
      } : null,
    };
  }

  async function restore(snapshot, { signal, isCurrent } = {}) {
    const current = () => !signal?.aborted && (typeof isCurrent !== 'function' || isCurrent());
    if (!snapshot || !current()) return;
    const restoreScroll = () => window.scrollTo({
      left: snapshot.x || 0,
      top: snapshot.y || 0,
      behavior: 'instant',
    });
    restoreScroll();
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!current()) return;
    restoreScroll();
    if (snapshot.focusPlugin) root?.querySelector(`[data-plugin="${snapshot.focusPlugin}"] [data-plugin-detail-link]`)?.focus({ preventScroll: true });
    if (snapshot.focusAutomationFlowNode) {
      root?.querySelector(`[data-automation-flow-node-trigger="${snapshot.focusAutomationFlowNode}"]`)?.focus({ preventScroll: true });
    }
    if (snapshot.focusDetailControl) {
      const { attribute, value } = snapshot.focusDetailControl;
      const allowed = new Set([
        'data-autocel-node-search',
        'data-autocel-node-clear',
        'data-autocel-category',
        'data-autocel-edition',
        'data-autocel-panel-mode',
        'data-automation-flow-node-back',
        'data-automation-flow-related-node',
      ]);
      if (allowed.has(attribute)) {
        const selector = value ? `[${attribute}="${CSS.escape(value)}"]` : `[${attribute}]`;
        root?.querySelector(selector)?.focus({ preventScroll: true });
      }
    }
  }

  function detailTitle(id) {
    const zh = window.resourceArchiveI18n?.language === 'zh';
    const name = id === 'autocel' ? 'AutoCel' : 'Automation Flow';
    return `${name} · ${zh ? '资源档案' : 'Resource Archive'}`;
  }

  function detailShell(detail, route) {
    const wrapper = document.createElement('div');
    wrapper.className = 'plugin-detail-shell';
    const backline = document.createElement('p');
    backline.className = 'plugin-backline';
    const back = document.createElement('a');
    back.className = 'back-link';
    back.href = '/plugins.html';
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    back.textContent = text().back;
    backline.append(back);
    const app = document.createElement('div');
    app.dataset.pluginDetailApp = '';
    app.setAttribute('aria-live', 'polite');
    app.append(window.ResourceArchivePluginDetail.render(detail, {
      language: window.resourceArchiveI18n?.language || 'en',
      route,
    }));
    wrapper.append(backline, app);
    return wrapper;
  }

  function detailSkeleton(id) {
    const copy = text();
    const name = id === 'autocel' ? 'AutoCel' : 'Automation Flow';
    const wrapper = document.createElement('div');
    wrapper.className = 'plugin-detail-shell plugin-detail-skeleton';
    wrapper.dataset.pluginDetailSkeleton = id;
    const backline = document.createElement('p');
    backline.className = 'plugin-backline';
    const back = Object.assign(document.createElement('a'), { className: 'back-link', href: '/plugins.html', textContent: copy.back });
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    backline.append(back);
    const article = document.createElement('article');
    article.className = 'plugin-detail plugin-detail-loading-shell';
    const header = document.createElement('header');
    header.className = 'plugin-detail-header';
    const heading = document.createElement('h1');
    heading.textContent = name;
    const status = document.createElement('p');
    status.className = 'loading';
    status.dataset.pluginDetailLoading = '';
    status.setAttribute('role', 'status');
    status.textContent = copy.detailLoading;
    header.append(heading, status);
    article.append(header);
    wrapper.append(backline, article);
    return wrapper;
  }

  function detailError(error, id) {
    const copy = text();
    const wrapper = document.createElement('div');
    wrapper.className = 'plugin-detail-shell';
    const backline = document.createElement('p');
    backline.className = 'plugin-backline';
    const back = Object.assign(document.createElement('a'), { className: 'back-link', href: '/plugins.html', textContent: copy.back });
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    backline.append(back);
    const panel = document.createElement('section');
    panel.className = 'error-state plugin-detail-error';
    panel.dataset.pluginDetailError = '';
    panel.append(
      Object.assign(document.createElement('p'), { className: 'status-label', textContent: copy.detailUnavailable }),
      Object.assign(document.createElement('h2'), { textContent: copy.detailErrorHeading }),
      Object.assign(document.createElement('p'), { textContent: error?.message || copy.detailErrorUnavailable }),
    );
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button-secondary';
    retry.dataset.pluginDetailRetry = id;
    retry.append(Object.assign(document.createElement('span'), { className: 'pixel-button-label', textContent: copy.detailRetry }));
    panel.append(retry);
    wrapper.append(backline, panel);
    return wrapper;
  }

  function contentTableErrorView(error) {
    const panel = document.createElement('section');
    panel.className = 'error-state content-table-error';
    panel.dataset.contentTableError = error.contentTable;
    panel.setAttribute('role', 'alert');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button-secondary';
    retry.dataset.contentTableRetry = error.contentTable;
    retry.dataset.pixelFlicker = '';
    retry.append(Object.assign(document.createElement('span'), {
      className: 'pixel-button-label',
      textContent: translate('content-table-retry'),
    }));
    panel.append(
      Object.assign(document.createElement('p'), {
        className: 'status-label',
        textContent: translate('content-table-error-status'),
      }),
      Object.assign(document.createElement('h2'), {
        textContent: translate('content-table-error-heading'),
      }),
      Object.assign(document.createElement('p'), {
        textContent: translate('content-table-error-message'),
      }),
      retry,
    );
    return panel;
  }

  function showContentTableError(error) {
    if (disposed || !error?.contentTable || !root) return;
    root.querySelector('[data-content-table-error]')?.remove();
    root.prepend(contentTableErrorView(error));
    window.ResourceArchivePixelField?.refreshTargets?.();
  }

  function languageRenderOperation({ requireChinese = false, direction = 'language' } = {}) {
    const href = window.location.href;
    const requestedLanguage = window.resourceArchiveI18n?.language || 'en';
    const epoch = ++languageNavigationEpoch;
    const isCurrent = () => !disposed
      && epoch === languageNavigationEpoch
      && window.location.href === href
      && window.resourceArchiveI18n?.language === requestedLanguage
      && (!requireChinese || requestedLanguage === 'zh');
    return {
      direction,
      href,
      requestedLanguage,
      snapshot: capture(),
      isCurrent,
    };
  }

  function announceLanguageTransition(phase, detail) {
    root?.dispatchEvent(new CustomEvent(`resourcearchiveinternalviewrouter${phase}`, {
      detail,
    }));
  }

  async function renderLanguageInPlace(operation) {
    await Promise.resolve();
    if (!operation.isCurrent()) return;
    const route = parseUrl(new URL(operation.href));
    if (route.kind === 'list') {
      document.title = operation.requestedLanguage === 'zh' ? '插件 · 资源档案' : 'Plugins · Resource Archive';
      renderHeader(root);
      renderList();
      return;
    }

    const transition = {
      token: Symbol('plugin-language-render'),
      route,
      direction: operation.direction,
    };
    announceLanguageTransition('beforetransition', transition);
    try {
      if (!operation.isCurrent()) return;
      await window.ResourceArchivePluginDetail.prepareLanguage?.(route.id, operation.requestedLanguage);
      if (!operation.isCurrent()) return;
      const prepared = cache?.peek(route.id);
      if (!prepared) return;
      const shellView = detailShell(prepared.detail, route);
      if (!operation.isCurrent()) return;
      root.replaceChildren(shellView);
      hydrate(root, route, prepared.detail);
      if (!operation.isCurrent()) return;
      await restore(operation.snapshot, { isCurrent: operation.isCurrent });
    } finally {
      announceLanguageTransition('transitionfinished', transition);
    }
  }

  async function retryContentTable(button) {
    if (disposed || contentTableRetryPromise || button.disabled) return;
    const table = button.dataset.contentTableRetry;
    const panel = button.closest('[data-content-table-error]');
    if (!table || !panel || !router) return;
    const operation = languageRenderOperation({ requireChinese: true, direction: 'retry' });
    button.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    const pending = window.resourceArchiveI18n.retryContentTable(table).then(async () => {
      if (!operation.isCurrent()) return;
      await renderLanguageInPlace(operation);
    }).catch(error => {
      if (operation.isCurrent()) showContentTableError(error);
    }).finally(() => {
      if (contentTableRetryPromise === pending) contentTableRetryPromise = null;
    });
    contentTableRetryPromise = pending;
    await pending;
  }

  function cancelScheduledPrefetch() {
    const scheduled = state.prefetchIdle;
    if (!scheduled) return;
    if (scheduled.kind === 'idle') cancelIdleCallback(scheduled.handle);
    else clearTimeout(scheduled.handle);
    state.prefetchIdle = null;
  }

  function prefetchDetails() {
    if (!shell || disposed || !state.records.length) return;
    cancelScheduledPrefetch();
    const run = () => {
      state.prefetchIdle = null;
      state.records.forEach(record => {
        if (!validIds.has(record.id)) return;
        cache?.prefetch(record.id).catch(() => undefined);
      });
    };
    if (typeof requestIdleCallback === 'function') {
      state.prefetchIdle = { kind: 'idle', handle: requestIdleCallback(run) };
    } else {
      state.prefetchIdle = { kind: 'timeout', handle: setTimeout(run, 0) };
    }
  }

  function warmPluginDetail(event) {
    const link = event.target instanceof Element ? event.target.closest('[data-plugin-detail-link]') : null;
    const id = link?.closest('[data-plugin]')?.dataset.plugin;
    if (!link || !root?.contains(link) || !validIds.has(id)) return;
    cache?.prefetch(id).catch(() => undefined);
  }

  function updateDetailNodes(scope) {
    const search = scope.querySelector('[data-plugin-node-search]');
    if (!search) return;
    const activeCategory = scope.querySelector('[data-plugin-node-category][aria-pressed="true"]')?.dataset.pluginNodeCategory || 'all';
    let visible = 0;
    scope.querySelectorAll('[data-plugin-node]').forEach(card => {
      const query = search.value.trim().toLocaleLowerCase();
      const matchesQuery = !query || card.textContent.toLocaleLowerCase().includes(query);
      const matchesCategory = activeCategory === 'all' || card.dataset.nodeCategory === activeCategory;
      const show = matchesQuery && matchesCategory;
      card.hidden = !show;
      card.setAttribute('aria-hidden', String(!show));
      if (show) visible += 1;
    });
    const count = scope.querySelector('[data-plugin-node-count]');
    if (count) count.textContent = `${visible} / ${scope.querySelectorAll('[data-plugin-node]').length} ${translate('plugin-detail-nodes-visible')}`;
  }

  function disposeRenderer() {
    const cleanup = activeRendererCleanup;
    activeRendererCleanup = null;
    cleanup?.();
  }

  function ownRendererCleanup(cleanup) {
    disposeRenderer();
    let cleaned = false;
    activeRendererCleanup = () => {
      if (cleaned) return;
      cleaned = true;
      cleanup?.();
    };
    return activeRendererCleanup;
  }

  function hydrate(liveRoot, route, detail = null) {
    container = liveRoot.querySelector('#plugins');
    liveRoot.classList.toggle('plugin-detail-route', route.kind === 'detail');
    if (route.kind === 'list') {
      document.title = window.resourceArchiveI18n?.language === 'zh' ? '插件 · 资源档案' : 'Plugins · Resource Archive';
      renderHeader(liveRoot);
      renderList();
      prefetchDetails();
    } else {
      document.title = detailTitle(route.id);
      updateDetailNodes(liveRoot);
      if (detail) {
        const cleanup = window.ResourceArchivePluginDetail.hydrate(liveRoot, detail, {
          language: window.resourceArchiveI18n?.language || 'en',
          route,
        });
        ownRendererCleanup(cleanup);
      }
    }
    window.ResourceArchivePixelField?.refreshTargets?.();
  }

  function showDetailPreparationError(id, error) {
    const link = root?.querySelector(`[data-plugin="${id}"] [data-plugin-detail-link]`);
    if (!link) return;
    link.parentElement?.querySelector('[data-plugin-detail-preparation-error]')?.remove();
    const note = document.createElement('p');
    note.className = 'plugin-detail-preparation-error';
    note.dataset.pluginDetailPreparationError = '';
    note.setAttribute('role', 'status');
    note.textContent = error?.message || text().detailErrorUnavailable;
    link.insertAdjacentElement('afterend', note);
  }

  async function renderRoute(route, context) {
    if (route.kind === 'list') {
      context.target.append(createListView());
      context.afterCommit(liveRoot => hydrate(liveRoot, route));
      return;
    }
    const showDirectSkeleton = context.initial && !cache?.peek(route.id);
    if (showDirectSkeleton) {
      context.target.append(detailSkeleton(route.id));
      context.commitNow(liveRoot => hydrate(liveRoot, route));
    }
    try {
      const prepared = await cache.get(route.id, { signal: context.signal });
      if (context.signal.aborted) return;
      context.target.replaceChildren(detailShell(prepared.detail, route));
      context.afterCommit(liveRoot => {
        hydrate(liveRoot, route, prepared.detail);
        if (!context.initial && context.direction !== 'language') {
          window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        }
        return disposeRenderer;
      });
    } catch (error) {
      if (context.signal.aborted) return;
      if (!context.initial) {
        showDetailPreparationError(route.id, error);
        throw error;
      }
      context.target.replaceChildren(detailError(error, route.id));
      context.afterCommit(liveRoot => hydrate(liveRoot, route));
    }
  }

  function focusTarget(route) {
    if (route.kind !== 'detail') return null;
    const heading = root?.querySelector('.plugin-detail h1');
    if (heading) heading.tabIndex = -1;
    return heading;
  }

  function loadRecords() {
    if (disposed || recordsController || state.records.length) return;
    recordsController = new AbortController();
    const request = recordsController;
    fetch('/data/plugins.json', { signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(records => {
        if (disposed || recordsController !== request) return;
        state.records = records;
        if (!shell || parseUrl(new URL(window.location.href)).kind === 'list') {
          renderList();
          prefetchDetails();
        }
      })
      .catch(error => {
        if (disposed || error?.name === 'AbortError' || recordsController !== request) return;
        renderListError(error);
      })
      .finally(() => { if (recordsController === request) recordsController = null; });
  }

  function onRootClick(event) {
    const retryContent = event.target.closest?.('[data-content-table-retry]');
    if (retryContent && root?.contains(retryContent)) {
      void retryContentTable(retryContent);
      return;
    }
    const retryRecords = event.target.closest?.('[data-plugin-records-retry]');
    if (retryRecords) {
      state.records = [];
      renderList();
      loadRecords();
      return;
    }
    const retryDetail = event.target.closest?.('[data-plugin-detail-retry]');
    if (retryDetail) {
      router?.navigate(window.location.href, { replace: true, trigger: 'retry' }).catch(() => undefined);
      return;
    }
    const category = event.target.closest?.('[data-plugin-node-category]');
    if (!category || !root?.contains(category)) return;
    root.querySelectorAll('[data-plugin-node-category]').forEach(button => button.setAttribute('aria-pressed', String(button === category)));
    updateDetailNodes(root);
  }

  function capturePluginTrigger(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('[data-plugin-detail-link]') : null;
    if (!link || !root?.contains(link)) return;
    const id = link.closest('[data-plugin]')?.dataset.plugin;
    state.pendingFocusPlugin = validIds.has(id) ? id : null;
  }

  function onRootInput(event) {
    if (event.target.matches?.('[data-plugin-node-search]')) updateDetailNodes(root);
  }

  function onRootImageError(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches('[data-plugin-image]')) return;
    const fallback = document.createElement('div');
    fallback.className = 'missing-image';
    fallback.dataset.imageFallback = '';
    fallback.textContent = `${text().imageUnavailable}: ${image.dataset.pluginImageLabel || image.alt}`;
    image.replaceWith(fallback);
  }

  function onLanguageChange() {
    if (disposed) return;
    if (shell && router) {
      const requestedLanguage = window.resourceArchiveI18n?.language || 'en';
      if (requestedLanguage !== 'zh') root?.querySelector('[data-content-table-error]')?.remove();
      const operation = languageRenderOperation();
      void renderLanguageInPlace(operation)
        .catch(error => {
          if (operation.isCurrent() && error?.contentTable) {
            showContentTableError(error);
          }
        });
    }
    else renderList();
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    languageNavigationEpoch += 1;
    contentTableRetryPromise = null;
    recordsController?.abort();
    cancelScheduledPrefetch();
    cache?.abortAll();
    disposeRenderer();
    root?.removeEventListener('pointerdown', preparePluginTransition);
    root?.removeEventListener('focusin', preparePluginTransition);
    root?.removeEventListener('pointerover', warmPluginDetail);
    root?.removeEventListener('focusin', warmPluginDetail);
    root?.removeEventListener('click', capturePluginTrigger, true);
    root?.removeEventListener('click', onRootClick);
    root?.removeEventListener('input', onRootInput);
    root?.removeEventListener('error', onRootImageError, true);
    document.removeEventListener('resource-archive-language-change', onLanguageChange);
    removeEventListener('pagehide', onPageHide);
    removeEventListener('pageshow', onPageShow);
    router?.destroy();
    if (window.__resourceArchivePluginsCleanup === cleanup) delete window.__resourceArchivePluginsCleanup;
  }

  function onPageHide(event) {
    cancelScheduledPrefetch();
    disposeRenderer();
    if (!event.persisted) cleanup();
  }

  function onPageShow(event) {
    if (event.persisted && shell && router) router.syncFromLocation({ initial: true }).catch(() => undefined);
  }

  window.__resourceArchivePluginsCleanup = cleanup;
  document.addEventListener('resource-archive-language-change', onLanguageChange);
  root?.addEventListener('pointerdown', preparePluginTransition);
  root?.addEventListener('focusin', preparePluginTransition);
  root?.addEventListener('pointerover', warmPluginDetail);
  root?.addEventListener('focusin', warmPluginDetail);
  root?.addEventListener('click', capturePluginTrigger, true);
  root?.addEventListener('click', onRootClick);
  root?.addEventListener('input', onRootInput);
  root?.addEventListener('error', onRootImageError, true);
  addEventListener('pagehide', onPageHide);
  addEventListener('pageshow', onPageShow);

  if (shell && root && window.ResourceArchiveInternalViewRouter && window.ResourceArchivePluginDetail
    && window.ResourceArchivePluginDetailCache) {
    cache = window.ResourceArchivePluginDetailCache.create({
      loadDetail: window.ResourceArchivePluginDetail.load,
      rendererFor: window.ResourceArchivePluginDetail.rendererFor,
    });
    router = window.ResourceArchiveInternalViewRouter.create({ root, parseUrl, render: renderRoute, capture, restore, canHandle, focusTarget });
    router.syncFromLocation({ initial: true }).catch(() => undefined);
  } else {
    renderHeader();
    renderList();
  }
  loadRecords();
})();
