(() => {
  const page = document.body?.dataset.page;
  const root = document.querySelector('#tutorials-app, [data-tutorials-app]');
  if (!root || (page !== 'tutorials' && page !== 'home')) return;

  const i18n = window.resourceArchiveI18n;
  const routerApi = window.ResourceArchiveInternalViewRouter;
  const homeOriginStorageKey = 'resourceArchiveTutorialHomeOrigin';
  const homeReturnStorageKey = 'resourceArchiveTutorialHomeReturn';
  const homeOriginHistoryKey = 'resourceArchiveTutorialHomeOrigin';
  const homeOriginMarker = 'index-tutorials';
  const homeOriginMaxAgeMs = 10_000;
  if (page === 'tutorials' && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  const state = {
    expanded: false,
    triggerSlug: null,
    entries: null,
    entriesBySlug: null,
    homeOrigin: null,
    router: null,
  };
  let entriesPromise = null;
  const tutorialPixelSuppressionOwner = 'tutorial-home-register';
  let tutorialPixelSuppressionFrame = 0;
  let pendingMouseTriggerSlug = null;
  let pendingHomeReturn = null;

  const t = (key, parameters) => i18n?.translate?.(key, parameters) || key;
  const current = ({ signal, isCurrent } = {}) => !signal?.aborted && (typeof isCurrent !== 'function' || isCurrent());

  function tutorialLocation(slug) {
    const url = new URL(tutorialHref(slug), window.location.origin);
    return `${url.pathname}${url.search}`;
  }

  function validHomeSnapshot(value) {
    return value && typeof value === 'object'
      && Number.isFinite(value.scrollY) && value.scrollY >= 0
      && (value.triggerSlug === null || typeof value.triggerSlug === 'string')
      && typeof value.expanded === 'boolean';
  }

  function homeTutorialOrigin() {
    if (state.homeOrigin) return state.homeOrigin;
    const value = history.state?.[homeOriginHistoryKey];
    if (!value || typeof value !== 'object' || value.marker !== homeOriginMarker || !validHomeSnapshot(value.snapshot)) return null;
    state.homeOrigin = value;
    return value;
  }

  function hasHomeDocumentReferrer() {
    if (!document.referrer) return false;
    try {
      const referrer = new URL(document.referrer);
      return referrer.origin === window.location.origin && referrer.pathname === '/index.html';
    } catch {
      return false;
    }
  }

  function rememberHomeTutorialOrigin(event) {
    if (page !== 'home' || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[data-tutorial-slug]');
    if (!link || !root.contains(link)) return;
    const slug = link.dataset.tutorialSlug;
    if (!hasText(slug)) return;
    let destination;
    try {
      destination = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (`${destination.pathname}${destination.search}` !== tutorialLocation(slug)) return;
    try {
      sessionStorage.setItem(homeOriginStorageKey, JSON.stringify({
        source: homeOriginMarker,
        destination: tutorialLocation(slug),
        createdAt: Date.now(),
        snapshot: {
          scrollY: window.scrollY,
          triggerSlug: slug,
          expanded: state.expanded,
        },
      }));
    } catch {}
  }

  function persistIncomingHomeTutorialOrigin() {
    const route = parseUrl(new URL(window.location.href));
    if (route.kind !== 'detail' || homeTutorialOrigin()) return;
    let candidate = null;
    try {
      candidate = JSON.parse(sessionStorage.getItem(homeOriginStorageKey) || 'null');
      sessionStorage.removeItem(homeOriginStorageKey);
    } catch {
      return;
    }
    if (!candidate || typeof candidate !== 'object'
      || candidate.source !== homeOriginMarker
      || candidate.destination !== tutorialLocation(route.slug)
      || !Number.isFinite(candidate.createdAt)
      || Date.now() - candidate.createdAt < 0
      || Date.now() - candidate.createdAt > homeOriginMaxAgeMs
      || !validHomeSnapshot(candidate.snapshot)
      || !hasHomeDocumentReferrer()) return;
    const origin = { marker: homeOriginMarker, snapshot: candidate.snapshot };
    history.replaceState({
      ...history.state,
      [homeOriginHistoryKey]: origin,
    }, '', window.location.href);
    state.homeOrigin = origin;
  }

  function rememberHomeTutorialReturn(snapshot) {
    if (!validHomeSnapshot(snapshot)) return;
    try {
      sessionStorage.setItem(homeReturnStorageKey, JSON.stringify({
        marker: homeOriginMarker,
        createdAt: Date.now(),
        snapshot,
      }));
    } catch {}
  }

  function rememberHomeTutorialReturnOnPageHide() {
    if (page !== 'tutorials') return;
    const origin = homeTutorialOrigin();
    if (origin) rememberHomeTutorialReturn(origin.snapshot);
  }

  function restoreHomeTutorialReturn() {
    if (page !== 'home') return;
    let candidate = null;
    try {
      candidate = JSON.parse(sessionStorage.getItem(homeReturnStorageKey) || 'null');
      sessionStorage.removeItem(homeReturnStorageKey);
    } catch {
      return;
    }
    if (!candidate || typeof candidate !== 'object' || candidate.marker !== homeOriginMarker
      || !Number.isFinite(candidate.createdAt) || Date.now() - candidate.createdAt < 0
      || Date.now() - candidate.createdAt > homeOriginMaxAgeMs || !validHomeSnapshot(candidate.snapshot)) return;
    pendingHomeReturn = candidate.snapshot;
    applyPendingHomeReturn();
  }

  function applyPendingHomeReturn() {
    const snapshot = pendingHomeReturn;
    if (!snapshot || !state.entries) return;
    pendingHomeReturn = null;
    state.expanded = snapshot.expanded;
    state.triggerSlug = snapshot.triggerSlug;
    applyDirectoryState();
    const restoreScrollAndFocus = (attempt = 0) => {
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (maxScrollY < snapshot.scrollY && attempt < 30) {
        window.setTimeout(() => restoreScrollAndFocus(attempt + 1), 50);
        return;
      }
      window.scrollTo({ top: snapshot.scrollY, left: 0, behavior: 'instant' });
      (directoryLink(snapshot.triggerSlug) || directoryTitle())?.focus?.({ preventScroll: true });
    };
    window.setTimeout(restoreScrollAndFocus, 120);
  }

  function element(name, attributes = {}, children = []) {
    const node = document.createElement(name);
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'lang') node.lang = value;
      else if (key === 'hidden') node.hidden = Boolean(value);
      else node.setAttribute(key, String(value));
    }
    for (const child of children) node.append(child);
    return node;
  }

  function schemaError(message) {
    const error = new Error(message);
    error.name = 'TutorialSchemaError';
    return error;
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function validateImage(block, path) {
    if (!hasText(block.src) || !hasText(block.alt) || !hasText(block.caption)
      || !Number.isInteger(block.width) || block.width < 1
      || !Number.isInteger(block.height) || block.height < 1) {
      throw schemaError(`${path} image is invalid`);
    }
  }

  function validateBlocks(blocks, path, renderedAssetFiles = null) {
    if (!Array.isArray(blocks) || blocks.length === 0) throw schemaError(`${path} blocks are missing`);
    blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object') throw schemaError(`${path}[${index}] is invalid`);
      if (block.type === 'paragraph' || block.type === 'note' || block.type === 'warning') {
        if (!hasText(block.text)) throw schemaError(`${path}[${index}] text is invalid`);
        return;
      }
      if (block.type === 'list') {
        if (!Array.isArray(block.items) || block.items.length === 0 || !block.items.every(hasText)) {
          throw schemaError(`${path}[${index}] list is invalid`);
        }
        return;
      }
      if (block.type === 'image') {
        validateImage(block, `${path}[${index}]`);
        if (renderedAssetFiles?.get(block.src) !== true) {
          throw schemaError(`${path}[${index}] image is not declared as a rendered source asset`);
        }
        return;
      }
      throw schemaError(`${path}[${index}] has an unknown block type`);
    });
  }

  function structuredAssetPathIsWithinDirectory(directory, src) {
    if (!hasText(src) || !src.startsWith(`${directory}/`)) return false;
    const segments = src.slice(directory.length + 1).split('/');
    return segments.length > 0 && segments.every(segment => segment && segment !== '.' && segment !== '..');
  }

  function validateStructuredAsset(entry, path) {
    const asset = entry.asset;
    const expectedDirectory = `assets/tutorials/${entry.slug}`;
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)
      || Object.keys(asset).length !== 2 || !Object.hasOwn(asset, 'directory') || !Object.hasOwn(asset, 'files')
      || !hasText(asset.directory) || asset.directory !== expectedDirectory
      || !Array.isArray(asset.files) || asset.files.length === 0) {
      throw schemaError(`${path} structured asset is invalid`);
    }
    const renderedAssetFiles = new Map();
    asset.files.forEach((file, fileIndex) => {
      const filePath = `${path}.asset.files[${fileIndex}]`;
      if (!file || typeof file !== 'object' || Array.isArray(file)
        || Object.keys(file).length !== 3 || !Object.hasOwn(file, 'src') || !Object.hasOwn(file, 'sha256') || !Object.hasOwn(file, 'rendered')
        || !structuredAssetPathIsWithinDirectory(asset.directory, file.src)
        || !/^[a-f0-9]{64}$/i.test(file.sha256) || typeof file.rendered !== 'boolean'
        || renderedAssetFiles.has(file.src)) {
        throw schemaError(`${filePath} is invalid`);
      }
      renderedAssetFiles.set(file.src, file.rendered);
    });
    return renderedAssetFiles;
  }

  function validateEntry(entry, index, slugs) {
    const path = `tutorials[${index}]`;
    if (!entry || typeof entry !== 'object' || !hasText(entry.slug) || !hasText(entry.title)) {
      throw schemaError(`${path} identity is invalid`);
    }
    if (slugs.has(entry.slug)) throw schemaError(`${path} duplicates ${entry.slug}`);
    slugs.add(entry.slug);
    if (entry.type === 'long-image') {
      if (!entry.asset || typeof entry.asset !== 'object' || !hasText(entry.asset.src) || !hasText(entry.asset.alt)
        || !Number.isInteger(entry.asset.width) || entry.asset.width < 1
        || !Number.isInteger(entry.asset.height) || entry.asset.height < 1) {
        throw schemaError(`${path} long-image asset is invalid`);
      }
      return;
    }
    if (entry.type !== 'structured') throw schemaError(`${path} type is invalid`);
    const renderedAssetFiles = validateStructuredAsset(entry, path);
    validateBlocks(entry.intro, `${path}.intro`, renderedAssetFiles);
    if (!Array.isArray(entry.sections) || entry.sections.length === 0) throw schemaError(`${path}.sections are missing`);
    if (entry.sections[0]?.title === entry.title) throw schemaError(`${path}.sections[0] must not duplicate entry title`);
    entry.sections.forEach((section, sectionIndex) => {
      if (!section || !hasText(section.title)) throw schemaError(`${path}.sections[${sectionIndex}] title is invalid`);
      validateBlocks(section.blocks, `${path}.sections[${sectionIndex}].blocks`, renderedAssetFiles);
    });
  }

  function validateEntries(value) {
    if (!Array.isArray(value) || value.length === 0) throw schemaError('Tutorial data must be a non-empty array');
    const slugs = new Set();
    value.forEach((entry, index) => validateEntry(entry, index, slugs));
    return Object.freeze(value.map(entry => Object.freeze(entry)));
  }

  function loadTutorials({ retry = false } = {}) {
    if (state.entries) return Promise.resolve(state.entries);
    if (entriesPromise && !retry) return entriesPromise;
    entriesPromise = fetch('/data/tutorials.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(validateEntries)
      .then(entries => {
        state.entries = entries;
        state.entriesBySlug = new Map(entries.map(entry => [entry.slug, entry]));
        return entries;
      })
      .catch(error => {
        entriesPromise = null;
        throw error;
      });
    return entriesPromise;
  }

  function directoryTitle() {
    const scope = page === 'home' ? root.closest('#tutorials') : root;
    return scope?.querySelector('[data-tutorial-directory-title]') || null;
  }

  function notifyTutorialRender() {
    document.dispatchEvent(new CustomEvent('resource-archive-tutorial-render'));
  }

  function directoryLink(slug) {
    return [...root.querySelectorAll('a[data-tutorial-slug]')].find(link => link.dataset.tutorialSlug === slug) || null;
  }

  function scheduleTutorialPixelSuppression() {
    if (page !== 'home') return;
    if (tutorialPixelSuppressionFrame) cancelAnimationFrame(tutorialPixelSuppressionFrame);
    const pixelField = window.ResourceArchivePixelField;
    if (!state.expanded) {
      tutorialPixelSuppressionFrame = 0;
      pixelField?.setSuppressedRect?.(null, tutorialPixelSuppressionOwner);
      return;
    }
    tutorialPixelSuppressionFrame = requestAnimationFrame(() => {
      tutorialPixelSuppressionFrame = 0;
      const register = root.querySelector('[data-tutorial-directory]');
      const bounds = register?.getBoundingClientRect();
      const rect = bounds && bounds.width > 0 && bounds.height > 0
        ? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
        : null;
      window.ResourceArchivePixelField?.setSuppressedRect?.(rect, tutorialPixelSuppressionOwner);
    });
  }

  function applyDirectoryState() {
    const links = [...root.querySelectorAll('a[data-tutorial-slug]')];
    const disclosure = root.querySelector('[data-tutorial-disclosure]');
    const moreGroup = root.querySelector('[data-tutorial-more]');
    if (!disclosure || !moreGroup) return;
    links.slice(5).forEach(link => { link.hidden = !state.expanded; });
    disclosure.setAttribute('aria-expanded', String(state.expanded));
    disclosure.textContent = state.expanded ? t('tutorials-collapse') : t('tutorials-show-more');
    scheduleTutorialPixelSuppression();
  }

  function tutorialHref(slug) {
    return `/tutorials.html?tutorial=${encodeURIComponent(slug)}`;
  }

  function renderDirectoryList(entries) {
    const list = element('div', { class: 'tutorial-directory-list', role: 'list' });
    if (entries.length > 5) {
      const more = element('div', { id: 'tutorials-more', 'data-tutorial-more': '' });
      entries.forEach((entry, index) => {
        more.append(renderDirectoryLink(entry, index + 1, index >= 5 && !state.expanded));
      });
      list.append(more);
      list.append(element('button', {
        class: 'tutorial-disclosure',
        type: 'button',
        'data-tutorial-disclosure': '',
        'aria-expanded': String(state.expanded),
        'aria-controls': 'tutorials-more',
        text: state.expanded ? t('tutorials-collapse') : t('tutorials-show-more'),
      }));
    } else {
      entries.forEach((entry, index) => list.append(renderDirectoryLink(entry, index + 1)));
    }
    return list;
  }

  function renderHomeDirectory(target, entries) {
    const directory = element('div', {
      class: 'tutorial-home-directory',
      'data-tutorial-directory': '',
    });
    directory.append(renderDirectoryList(entries));
    target.replaceChildren(directory);
    applyDirectoryState();
  }

  function renderDirectory(target, entries) {
    if (page === 'home') return renderHomeDirectory(target, entries);
    const directory = element('section', {
      class: 'tutorial-directory',
      'aria-labelledby': 'tutorial-directory-title',
      'data-tutorial-directory': '',
    });
    const introduction = element('div', { class: 'tutorial-directory-introduction' });
    introduction.append(
      element('p', { class: 'eyebrow', text: t('tutorials-directory-eyebrow') }),
      element('h1', {
        id: 'tutorial-directory-title',
        'data-tutorial-directory-title': '',
        'data-pixel-arrow-target': 'tutorial-directory',
        tabindex: '-1',
        text: t('tutorials-directory-title'),
      }),
      element('p', { class: 'lede', text: t('tutorials-lede') }),
    );

    const register = element('div', { class: 'tutorial-directory-register' });
    register.append(renderDirectoryList(entries));
    directory.append(introduction, register);
    target.replaceChildren(directory);
    applyDirectoryState();
    notifyTutorialRender();
  }

  function renderDirectoryLink(entry, index, hidden = false) {
    const link = element('a', {
      class: 'tutorial-directory-link',
      href: tutorialHref(entry.slug),
      'data-tutorial-slug': entry.slug,
      'data-tutorial-index': String(index).padStart(2, '0'),
      role: 'listitem',
      hidden,
    });
    link.append(element('span', { class: 'tutorial-directory-name', lang: 'zh-CN', text: entry.title }));
    return link;
  }

  // Inline red emphasis for version caveats readers must not skim past.
  const criticalPhrase = '（Blender 5.2 版本不适用见下重点提示。）';

  function fillCopyText(node, text) {
    const index = text.indexOf(criticalPhrase);
    if (index === -1) {
      node.textContent = text;
      return;
    }
    if (index > 0) node.append(document.createTextNode(text.slice(0, index)));
    node.append(element('span', { class: 'tutorial-copy-critical', text: criticalPhrase }));
    if (index + criticalPhrase.length < text.length) {
      node.append(document.createTextNode(text.slice(index + criticalPhrase.length)));
    }
  }

  function renderBlock(block) {
    if (block.type === 'paragraph') {
      const paragraph = element('p', {
        class: 'tutorial-copy-block', 'data-tutorial-block': '', 'data-tutorial-block-type': 'paragraph', lang: 'zh-CN',
      });
      fillCopyText(paragraph, block.text);
      return paragraph;
    }
    if (block.type === 'list') {
      const list = element('ul', { class: 'tutorial-copy-list', 'data-tutorial-block': '', 'data-tutorial-block-type': 'list', lang: 'zh-CN' });
      block.items.forEach((item) => {
        const li = element('li');
        fillCopyText(li, item);
        list.append(li);
      });
      return list;
    }
    if (block.type === 'note' || block.type === 'warning') {
      const callout = element('aside', {
        class: `tutorial-callout tutorial-callout-${block.type}`,
        'data-tutorial-block': '',
        'data-tutorial-block-type': block.type,
        lang: 'zh-CN',
      });
      fillCopyText(callout, block.text);
      return callout;
    }
    const src = `/${block.src.replace(/^\/+/, '')}`;
    const figure = element('figure', { class: 'tutorial-figure', 'data-tutorial-block': '', 'data-tutorial-block-type': 'image' });
    const button = element('button', {
      type: 'button',
      class: 'tutorial-figure-zoom',
      'data-tutorial-image-zoom': '',
      'data-tutorial-image-src': src,
      'aria-label': t('tutorials-image-zoom'),
    });
    // Do not set HTML width/height to the full capture size (often 4k+).
    // That intrinsic size can blow Safari layout before max-width settles.
    const image = element('img', {
      src,
      alt: block.alt,
      loading: 'lazy',
      decoding: 'async',
    });
    if (Number.isFinite(block.width) && block.width > 0
      && Number.isFinite(block.height) && block.height > 0) {
      image.style.aspectRatio = `${block.width} / ${block.height}`;
    }
    button.append(image);
    figure.append(
      button,
      element('figcaption', { lang: 'zh-CN', text: block.caption }),
    );
    return figure;
  }

  function closeTutorialLightbox() {
    document.getElementById('tutorial-image-lightbox')?.remove();
    document.documentElement.classList.remove('tutorial-lightbox-open');
  }

  function openTutorialLightbox(src, alt) {
    closeTutorialLightbox();
    const dialog = element('dialog', {
      id: 'tutorial-image-lightbox',
      class: 'tutorial-image-lightbox',
      'aria-label': t('tutorials-image-zoom'),
    });
    const closeButton = element('button', {
      type: 'button',
      class: 'tutorial-image-lightbox-close',
      'aria-label': t('tutorials-image-zoom-close'),
      text: '×',
    });
    const image = element('img', {
      src,
      alt: alt || '',
      decoding: 'async',
    });
    dialog.append(closeButton, image);
    document.body.append(dialog);
    document.documentElement.classList.add('tutorial-lightbox-open');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      closeTutorialLightbox();
    };
    dialog.addEventListener('close', onClose);
    closeButton.addEventListener('click', () => {
      if (typeof dialog.close === 'function') dialog.close();
      else onClose();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else onClose();
      }
    });
  }

  function renderDetail(target, entry) {
    const article = element('article', {
      class: `tutorial-detail tutorial-detail-${entry.type}`,
      'data-tutorial-detail': '',
      'data-tutorial-slug': entry.slug,
    });
    article.append(
      element('a', {
        class: 'back-link tutorial-back-link',
        // Prefer the home archive section over the standalone tutorials page.
        href: '/index.html#tutorials',
        'data-tutorial-back': '',
        'data-internal-view-history-back': '',
        'data-internal-view-fallback-replace': '',
        text: t('tutorials-back'),
      }),
      element('p', { class: 'tutorial-hierarchy', text: t('tutorials-hierarchy') }),
      element('h1', { 'data-tutorial-source-title': '', lang: 'zh-CN', text: entry.title }),
    );

    if (entry.type === 'long-image') {
      const figure = element('figure', { class: 'tutorial-long-image' });
      const image = element('img', {
        src: `/${entry.asset.src.replace(/^\/+/, '')}`,
        alt: entry.asset.alt,
        width: entry.asset.width,
        height: entry.asset.height,
        loading: 'eager',
        decoding: 'async',
      });
      // Keep intrinsic ratio even if UA presentational hints fight CSS width:100%.
      image.style.width = '100%';
      image.style.height = 'auto';
      image.style.aspectRatio = `${entry.asset.width} / ${entry.asset.height}`;
      figure.append(image);
      article.append(figure);
    } else {
      const intro = element('div', { class: 'tutorial-intro', 'data-tutorial-intro': '' });
      entry.intro.forEach(block => intro.append(renderBlock(block)));
      article.append(intro);
      entry.sections.forEach((section, index) => {
        const sectionId = `tutorial-${entry.slug}-section-${index + 1}`;
        const sectionElement = element('section', { class: 'tutorial-section', 'data-tutorial-section': '', 'aria-labelledby': sectionId });
        sectionElement.append(element('h2', { id: sectionId, lang: 'zh-CN', text: section.title }));
        section.blocks.forEach(block => sectionElement.append(renderBlock(block)));
        article.append(sectionElement);
      });
    }
    target.replaceChildren(article);
  }

  function renderState(target, { kind, error } = {}) {
    const isMissing = kind === 'missing';
    const heading = isMissing ? t('tutorials-invalid-title') : t('tutorials-data-error-title');
    const copy = isMissing ? t('tutorials-invalid-copy') : `${t('tutorials-data-error-copy')} ${error?.message || ''}`.trim();
    const stateElement = element('section', { class: 'tutorial-state', 'aria-live': 'polite' });
    stateElement.append(
      element('p', { class: 'status-label', text: isMissing ? t('tutorials-invalid') : t('tutorials-data-error') }),
      element('h1', { text: heading }),
      element('p', { text: copy }),
    );
    if (!isMissing) stateElement.append(element('button', { type: 'button', 'data-tutorial-retry': '', text: t('tutorials-retry') }));
    target.replaceChildren(stateElement);
  }

  function renderLoading(target) {
    target.replaceChildren(element('p', {
      class: 'tutorial-loading', role: 'status', text: t('tutorials-loading'),
    }));
  }

  function parseUrl(url) {
    const keys = [...url.searchParams.keys()];
    if (keys.length === 0) return { kind: 'index' };
    if (keys.length !== 1 || keys[0] !== 'tutorial') return { kind: 'missing' };
    const slug = url.searchParams.get('tutorial');
    return state.entriesBySlug?.has(slug) ? { kind: 'detail', slug } : { kind: 'missing' };
  }

  function canHandle(url) {
    if (url.origin !== window.location.origin || url.pathname !== '/tutorials.html') return false;
    const keys = [...url.searchParams.keys()];
    return keys.length === 0 || (keys.length === 1 && keys[0] === 'tutorial');
  }

  function capture() {
    const pendingMouseTrigger = pendingMouseTriggerSlug;
    pendingMouseTriggerSlug = null;
    const active = document.activeElement;
    const trigger = active instanceof Element ? active.closest('a[data-tutorial-slug]') : null;
    return {
      scrollY: window.scrollY,
      triggerSlug: pendingMouseTrigger || trigger?.dataset.tutorialSlug || state.triggerSlug,
      expanded: state.expanded,
    };
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function restore(snapshot, context = {}) {
    if (!snapshot || !current(context)) return;
    state.expanded = snapshot.expanded === true;
    state.triggerSlug = snapshot.triggerSlug || null;
    applyDirectoryState();
    await nextFrame();
    await nextFrame();
    if (!current(context)) return;
    window.scrollTo({ top: Number.isFinite(snapshot.scrollY) ? snapshot.scrollY : 0, left: 0, behavior: 'instant' });
    const target = directoryLink(state.triggerSlug) || directoryTitle();
    target?.focus?.({ preventScroll: true });
  }

  function focusTarget(route) {
    if (route.kind === 'detail') return root.querySelector('[data-tutorial-back]');
    return directoryLink(state.triggerSlug) || directoryTitle();
  }

  function renderInto(route, target) {
    if (route.kind === 'index') return renderDirectory(target, state.entries);
    if (route.kind === 'detail') return renderDetail(target, state.entriesBySlug.get(route.slug));
    return renderState(target, { kind: 'missing' });
  }

  async function renderRoute(route, context) {
    try {
      await loadTutorials();
      if (!current(context)) return;
      context.commit(target => renderInto(route, target));
    } catch (error) {
      if (!current(context)) return;
      context.commit(target => renderState(target, { kind: 'error', error }));
    }
  }

  function initializeRouter() {
    if (state.router || !routerApi) return Promise.resolve(state.router);
    persistIncomingHomeTutorialOrigin();
    state.router = routerApi.create({
      root,
      parseUrl,
      render: renderRoute,
      capture,
      restore,
      canHandle,
      focusTarget,
      // Long-image details can be 30k–50k px tall. View-transition capture of that
      // document freezes "返回教程目录" for 1–2s+ and feels like a dead click.
      transitionMode(route, { fromUrl }) {
        const from = parseUrl(new URL(fromUrl, window.location.origin));
        return route.kind === 'detail' || from.kind === 'detail' ? 'none' : undefined;
      },
    });
    return state.router.syncFromLocation({ initial: true });
  }

  function redrawForLanguage() {
    pendingMouseTriggerSlug = null;
    const active = document.activeElement;
    const activeSlug = active instanceof Element ? active.closest('a[data-tutorial-slug]')?.dataset.tutorialSlug : null;
    const wasBack = active instanceof Element && active.matches('[data-tutorial-back]');
    const scrollY = window.scrollY;
    if (!state.entries) {
      renderLoading(root);
      loadTutorials().then(() => redrawForLanguage()).catch(error => renderState(root, { kind: 'error', error }));
      return;
    }
    renderInto(parseUrl(new URL(window.location.href)), root);
    window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
    if (wasBack) root.querySelector('[data-tutorial-back]')?.focus({ preventScroll: true });
    else if (activeSlug) directoryLink(activeSlug)?.focus({ preventScroll: true });
  }

  function onRootClick(event) {
    rememberHomeTutorialOrigin(event);
    const target = event.target instanceof Element ? event.target : null;
    const back = target?.closest('[data-tutorial-back]');
    const homeOrigin = homeTutorialOrigin();
    if (back && homeOrigin && history.length > 1) {
      event.preventDefault();
      rememberHomeTutorialReturn(homeOrigin.snapshot);
      history.back();
      return;
    }
    const disclosure = target?.closest('[data-tutorial-disclosure]');
    if (disclosure) {
      if (state.expanded) disclosure.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      state.expanded = !state.expanded;
      applyDirectoryState();
      return;
    }
    const zoom = target?.closest('[data-tutorial-image-zoom]');
    if (zoom && root.contains(zoom)) {
      event.preventDefault();
      const src = zoom.getAttribute('data-tutorial-image-src');
      const img = zoom.querySelector('img');
      if (src) openTutorialLightbox(src, img?.getAttribute('alt') || '');
      return;
    }
    const retry = target?.closest('[data-tutorial-retry]');
    if (!retry) return;
    event.preventDefault();
    renderLoading(root);
    loadTutorials({ retry: true }).then(() => {
      if (page === 'tutorials' && routerApi && !state.router) return initializeRouter();
      const route = parseUrl(new URL(window.location.href));
      renderInto(route, root);
    }).catch(error => renderState(root, { kind: 'error', error }));
  }

  function onRootCaptureClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.detail === 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[data-tutorial-slug]');
    if (!link || !root.contains(link)) return;
    pendingMouseTriggerSlug = link.dataset.tutorialSlug || null;
  }

  function onImageError(event) {
    const image = event.target instanceof HTMLImageElement ? event.target : null;
    if (!image || !root.contains(image)) return;
    const figure = image.closest('figure');
    if (!figure || figure.querySelector('[data-tutorial-image-error]')) return;
    figure.prepend(element('p', { role: 'status', 'data-tutorial-image-error': '', text: t('tutorials-image-error') }));
    image.hidden = true;
    image.style.display = 'none';
  }

  root.addEventListener('click', onRootCaptureClick, true);
  root.addEventListener('click', onRootClick);
  root.addEventListener('error', onImageError, true);
  document.addEventListener('resource-archive-language-change', redrawForLanguage);
  document.addEventListener('resource-archive-pixel-field-ready', scheduleTutorialPixelSuppression);
  window.addEventListener('resize', scheduleTutorialPixelSuppression, { passive: true });
  window.addEventListener('pagehide', rememberHomeTutorialReturnOnPageHide);
  window.addEventListener('pageshow', restoreHomeTutorialReturn);

  window.ResourceArchiveTutorials = Object.freeze({
    load: loadTutorials,
    renderDirectory(target, entries = state.entries) {
      if (!entries) throw new Error('Tutorial entries must be loaded before rendering');
      renderDirectory(target, entries);
    },
  });

  if (page === 'home') {
    restoreHomeTutorialReturn();
    renderLoading(root);
    loadTutorials().then(entries => {
      renderDirectory(root, entries);
      applyPendingHomeReturn();
    }).catch(error => renderState(root, { kind: 'error', error }));
    return;
  }

  if (!routerApi) {
    renderLoading(root);
    loadTutorials().then(() => renderInto(parseUrl(new URL(window.location.href)), root)).catch(error => renderState(root, { kind: 'error', error }));
    return;
  }

  renderLoading(root);
  loadTutorials().then(initializeRouter).catch(error => renderState(root, { kind: 'error', error }));
})();
