(() => {
  const app = document.querySelector('#video-app');
  const routerApi = window.ResourceArchiveInternalViewRouter;
  if (!app || !window.ResourceArchiveVideos) return;

  const stateKey = '__resourceArchiveVideosState';
  app[stateKey]?.dispose?.();

  const origins = new Map([
    ['home-videos', '/index.html#videos'],
    ['video-index', '/videos.html'],
  ]);
  const snapshotVersion = 1;
  const state = {
    disposed: false,
    videos: null,
    error: null,
    router: null,
    pendingFocusedVideoId: null,
  };
  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  app[stateKey] = state;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function parseRoute(url) {
    const videoId = url.searchParams.get('video');
    const origin = url.searchParams.get('origin');
    return {
      videoId: videoId || null,
      origin: origins.has(origin) ? origin : null,
    };
  }

  function routeUrl(videoId, origin) {
    const url = new URL('/videos.html', location.origin);
    if (videoId) url.searchParams.set('video', videoId);
    if (origin && origins.has(origin)) url.searchParams.set('origin', origin);
    return `${url.pathname}${url.search}`;
  }

  function videoSnapshot(route = parseRoute(new URL(location.href)), pendingFocusedVideoId = null) {
    const active = document.activeElement instanceof Element ? document.activeElement : null;
    const focusedVideoId = active?.closest('[data-video-card]')?.dataset.videoCard || pendingFocusedVideoId;
    return {
      version: snapshotVersion,
      owner: 'video',
      x: scrollX,
      y: scrollY,
      pathname: location.pathname,
      view: route.videoId ? 'detail' : 'index',
      origin: route.origin,
      videoId: route.videoId,
      focusedVideoId,
    };
  }

  function matchingVideoSnapshot(snapshot, route = parseRoute(new URL(location.href))) {
    return snapshot && typeof snapshot === 'object'
      && snapshot.version === snapshotVersion
      && snapshot.owner === 'video'
      && Number.isFinite(snapshot.x)
      && Number.isFinite(snapshot.y)
      && snapshot.pathname === location.pathname
      && snapshot.view === (route.videoId ? 'detail' : 'index')
      && snapshot.origin === route.origin
      && snapshot.videoId === route.videoId;
  }

  function clearVideoTransition() {
    app.querySelectorAll('[data-transition-video]').forEach(media => {
      media.removeAttribute('data-transition-video');
      media.style.removeProperty('view-transition-name');
    });
  }

  function selectVideoTransition(event) {
    const primaryPointer = event.type === 'pointerdown'
      && event.button === 0 && (event.isPrimary !== false || !event.pointerType)
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (event.type === 'pointerdown' && !primaryPointer) {
      clearVideoTransition();
      return;
    }
    const link = event.target instanceof Element ? event.target.closest('.video-archive-link') : null;
    if (!link || !app.contains(link)) {
      if (event.type !== 'focusin' || app.querySelector('[data-video-card]')) clearVideoTransition();
      return;
    }
    clearVideoTransition();
    const media = link.querySelector('.video-media');
    if (!media) return;
    media.dataset.transitionVideo = '';
    media.style.setProperty('view-transition-name', 'video-media');
  }

  function poster(video) {
    const image = window.ResourceArchiveVideos.poster(video);
    image.dataset.videoPosterId = video.id;
    image.loading = 'lazy';
    return image;
  }

  function hydrate(root) {
    root.querySelectorAll('img[data-video-poster-id]').forEach(image => {
      const video = state.videos?.find(record => record.id === image.dataset.videoPosterId);
      if (!video) return;
      const replacement = poster(video);
      replacement.className = image.className;
      image.replaceWith(replacement);
    });
    window.ResourceArchiveStageMediaMotion?.enhance(root, {
      mediaSelector: '.video-media',
      railSelector: '.video-archive-grid',
      ctaKey: 'videos-media-cta',
    });
    window.ResourceArchivePixelField?.refreshTargets();
  }

  function videoCard(video, origin) {
    const article = element('article', 'video-archive-item');
    article.dataset.videoCard = video.id;
    const link = element('a', 'video-archive-link');
    link.href = routeUrl(video.id, origin === 'home-videos' ? origin : 'video-index');
    link.setAttribute('aria-label', translate('videos-view-details', { title: video.title }));
    const media = element('div', 'stage-media video-media');
    media.dataset.videoMedia = video.id;
    media.dataset.localImage = window.ResourceArchiveVideos.localPosterPath(video);
    media.append(poster(video));
    const metadata = element('div', 'video-meta-row');
    metadata.append(
      element('span', null, video.date),
      element('span', null, video.duration),
    );
    metadata.querySelectorAll('span')[0].dataset.videoDate = '';
    metadata.querySelectorAll('span')[1].dataset.videoDuration = '';
    link.append(media, metadata, element('h2', null, video.title));
    article.append(link);
    return article;
  }

  function renderIndex(target, videos, route) {
    if (route.origin === 'home-videos') {
      const back = element('a', 'back-link', translate('videos-back-home'));
      back.href = origins.get(route.origin);
      target.append(back);
    }
    const header = element('header', 'video-index-header explorer-header');
    const eyebrow = element('p', 'eyebrow', translate('videos-eyebrow'));
    const title = element('h1', null, translate('videos-title'));
    title.tabIndex = -1;
    const total = element('strong', 'video-total', String(videos.length));
    total.dataset.testid = 'video-total';
    header.append(eyebrow, title, total);
    const list = element('section', 'video-archive-grid');
    list.setAttribute('aria-label', translate('videos-index-aria'));
    list.append(...videos.map(video => videoCard(video, route.origin)));
    target.append(header, list);
  }

  function metadataItem(label, value, dataName) {
    const item = document.createElement('div');
    const term = element('dt', null, label);
    const description = element('dd', null, value);
    if (dataName) description.dataset[dataName] = '';
    item.append(term, description);
    return item;
  }

  function downloadLabelKey(variant) {
    if (variant === 'outer') return 'videos-download-outer';
    if (variant === 'inner') return 'videos-download-inner';
    return 'videos-download-default';
  }

  function downloadAction(download) {
    let url;
    try {
      url = new URL(download.url);
      url.searchParams.set('pwd', download.extraction_code);
    } catch {
      return null;
    }
    const action = element('a', 'button-secondary', translate(downloadLabelKey(download.variant)));
    action.dataset.pixelFlicker = '';
    action.dataset.videoDownload = '';
    action.dataset.videoDownloadFilename = download.filename;
    action.dataset.videoDownloadVariant = download.variant;
    action.href = url.toString();
    action.target = '_blank';
    action.rel = 'noopener noreferrer';
    action.setAttribute('aria-label', translate('videos-download-aria', { filename: download.filename }));
    return action;
  }

  function renderDetail(target, video, route) {
    const detail = element('article', 'record-detail video-detail');
    detail.dataset.testid = 'video-detail';
    detail.tabIndex = -1;
    const back = element('a', 'back-link', translate('videos-back-all'));
    back.dataset.videoDetailBack = '';
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    back.href = origins.get(route.origin) || '/videos.html';
    const media = element('div', 'video-media');
    media.dataset.transitionVideo = '';
    media.style.setProperty('view-transition-name', 'video-media');
    const player = document.createElement('iframe');
    player.loading = 'lazy';
    player.title = translate('videos-detail-iframe-title', { title: video.title });
    player.src = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(video.id)}&page=1&high_quality=1&danmaku=0&autoplay=0`;
    player.setAttribute('allowfullscreen', '');
    media.append(player);
    const metadata = element('dl', 'video-detail-metadata');
    metadata.dataset.videoMetadata = '';
    metadata.append(
      metadataItem(translate('videos-detail-video-id'), video.id, 'videoId'),
      metadataItem(translate('videos-detail-source-number'), String(video.source_number), 'videoSourceNumber'),
      metadataItem(translate('videos-detail-date'), video.date, 'videoDate'),
      metadataItem(translate('videos-detail-duration'), video.duration, 'videoDuration'),
    );
    const source = element('a', 'button-secondary', translate('videos-detail-source-link'));
    source.dataset.pixelFlicker = '';
    source.dataset.videoSourceLink = '';
    source.href = video.source_url;
    detail.append(back, element('p', 'eyebrow', translate('videos-detail-eyebrow', { sourceNumber: video.source_number })), element('h1', null, video.title), media, metadata);
    const actions = element('div', 'detail-actions');
    actions.append(source, ...video.downloads.map(downloadAction).filter(Boolean));
    detail.append(actions);
    target.append(detail);
  }

  function renderInvalid(target, videoId, route) {
    const errorState = element('section', 'error-state');
    errorState.dataset.videoInvalid = '';
    const back = element('a', 'back-link', translate('videos-back-all'));
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    back.href = origins.get(route.origin) || '/videos.html';
    errorState.append(
      element('p', 'status-label', translate('videos-error-status')),
      element('h1', null, translate('videos-unknown-heading', { videoId })),
      back,
    );
    target.append(errorState);
  }

  function renderLoadError(target) {
    const errorState = element('section', 'error-state');
    errorState.dataset.videoLoadError = '';
    const retry = element('button', 'button-secondary', translate('videos-retry'));
    retry.dataset.videoRetry = '';
    retry.type = 'button';
    errorState.append(
      element('p', 'status-label', translate('videos-error-status')),
      element('h1', null, translate('videos-error-heading')),
      element('p', null, translate('videos-error-message')),
      retry,
    );
    target.append(errorState);
  }

  function renderInto(route, target) {
    if (state.error) {
      renderLoadError(target);
      return;
    }
    const video = route.videoId && state.videos.find(record => record.id === route.videoId);
    if (!route.videoId) renderIndex(target, state.videos, route);
    else if (!video) renderInvalid(target, route.videoId, route);
    else renderDetail(target, video, route);
  }

  function capture() {
    const pendingFocusedVideoId = state.pendingFocusedVideoId;
    state.pendingFocusedVideoId = null;
    return videoSnapshot(undefined, pendingFocusedVideoId);
  }

  async function restore(snapshot, { signal, isCurrent } = {}) {
    const current = () => !signal?.aborted && isCurrent?.() !== false;
    if (!matchingVideoSnapshot(snapshot) || !current()) return;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!current()) return;
    scrollTo({ left: snapshot.x, top: snapshot.y, behavior: 'instant' });
    if (!snapshot.focusedVideoId) return;
    const card = app.querySelector(`[data-video-card="${CSS.escape(snapshot.focusedVideoId)}"]`);
    card?.querySelector('.video-archive-link')?.focus({ preventScroll: true });
  }

  function renderRoute(route, context) {
    renderInto(route, context.target);
    context.afterCommit(hydrate);
  }

  function renderStaticRoute() {
    const target = document.createDocumentFragment();
    renderInto(parseRoute(new URL(location.href)), target);
    app.replaceChildren(target);
    hydrate(app);
  }

  function patchIndexForLanguageChange(route) {
    const header = app.querySelector('.video-index-header');
    if (!header) return;
    const back = app.querySelector('.back-link');
    if (route.origin === 'home-videos' && back) back.textContent = translate('videos-back-home');
    const eyebrow = header.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = translate('videos-eyebrow');
    const title = header.querySelector('h1');
    if (title) title.textContent = translate('videos-title');
    const list = app.querySelector('.video-archive-grid');
    if (list) list.setAttribute('aria-label', translate('videos-index-aria'));
    state.videos?.forEach(video => {
      const link = app.querySelector(`[data-video-card="${CSS.escape(video.id)}"] .video-archive-link`);
      link?.setAttribute('aria-label', translate('videos-view-details', { title: video.title }));
    });
    window.ResourceArchiveVideos.refreshPosterFallbacks(app);
  }

  function patchDetailForLanguageChange(video) {
    const detail = app.querySelector('[data-testid="video-detail"]');
    if (!detail) return;
    const back = detail.querySelector('[data-video-detail-back]');
    if (back) back.textContent = translate('videos-back-all');
    const eyebrow = detail.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = translate('videos-detail-eyebrow', { sourceNumber: video.source_number });
    const labels = [
      'videos-detail-video-id',
      'videos-detail-source-number',
      'videos-detail-date',
      'videos-detail-duration',
    ];
    detail.querySelectorAll('[data-video-metadata] dt').forEach((term, index) => {
      if (labels[index]) term.textContent = translate(labels[index]);
    });
    const player = detail.querySelector('iframe');
    if (player) player.title = translate('videos-detail-iframe-title', { title: video.title });
    const source = detail.querySelector('[data-video-source-link]');
    if (source) source.textContent = translate('videos-detail-source-link');
    detail.querySelectorAll('[data-video-download]').forEach(action => {
      const filename = action.dataset.videoDownloadFilename || '';
      const variant = action.dataset.videoDownloadVariant || 'default';
      action.textContent = translate(downloadLabelKey(variant));
      action.setAttribute('aria-label', translate('videos-download-aria', { filename }));
    });
  }

  function patchInvalidForLanguageChange(videoId) {
    const invalid = app.querySelector('[data-video-invalid]');
    if (!invalid) return;
    const status = invalid.querySelector('.status-label');
    if (status) status.textContent = translate('videos-error-status');
    const heading = invalid.querySelector('h1');
    if (heading) heading.textContent = translate('videos-unknown-heading', { videoId });
    const back = invalid.querySelector('.back-link');
    if (back) back.textContent = translate('videos-back-all');
  }

  function patchLoadErrorForLanguageChange() {
    const error = app.querySelector('[data-video-load-error]');
    if (!error) return;
    const status = error.querySelector('.status-label');
    if (status) status.textContent = translate('videos-error-status');
    const heading = error.querySelector('h1');
    if (heading) heading.textContent = translate('videos-error-heading');
    const message = error.querySelector('p:not(.status-label)');
    if (message) message.textContent = translate('videos-error-message');
    const retry = error.querySelector('[data-video-retry]');
    if (retry) retry.textContent = translate('videos-retry');
  }

  function patchCurrentViewForLanguageChange() {
    if (state.disposed || (!state.videos && !state.error)) return;
    if (state.error) {
      patchLoadErrorForLanguageChange();
      return;
    }
    const route = parseRoute(new URL(location.href));
    const video = route.videoId && state.videos.find(record => record.id === route.videoId);
    if (!route.videoId) patchIndexForLanguageChange(route);
    else if (!video) patchInvalidForLanguageChange(route.videoId);
    else patchDetailForLanguageChange(video);
  }

  function setupRouter() {
    if (!routerApi) {
      renderStaticRoute();
      return;
    }
    state.router = routerApi.create({
      root: app,
      parseUrl: parseRoute,
      render: renderRoute,
      capture,
      restore,
      canHandle: url => url.pathname === location.pathname && url.pathname === '/videos.html',
      focusTarget: route => route.videoId
        ? app.querySelector('[data-testid="video-detail"]')
        : app.querySelector('.video-index-header h1'),
    });
    state.router.syncFromLocation({ initial: true }).catch(error => {
      state.error = error;
      renderStaticRoute();
    });
  }

  function captureVideoTrigger(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('.video-archive-link') : null;
    if (!link || !app.contains(link)) return;
    state.pendingFocusedVideoId = link.closest('[data-video-card]')?.dataset.videoCard || null;
  }

  function onShellClick(event) {
    const retry = event.target instanceof Element ? event.target.closest('[data-video-retry]') : null;
    if (retry && app.contains(retry)) location.reload();
  }

  app.addEventListener('pointerdown', selectVideoTransition);
  app.addEventListener('focusin', selectVideoTransition);
  app.addEventListener('pointercancel', clearVideoTransition);
  app.addEventListener('click', captureVideoTrigger, true);
  app.addEventListener('click', onShellClick);
  document.addEventListener('resource-archive-language-change', patchCurrentViewForLanguageChange);
  addEventListener('pagehide', clearVideoTransition);
  state.dispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    state.router?.destroy();
    app.removeEventListener('pointerdown', selectVideoTransition);
    app.removeEventListener('focusin', selectVideoTransition);
    app.removeEventListener('pointercancel', clearVideoTransition);
    app.removeEventListener('click', captureVideoTrigger, true);
    app.removeEventListener('click', onShellClick);
    document.removeEventListener('resource-archive-language-change', patchCurrentViewForLanguageChange);
    removeEventListener('pagehide', clearVideoTransition);
  };

  window.ResourceArchiveVideos.load().then(videos => {
    if (state.disposed) return;
    state.videos = videos;
    setupRouter();
  }).catch(error => {
    if (state.disposed) return;
    state.error = error;
    renderStaticRoute();
  });
})();
