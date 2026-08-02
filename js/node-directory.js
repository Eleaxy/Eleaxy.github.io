(() => {
  const app = document.querySelector('#node-directory-app');
  const taxonomy = window.ResourceArchiveNodeTaxonomy;
  const wordmark = window.ResourceArchiveNodeWordmark;
  if (!app || !taxonomy || !wordmark) return;

  const stateKey = '__resourceArchiveNodeDirectoryState';
  app[stateKey]?.dispose?.();

  const finePointerQuery = '(hover: hover) and (pointer: fine)';
  const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
  const pointerMedia = typeof window.matchMedia === 'function' ? window.matchMedia(finePointerQuery) : null;
  const reducedMotionMedia = typeof window.matchMedia === 'function' ? window.matchMedia(reducedMotionQuery) : null;
  const state = {
    disposed: false,
    requestId: 0,
    list: null,
    listeners: [],
    side: null,
    semanticWordmark: null,
    canvas: null,
    hoveredLink: null,
    focusedLink: null,
    finePointer: Boolean(pointerMedia?.matches),
    pointerMedia,
    mediaListener: null,
    reducedMotion: Boolean(reducedMotionMedia?.matches),
    reducedMotionMedia,
    reducedMotionListener: null,
    languageListener: null,
    records: null,
    activeWordmark: null,
    wordmarkMode: null,
    wordmarkRevision: 0,
    wordmarkTicker: null,
    pageHidden: false,
    resizeObserver: null,
    resizeListener: null,
    pageshowListener: null,
    pagehideListener: null,
    rootObserver: null,
  };
  app[stateKey] = state;
  const dprWatcher = wordmark.createDprWatcher(() => {
    if (state.disposed || app[stateKey] !== state) return;
    redrawWordmark();
  });

  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function removeListListeners() {
    state.listeners.forEach(([type, listener]) => state.list?.removeEventListener(type, listener));
    state.listeners = [];
    state.list = null;
  }

  function stopWordmarkTicker() {
    state.wordmarkTicker?.stop();
    state.wordmarkTicker = null;
  }

  function removeCanvas() {
    stopWordmarkTicker();
    state.canvas?.remove();
    state.canvas = null;
  }

  function clearPresentation() {
    delete app.dataset.activeSystem;
    state.activeWordmark = null;
    state.wordmarkMode = null;
    if (state.semanticWordmark) state.semanticWordmark.textContent = '';
    removeCanvas();
  }

  function clearTransitionParts() {
    document.querySelectorAll('[data-transition-selected]').forEach(node => {
      node.removeAttribute('data-transition-selected');
      node.style.removeProperty('view-transition-name');
    });
    document.querySelectorAll('.node-wordmark-canvas').forEach(node => {
      node.style.removeProperty('view-transition-name');
    });
  }

  function selectTransitionParts(link) {
    clearTransitionParts();
    if (!link) return;
    link.dataset.transitionSelected = '';
    link.querySelector('.node-system-name')?.style.setProperty('view-transition-name', 'node-system-title');
    link.querySelector('.node-system-count')?.style.setProperty('view-transition-name', 'node-system-count');
    document.querySelector('.node-wordmark-canvas')?.style.setProperty('view-transition-name', 'node-system-wordmark');
  }

  function ensureCanvas() {
    if (!state.side || !state.semanticWordmark || state.canvas?.isConnected) return;
    const canvas = node('canvas', 'node-wordmark-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    state.side.insertBefore(canvas, state.semanticWordmark);
    state.canvas = canvas;
  }

  function readableCanvasWidth() {
    if (!state.side || window.innerWidth <= 760) return 0;
    return Math.min(480, state.side.getBoundingClientRect().width);
  }

  function redrawWordmark() {
    if (state.disposed || app[stateKey] !== state) return;
    const presentation = state.activeWordmark;
    const cssWidth = readableCanvasWidth();
    if (state.pageHidden || !wordmarkAllowed() || !presentation || cssWidth < 160) {
      removeCanvas();
      return;
    }
    ensureCanvas();
    if (!state.canvas) return;
    stopWordmarkTicker();
    const canvas = state.canvas;
    const recordRender = result => {
      if (state.disposed || state.canvas !== canvas || !canvas.isConnected || result?.mode !== 'canvas') return;
      canvas.dataset.wordmarkRenderRevision = String(++state.wordmarkRevision);
    };
    const options = {
      canvas,
      cssWidth,
      dpr: window.devicePixelRatio || 1,
      ...presentation,
      allowFallback: true,
    };
    if (state.wordmarkMode === 'ticker') {
      state.wordmarkTicker = wordmark.startTicker({ ...options, onRender: recordRender });
    } else {
      recordRender(wordmark.render(options));
    }
    if (canvas.width === 0) removeCanvas();
  }

  function activate(link) {
    if (!link || !state.semanticWordmark) return clearPresentation();
    const count = link.querySelector('.node-system-count')?.textContent.match(/\d+/)?.[0];
    const name = link.querySelector('.node-system-name')?.textContent;
    if (!count || !name) return clearPresentation();

    if (!wordmarkAllowed()) {
      delete app.dataset.activeSystem;
      state.activeWordmark = null;
      state.wordmarkMode = null;
      state.semanticWordmark.textContent = name;
      removeCanvas();
      return;
    }

    const nextWordmark = { slug: link.dataset.nodeSystem, label: name, count };
    const unchanged = state.activeWordmark?.slug === nextWordmark.slug
      && state.activeWordmark?.label === nextWordmark.label
      && state.activeWordmark?.count === nextWordmark.count;
    const nextMode = state.hoveredLink && !state.focusedLink ? 'ticker' : 'static';
    const modeChanged = state.wordmarkMode !== nextMode;
    app.dataset.activeSystem = link.dataset.nodeSystem;
    state.activeWordmark = nextWordmark;
    state.wordmarkMode = nextMode;
    state.semanticWordmark.textContent = name;
    if (!unchanged || modeChanged || !state.canvas?.isConnected) redrawWordmark();
  }

  function wordmarkAllowed() {
    return state.finePointer && !state.reducedMotion;
  }

  function syncActiveLink() {
    activate(state.focusedLink || state.hoveredLink);
  }

  function focusedLinkFromDocument() {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof Element) || !state.list?.contains(activeElement)) return null;
    return activeElement.closest('[data-node-system]');
  }

  function updatePointerCapability(isFine) {
    if (state.finePointer === isFine) return;
    state.finePointer = isFine;
    state.hoveredLink = null;
    state.focusedLink = null;
    clearPresentation();
    state.focusedLink = focusedLinkFromDocument();
    syncActiveLink();
  }

  function updateReducedMotion(reduced) {
    if (state.reducedMotion === reduced) return;
    state.reducedMotion = reduced;
    state.hoveredLink = null;
    state.focusedLink = null;
    clearPresentation();
    state.focusedLink = focusedLinkFromDocument();
    syncActiveLink();
  }

  function render(records) {
    if (state.disposed || !app.isConnected) return;
    removeListListeners();
    stopWordmarkTicker();
    state.hoveredLink = null;
    state.focusedLink = null;
    const activeSlug = state.activeWordmark?.slug;
    state.wordmarkMode = null;
    state.canvas = null;

    const language = document.documentElement.lang;
    const summaries = taxonomy.summarizeSystems(records);
    const shell = node('div', 'node-directory-layout');
    const side = node('aside', 'node-directory-side');
    side.append(
      node('p', 'source-kind', translate('nodes-directory-kicker')),
      node('h2', null, translate('nodes-directory-title')),
      node('p', null, translate('nodes-directory-copy')),
    );

    const semanticWordmark = node('p', 'node-wordmark-text', '');
    semanticWordmark.setAttribute('aria-live', 'polite');
    side.append(semanticWordmark);
    state.side = side;
    state.semanticWordmark = semanticWordmark;
    const list = node('div', 'node-system-list');
    const entries = [...summaries, {
      slug: 'all',
        categories: [],
        count: records.length,
    }];
    entries.forEach((entry, index) => {
      const link = node('a', `node-system-link${entry.slug === 'all' ? ' all-nodes-link' : ''}`);
      link.dataset.nodeSystem = entry.slug;
      link.href = entry.slug === 'all' ? '/nodes.html' : `/nodes.html?group=${entry.slug}`;
      link.append(
        node('span', 'node-system-index', String(index + 1).padStart(2, '0')),
        node('strong', 'node-system-name', entry.slug === 'all'
          ? translate('nodes-all')
          : taxonomy.systemLabel(entry, language)),
        node('span', 'node-system-subtypes', entry.slug === 'all'
          ? translate('nodes-complete-index')
          : entry.categories.map(id => taxonomy.categoryLabel(id, language)).join(' · ')),
        node('span', 'node-system-count', `${entry.count} ↗`),
      );
      list.append(link);
    });

    const linkForEvent = event => event.target instanceof Element
      ? event.target.closest('[data-node-system]')
      : null;
    const onPointerOver = event => {
      state.hoveredLink = linkForEvent(event);
      syncActiveLink();
    };
    const onFocusIn = event => {
      state.focusedLink = linkForEvent(event);
      selectTransitionParts(state.focusedLink);
      syncActiveLink();
    };
    const isPrimaryNavigation = event => event.button === 0 && !(event.isPrimary === false && event.pointerType)
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const onPointerDown = event => {
      if (!isPrimaryNavigation(event)) return clearTransitionParts();
      selectTransitionParts(linkForEvent(event));
    };
    const onClick = event => {
      if (!isPrimaryNavigation(event)) return clearTransitionParts();
      selectTransitionParts(linkForEvent(event));
    };
    const onFocusOut = event => {
      if (event.relatedTarget instanceof Node && list.contains(event.relatedTarget)) return;
      state.focusedLink = null;
      syncActiveLink();
    };
    const onPointerLeave = () => {
      state.hoveredLink = null;
      syncActiveLink();
    };
    const onPointerCancel = () => clearTransitionParts();
    state.list = list;
    state.listeners = [
      ['pointerover', onPointerOver],
      ['pointerdown', onPointerDown],
      ['focusin', onFocusIn],
      ['focusout', onFocusOut],
      ['pointerleave', onPointerLeave],
      ['pointercancel', onPointerCancel],
      ['click', onClick],
    ];
    state.listeners.forEach(([type, listener]) => list.addEventListener(type, listener));

    shell.append(side, list);
    app.replaceChildren(shell);
    state.focusedLink = activeSlug ? list.querySelector(`[data-node-system="${activeSlug}"]`) : focusedLinkFromDocument();
    state.hoveredLink = null;
    syncActiveLink();
    state.resizeObserver?.disconnect();
    if (typeof ResizeObserver === 'function') {
      state.resizeObserver = new ResizeObserver(() => redrawWordmark());
      state.resizeObserver.observe(side);
    }
    window.ResourceArchivePixelField?.refreshTargets();
  }

  function showError(error) {
    if (state.disposed) return;
    const retry = node('button', 'button-secondary');
    retry.dataset.pixelFlicker = '';
    retry.type = 'button';
    retry.append(node('span', 'pixel-button-label', 'Retry'));
    retry.addEventListener('click', load);
    app.replaceChildren(node('p', 'error-state', `Node systems unavailable: ${error.message}`), retry);
  }

  function load() {
    const requestId = state.requestId += 1;
    fetch('/data/migrated/search-index.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(records => {
        if (!state.disposed && requestId === state.requestId) {
          state.records = records;
          render(records);
        }
      })
      .catch(error => {
        if (!state.disposed && requestId === state.requestId) showError(error);
      });
  }

  state.dispose = () => {
    state.disposed = true;
    state.requestId += 1;
    clearPresentation();
    removeListListeners();
    if (state.pointerMedia && state.mediaListener) {
      if (typeof state.pointerMedia.removeEventListener === 'function') {
        state.pointerMedia.removeEventListener('change', state.mediaListener);
      } else {
        state.pointerMedia.removeListener?.(state.mediaListener);
      }
    }
    state.mediaListener = null;
    if (state.reducedMotionMedia && state.reducedMotionListener) {
      if (typeof state.reducedMotionMedia.removeEventListener === 'function') {
        state.reducedMotionMedia.removeEventListener('change', state.reducedMotionListener);
      } else {
        state.reducedMotionMedia.removeListener?.(state.reducedMotionListener);
      }
    }
    state.reducedMotionListener = null;
    if (state.languageListener) {
      document.removeEventListener('resource-archive-language-change', state.languageListener);
      state.languageListener = null;
    }
    state.hoveredLink = null;
    state.focusedLink = null;
    stopWordmarkTicker();
    removeCanvas();
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    if (state.resizeListener) removeEventListener('resize', state.resizeListener);
    if (state.pageshowListener) removeEventListener('pageshow', state.pageshowListener);
    if (state.pagehideListener) removeEventListener('pagehide', state.pagehideListener);
    dprWatcher.unbind();
    state.rootObserver?.disconnect();
    state.rootObserver = null;
  };

  state.mediaListener = event => updatePointerCapability(Boolean(event.matches));
  if (pointerMedia) {
    if (typeof pointerMedia.addEventListener === 'function') pointerMedia.addEventListener('change', state.mediaListener);
    else pointerMedia.addListener?.(state.mediaListener);
  }

  state.reducedMotionListener = event => updateReducedMotion(Boolean(event.matches));
  if (reducedMotionMedia) {
    if (typeof reducedMotionMedia.addEventListener === 'function') {
      reducedMotionMedia.addEventListener('change', state.reducedMotionListener);
    } else {
      reducedMotionMedia.addListener?.(state.reducedMotionListener);
    }
  }

  state.languageListener = () => {
    if (state.records && app.isConnected) render(state.records);
  };
  document.addEventListener('resource-archive-language-change', state.languageListener);
  state.resizeListener = () => redrawWordmark();
  state.pageshowListener = () => {
    state.pageHidden = false;
    dprWatcher.bind();
    redrawWordmark();
  };
  state.pagehideListener = () => {
    state.pageHidden = true;
    clearTransitionParts();
    stopWordmarkTicker();
    dprWatcher.unbind();
  };
  addEventListener('resize', state.resizeListener);
  addEventListener('pageshow', state.pageshowListener);
  addEventListener('pagehide', state.pagehideListener);
  dprWatcher.bind();
  if (typeof MutationObserver === 'function') {
    state.rootObserver = new MutationObserver(() => {
      if (!app.isConnected) state.dispose();
    });
    state.rootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.fonts?.ready?.then(() => {
    if (state.disposed || app[stateKey] !== state) return;
    redrawWordmark();
  }).catch(() => {});

  load();
})();
