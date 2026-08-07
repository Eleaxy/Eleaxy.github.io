(() => {
  const app = document.querySelector('#node-catalog-app');
  const taxonomy = window.ResourceArchiveNodeTaxonomy;
  const detailView = window.ResourceArchiveNodeDetail;
  const routerApi = window.ResourceArchiveInternalViewRouter;
  const wordmark = window.ResourceArchiveNodeWordmark;
  const BLUEISH_THUMBNAIL_BASE_URL = 'https://blender-assets.blueish.workers.dev/';
  // This legacy catalog record remains in the source index, but the current
  // Blueish asset library and the audited Blender corpus contain no matching
  // node group. Keep it visible without presenting a fabricated thumbnail.
  const SOURCE_VISUAL_UNAVAILABLE_KEYS = new Set(['geomData/string-art']);
  if (!app || !taxonomy || !detailView || !routerApi) return;

  const stateKey = '__resourceArchiveNodeCatalogState';
  app[stateKey]?.dispose?.();
  const state = {
    disposed: false,
    records: null,
    recordsPromise: null,
    thumbnailManifest: null,
    thumbnailManifestPromise: null,
    catalogRetryPromise: null,
    contentTableRetryPromise: null,
    languageGeneration: 0,
    router: null,
    prefetchController: null,
    prefetchKey: null,
    shellListeners: [],
    languageListener: null,
    resizeObserver: null,
    wordmarkRevision: 0,
    drawWordmark: null,
    pointerMedia: null,
    reducedMotionMedia: null,
    pointerListener: null,
    reducedMotionListener: null,
    dprWatcher: null,
    pagehideListener: null,
    pageshowListener: null,
    rootObserver: null,
    languageSnapshot: null,
    pendingFocusKey: null,
    priorScrollRestoration: null,
    preparedDetails: new Map(),
    pendingDetailNavigation: null,
    failedDetailUrl: null,
    snapshotRestoreGeneration: 0,
    detailNavigationGeneration: 0,
    detailNavigationIntent: null,
    catalogRoute: null,
    workbench: null,
    workbenchNavigationListener: null,
    workbenchClosedListener: null,
    pendingNavigationClickListener: null,
    pendingNavigationPopstateListener: null,
    titleTransition: null,
    titlePointerCleanupTimer: null,
    titleTransitionBeforeListener: null,
    titleTransitionFinishedListener: null,
    titlePointerUpListener: null,
    titlePointerCancelListener: null,
  };
  app[stateKey] = state;

  const finePointerQuery = '(hover: hover) and (pointer: fine)';
  const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
  state.pointerMedia = typeof window.matchMedia === 'function' ? window.matchMedia(finePointerQuery) : null;
  state.reducedMotionMedia = typeof window.matchMedia === 'function' ? window.matchMedia(reducedMotionQuery) : null;
  state.dprWatcher = wordmark?.createDprWatcher?.(() => state.drawWordmark?.()) ?? null;

  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const language = () => document.documentElement.lang || 'en';
  const isChinese = () => language().toLowerCase().startsWith('zh');
  const nodeContentTables = () => Promise.all([
    window.resourceArchiveI18n?.loadContentTable('node-display-names'),
    window.resourceArchiveI18n?.loadContentTable('node-socket-labels'),
    window.resourceArchiveI18n?.loadContentTable('translation-allowlist'),
  ]);
  const nodeDisplayName = record => {
    if (!isChinese()) return record.name ?? record.id;
    if (String(record.name_zh || '').trim()) return record.name_zh.trim();
    return window.resourceArchiveI18n?.contentTable('node-display-names')?.[`${record.catalog_source}/${record.id}`]
      || `未提供译名：${record.name ?? record.id}`;
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const routeUrl = value => new URL(value, window.location.href);
  const normalizedRouteHref = (value = window.location.href) => {
    const url = routeUrl(value);
    return `${url.origin}${url.pathname}${url.search}`;
  };
  const currentness = ({
    generation = state.languageGeneration,
    requestedChinese = isChinese(),
    href = normalizedRouteHref(),
    contextIsCurrent = null,
  } = {}) => () => !state.disposed
    && generation === state.languageGeneration
    && requestedChinese === isChinese()
    && href === normalizedRouteHref()
    && contextIsCurrent?.() !== false;
  const activeKey = () => document.activeElement instanceof Element
    ? document.activeElement.closest('[data-node-key]')?.dataset.nodeKey || null
    : null;

  function claimScrollRestoration() {
    if (!('scrollRestoration' in history)) return;
    if (state.priorScrollRestoration === null) state.priorScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
  }

  function releaseScrollRestoration() {
    if (state.priorScrollRestoration === null || history.scrollRestoration !== 'manual') return;
    history.scrollRestoration = state.priorScrollRestoration;
  }

  function catalogHref({ group = null, subcategory = null, q = '' } = {}) {
    const query = new URLSearchParams();
    if (group) query.set('group', group);
    if (subcategory) query.set('subcategory', subcategory);
    if (q) query.set('q', q);
    const text = query.toString();
    return `/nodes.html${text ? `?${text}` : ''}`;
  }

  function parseUrl(url) {
    const params = url.searchParams;
    const groupValue = params.get('group');
    const group = taxonomy.getSystem(groupValue) ? groupValue : null;
    const requestedSubcategory = params.get('subcategory');
    const subcategory = group && taxonomy.getSystem(group).categories.includes(requestedSubcategory)
      ? requestedSubcategory
      : null;
    const source = params.get('source') || null;
    const id = params.get('id') || null;
    return {
      group,
      requestedGroup: groupValue,
      invalidGroup: Boolean(groupValue && !group),
      subcategory,
      q: params.get('q') || '',
      source: source && id ? source : null,
      id: source && id ? id : null,
      isDetail: Boolean(source && id),
    };
  }

  function canHandle(url) {
    return url.pathname === '/nodes.html';
  }

  function parentRoute(route, record) {
    const system = taxonomy.systemForCategory(record.category_id);
    const group = system?.slug || route.group || null;
    const subcategory = system?.categories.includes(record.category_id) ? record.category_id : null;
    return {
      ...route,
      group,
      subcategory,
      parentGroup: group,
      parentSystemHref: catalogHref({ group, q: route.q }),
      parentHref: catalogHref({ group, subcategory, q: route.q }),
    };
  }

  function catalogRouteForDetail(route, record) {
    const parent = parentRoute(route, record);
    return { ...parent, source: null, id: null, isDetail: false };
  }

  function detailHref(record, route, group) {
    const system = taxonomy.systemForCategory(record.category_id);
    const canonicalGroup = system?.slug || group;
    const subcategory = system?.categories.includes(record.category_id) ? record.category_id : null;
    const query = new URLSearchParams({ group: canonicalGroup, subcategory, source: record.catalog_source, id: record.id });
    if (route.q) query.set('q', route.q);
    return `/nodes.html?${query}`;
  }

  function emptyThumbnailManifest() {
    return { trusted: false, baseUrl: null, thumbnails: new Map(), detailPreviews: new Map() };
  }

  function isSafeThumbnailPath(value) {
    return typeof value === 'string'
      && value.endsWith('.webp')
      && !value.startsWith('/')
      && !value.startsWith('\\')
      && !value.includes('..')
      && !value.includes('\\')
      && !/^[a-z][a-z0-9+.-]*:/i.test(value);
  }

  function isSafeDetailPreviewPath(value) {
    return typeof value === 'string' && /^\/images\/nodes\/[0-9a-f]{64}\.png$/.test(value);
  }

  function validatedThumbnailManifest(value) {
    if (value?.version !== 2 || typeof value.base_url !== 'string'
      || !value.thumbnails || typeof value.thumbnails !== 'object' || Array.isArray(value.thumbnails)
      || !value.detail_previews || typeof value.detail_previews !== 'object' || Array.isArray(value.detail_previews)) {
      return emptyThumbnailManifest();
    }
    try {
      const baseUrl = new URL(value.base_url);
      if (baseUrl.href !== BLUEISH_THUMBNAIL_BASE_URL) return emptyThumbnailManifest();
      return {
        trusted: true,
        baseUrl: baseUrl.href,
        thumbnails: new Map(Object.entries(value.thumbnails).filter(([key, thumbnailPath]) => key && isSafeThumbnailPath(thumbnailPath))),
        detailPreviews: new Map(Object.entries(value.detail_previews).filter(([key, previewPath]) => key && isSafeDetailPreviewPath(previewPath))),
      };
    } catch {
      return emptyThumbnailManifest();
    }
  }

  function getThumbnailManifest() {
    if (state.thumbnailManifest) return Promise.resolve(state.thumbnailManifest);
    if (!state.thumbnailManifestPromise) {
      const pending = fetch('/data/migrated/node-asset-thumbnails.json')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(validatedThumbnailManifest)
        .catch(() => emptyThumbnailManifest())
        .then(manifest => {
          state.thumbnailManifest = manifest;
          return manifest;
        });
      state.thumbnailManifestPromise = pending;
    }
    return state.thumbnailManifestPromise;
  }

  function nodeLink(record, route, group) {
    const link = element('a', 'node-link');
    link.dataset.nodeLink = '';
    link.dataset.nodeKey = `${record.catalog_source}/${record.id}`;
    link.dataset.search = [record.name, record.name_zh, record.id, record.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    link.href = detailHref(record, route, group);
    link.append(element('span', 'node-link-name', nodeDisplayName(record)), element('i', 'node-link-arrow', '↗'));
    return link;
  }

  function applyCardThumbnail(link, thumbnailManifest) {
    const thumbnail = link.querySelector('[data-node-card-thumbnail]');
    const placeholder = link.querySelector('[data-node-card-placeholder]');
    const thumbnailPath = thumbnailManifest?.thumbnails?.get(link.dataset.nodeKey);
    const detailPreviewPath = thumbnailManifest?.detailPreviews?.get(link.dataset.nodeKey);
    if (!thumbnail || !placeholder) return;
    const remoteSrc = thumbnailPath && thumbnailManifest?.baseUrl
      ? new URL(thumbnailPath, thumbnailManifest.baseUrl).href
      : null;
    const localSrc = isSafeDetailPreviewPath(detailPreviewPath)
      ? detailPreviewPath
      : null;
    const src = remoteSrc || localSrc;
    if (!src) {
      thumbnail.onload = null;
      thumbnail.onerror = null;
      thumbnail.removeAttribute('src');
      thumbnail.hidden = true;
      placeholder.hidden = false;
      return;
    }
    const showLoaded = () => {
      if (thumbnail.getAttribute('src') !== src || !thumbnail.naturalWidth) return;
      thumbnail.hidden = false;
      thumbnail.removeAttribute('data-node-card-loading');
      placeholder.hidden = true;
    };
    const showUnavailable = () => {
      if (thumbnail.getAttribute('src') !== src) return;
      thumbnail.hidden = true;
      thumbnail.removeAttribute('data-node-card-loading');
      placeholder.hidden = false;
    };
    thumbnail.onload = showLoaded;
    thumbnail.onerror = showUnavailable;
    // Keep the honest placeholder visible while a lazy image is pending. The
    // previous implementation hid it before the request completed, which
    // produced blank media boxes during fast scrolling or a cold cache.
    // Do not use the `hidden` attribute while loading: it sets display:none
    // and prevents native lazy-loading from ever starting for off-screen cards.
    thumbnail.hidden = false;
    thumbnail.setAttribute('data-node-card-loading', '');
    placeholder.hidden = false;
    if (thumbnail.getAttribute('src') !== src) thumbnail.src = src;
    if (thumbnail.complete) {
      if (thumbnail.naturalWidth) showLoaded();
      else showUnavailable();
    }
  }

  function nodeCard(record, route, group, thumbnailManifest) {
    const link = nodeLink(record, route, group);
    const key = link.dataset.nodeKey;
    const sourceVisualUnavailable = SOURCE_VISUAL_UNAVAILABLE_KEYS.has(key);
    const primaryName = nodeDisplayName(record);
    const alternateName = isChinese() ? String(record.name || '').trim() : String(record.name_zh || '').trim();
    const media = element('span', 'node-card-media');
    const thumbnail = document.createElement('img');
    thumbnail.className = 'node-card-thumbnail';
    thumbnail.dataset.nodeCardThumbnail = '';
    thumbnail.alt = translate('nodes-card-thumbnail-alt', { name: primaryName });
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    thumbnail.width = 256;
    thumbnail.height = 256;
    const placeholder = element(
      'span',
      'node-card-placeholder',
      sourceVisualUnavailable
        ? translate('nodes-card-source-visual-unavailable')
        : translate('nodes-card-thumbnail-fallback'),
    );
    placeholder.dataset.nodeCardPlaceholder = '';
    media.append(thumbnail, placeholder);

    const body = element('span', 'node-card-body');
    body.append(element('span', 'node-link-name node-card-name', primaryName));
    if (alternateName && alternateName !== primaryName) body.append(element('span', 'node-card-alternate', alternateName));
    body.append(
      element(
        'span',
        'node-card-description',
        sourceVisualUnavailable
          ? translate('nodes-card-source-visual-unavailable-description')
          : String(record.description || '').trim() || translate('nodes-card-description-unavailable'),
      ),
      element('span', 'node-card-source', key),
    );
    link.classList.add('node-catalog-card');
    link.dataset.nodeCard = '';
    link.replaceChildren(media, body);
    applyCardThumbnail(link, thumbnailManifest);
    return link;
  }

  function subtypeSection(group, index, route, linkGroup, thumbnailManifest = null) {
    const section = element('section', 'catalog-subtype');
    section.id = `subtype-${group.id}`;
    section.dataset.subtypeSection = group.id;
    const heading = element('div', 'catalog-subtype-heading');
    heading.append(
      element('span', 'source-kind', `${String(index + 1).padStart(2, '0')} / ${translate('nodes-subtype')}`),
      element('h2', null, taxonomy.categoryLabel(group.id, language())),
    );
    const count = element('strong', 'subtype-count', translate('nodes-record-count', { count: group.records.length }));
    count.dataset.originalCount = String(group.records.length);
    heading.append(count);
    const links = element('div', thumbnailManifest ? 'node-card-grid' : 'node-link-grid');
    links.append(...group.records.map(record => (thumbnailManifest
      ? nodeCard(record, route, linkGroup, thumbnailManifest)
      : nodeLink(record, route, linkGroup))));
    section.append(heading, links);
    return section;
  }

  function buildJump(groups, route) {
    const navigation = element('nav', 'catalog-jump');
    if (route.group) {
      navigation.setAttribute('aria-label', translate('nodes-jump-subtype'));
      groups.forEach(group => {
        const link = element('a', null, taxonomy.categoryLabel(group.id, language()));
        link.href = `#subtype-${group.id}`;
        navigation.append(link);
      });
    } else {
      navigation.setAttribute('aria-label', translate('nodes-jump-system'));
      taxonomy.SYSTEMS.forEach(system => {
        const link = element('a', null, taxonomy.systemLabel(system, language()));
        link.href = `#system-${system.slug}`;
        navigation.append(link);
      });
    }
    return navigation;
  }

  function buildCatalogAxis(groups) {
    const rail = element('aside', 'node-catalog-axis');
    rail.dataset.nodeCatalogAxis = '';
    rail.setAttribute('aria-label', translate('nodes-jump-subtype'));
    rail.append(element('h2', null, language().toLowerCase().startsWith('zh') ? '节点目录' : 'Node catalog'));
    const navigation = element('nav', 'catalog-jump node-catalog-axis-index');
    navigation.setAttribute('aria-label', translate('nodes-jump-subtype'));
    groups.forEach(group => {
      const link = element('a', null, taxonomy.categoryLabel(group.id, language()));
      link.href = `#subtype-${group.id}`;
      navigation.append(link);
    });
    rail.append(navigation);
    return rail;
  }

  function catalogHeader(route, scoped) {
    const system = route.group ? taxonomy.getSystem(route.group) : null;
    const header = element('header', 'catalog-header');
    header.classList.toggle('catalog-header-scoped', Boolean(route.group));
    header.dataset.transitionCatalogHeader = '';
    const parent = element('a', 'node-parent-link');
    parent.dataset.transitionCatalogParent = '';
    parent.dataset.nodeParentLink = '';
    // Level-1 Node systems live on Home. Both scoped catalogs and the All catalog
    // should return there — not bounce into /nodes.html (All) as a fake parent.
    parent.href = '/index.html#nodes';
    parent.textContent = translate('nodes-parent-directory');
    parent.hidden = false;
    const titleText = system ? taxonomy.systemLabel(system, language()) : translate('nodes-all');
    const kicker = element('p', 'eyebrow', translate('nodes-directory-kicker'));
    kicker.dataset.transitionCatalogKicker = '';
    const title = element('h1', 'catalog-title', titleText);
    title.dataset.transitionCatalogTitle = '';
    title.tabIndex = -1;
    const summary = element('p', 'catalog-summary', translate('nodes-catalog-summary'));
    summary.dataset.transitionCatalogSummary = '';
    const count = element('strong', 'catalog-total', String(scoped.length));
    count.dataset.transitionCatalogCount = '';
    count.setAttribute('aria-label', translate('nodes-record-count', { count: scoped.length }));
    const canvas = element('canvas', 'node-wordmark-canvas catalog-wordmark-canvas');
    canvas.dataset.transitionCatalogWordmark = '';
    canvas.setAttribute('aria-hidden', 'true');
    const fallback = element('p', 'node-wordmark-text catalog-wordmark-text', titleText);
    fallback.dataset.transitionCatalogWordmarkFallback = '';
    header.append(parent, kicker, title, summary, count, canvas, fallback);
    return header;
  }

  function catalogView(records, route, thumbnailManifest = null) {
    if (route.invalidGroup) {
      const invalid = element('section', 'invalid-group-state');
      invalid.dataset.testid = 'invalid-node-group';
      invalid.append(
        element('p', 'status-label', translate('nodes-invalid-group')),
        element('h1', null, `Unknown node group: ${route.requestedGroup}`),
        Object.assign(element('a', 'button-primary', translate('nodes-all')), { href: '/nodes.html' }),
      );
      return invalid;
    }
    let scoped = route.group ? taxonomy.recordsForSystem(records, route.group) : records;
    if (route.subcategory) scoped = scoped.filter(record => record.category_id === route.subcategory);
    const groups = taxonomy.subtypeGroups(scoped, route.group).filter(group => !route.subcategory || group.id === route.subcategory);
    const fragment = document.createDocumentFragment();
    fragment.append(catalogHeader(route, scoped));
    const tools = element('div', 'catalog-tools');
    const search = document.createElement('input');
    search.type = 'search';
    search.dataset.catalogSearch = '';
    const searchableTitle = route.group ? taxonomy.systemLabel(taxonomy.getSystem(route.group), language()) : translate('nodes-all');
    search.setAttribute('aria-label', language().toLowerCase().startsWith('zh')
      ? `${translate('nodes-search')} ${searchableTitle}`
      : `Search ${searchableTitle}`);
    search.placeholder = translate('nodes-search-placeholder');
    search.value = route.q;
    const clear = element('button', 'button-secondary', translate('nodes-search-clear'));
    clear.type = 'button';
    clear.dataset.catalogClear = '';
    tools.append(search, clear);
    if (!route.group) tools.append(buildJump(groups, route));
    const status = element('p', 'catalog-status');
    status.append(
      element('span', null, translate('nodes-links-in-document', { count: scoped.length })),
      element('span', null, translate('nodes-visible-label')),
    );
    const visible = element('strong', null, String(scoped.length));
    visible.dataset.catalogVisible = '';
    status.append(visible);
    const empty = element('section', 'empty-state catalog-empty', translate('nodes-search-empty'));
    empty.dataset.nodeEmpty = '';
    empty.hidden = true;
    const catalog = element('div', 'node-catalog');
    catalog.dataset.nodeCatalog = '';
    if (route.group) {
      const cardManifest = thumbnailManifest || emptyThumbnailManifest();
      const scopedCatalog = element('div', 'node-scoped-catalog');
      const scopedContent = element('div', 'node-catalog-content');
      scopedContent.append(...groups.map((group, index) => subtypeSection(group, index, route, route.group, cardManifest)));
      scopedCatalog.append(buildCatalogAxis(groups), scopedContent);
      catalog.append(scopedCatalog);
    } else {
      taxonomy.SYSTEMS.forEach(system => {
        const systemSection = element('section', 'catalog-system');
        systemSection.id = `system-${system.slug}`;
        systemSection.dataset.systemSection = system.slug;
        systemSection.append(element('h2', 'catalog-system-title', taxonomy.systemLabel(system, language())));
        const systemRecords = taxonomy.recordsForSystem(records, system.slug);
        const systemGroups = taxonomy.subtypeGroups(systemRecords, system.slug);
        systemSection.append(...systemGroups.map((group, index) => subtypeSection(group, index, route, system.slug)));
        catalog.append(systemSection);
      });
    }
    fragment.append(tools, status, empty, catalog);
    return fragment;
  }

  function errorView(route, error) {
    const article = element('article', 'record-detail node-detail-error');
    article.dataset.testid = 'node-detail-error';
    const back = element('a', 'back-link', translate('nodes-dialog-back-directory'));
    back.dataset.testid = 'node-detail-back';
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    back.href = catalogHref({ group: route.group, subcategory: route.subcategory, q: route.q });
    const retry = element('button', 'button-secondary');
    retry.type = 'button';
    retry.dataset.testid = 'node-detail-retry';
    retry.dataset.pixelFlicker = '';
    retry.append(element('span', 'pixel-button-label', translate('nodes-dialog-retry')));
    const title = element('h1', null, translate('nodes-dialog-error'));
    title.dataset.testid = 'node-detail-error-title';
    title.tabIndex = -1;
    article.append(
      element('p', 'node-detail-back-line'),
      title,
      element('p', 'lede', error.message),
      retry,
    );
    article.firstElementChild.append(back);
    return article;
  }

  function workbenchErrorView(error) {
    const panel = element('section', 'node-workbench-error');
    panel.dataset.testid = 'node-detail-error';
    const title = element('h2', null, translate('nodes-dialog-error'));
    title.dataset.testid = 'node-detail-error-title';
    const retry = element('button', 'button-secondary');
    retry.type = 'button';
    retry.dataset.testid = 'node-detail-retry';
    retry.dataset.pixelFlicker = '';
    retry.append(element('span', 'pixel-button-label', translate('nodes-dialog-retry')));
    panel.append(title, element('p', 'lede', error.message), retry);
    return panel;
  }

  function catalogErrorView(error) {
    const panel = element('section', 'error-state node-catalog-error');
    panel.dataset.testid = 'node-catalog-error';
    const heading = element('h1', null, translate('nodes-catalog-error-title'));
    heading.dataset.testid = 'node-catalog-error-title';
    heading.tabIndex = -1;
    const retry = element('button', 'button-secondary');
    retry.type = 'button';
    retry.dataset.testid = 'node-catalog-retry';
    retry.dataset.pixelFlicker = '';
    retry.append(element('span', 'pixel-button-label', translate('nodes-dialog-retry')));
    panel.append(
      element('p', 'status-label', translate('nodes-catalog-error-label')),
      heading,
      element('p', null, translate('nodes-catalog-error-message', { message: error.message })),
      retry,
    );
    return panel;
  }

  function contentTableErrorView(error) {
    const panel = element('section', 'error-state content-table-error');
    panel.dataset.contentTableError = error.contentTable;
    panel.setAttribute('role', 'alert');
    const heading = element('h2', null, translate('content-table-error-heading'));
    const retry = element('button', 'button-secondary');
    retry.type = 'button';
    retry.dataset.contentTableRetry = error.contentTable;
    retry.dataset.pixelFlicker = '';
    retry.append(element('span', 'pixel-button-label', translate('content-table-retry')));
    panel.append(
      element('p', 'status-label', translate('content-table-error-status')),
      heading,
      element('p', null, translate('content-table-error-message')),
      retry,
    );
    return panel;
  }

  function showContentTableError(error) {
    if (state.disposed || !error?.contentTable) return;
    app.querySelector('[data-content-table-error]')?.remove();
    const detail = app.querySelector('[data-node-detail-workbench] [data-testid="node-detail"]');
    const host = detail?.querySelector('.node-workbench-information-scroll');
    (host || app).prepend(contentTableErrorView(error));
    window.ResourceArchivePixelField?.refreshTargets();
  }

  async function retryContentTable(button) {
    if (state.disposed || state.contentTableRetryPromise || button.disabled) return;
    const table = button.dataset.contentTableRetry;
    const panel = button.closest('[data-content-table-error]');
    if (!table || !panel) return;
    const isCurrent = currentness();
    button.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    const pending = window.resourceArchiveI18n.retryContentTable(table).then(async () => {
      if (!isCurrent()) return;
      try {
        await nodeContentTables();
      } catch (error) {
        if (isCurrent()) showContentTableError(error);
        return;
      }
      if (!isCurrent()) return;
      panel.remove();
      const detail = app.querySelector('[data-testid="node-detail"]');
      if (detail?.__resourceArchiveNodeDetail) {
        const scroll = window.scrollY;
        detail.__resourceArchiveNodeDetailUpdate?.(detail.__resourceArchiveNodeDetail.route, language());
        window.scrollTo(0, scroll);
        requestAnimationFrame(() => {
          if (isCurrent() && detail.isConnected) window.scrollTo(0, scroll);
        });
        return;
      }
      state.languageSnapshot = capture();
      cancelPendingSnapshotRestore();
      await state.router.navigate(window.location.href, { trigger: 'language', replace: true });
    }).catch(error => {
      if (isCurrent()) showContentTableError(error);
    }).finally(() => {
      if (state.contentTableRetryPromise === pending) state.contentTableRetryPromise = null;
    });
    state.contentTableRetryPromise = pending;
    await pending;
  }

  function getRecords() {
    if (state.records) return Promise.resolve(state.records);
    if (!state.recordsPromise) {
      const pending = fetch('/data/migrated/search-index.json')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(records => {
          if (!Array.isArray(records)) throw new TypeError('node index must be an array');
          state.records = records;
          return records;
        });
      state.recordsPromise = pending;
      pending.then(
        () => {
          if (state.recordsPromise === pending) state.recordsPromise = null;
        },
        () => {
          state.records = null;
          if (state.recordsPromise === pending) state.recordsPromise = null;
        },
      );
    }
    return state.recordsPromise;
  }

  function updateSearchUrl(route, q) {
    const url = new URL(catalogHref({ group: route.group, subcategory: route.subcategory, q }), window.location.origin);
    url.hash = window.location.hash;
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function hydrateCatalog(root, route, { syncUrl = true } = {}) {
    const catalog = root.querySelector('[data-node-catalog]');
    if (!catalog) return undefined;
    const search = root.querySelector('[data-catalog-search]');
    const clear = root.querySelector('[data-catalog-clear]');
    const status = root.querySelector('[data-catalog-visible]');
    const empty = root.querySelector('[data-node-empty]');
    const update = () => {
      const query = search.value.trim();
      const normalized = query.toLowerCase();
      let visible = 0;
      root.querySelectorAll('[data-node-link]').forEach(link => {
        const matches = !normalized || link.dataset.search.includes(normalized);
        link.hidden = !matches;
        if (matches) visible += 1;
        const href = new URL(link.href);
        if (query) href.searchParams.set('q', query);
        else href.searchParams.delete('q');
        link.href = `${href.pathname}${href.search}${href.hash}`;
      });
      root.querySelectorAll('[data-subtype-section]').forEach(section => {
        const count = [...section.querySelectorAll('[data-node-link]')].filter(link => !link.hidden).length;
        section.hidden = count === 0;
        section.querySelector('.subtype-count').textContent = translate('nodes-record-count', { count });
      });
      status.textContent = String(visible);
      empty.hidden = visible !== 0;
      if (syncUrl) updateSearchUrl(route, query);
    };
    const onInput = () => update();
    const onClear = () => {
      search.value = '';
      update();
      search.focus();
    };
    search.addEventListener('input', onInput);
    clear.addEventListener('click', onClear);
    update();

    const axis = root.querySelector('[data-node-catalog-axis]');
    const sections = [...root.querySelectorAll('[data-subtype-section]')];
    let axisObserver = null;
    let onAxisClick = null;
    let pendingAxisSection = null;
    if (axis && sections.length && typeof IntersectionObserver === 'function') {
      const axisLinks = [...axis.querySelectorAll('a[href^="#subtype-"]')];
      const activeSections = new Set();
      const setCurrentAxisLink = section => {
        const currentHref = section ? `#${section.id}` : null;
        axisLinks.forEach(link => {
          const current = link.getAttribute('href') === currentHref;
          link.classList.toggle('is-current', current);
          if (current) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      };
      setCurrentAxisLink(sections[0]);
      axisObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) activeSections.add(entry.target);
          else activeSections.delete(entry.target);
        });
        // A click updates the rail immediately, while smooth scrolling may
        // leave the previously visible section intersecting for a few frames.
        // Hold that clicked state until the destination enters the observer
        // window so a stale callback cannot flash the old link as active.
        if (pendingAxisSection) {
          if (activeSections.has(pendingAxisSection)) {
            setCurrentAxisLink(pendingAxisSection);
            pendingAxisSection = null;
          }
          return;
        }
        const current = sections.find(section => activeSections.has(section));
        if (current) setCurrentAxisLink(current);
      }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });
      sections.forEach(section => axisObserver.observe(section));
    }
    if (axis && sections.length) {
      onAxisClick = event => {
        if (event.defaultPrevented || event.button !== 0
          || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = event.target instanceof Element ? event.target.closest('a[href^="#subtype-"]') : null;
        if (!anchor || !axis.contains(anchor)) return;
        const destination = new URL(anchor.href, window.location.href);
        const current = new URL(window.location.href);
        if (destination.origin !== current.origin
          || destination.pathname !== current.pathname
          || destination.search !== current.search
          || !destination.hash) return;
        const section = document.getElementById(destination.hash.slice(1));
        if (!section || !root.contains(section)) return;
        event.preventDefault();
        const router = history.state?.resourceArchiveInternalViewRouter;
        const nextState = router
          ? { ...history.state, resourceArchiveInternalViewRouter: { ...router, snapshot: null, fragment: destination.hash } }
          : history.state;
        history.replaceState(nextState, '', destination.href);
        axis.querySelectorAll('a[href^="#subtype-"]').forEach(link => {
          const current = link === anchor;
          link.classList.toggle('is-current', current);
          if (current) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
        pendingAxisSection = section;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start', inline: 'nearest' });
      };
      axis.addEventListener('click', onAxisClick);
    }

    const createWordmarkCanvas = () => {
      const header = root.querySelector('.catalog-header');
      const fallback = header?.querySelector('.catalog-wordmark-text');
      if (!header || !fallback) return null;
      const canvas = element('canvas', 'node-wordmark-canvas catalog-wordmark-canvas');
      canvas.dataset.transitionCatalogWordmark = '';
      canvas.setAttribute('aria-hidden', 'true');
      fallback.before(canvas);
      return canvas;
    };
    const drawWordmark = () => {
      if (!wordmark || state.disposed) return;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
      const header = root.querySelector('.catalog-header');
      const currentCanvas = header?.querySelector('.catalog-wordmark-canvas');
      const width = window.innerWidth > 760 ? Math.min(480, header?.getBoundingClientRect().width || 0) : 0;
      if (reduced || !fine || width < 160) {
        currentCanvas?.remove();
        return;
      }
      const canvas = currentCanvas || createWordmarkCanvas();
      if (!canvas) return;
      const label = root.querySelector('.catalog-title')?.textContent || '';
      const count = root.querySelector('.catalog-total')?.textContent || '';
      const result = wordmark.render({
        canvas,
        cssWidth: width,
        dpr: devicePixelRatio || 1,
        label,
        count,
        alignment: 'center',
        allowFallback: true,
      });
      if (result.mode !== 'canvas') {
        canvas.remove();
        return;
      }
      canvas.hidden = false;
      canvas.dataset.wordmarkRenderRevision = String(++state.wordmarkRevision);
    };
    state.drawWordmark = drawWordmark;
    drawWordmark();
    state.resizeObserver?.disconnect();
    state.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(drawWordmark) : null;
    if (state.resizeObserver) state.resizeObserver.observe(root.querySelector('.catalog-header'));
    window.ResourceArchivePixelField?.refreshTargets();
    return () => {
      search.removeEventListener('input', onInput);
      clear.removeEventListener('click', onClear);
      axisObserver?.disconnect();
      if (axis && onAxisClick) axis.removeEventListener('click', onAxisClick);
      state.resizeObserver?.disconnect();
      state.resizeObserver = null;
      if (state.drawWordmark === drawWordmark) state.drawWordmark = null;
    };
  }

  function queueCatalogThumbnailHydration(root, route, isCurrent) {
    if (!route.group) return;
    void getThumbnailManifest().then(thumbnailManifest => {
      if (!thumbnailManifest.trusted || !isCurrent() || !root.isConnected) return;
      const scopedCatalog = root.querySelector('.node-scoped-catalog');
      if (!scopedCatalog?.isConnected) return;
      scopedCatalog.querySelectorAll('[data-node-card]').forEach(link => applyCardThumbnail(link, thumbnailManifest));
    });
  }

  function capture() {
    const focusedKey = activeKey() || state.pendingFocusKey;
    state.pendingFocusKey = null;
    return { scrollY: window.scrollY, activeKey: focusedKey };
  }

  async function restore(snapshot, { signal, isCurrent: operationIsCurrent } = {}) {
    if (!snapshot || state.disposed || signal?.aborted || operationIsCurrent?.() === false) return;
    const generation = ++state.snapshotRestoreGeneration;
    const isCurrent = () => !state.disposed
      && !signal?.aborted
      && operationIsCurrent?.() !== false
      && state.snapshotRestoreGeneration === generation;
    const restoreSnapshot = () => {
      if (!isCurrent()) return;
      window.scrollTo({ top: snapshot.scrollY || 0, behavior: 'instant' });
      if (snapshot.activeKey) app.querySelector(`[data-node-key="${CSS.escape(snapshot.activeKey)}"]`)?.focus({ preventScroll: true });
    };
    restoreSnapshot();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    restoreSnapshot();
  }

  function focusTarget(route, context) {
    if (context.direction === 'language') return null;
    return route.isDetail
      ? app.querySelector('[data-testid="node-detail"] h1, [data-testid="node-detail-error"] h1')
      : app.querySelector('[data-testid="node-catalog-error-title"], .catalog-title');
  }

  function resetRouteScroll(context) {
    if (!context.initial && context.snapshot === null && context.direction !== 'language') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  const titleTransitionName = 'node-detail-title';

  function clearTitleTransition() {
    if (state.titlePointerCleanupTimer !== null) {
      clearTimeout(state.titlePointerCleanupTimer);
      state.titlePointerCleanupTimer = null;
    }
    state.titleTransition?.sourceTitle?.style.removeProperty('view-transition-name');
    state.titleTransition?.detailTitle?.style.removeProperty('view-transition-name');
    app.querySelectorAll('.node-link-name, [data-testid="node-detail-title"]')
      .forEach(title => title.style.removeProperty('view-transition-name'));
    state.titleTransition = null;
  }

  function supportsTitleTransition() {
    return !state.reducedMotionMedia?.matches && typeof document.startViewTransition === 'function';
  }

  function primaryNodeActivation(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function selectTransitionTitle(event) {
    const link = event.target instanceof Element ? event.target.closest('[data-node-link]') : null;
    if (!link || !app.contains(link) || !primaryNodeActivation(event) || !supportsTitleTransition()) {
      clearTitleTransition();
      return;
    }
    const sourceTitle = link.querySelector('.node-link-name');
    if (!sourceTitle) {
      clearTitleTransition();
      return;
    }
    clearTitleTransition();
    sourceTitle.style.setProperty('view-transition-name', titleTransitionName);
    state.titleTransition = {
      key: link.dataset.nodeKey || null,
      sourceTitle,
      detailTitle: null,
      token: null,
    };
  }

  function releaseUnactivatedPointerTitle(event) {
    if (event.button !== 0 || !state.titleTransition || state.titleTransition.token) return;
    const sourceTitle = state.titleTransition.sourceTitle;
    state.titlePointerCleanupTimer = setTimeout(() => {
      if (state.titleTransition?.sourceTitle === sourceTitle && !state.titleTransition.token) clearTitleTransition();
    }, 0);
  }

  function cancelUnactivatedPointerTitle() {
    if (!state.titleTransition?.token) clearTitleTransition();
  }

  function applyDetailTransitionTitle(root, route) {
    const titleTransition = state.titleTransition;
    if (!titleTransition || titleTransition.key !== `${route.source}/${route.id}` || !titleTransition.token) return;
    const title = root.querySelector('[data-testid="node-detail-title"]');
    if (!title) return;
    title.style.setProperty('view-transition-name', titleTransitionName);
    titleTransition.detailTitle = title;
  }

  function sameCatalogRoute(left, right) {
    return left?.group === right?.group
      && left?.subcategory === right?.subcategory
      && left?.q === right?.q;
  }

  function visibleDetailSequence() {
    return [...app.querySelectorAll('[data-node-link]:not([hidden])')].map(link => ({
      key: link.dataset.nodeKey,
      href: link.href,
      label: link.querySelector('.node-link-name')?.textContent || link.dataset.nodeKey,
    }));
  }

  function workbenchSystemCode(route) {
    return {
      geometry: 'GN',
      shader: 'SN',
      compositor: 'CN',
      rigging: 'RG',
      particles: 'PN',
      pcg: 'PCG',
      stylized: 'NPR',
      effect: 'FX',
      'material-functions': 'MF',
    }[route.parentGroup || route.group] || 'GN';
  }

  function updateWorkbenchChrome(record, route, activeKey) {
    const system = taxonomy.getSystem(route.parentGroup || route.group);
    state.workbench?.updateChrome({
      route,
      activeKey,
      sequence: visibleDetailSequence(),
      code: workbenchSystemCode(route),
      breadcrumb: [
        translate('nodes-all'),
        taxonomy.systemLabel(system, language()),
        taxonomy.categoryLabel(record.category_id, language()),
        nodeDisplayName(record),
      ],
    });
  }

  async function render(route, context) {
    const isCurrent = currentness({ contextIsCurrent: context.isCurrent });
    if (isChinese()) {
      try {
        await nodeContentTables();
      } catch (error) {
        if (!isCurrent()) return;
        context.commit(target => target.append(contentTableErrorView(error)));
        context.afterCommit(() => window.ResourceArchivePixelField?.refreshTargets());
        return;
      }
    }
    if (!isCurrent()) return;
    if (route.isDetail) {
      const pending = state.pendingDetailNavigation;
      const pendingToken = pending?.token ?? null;
      const isPendingCurrent = () => context.isCurrent()
        && (!pending || (state.pendingDetailNavigation === pending
          && isCurrentDetailNavigation(pending)
          && pending.token === pendingToken));
      try {
        const key = `${route.source}/${route.id}`;
        const retainedCatalog = Boolean(app.querySelector('[data-node-catalog]'));
        const retainedCatalogRoute = retainedCatalog ? state.catalogRoute : null;
        const prepared = state.preparedDetails.get(key);
        if (prepared) state.preparedDetails.delete(key);
        if (prepared?.error) throw prepared.error;
        const record = prepared?.record || await detailView.load(route.source, route.id, { signal: context.signal });
        if (!isPendingCurrent()) return;
        const parent = catalogRouteForDetail(route, record);
        const catalogRoute = retainedCatalogRoute || parent;
        const activeKey = `${route.source}/${route.id}`;
        if (pending) {
          pending.parentHref = parent.parentHref;
          pending.activeKey = activeKey;
        }
        if (!retainedCatalog) {
          const records = await getRecords();
          if (!isPendingCurrent()) return;
          context.commit(target => target.append(catalogView(records, parent)));
        }
        const article = detailView.render(record, {
          route: parent,
          language: language(),
          variant: 'workbench',
        });
        let workbenchArticlePrepared = false;
        const prepareWorkbenchArticle = () => {
          if (!isPendingCurrent() || !state.workbench.isOpen()) return false;
          if (!state.workbench.showContent(article, { direction: pending?.direction })) return false;
          updateWorkbenchChrome(record, parent, activeKey);
          workbenchArticlePrepared = true;
          return true;
        };
        if (retainedCatalog) context.retainRoot(() => prepareWorkbenchArticle());
        context.afterCommit(root => {
          if (!isPendingCurrent()) return undefined;
          const cleanupCatalog = hydrateCatalog(root, catalogRoute, { syncUrl: false });
          if (!workbenchArticlePrepared) {
            if (!state.workbench.isOpen()) {
              state.workbench.openPending({
                route: parent,
                parentHref: pending?.parentHref || parent.parentHref,
                activeKey: pending?.activeKey || activeKey,
                anchor: pending?.anchor || null,
                direction: pending?.direction,
              });
            }
            prepareWorkbenchArticle();
          }
          state.workbench.markRouteCommitted({ direct: context.initial });
          state.failedDetailUrl = null;
          if (pending) clearPendingDetailNavigationTransient(pending);
          state.catalogRoute = catalogRoute;
          state.route = parent;
          queueCatalogThumbnailHydration(root, catalogRoute, () => context.isCurrent());
          window.ResourceArchivePixelField?.refreshTargets();
          return cleanupCatalog;
        });
        return;
      } catch (error) {
        if (context.signal.aborted || !isCurrent()) return;
        if (pending && isPendingCurrent()) throw error;
        let fallback = {
          ...route,
          parentGroup: route.group,
          parentSystemHref: catalogHref({ group: route.group, q: route.q }),
          parentHref: catalogHref({ group: route.group, subcategory: route.subcategory, q: route.q }),
        };
        let catalogRoute = { ...fallback, source: null, id: null, isDetail: false };
        const retainedCatalog = Boolean(app.querySelector('[data-node-catalog]'));
        let records;
        try {
          records = await getRecords();
        } catch (catalogError) {
          if (context.signal.aborted || !isCurrent()) return;
          context.commit(target => target.append(catalogErrorView(catalogError)));
          context.afterCommit(() => {
            state.route = catalogRoute;
            state.catalogRoute = catalogRoute;
            window.ResourceArchivePixelField?.refreshTargets();
          });
          return;
        }
        if (!isCurrent()) return;
        const indexedRecord = records.find(record => record.catalog_source === route.source && record.id === route.id);
        if (indexedRecord) fallback = parentRoute(route, indexedRecord);
        if (retainedCatalog) {
          catalogRoute = state.catalogRoute || catalogRoute;
          context.retainRoot(() => {});
        } else {
          if (indexedRecord) catalogRoute = catalogRouteForDetail(route, indexedRecord);
          context.commit(target => target.append(catalogView(records, catalogRoute)));
        }
        context.afterCommit(root => {
          if (!isCurrent()) return undefined;
          const cleanupCatalog = hydrateCatalog(root, catalogRoute, { syncUrl: false });
          if (!state.workbench.isOpen()) {
            state.workbench.openPending({
              route: fallback,
              parentHref: fallback.parentHref,
              activeKey: `${route.source}/${route.id}`,
            });
          }
          state.workbench.showError(workbenchErrorView(error));
          state.workbench.markRouteCommitted({ direct: context.initial });
          state.failedDetailUrl = null;
          state.catalogRoute = catalogRoute;
          state.route = fallback;
          queueCatalogThumbnailHydration(root, catalogRoute, () => context.isCurrent());
          window.ResourceArchivePixelField?.refreshTargets();
          return cleanupCatalog;
        });
        return;
      }
    }
    try {
      const liveCatalog = app.querySelector('[data-node-catalog]');
      const closingWorkbench = Boolean(liveCatalog && state.workbench?.isOpen());
      if (closingWorkbench && sameCatalogRoute(state.catalogRoute, route)) {
        context.retainRoot(() => {});
        context.afterCommit(async root => {
          await state.workbench.close();
          if (!context.isCurrent()) return undefined;
          state.route = route;
          state.catalogRoute = route;
          const cleanup = hydrateCatalog(root, route, { syncUrl: true });
          if (context.direction === 'language' && state.languageSnapshot) {
            const snapshot = state.languageSnapshot;
            state.languageSnapshot = null;
            void restore(snapshot);
          }
          return cleanup;
        });
        return;
      }
      const records = await getRecords();
      if (!isCurrent()) return;
      if (closingWorkbench) {
        const replacement = catalogView(records, route);
        context.retainRoot(() => {});
        context.afterCommit(async root => {
          await state.workbench.close();
          if (!context.isCurrent()) return undefined;
          root.replaceChildren(replacement);
          state.route = route;
          state.catalogRoute = route;
          const cleanup = hydrateCatalog(root, route, { syncUrl: true });
          queueCatalogThumbnailHydration(root, route, () => context.isCurrent());
          return cleanup;
        });
        return;
      }
      context.commit(target => target.append(catalogView(records, route)));
      context.afterCommit(root => {
        state.route = route;
        state.catalogRoute = route;
        const cleanup = hydrateCatalog(root, route);
        if (context.direction === 'language' && state.languageSnapshot) {
          const snapshot = state.languageSnapshot;
          state.languageSnapshot = null;
          void restore(snapshot);
        }
        if (context.direction === 'retry') {
          const retrySearch = root.querySelector('[data-catalog-search]');
          requestAnimationFrame(() => {
            if (!state.disposed && retrySearch?.isConnected) retrySearch.focus({ preventScroll: true });
          });
        }
        queueCatalogThumbnailHydration(root, route, () => context.isCurrent());
        return cleanup;
      });
    } catch (error) {
      if (context.signal.aborted || !isCurrent()) return;
      context.commit(target => target.append(catalogErrorView(error)));
      context.afterCommit(() => {
        state.route = route;
        window.ResourceArchivePixelField?.refreshTargets();
      });
    }
  }

  function startPrefetch(event) {
    const link = event.target instanceof Element ? event.target.closest('[data-node-link]') : null;
    if (!link || !app.contains(link)) return;
    if (event.type === 'pointerover' && event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) return;
    const url = routeUrl(link.href);
    const route = parseUrl(url);
    if (!route.isDetail) return;
    const key = `${route.source}/${route.id}`;
    if (state.prefetchKey === key && state.prefetchController && !state.prefetchController.signal.aborted) return;
    state.prefetchController?.abort();
    const controller = new AbortController();
    state.prefetchController = controller;
    state.prefetchKey = key;
    detailView.load(route.source, route.id, { signal: controller.signal })
      .catch(() => {})
      .finally(() => {
        if (state.prefetchController === controller) {
          state.prefetchController = null;
          state.prefetchKey = null;
        }
      });
  }

  function shellClick(event) {
    const contentTableRetry = event.target instanceof Element ? event.target.closest('[data-content-table-retry]') : null;
    if (contentTableRetry && app.contains(contentTableRetry)) {
      event.preventDefault();
      void retryContentTable(contentTableRetry);
      return;
    }
    const catalogRetry = event.target instanceof Element ? event.target.closest('[data-testid="node-catalog-retry"]') : null;
    if (catalogRetry && app.contains(catalogRetry)) {
      event.preventDefault();
      retryCatalog(catalogRetry);
      return;
    }
    const retry = event.target instanceof Element ? event.target.closest('[data-testid="node-detail-retry"]') : null;
    if (!retry || !app.contains(retry)) return;
    event.preventDefault();
    if (state.failedDetailUrl) {
      requestDetailNavigation(state.failedDetailUrl, { trigger: 'retry', replace: false });
      return;
    }
    state.router.navigate(window.location.href, { trigger: 'retry', replace: true }).catch(() => {});
  }

  function retryCatalog(retry) {
    if (state.disposed || state.catalogRetryPromise || retry.disabled) return;
    const route = parseUrl(routeUrl(window.location.href));
    const panel = retry.closest('[data-testid="node-catalog-error"]');
    if (!panel) return;
    const status = element('p', 'catalog-retry-status', translate('nodes-catalog-retrying'));
    status.setAttribute('role', 'status');
    panel.setAttribute('aria-busy', 'true');
    retry.disabled = true;
    retry.before(status);
    cancelPendingSnapshotRestore();
    const retryPromise = state.router.syncFromLocation({ initial: true, direction: 'retry' });
    state.catalogRetryPromise = retryPromise;
    retryPromise.catch(() => {
      if (state.disposed || !panel.isConnected) return;
      panel.removeAttribute('aria-busy');
      retry.disabled = false;
      status.remove();
    }).finally(() => {
      if (state.catalogRetryPromise === retryPromise) state.catalogRetryPromise = null;
    });
  }

  function captureNodeTrigger(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('[data-node-link]') : null;
    if (link && app.contains(link)) state.pendingFocusKey = link.dataset.nodeKey || null;
  }

  function detailNavigationKey(route) {
    return route.isDetail ? `${route.source}/${route.id}` : null;
  }

  function cancelPendingSnapshotRestore() {
    state.snapshotRestoreGeneration += 1;
  }

  function clearPendingDetailNavigationTransient(pending) {
    if (!pending) return;
    pending.anchor = null;
    pending.direction = null;
  }

  function cancelPendingDetailNavigation() {
    const pending = state.pendingDetailNavigation;
    if (!pending) return;
    state.detailNavigationGeneration += 1;
    state.detailNavigationIntent = null;
    state.pendingDetailNavigation = null;
    state.preparedDetails.delete(pending.key);
    clearPendingDetailNavigationTransient(pending);
    pending.controller.abort();
  }

  function isCurrentDetailNavigation(pending) {
    const intent = state.detailNavigationIntent;
    return !state.disposed
      && state.pendingDetailNavigation === pending
      && state.detailNavigationGeneration === pending.generation
      && intent?.key === pending.key
      && intent.generation === pending.generation
      && intent.url === pending.url;
  }

  function cancelPendingDetailNavigationFor(url) {
    const pending = state.pendingDetailNavigation;
    if (!pending) return;
    const route = parseUrl(url);
    if (detailNavigationKey(route) !== pending.key) cancelPendingDetailNavigation();
  }

  function cancelPendingDetailNavigationOnClick(event) {
    if (event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || !app.contains(anchor) || anchor.hasAttribute('download')
      || anchor.target && anchor.target.toLowerCase() !== '_self') return;
    let url;
    try {
      url = routeUrl(anchor.href);
    } catch {
      return;
    }
    if (!canHandle(url)) return;
    cancelPendingSnapshotRestore();
    if (anchor.matches('[data-node-detail-back]')
      && !parseUrl(routeUrl(window.location.href)).isDetail
      && state.pendingDetailNavigation) {
      cancelPendingDetailNavigation();
      state.router.syncFromLocation({ initial: true, direction: 'dismiss' }).catch(() => {});
      return;
    }
    cancelPendingDetailNavigationFor(url);
  }

  function cancelPendingDetailNavigationOnPopstate() {
    cancelPendingSnapshotRestore();
    cancelPendingDetailNavigationFor(routeUrl(window.location.href));
  }

  function requestDetailNavigation(url, {
    trigger = 'link', replace = false, anchor = null, direction = null,
  } = {}) {
    const destinationUrl = routeUrl(url);
    const route = parseUrl(destinationUrl);
    if (!route.isDetail) return;
    cancelPendingSnapshotRestore();
    const key = `${route.source}/${route.id}`;
    const intentUrl = destinationUrl.href;
    const active = state.pendingDetailNavigation;
    if (active?.key === key && active.url === intentUrl && isCurrentDetailNavigation(active)
      && !active.controller.signal.aborted) return;
    cancelPendingDetailNavigation();

    const controller = new AbortController();
    const generation = ++state.detailNavigationGeneration;
    const pending = {
      key,
      controller,
      generation,
      token: Symbol('node-detail-navigation'),
      url: intentUrl,
      anchor,
      parentHref: catalogHref({ group: route.group, subcategory: route.subcategory, q: route.q }),
      activeKey: key,
      direction,
    };
    state.pendingDetailNavigation = pending;
    state.detailNavigationIntent = { key, generation, url: intentUrl };
    const parentHref = catalogHref({ group: route.group, subcategory: route.subcategory, q: route.q });
    state.workbench.openPending({
      route,
      parentHref,
      activeKey: key,
      anchor: app.querySelector(`[data-node-key="${CSS.escape(key)}"]`),
      direction,
    });
    state.router.navigate(url, { trigger, replace }).then(() => {
      if (!isCurrentDetailNavigation(pending) || controller.signal.aborted) return;
      state.failedDetailUrl = null;
    }).catch(error => {
      if (!isCurrentDetailNavigation(pending) || controller.signal.aborted) return;
      state.failedDetailUrl = intentUrl;
      state.workbench.showError(workbenchErrorView(error));
    }).finally(() => {
      if (isCurrentDetailNavigation(pending)) {
        clearPendingDetailNavigationTransient(pending);
        state.pendingDetailNavigation = null;
        state.detailNavigationIntent = null;
      }
    });
  }

  function prepareDetailNavigation(event) {
    if (event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('[data-node-link]') : null;
    if (!link || !app.contains(link)) return;
    const url = routeUrl(link.href);
    if (!canHandle(url) || !parseUrl(url).isDetail) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectTransitionTitle(event);
    requestDetailNavigation(url, { anchor: link, direction: 'forward' });
  }

  app.addEventListener('click', captureNodeTrigger, true);
  state.pendingNavigationClickListener = cancelPendingDetailNavigationOnClick;
  state.pendingNavigationPopstateListener = cancelPendingDetailNavigationOnPopstate;
  app.addEventListener('click', state.pendingNavigationClickListener, true);
  addEventListener('popstate', state.pendingNavigationPopstateListener);
  claimScrollRestoration();
  state.router = routerApi.create({
    root: app,
    parseUrl,
    render,
    capture,
    restore,
    canHandle,
    focusTarget,
    transitionMode(route, { fromUrl }) {
      return route.isDetail || parseUrl(routeUrl(fromUrl)).isDetail ? 'none' : undefined;
    },
  });
  state.workbench = window.ResourceArchiveNodeWorkbench.create({ app, translate });
  state.workbenchNavigationListener = event => {
    const { href, key } = event.detail || {};
    if (!href || !key) return;
    state.pendingFocusKey = key;
    requestDetailNavigation(href, {
      trigger: 'node-workbench-switch',
      replace: true,
      direction: event.detail.direction,
    });
  };
  state.workbenchClosedListener = () => {
    const pending = state.pendingDetailNavigation;
    state.failedDetailUrl = null;
    if (!pending) return;
    cancelPendingDetailNavigation();
    state.router.syncFromLocation({ initial: true, direction: 'dismiss' }).catch(() => {});
  };
  app.addEventListener('resourcearchivenodeworkbenchnavigate', state.workbenchNavigationListener);
  app.addEventListener('resourcearchivenodeworkbenchclosed', state.workbenchClosedListener);
  app.addEventListener('click', prepareDetailNavigation, true);
  app.addEventListener('pointerover', startPrefetch);
  app.addEventListener('focusin', startPrefetch);
  app.addEventListener('pointerdown', selectTransitionTitle);
  app.addEventListener('click', selectTransitionTitle, true);
  app.addEventListener('click', shellClick);
  state.shellListeners.push(
    ['click', captureNodeTrigger, true], ['click', prepareDetailNavigation, true], ['pointerover', startPrefetch], ['focusin', startPrefetch],
    ['pointerdown', selectTransitionTitle],
    ['click', selectTransitionTitle, true], ['click', shellClick],
  );
  state.titlePointerUpListener = releaseUnactivatedPointerTitle;
  state.titlePointerCancelListener = cancelUnactivatedPointerTitle;
  document.addEventListener('pointerup', state.titlePointerUpListener);
  document.addEventListener('pointercancel', state.titlePointerCancelListener);
  state.titleTransitionBeforeListener = event => {
    const detail = event.detail;
    const transition = state.titleTransition;
    if (!detail?.route?.isDetail) {
      clearTitleTransition();
      return;
    }
    if (!transition || transition.key !== `${detail.route.source}/${detail.route.id}`) {
      clearTitleTransition();
      return;
    }
    transition.token = detail.token;
  };
  state.titleTransitionFinishedListener = event => {
    if (state.titleTransition?.token === event.detail?.token) clearTitleTransition();
  };
  app.addEventListener('resourcearchiveinternalviewrouterbeforetransition', state.titleTransitionBeforeListener);
  app.addEventListener('resourcearchiveinternalviewroutertransitionfinished', state.titleTransitionFinishedListener);
  state.languageListener = async () => {
    if (state.disposed) return;
    ++state.languageGeneration;
    const requestedChinese = isChinese();
    const isCurrent = currentness({ requestedChinese });
    if (!requestedChinese) app.querySelector('[data-content-table-error]')?.remove();
    try {
      if (requestedChinese) await nodeContentTables();
    } catch (error) {
      if (isCurrent()) showContentTableError(error);
      return;
    }
    if (!isCurrent()) return;
    const detail = app.querySelector('[data-node-detail-workbench] [data-testid="node-detail"]')
      || app.querySelector('[data-testid="node-detail"]');
    if (detail?.__resourceArchiveNodeDetail) {
      const focus = document.activeElement;
      const scroll = window.scrollY;
      detail.__resourceArchiveNodeDetailUpdate?.(detail.__resourceArchiveNodeDetail.route, language());
      updateWorkbenchChrome(
        detail.__resourceArchiveNodeDetail.record,
        detail.__resourceArchiveNodeDetail.route,
        state.workbench?.currentKey?.(),
      );
      window.scrollTo(0, scroll);
      requestAnimationFrame(() => {
        if (isCurrent() && detail.isConnected) window.scrollTo(0, scroll);
      });
      if (isCurrent() && focus instanceof HTMLElement && detail.contains(focus)) focus.focus({ preventScroll: true });
      return;
    }
    state.languageSnapshot = capture();
    cancelPendingSnapshotRestore();
    state.router.navigate(window.location.href, { trigger: 'language', replace: true }).catch(() => {});
  };
  document.addEventListener('resource-archive-language-change', state.languageListener);
  state.pointerListener = () => state.drawWordmark?.();
  state.reducedMotionListener = () => state.drawWordmark?.();
  if (state.pointerMedia) {
    if (typeof state.pointerMedia.addEventListener === 'function') state.pointerMedia.addEventListener('change', state.pointerListener);
    else state.pointerMedia.addListener?.(state.pointerListener);
  }
  if (state.reducedMotionMedia) {
    if (typeof state.reducedMotionMedia.addEventListener === 'function') state.reducedMotionMedia.addEventListener('change', state.reducedMotionListener);
    else state.reducedMotionMedia.addListener?.(state.reducedMotionListener);
  }
  state.pageshowListener = () => {
    claimScrollRestoration();
    state.dprWatcher?.bind();
    state.drawWordmark?.();
  };
  state.pagehideListener = () => {
    state.languageGeneration += 1;
    clearTitleTransition();
    releaseScrollRestoration();
    state.prefetchController?.abort();
    state.prefetchController = null;
    state.prefetchKey = null;
    cancelPendingSnapshotRestore();
    cancelPendingDetailNavigation();
    state.catalogRetryPromise = null;
    state.contentTableRetryPromise = null;
    state.failedDetailUrl = null;
    state.preparedDetails.clear();
    detailView.abortPending?.();
    app.querySelector('.catalog-wordmark-canvas')?.setAttribute('hidden', '');
    state.dprWatcher?.unbind();
  };
  addEventListener('pageshow', state.pageshowListener);
  addEventListener('pagehide', state.pagehideListener);
  state.dprWatcher?.bind();
  nodeContentTables().catch(() => {});
  state.router.syncFromLocation({ initial: true }).catch(() => {});

  state.dispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    state.languageGeneration += 1;
    clearTitleTransition();
    releaseScrollRestoration();
    state.prefetchController?.abort();
    state.prefetchController = null;
    state.prefetchKey = null;
    cancelPendingSnapshotRestore();
    cancelPendingDetailNavigation();
    state.catalogRetryPromise = null;
    state.contentTableRetryPromise = null;
    state.failedDetailUrl = null;
    state.preparedDetails.clear();
    detailView.abortPending?.();
    state.workbench?.destroy();
    state.workbench = null;
    state.router?.destroy();
    state.shellListeners.forEach(([type, listener, options]) => app.removeEventListener(type, listener, options));
    state.shellListeners = [];
    app.removeEventListener('click', state.pendingNavigationClickListener, true);
    app.removeEventListener('resourcearchivenodeworkbenchnavigate', state.workbenchNavigationListener);
    app.removeEventListener('resourcearchivenodeworkbenchclosed', state.workbenchClosedListener);
    removeEventListener('popstate', state.pendingNavigationPopstateListener);
    document.removeEventListener('pointerup', state.titlePointerUpListener);
    document.removeEventListener('pointercancel', state.titlePointerCancelListener);
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    state.drawWordmark = null;
    document.removeEventListener('resource-archive-language-change', state.languageListener);
    app.removeEventListener('resourcearchiveinternalviewrouterbeforetransition', state.titleTransitionBeforeListener);
    app.removeEventListener('resourcearchiveinternalviewroutertransitionfinished', state.titleTransitionFinishedListener);
    if (state.pointerMedia && state.pointerListener) {
      if (typeof state.pointerMedia.removeEventListener === 'function') state.pointerMedia.removeEventListener('change', state.pointerListener);
      else state.pointerMedia.removeListener?.(state.pointerListener);
    }
    if (state.reducedMotionMedia && state.reducedMotionListener) {
      if (typeof state.reducedMotionMedia.removeEventListener === 'function') state.reducedMotionMedia.removeEventListener('change', state.reducedMotionListener);
      else state.reducedMotionMedia.removeListener?.(state.reducedMotionListener);
    }
    if (state.pageshowListener) removeEventListener('pageshow', state.pageshowListener);
    if (state.pagehideListener) removeEventListener('pagehide', state.pagehideListener);
    state.dprWatcher?.unbind();
    state.rootObserver?.disconnect();
    state.rootObserver = null;
  };
  if (typeof MutationObserver === 'function') {
    state.rootObserver = new MutationObserver(() => {
      if (!app.isConnected) state.dispose();
    });
    state.rootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
