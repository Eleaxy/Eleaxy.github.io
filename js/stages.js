(() => {
  const app = document.querySelector('#stage-app');
  if (!app || !window.ResourceArchiveStages) return;
  const routerApi = window.ResourceArchiveInternalViewRouter;

  const stateKey = '__resourceArchiveStagesState';
  app[stateKey]?.dispose?.();

  const origins = new Map([
    ['home-stages', '/index.html#stages'],
    ['stage-index', '/stages.html'],
  ]);
  const scrollSnapshotVersion = 1;
  const stageLayoutVersion = 1;
  const scrollSnapshotWriteInterval = 250;
  const state = {
    disposed: false,
    disposing: false,
    stages: null,
    error: null,
    contentTableRetryPromise: null,
    languageGeneration: 0,
    router: null,
    indexEntry: null,
    languageListener: null,
    pageswapListener: null,
    pagehideListener: null,
    pageshowListener: null,
    routerBeforeTransitionListener: null,
    routerTransitionFinishedListener: null,
    routerTransitionToken: null,
    routerFragmentBeforeTransitionListener: null,
    routerFragmentTransitionFinishedListener: null,
    routerFragmentTransitionToken: null,
    priorScrollRestoration: null,
    pendingScrollSnapshot: null,
    pendingScrollSnapshotOwner: null,
    scrollSnapshotTransactionToken: null,
    scrollSnapshotLastAttemptAt: Number.NEGATIVE_INFINITY,
    scrollSnapshotListener: null,
    scrollSnapshotTimer: null,
    scrollSnapshotActive: false,
    scrollSnapshotWriteWarningIssued: false,
    documentExitHandled: false,
    scrollRestorationReady: false,
    initialRouterCommitPending: true,
    crossDocumentRestorePending: false,
    crossDocumentScrollVerified: null,
    initialScrollRestoreToken: null,
    initialScrollRestoreUrl: null,
    initialScrollRestoreBaseline: null,
    scrollSnapshotBaseline: null,
    scrollSnapshotRequiresFreshScroll: false,
    scrollSnapshotProceduralScrollToken: null,
    scrollRestorationTransaction: 0,
    scrollAnchorSuppression: null,
    pendingFocusedStageId: null,
    initialNavigationType: performance.getEntriesByType('navigation')[0]?.type ?? 'navigate',
  };
  app[stateKey] = state;

  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const isChinese = () => (document.documentElement.lang || 'en').toLowerCase().startsWith('zh');
  const stageContentTables = () => Promise.all([
    window.resourceArchiveI18n?.loadContentTable('stage-copy'),
    window.resourceArchiveI18n?.loadContentTable('translation-allowlist'),
  ]);
  const stageCopy = value => !isChinese() ? value : window.resourceArchiveI18n?.contentTable('stage-copy')?.[value]
    || `未提供译文：${value}`;
  const stageTitle = stage => !isChinese() ? stage.title : `${stageCopy(stage.title)} / ${stage.title}`;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function parseRoute(url) {
    const stageId = url.searchParams.get('stage');
    const origin = url.searchParams.get('origin');
    return {
      stageId: stageId || null,
      origin: origins.has(origin) ? origin : null,
    };
  }

  function stageSnapshot(route = parseRoute(new URL(location.href)), pendingFocusedStageId = null) {
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const focusedStageId = active?.closest('.stage-archive-link')?.closest('[data-stage-card]')?.dataset.stageCard
      || pendingFocusedStageId;
    return {
      version: scrollSnapshotVersion,
      layoutVersion: stageLayoutVersion,
      owner: 'stage',
      x: scrollX,
      y: scrollY,
      scrollX,
      scrollY,
      pathname: location.pathname,
      view: route.stageId ? 'detail' : 'index',
      origin: route.origin,
      category: null,
      detail: route.stageId,
      stageId: route.stageId,
      focusedStageId,
    };
  }

  function matchingStageSnapshot(snapshot, route = parseRoute(new URL(location.href))) {
    return snapshot && typeof snapshot === 'object'
      && snapshot.version === scrollSnapshotVersion
      && snapshot.layoutVersion === stageLayoutVersion
      && snapshot.owner === 'stage'
      && Number.isFinite(snapshot.x)
      && Number.isFinite(snapshot.y)
      && snapshot.pathname === location.pathname
      && snapshot.view === (route.stageId ? 'detail' : 'index')
      && snapshot.origin === route.origin
      && snapshot.category === null
      && snapshot.detail === route.stageId
      && snapshot.stageId === route.stageId;
  }

  function claimScrollRestoration() {
    if (!('scrollRestoration' in history)) return;
    if (state.priorScrollRestoration === null) state.priorScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
  }

  function releaseScrollRestoration() {
    if (state.priorScrollRestoration === null || history.scrollRestoration !== 'manual') return;
    history.scrollRestoration = state.priorScrollRestoration;
  }

  function cancelScrollSnapshotTimer() {
    if (state.scrollSnapshotTimer === null) return;
    clearTimeout(state.scrollSnapshotTimer);
    state.scrollSnapshotTimer = null;
  }

  function cancelPendingScrollSnapshot() {
    cancelScrollSnapshotTimer();
    state.pendingScrollSnapshot = null;
    state.pendingScrollSnapshotOwner = null;
  }

  function scrollSnapshotOwner() {
    const entry = currentRouterEntry();
    return entry ? {
      index: entry.index,
      session: entry.session,
      transactionToken: state.scrollSnapshotTransactionToken,
    } : null;
  }

  function sameScrollSnapshotOwner(left, right) {
    return left !== null && right !== null
      && left.index === right.index
      && left.session === right.session
      && left.transactionToken === right.transactionToken;
  }

  function currentScrollSnapshotOwner(owner) {
    return sameScrollSnapshotOwner(owner, scrollSnapshotOwner());
  }

  function tryPersistScrollSnapshot(snapshot, owner = scrollSnapshotOwner()) {
    if (!snapshot || state.disposed || !state.router) return false;
    if (!currentScrollSnapshotOwner(owner)) return false;
    const entry = currentRouterEntry();
    if (!entry) return false;
    const current = history.state && typeof history.state === 'object' ? history.state : {};
    try {
      history.replaceState({
        ...current,
        resourceArchiveInternalViewRouter: {
          ...entry,
          snapshot,
        },
      }, '', location.href);
      if (state.pendingScrollSnapshot === snapshot
        && sameScrollSnapshotOwner(state.pendingScrollSnapshotOwner, owner)) {
        state.pendingScrollSnapshot = null;
        state.pendingScrollSnapshotOwner = null;
      }
      return true;
    } catch (error) {
      if (!state.scrollSnapshotWriteWarningIssued) {
        state.scrollSnapshotWriteWarningIssued = true;
        console.warn('Stage scroll snapshot persistence failed; the pending snapshot was retained.');
      }
      return false;
    }
  }

  function flushScrollSnapshot() {
    cancelScrollSnapshotTimer();
    const owner = scrollSnapshotOwner();
    const snapshot = state.scrollSnapshotRequiresFreshScroll
      ? state.scrollSnapshotBaseline
      : stageSnapshot();
    if (!snapshot || !owner) return false;
    state.pendingScrollSnapshot = snapshot;
    state.pendingScrollSnapshotOwner = owner;
    state.scrollSnapshotLastAttemptAt = performance.now();
    return tryPersistScrollSnapshot(snapshot, owner);
  }

  function scheduleScrollSnapshot() {
    if (state.scrollSnapshotProceduralScrollToken !== null) {
      state.scrollSnapshotProceduralScrollToken = null;
      return;
    }
    if (state.disposed || !state.scrollSnapshotActive) return;
    state.scrollSnapshotBaseline = null;
    state.scrollSnapshotRequiresFreshScroll = false;
    const owner = scrollSnapshotOwner();
    if (!owner) return;
    state.pendingScrollSnapshot = stageSnapshot();
    state.pendingScrollSnapshotOwner = owner;
    if (state.scrollSnapshotTimer !== null) return;
    const elapsed = performance.now() - state.scrollSnapshotLastAttemptAt;
    const delay = Math.max(0, scrollSnapshotWriteInterval - elapsed);
    const timer = setTimeout(() => {
      if (state.scrollSnapshotTimer !== timer || !currentScrollSnapshotOwner(owner)) return;
      state.scrollSnapshotTimer = null;
      if (state.disposed || !state.scrollSnapshotActive || !state.pendingScrollSnapshot
        || !sameScrollSnapshotOwner(state.pendingScrollSnapshotOwner, owner)) return;
      state.scrollSnapshotLastAttemptAt = performance.now();
      tryPersistScrollSnapshot(state.pendingScrollSnapshot, owner);
    }, delay);
    state.scrollSnapshotTimer = timer;
  }

  function waitForAnimationFrame() {
    return new Promise((resolve, reject) => {
      try {
        requestAnimationFrame(resolve);
      } catch (error) {
        reject(error);
      }
    });
  }

  function waitForLayoutCommit() {
    return new Promise((resolve, reject) => {
      try {
        requestAnimationFrame(() => {
          try {
            requestAnimationFrame(resolve);
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function restoreStageScroll(x, y, restoreToken = null, trackProceduralScroll = false) {
    const beforeX = scrollX;
    const beforeY = scrollY;
    window.scrollTo({ left: x, top: y, behavior: 'instant' });
    if (restoreToken !== null && (trackProceduralScroll || scrollX !== beforeX || scrollY !== beforeY)) {
      state.scrollSnapshotProceduralScrollToken = restoreToken;
    }
  }

  function restoreStageFocus(focusedStageId) {
    if (focusedStageId) {
      const card = [...app.querySelectorAll('[data-stage-card]')]
        .find(node => node.dataset.stageCard === focusedStageId);
      card?.querySelector('.stage-archive-link')?.focus({ preventScroll: true });
    }
  }

  function suppressScrollAnchoring() {
    if (state.scrollAnchorSuppression !== null) return;
    const root = document.documentElement;
    state.scrollAnchorSuppression = {
      root,
      overflowAnchor: root.style.overflowAnchor,
    };
    root.style.overflowAnchor = 'none';
  }

  function releaseScrollAnchoring() {
    const suppression = state.scrollAnchorSuppression;
    if (suppression === null) return;
    state.scrollAnchorSuppression = null;
    if (suppression.root.style.overflowAnchor === 'none') {
      suppression.root.style.overflowAnchor = suppression.overflowAnchor;
    }
  }

  function exactRouterEntry(session, index, url) {
    const entry = currentRouterEntry();
    return entry && entry.session === session && entry.index === index && location.href === url;
  }

  function currentInitialScrollRestore(token, session, index, url) {
    return !state.disposed
      && state.initialScrollRestoreToken === token
      && state.scrollRestorationTransaction === token
      && state.initialScrollRestoreUrl === url
      && exactRouterEntry(session, index, url);
  }

  function completeInitialScrollRestore(token, session, index, url, verified) {
    if (!currentInitialScrollRestore(token, session, index, url)) return false;
    const baseline = state.initialScrollRestoreBaseline;
    state.initialScrollRestoreToken = null;
    state.initialScrollRestoreUrl = null;
    state.initialScrollRestoreBaseline = null;
    if (state.scrollSnapshotProceduralScrollToken === token) state.scrollSnapshotProceduralScrollToken = null;
    state.crossDocumentScrollVerified = verified;
    if (!verified && baseline?.token === token) {
      state.scrollSnapshotBaseline = baseline.snapshot;
      state.scrollSnapshotRequiresFreshScroll = true;
      tryPersistScrollSnapshot(baseline.snapshot);
    } else {
      state.scrollSnapshotBaseline = null;
      state.scrollSnapshotRequiresFreshScroll = false;
    }
    state.scrollRestorationReady = true;
    state.scrollSnapshotActive = true;
    releaseScrollAnchoring();
    return true;
  }

  function completeDegradedInitialScrollRestore(token, session, index, url) {
    if (!currentInitialScrollRestore(token, session, index, url)) return;
    if (state.scrollSnapshotProceduralScrollToken !== token) {
      completeInitialScrollRestore(token, session, index, url, false);
      return;
    }
    void waitForAnimationFrame().then(
      () => {
        if (!currentInitialScrollRestore(token, session, index, url)) return;
        state.scrollSnapshotProceduralScrollToken = null;
        completeInitialScrollRestore(token, session, index, url, false);
      },
      () => completeInitialScrollRestore(token, session, index, url, false),
    );
  }

  function cancelInitialScrollRestore({
    preserveSnapshotBaseline = false,
    preservePendingScrollSnapshot = false,
  } = {}) {
    if (preservePendingScrollSnapshot) cancelScrollSnapshotTimer();
    else cancelPendingScrollSnapshot();
    state.scrollRestorationTransaction += 1;
    state.initialScrollRestoreToken = null;
    state.initialScrollRestoreUrl = null;
    state.initialScrollRestoreBaseline = null;
    if (!preserveSnapshotBaseline) {
      state.scrollSnapshotBaseline = null;
      state.scrollSnapshotRequiresFreshScroll = false;
    }
    state.scrollSnapshotProceduralScrollToken = null;
    state.crossDocumentScrollVerified = null;
    state.scrollRestorationReady = false;
    state.scrollSnapshotActive = false;
    releaseScrollAnchoring();
  }

  function activateCurrentRouteScrollSnapshots({ preserveSnapshotBaseline = false } = {}) {
    if (state.disposed || state.initialRouterCommitPending || state.initialScrollRestoreToken !== null) return;
    if (!preserveSnapshotBaseline) {
      state.scrollSnapshotBaseline = null;
      state.scrollSnapshotRequiresFreshScroll = false;
    }
    state.crossDocumentScrollVerified = null;
    state.scrollRestorationReady = true;
    state.scrollSnapshotActive = true;
    releaseScrollAnchoring();
  }

  function settleInitialScrollRestoration() {
    if (state.disposed) return;
    claimScrollRestoration();
    const snapshot = currentRouterEntry()?.snapshot ?? null;
    const entry = currentRouterEntry();
    const restorePending = state.crossDocumentRestorePending && matchingStageSnapshot(snapshot);
    state.crossDocumentRestorePending = false;
    state.initialRouterCommitPending = false;
    if (!restorePending) {
      state.crossDocumentScrollVerified = null;
      state.scrollRestorationReady = true;
      state.scrollSnapshotActive = true;
      releaseScrollAnchoring();
      return;
    }
    if (!entry) {
      state.crossDocumentScrollVerified = false;
      state.scrollRestorationReady = false;
      state.scrollSnapshotActive = false;
      releaseScrollAnchoring();
      return;
    }
    const targetFocus = snapshot.focusedStageId;
    const targetX = snapshot.x;
    const targetY = snapshot.y;
    const entryIndex = entry.index;
    const entrySession = entry.session;
    const entryUrl = location.href;
    const restoreToken = ++state.scrollRestorationTransaction;
    state.initialScrollRestoreToken = restoreToken;
    state.initialScrollRestoreUrl = entryUrl;
    state.initialScrollRestoreBaseline = {
      snapshot: {
        version: scrollSnapshotVersion,
        layoutVersion: stageLayoutVersion,
        owner: 'stage',
        x: targetX,
        y: targetY,
        scrollX: targetX,
        scrollY: targetY,
        pathname: location.pathname,
        view: snapshot.view,
        origin: snapshot.origin,
        category: null,
        detail: snapshot.detail,
        stageId: snapshot.stageId,
        focusedStageId: targetFocus,
      },
      token: restoreToken,
    };
    state.scrollSnapshotActive = false;
    state.crossDocumentScrollVerified = null;
    state.scrollRestorationReady = false;
    suppressScrollAnchoring();
    try {
      restoreStageScroll(targetX, targetY, restoreToken);
      restoreStageFocus(targetFocus);
    } catch {
      completeDegradedInitialScrollRestore(restoreToken, entrySession, entryIndex, entryUrl);
      return;
    }
    void waitForLayoutCommit().then(() => {
      if (!currentInitialScrollRestore(restoreToken, entrySession, entryIndex, entryUrl)) return;
      let verified = false;
      try {
        restoreStageScroll(targetX, targetY, restoreToken, true);
        verified = Math.abs(scrollX - targetX) <= 2 && Math.abs(scrollY - targetY) <= 2;
      } catch {
        verified = false;
      }
      if (verified) completeInitialScrollRestore(restoreToken, entrySession, entryIndex, entryUrl, true);
      else completeDegradedInitialScrollRestore(restoreToken, entrySession, entryIndex, entryUrl);
    }, () => completeDegradedInitialScrollRestore(restoreToken, entrySession, entryIndex, entryUrl));
  }

  function routeUrl(stageId, origin) {
    const url = new URL('/stages.html', location.origin);
    if (stageId) url.searchParams.set('stage', stageId);
    if (origin && origins.has(origin)) url.searchParams.set('origin', origin);
    return `${url.pathname}${url.search}`;
  }

  function currentRouterEntry() {
    const entry = history.state?.resourceArchiveInternalViewRouter;
    return entry && typeof entry.session === 'string' && Number.isInteger(entry.index) ? entry : null;
  }

  function rememberIndexEntry(route) {
    if (route.stageId) return;
    const entry = currentRouterEntry();
    state.indexEntry = entry ? { session: entry.session, index: entry.index } : null;
  }

  function canReturnToOwnedIndex() {
    const current = currentRouterEntry();
    const indexEntry = state.indexEntry;
    return current && indexEntry
      && current.session === indexEntry.session
      && current.index === indexEntry.index + 1;
  }

  function clearStageTransition() {
    app.querySelectorAll('[data-transition-stage]').forEach(node => {
      node.removeAttribute('data-transition-stage');
      node.style.removeProperty('view-transition-name');
    });
  }

  function selectStageTransition(event) {
    const primaryPointer = event.type === 'pointerdown'
      && event.button === 0 && (event.isPrimary !== false || !event.pointerType)
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (event.type === 'pointerdown' && !primaryPointer) {
      clearStageTransition();
      return;
    }
    const link = event.target instanceof Element ? event.target.closest('.stage-archive-link') : null;
    if (!link || !app.contains(link)) {
      // The router moves focus to the committed detail shell. Its hero owns the
      // shared name, so a focus event outside the archive index must not clear it.
      if (event.type !== 'focusin' || app.querySelector('[data-stage-card]')) clearStageTransition();
      return;
    }
    clearStageTransition();
    const media = link.querySelector('.stage-media');
    if (!media) return;
    media.dataset.transitionStage = '';
    media.style.setProperty('view-transition-name', 'stage-media');
  }

  function capture() {
    const pendingFocusedStageId = state.pendingFocusedStageId;
    state.pendingFocusedStageId = null;
    const snapshot = state.scrollSnapshotRequiresFreshScroll && state.scrollSnapshotBaseline
      ? state.scrollSnapshotBaseline
      : stageSnapshot(undefined, pendingFocusedStageId);
    return snapshot;
  }

  async function restore(snapshot, { signal, isCurrent: operationIsCurrent } = {}) {
    const current = () => !signal?.aborted && operationIsCurrent?.() !== false;
    if (state.initialRouterCommitPending && state.crossDocumentRestorePending) return;
    if (!matchingStageSnapshot(snapshot) || !current()) return;
    const left = snapshot.x;
    const top = snapshot.y;
    try {
      await waitForLayoutCommit();
    } catch {
      return;
    }
    if (!current()) return;
    window.scrollTo({ left, top, behavior: 'instant' });
    if (!snapshot.focusedStageId) return;
    const card = [...app.querySelectorAll('[data-stage-card]')]
      .find(node => node.dataset.stageCard === snapshot.focusedStageId);
    card?.querySelector('.stage-archive-link')?.focus({ preventScroll: true });
  }

  function restoreFragment(snapshot, { token } = {}) {
    const owner = scrollSnapshotOwner();
    if (!matchingStageSnapshot(snapshot) || !owner || token !== state.routerFragmentTransitionToken
      || !currentScrollSnapshotOwner(owner)) return;
    restoreStageScroll(snapshot.x, snapshot.y, token, true);
    if (token !== state.routerFragmentTransitionToken || !currentScrollSnapshotOwner(owner)) return;
    restoreStageFocus(snapshot.focusedStageId);
  }

  function textList(title, values) {
    const section = element('section', 'prose-section');
    section.append(element('h2', null, title));
    const list = document.createElement('ul');
    values.forEach(value => list.append(element('li', null, value)));
    section.append(list);
    return section;
  }

  function stageCard(stage, origin) {
    const article = element('article', 'stage-archive-item');
    article.dataset.stageCard = stage.id;
    const link = element('a', 'stage-archive-link');
    link.href = routeUrl(stage.id, origin === 'home-stages' ? origin : 'stage-index');
    link.setAttribute('aria-label', translate('stages-view-details', { title: stageTitle(stage) }));
    const media = element('div', 'stage-media');
    media.dataset.stageMedia = stage.id;
    media.dataset.localImage = stage.image.local;
    const image = window.ResourceArchiveStages.image(stage);
    image.dataset.stageImageId = stage.id;
    image.loading = 'lazy';
    media.append(image);
    link.append(media, element('p', 'source-kind', stage.date), element('h2', null, stageTitle(stage)));
    article.append(link);
    return article;
  }

  function renderIndex(target, stages, route) {
    if (route.origin === 'home-stages') {
      const back = element('a', 'back-link', translate('footer-home'));
      back.href = origins.get(route.origin);
      target.append(back);
    }
    const header = element('header', 'stage-index-header explorer-header');
    const eyebrow = element('p', 'eyebrow');
    const title = element('h1');
    title.tabIndex = -1;
    const lede = element('p', 'lede');
    const total = element('strong', 'stage-total', String(stages.length));
    total.dataset.testid = 'stage-total';
    eyebrow.textContent = translate('stages-eyebrow');
    title.textContent = translate('stages-title');
    lede.textContent = translate('stages-lede', { count: stages.length });
    header.append(eyebrow, title, lede, total);
    const list = element('section', 'stage-archive-grid');
    list.setAttribute('aria-label', translate('stages-index-aria'));
    list.append(...stages.map(stage => stageCard(stage, route.origin)));
    target.append(header, list);
  }

  function renderDetail(target, stage, route) {
    const detail = element('article', 'record-detail stage-detail');
    detail.dataset.testid = 'stage-detail';
    detail.dataset.transitionStageDetail = '';
    detail.tabIndex = -1;
    const back = element('a', 'back-link', translate('stages-back-all'));
    back.dataset.stageDetailBack = '';
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    back.href = origins.get(route.origin) || '/stages.html';
    const image = window.ResourceArchiveStages.image(stage, 'stage-hero-image');
    image.dataset.stageImageId = stage.id;
    image.dataset.transitionStageHero = '';
    image.dataset.transitionStage = stage.id;
    image.width = 2560;
    image.height = 1080;
    image.style.setProperty('view-transition-name', 'stage-media');
    detail.append(back, element('p', 'eyebrow', stage.date), element('h1', null, stageTitle(stage)), image);
    if (stage.blender_version) detail.append(element('p', 'version-badge', stageCopy(stage.blender_version)));
    detail.append(
      textList(translate('stages-readme'), (stage.readme || []).map(stageCopy)),
      textList(translate('stages-usage-terms'), (stage.usage_terms || []).map(stageCopy)),
    );
    const actions = element('div', 'detail-actions');
    (stage.download_urls || []).forEach(download => {
      const link = element('a', 'button-primary');
      link.dataset.pixelFlicker = '';
      link.href = download.href;
      link.append(element('span', 'pixel-button-label', translate('stages-download-from', { source: download.text })));
      actions.append(link);
    });
    const source = element('a', 'button-secondary');
    source.dataset.pixelFlicker = '';
    source.href = stage.source_url;
    source.append(element('span', 'pixel-button-label', translate('stages-view-original-source')));
    actions.append(source);
    detail.append(actions);
    target.append(detail);
  }

  function renderError(target, error) {
    const errorState = element('section', 'error-state');
    errorState.append(
      element('p', 'status-label', translate('stages-error-status')),
      element('h1', null, translate('stages-error-heading')),
      element('p', null, error.message),
    );
    const retry = element('button', 'button-secondary');
    retry.dataset.pixelFlicker = '';
    retry.dataset.stageRetry = '';
    retry.type = 'button';
    retry.append(element('span', 'pixel-button-label', translate('stages-retry')));
    errorState.append(retry);
    target.append(errorState);
  }

  function contentTableErrorView(error) {
    const panel = element('section', 'error-state content-table-error');
    panel.dataset.contentTableError = error.contentTable;
    panel.setAttribute('role', 'alert');
    const retry = element('button', 'button-secondary');
    retry.dataset.pixelFlicker = '';
    retry.dataset.contentTableRetry = error.contentTable;
    retry.type = 'button';
    retry.append(element('span', 'pixel-button-label', translate('content-table-retry')));
    panel.append(
      element('p', 'status-label', translate('content-table-error-status')),
      element('h2', null, translate('content-table-error-heading')),
      element('p', null, translate('content-table-error-message')),
      retry,
    );
    return panel;
  }

  function showContentTableError(error) {
    if (state.disposed || !error?.contentTable) return;
    app.querySelector('[data-content-table-error]')?.remove();
    app.prepend(contentTableErrorView(error));
    window.ResourceArchivePixelField?.refreshTargets();
  }

  async function retryContentTable(button) {
    if (state.disposed || state.contentTableRetryPromise || button.disabled) return;
    const table = button.dataset.contentTableRetry;
    const panel = button.closest('[data-content-table-error]');
    if (!table || !panel) return;
    const generation = state.languageGeneration;
    const requestedChinese = isChinese();
    const href = window.location.href;
    const isCurrent = () => !state.disposed
      && generation === state.languageGeneration
      && isChinese() === requestedChinese
      && requestedChinese
      && window.location.href === href;
    const snapshot = capture();
    button.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    const pending = window.resourceArchiveI18n.retryContentTable(table).then(async () => {
      if (!isCurrent()) return;
      try {
        await stageContentTables();
      } catch (error) {
        if (isCurrent()) showContentTableError(error);
        return;
      }
      if (!isCurrent()) return;
      panel.remove();
      if (state.router) {
        await state.router.navigate(href, { trigger: 'language', replace: true });
        if (!isCurrent()) return;
        await restore(snapshot);
      } else {
        await renderStaticRoute();
        if (!isCurrent()) return;
        await restore(snapshot);
      }
    }).catch(error => {
      if (isCurrent()) showContentTableError(error);
    }).finally(() => {
      if (state.contentTableRetryPromise === pending) state.contentTableRetryPromise = null;
    });
    state.contentTableRetryPromise = pending;
    await pending;
  }

  function renderUnknownStage(target, stageId) {
    const errorState = element('section', 'error-state');
    errorState.dataset.stageInvalid = '';
    errorState.append(
      element('p', 'status-label', translate('stages-error-status')),
      element('h1', null, translate('stages-unknown-heading', { stageId })),
    );
    const back = element('a', 'back-link', translate('stages-back-all'));
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    back.href = '/stages.html';
    errorState.append(back);
    target.append(errorState);
  }

  function hydrate(root) {
    root.querySelectorAll('img[data-stage-image-id]').forEach(image => {
      const stage = state.stages.find(record => record.id === image.dataset.stageImageId);
      if (!stage) return;
      // Event listeners are intentionally attached only after the router has
      // committed its cloned target; listeners on detached staging nodes do not
      // cross the clone boundary.
      if (typeof window.ResourceArchiveStages.configureImage === 'function') {
        delete image.dataset.stageImageFallback;
        window.ResourceArchiveStages.configureImage(image, stage, image.className);
      }
    });
    window.ResourceArchiveStageMediaMotion?.enhance(root);
    window.ResourceArchivePixelField?.refreshTargets();
  }

  function renderInto(route, target) {
    if (state.error) renderError(target, state.error);
    else {
      const stage = route.stageId && state.stages.find(record => record.id === route.stageId);
      if (!route.stageId) renderIndex(target, state.stages, route);
      else if (!stage) renderUnknownStage(target, route.stageId);
      else renderDetail(target, stage, route);
    }
  }

  async function renderRoute(route, context) {
    if (isChinese()) {
      try {
        await stageContentTables();
      } catch (error) {
        context.target.append(contentTableErrorView(error));
        context.afterCommit(hydrate);
        return;
      }
    }
    renderInto(route, context.target);
    context.afterCommit(hydrate);
    context.afterCommit(() => rememberIndexEntry(route));
  }

  async function renderStaticRoute() {
    if (isChinese()) await stageContentTables();
    const target = document.createDocumentFragment();
    renderInto(parseRoute(new URL(location.href)), target);
    app.replaceChildren(target);
    hydrate(app);
  }

  function renderLoadError() {
    const target = document.createDocumentFragment();
    renderError(target, state.error);
    app.replaceChildren(target);
  }

  function setupRouter() {
    if (!routerApi) {
      void renderStaticRoute().catch(error => {
        state.error = error;
        renderLoadError();
      });
      return;
    }
    const initialRoute = parseRoute(new URL(location.href));
    const candidate = currentRouterEntry()?.snapshot ?? null;
    const crossDocumentNavigation = state.initialNavigationType === 'back_forward'
      || state.initialNavigationType === 'reload';
    state.crossDocumentRestorePending = Boolean(
      crossDocumentNavigation && matchingStageSnapshot(candidate, initialRoute),
    );
    state.router = routerApi.create({
      root: app,
      parseUrl: parseRoute,
      render: renderRoute,
      capture,
      restore,
      restoreFragment,
      canHandle: url => url.pathname === location.pathname && url.pathname === '/stages.html',
      focusTarget: route => route.stageId
        ? app.querySelector('[data-testid="stage-detail"]')
        : app.querySelector('.stage-index-header h1'),
    });
    state.router.syncFromLocation({ initial: true }).then(() => (
      settleInitialScrollRestoration()
    )).catch(error => {
      state.initialRouterCommitPending = false;
      state.error = error;
      renderLoadError();
    });
  }

  function onShellClick(event) {
    const contentTableRetry = event.target instanceof Element ? event.target.closest('[data-content-table-retry]') : null;
    if (contentTableRetry && app.contains(contentTableRetry)) {
      event.preventDefault();
      void retryContentTable(contentTableRetry);
      return;
    }
    const retry = event.target instanceof Element ? event.target.closest('[data-stage-retry]') : null;
    if (retry && app.contains(retry)) location.reload();
  }

  function captureStageTrigger(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('.stage-archive-link') : null;
    if (!link || !app.contains(link)) return;
    state.pendingFocusedStageId = link.closest('[data-stage-card]')?.dataset.stageCard || null;
  }

  state.languageListener = async () => {
    if (state.disposed) return;
    const generation = ++state.languageGeneration;
    const requestedChinese = isChinese();
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const x = scrollX;
    const y = scrollY;
    if (!requestedChinese) app.querySelector('[data-content-table-error]')?.remove();
    try {
      if (requestedChinese) await stageContentTables();
    } catch (error) {
      if (!state.disposed && generation === state.languageGeneration && isChinese()) {
        showContentTableError(error);
      }
      return;
    }
    if (state.disposed || generation !== state.languageGeneration || isChinese() !== requestedChinese) return;
    if (state.router) await state.router.syncFromLocation({ initial: true }).catch(() => undefined);
    else if (state.stages) await renderStaticRoute().catch(() => undefined);
    else if (state.error) renderLoadError();
    if (state.disposed || generation !== state.languageGeneration || isChinese() !== requestedChinese) return;
    scrollTo(x, y);
    requestAnimationFrame(() => scrollTo(x, y));
    if (focus?.isConnected) focus.focus({ preventScroll: true });
  };
  app.addEventListener('pointerdown', selectStageTransition);
  app.addEventListener('focusin', selectStageTransition);
  app.addEventListener('pointercancel', clearStageTransition);
  app.addEventListener('click', captureStageTrigger, true);
  app.addEventListener('click', onShellClick);
  document.addEventListener('resource-archive-language-change', state.languageListener);
  state.routerBeforeTransitionListener = event => {
    state.routerFragmentTransitionToken = null;
    state.scrollSnapshotTransactionToken = null;
    state.routerTransitionToken = event.detail?.token ?? null;
    cancelInitialScrollRestore();
  };
  state.routerTransitionFinishedListener = event => {
    if (state.routerTransitionToken !== event.detail?.token) return;
    state.routerTransitionToken = null;
    activateCurrentRouteScrollSnapshots();
  };
  state.routerFragmentBeforeTransitionListener = event => {
    const pendingBelongsToCurrentEntry = state.pendingScrollSnapshot !== null
      && currentScrollSnapshotOwner(state.pendingScrollSnapshotOwner);
    const pendingFlushed = pendingBelongsToCurrentEntry && flushScrollSnapshot();
    state.routerTransitionToken = null;
    state.routerFragmentTransitionToken = event.detail?.token ?? null;
    state.scrollSnapshotTransactionToken = event.detail?.token ?? null;
    const preserveSnapshotBaseline = state.scrollSnapshotRequiresFreshScroll
      && state.scrollSnapshotBaseline !== null;
    cancelInitialScrollRestore({
      preserveSnapshotBaseline,
      preservePendingScrollSnapshot: pendingBelongsToCurrentEntry && !pendingFlushed,
    });
  };
  state.routerFragmentTransitionFinishedListener = event => {
    if (state.routerFragmentTransitionToken !== event.detail?.token) return;
    state.routerFragmentTransitionToken = null;
    const preserveSnapshotBaseline = state.scrollSnapshotRequiresFreshScroll
      && state.scrollSnapshotBaseline !== null;
    activateCurrentRouteScrollSnapshots({ preserveSnapshotBaseline });
  };
  app.addEventListener('resourcearchiveinternalviewrouterbeforetransition', state.routerBeforeTransitionListener);
  app.addEventListener('resourcearchiveinternalviewroutertransitionfinished', state.routerTransitionFinishedListener);
  app.addEventListener('resourcearchiveinternalviewrouterfragmentbeforetransition', state.routerFragmentBeforeTransitionListener);
  app.addEventListener('resourcearchiveinternalviewrouterfragmenttransitionfinished', state.routerFragmentTransitionFinishedListener);
  state.scrollSnapshotListener = () => scheduleScrollSnapshot();
  const stopInitialScrollRestorationForExit = () => {
    state.scrollRestorationTransaction += 1;
    state.initialScrollRestoreToken = null;
    state.initialScrollRestoreUrl = null;
    state.initialScrollRestoreBaseline = null;
    state.scrollSnapshotBaseline = null;
    state.scrollSnapshotRequiresFreshScroll = false;
    state.scrollSnapshotProceduralScrollToken = null;
    state.crossDocumentScrollVerified = null;
    state.scrollRestorationReady = false;
    state.scrollSnapshotActive = false;
    releaseScrollAnchoring();
  };
  const handleDocumentExit = () => {
    if (state.disposed || state.documentExitHandled) return;
    state.documentExitHandled = true;
    try {
      state.scrollSnapshotTransactionToken = null;
      flushScrollSnapshot();
    } finally {
      cancelScrollSnapshotTimer();
      stopInitialScrollRestorationForExit();
      releaseScrollRestoration();
    }
  };
  state.pageswapListener = handleDocumentExit;
  state.pagehideListener = handleDocumentExit;
  state.pageshowListener = event => {
    if (!event.persisted || state.disposed || !state.router) return;
    state.documentExitHandled = false;
    claimScrollRestoration();
    state.initialScrollRestoreToken = null;
    state.initialScrollRestoreUrl = null;
    state.initialScrollRestoreBaseline = null;
    state.scrollSnapshotBaseline = null;
    state.scrollSnapshotRequiresFreshScroll = false;
    state.scrollSnapshotProceduralScrollToken = null;
    state.scrollSnapshotTransactionToken = null;
    state.scrollRestorationReady = true;
    state.scrollSnapshotActive = true;
    releaseScrollAnchoring();
  };
  addEventListener('scroll', state.scrollSnapshotListener, { passive: true });
  addEventListener('pageswap', state.pageswapListener);
  addEventListener('pagehide', state.pagehideListener);
  addEventListener('pageshow', state.pageshowListener);
  state.dispose = () => {
    if (state.disposed || state.disposing) return;
    state.disposing = true;
    try {
      flushScrollSnapshot();
    } finally {
      state.disposed = true;
      state.languageGeneration += 1;
      state.documentExitHandled = true;
      cancelInitialScrollRestore();
      state.contentTableRetryPromise = null;
      cancelScrollSnapshotTimer();
      const cleanupSteps = [
        () => releaseScrollRestoration(),
        () => state.router?.destroy(),
        () => document.removeEventListener('resource-archive-language-change', state.languageListener),
        () => app.removeEventListener('pointerdown', selectStageTransition),
        () => app.removeEventListener('focusin', selectStageTransition),
        () => app.removeEventListener('pointercancel', clearStageTransition),
        () => app.removeEventListener('click', captureStageTrigger, true),
        () => app.removeEventListener('click', onShellClick),
        () => app.removeEventListener('resourcearchiveinternalviewrouterbeforetransition', state.routerBeforeTransitionListener),
        () => app.removeEventListener('resourcearchiveinternalviewroutertransitionfinished', state.routerTransitionFinishedListener),
        () => app.removeEventListener('resourcearchiveinternalviewrouterfragmentbeforetransition', state.routerFragmentBeforeTransitionListener),
        () => app.removeEventListener('resourcearchiveinternalviewrouterfragmenttransitionfinished', state.routerFragmentTransitionFinishedListener),
        () => removeEventListener('scroll', state.scrollSnapshotListener),
        () => removeEventListener('pageswap', state.pageswapListener),
        () => removeEventListener('pagehide', state.pagehideListener),
        () => removeEventListener('pageshow', state.pageshowListener),
      ];
      cleanupSteps.forEach(cleanup => {
        try {
          cleanup();
        } catch {
        }
      });
      state.languageListener = null;
      state.pageswapListener = null;
      state.pagehideListener = null;
      state.pageshowListener = null;
      state.routerBeforeTransitionListener = null;
      state.routerTransitionFinishedListener = null;
      state.routerTransitionToken = null;
      state.routerFragmentBeforeTransitionListener = null;
      state.routerFragmentTransitionFinishedListener = null;
      state.routerFragmentTransitionToken = null;
      state.scrollSnapshotListener = null;
      state.disposing = false;
    }
  };

  stageContentTables().catch(() => {});
  window.ResourceArchiveStages.load().then(stages => {
    if (state.disposed) return;
    state.stages = stages;
    setupRouter();
  }).catch(error => {
    if (state.disposed) return;
    state.error = error;
    renderLoadError();
  });
})();
