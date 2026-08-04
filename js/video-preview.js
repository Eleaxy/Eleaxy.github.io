(() => {
  const app = document.querySelector('#video-preview-app');
  if (!app || !window.ResourceArchiveVideos || !window.StageRail) return;

  const stateKey = '__resourceArchiveVideoPreviewState';
  app[stateKey]?.dispose?.();

  const state = {
    disposed: false,
    videos: null,
    error: null,
    languageListener: null,
    pagehideListener: null,
  };
  app[stateKey] = state;

  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function clearVideoTransition() {
    app.querySelectorAll('[data-transition-video]').forEach(media => {
      media.removeAttribute('data-transition-video');
      media.style.removeProperty('view-transition-name');
    });
  }

  function prepareVideoTransition(event) {
    const primaryPointer = event.type === 'pointerdown'
      && event.button === 0 && (event.isPrimary !== false || !event.pointerType)
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const primaryKey = event.type === 'keydown' && event.key === 'Enter'
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if ((event.type === 'pointerdown' || event.type === 'keydown') && !primaryPointer && !primaryKey) {
      clearVideoTransition();
      return;
    }
    const link = event.target.closest?.('.video-preview-link');
    if (!link || !app.contains(link)) return clearVideoTransition();
    clearVideoTransition();
    const media = link.querySelector('.video-media');
    if (!media) return;
    media.dataset.transitionVideo = '';
    media.style.setProperty('view-transition-name', 'video-media');
  }

  function preview(video) {
    const item = element('article', 'video-preview-item');
    item.dataset.videoPreview = video.id;
    const link = element('a', 'video-preview-link');
    link.href = `/videos.html?video=${encodeURIComponent(video.id)}&origin=home-videos`;
    const media = element('div', 'stage-media video-media');
    media.dataset.videoMedia = video.id;
    media.dataset.localImage = window.ResourceArchiveVideos.localPosterPath(video);
    const image = window.ResourceArchiveVideos.poster(video);
    image.loading = 'lazy';
    media.append(image);
    link.append(
      media,
      element('p', 'source-kind', video.date),
      element('p', 'video-duration', video.duration),
      element('h3', null, video.title),
    );
    item.append(link);
    return item;
  }

  function destroyCurrentRail() {
    app.__videoPreviewRail?.destroy();
    app.__videoPreviewRail = null;
  }

  function renderPreviews(videos) {
    destroyCurrentRail();
    const rail = element('div', 'stage-rail video-rail');
    rail.dataset.videoRail = '';
    rail.setAttribute('aria-label', translate('videos-preview-aria'));
    const track = element('div', 'stage-track');
    track.dataset.stageTrack = '';
    track.append(...videos.map(preview));
    rail.append(track);
    const archive = element('a', 'button-secondary');
    archive.dataset.pixelFlicker = '';
    archive.href = '/videos.html?origin=home-videos';
    archive.append(element('span', 'pixel-button-label', translate('videos-view-all', { count: videos.length })));
    app.replaceChildren(rail, archive);
    app.__videoPreviewRail = new window.StageRail(rail, {
      previousKey: 'videos-rail-previous',
      previousFallback: 'Previous video',
      nextKey: 'videos-rail-next',
      nextFallback: 'Next video',
      mediaSelector: '.video-media',
    });
    window.ResourceArchiveStageMediaMotion?.enhance(rail, {
      mediaSelector: '.video-media',
      railSelector: '[data-video-rail]',
      ctaKey: 'videos-media-cta',
    });
  }

  function renderError() {
    destroyCurrentRail();
    const message = element('p', 'error-state', translate('videos-preview-error'));
    message.dataset.videoPreviewError = '';
    const retry = element('button', 'button-secondary');
    retry.dataset.videoPreviewRetry = '';
    retry.dataset.pixelFlicker = '';
    retry.type = 'button';
    retry.append(element('span', 'pixel-button-label', translate('videos-retry')));
    retry.addEventListener('click', () => location.reload());
    app.replaceChildren(message, retry);
  }

  function patchPreviewsForLanguageChange() {
    if (state.disposed) return;
    if (state.videos) {
      const rail = app.querySelector('[data-video-rail]');
      if (rail) rail.setAttribute('aria-label', translate('videos-preview-aria'));
      const archive = app.querySelector('.button-secondary .pixel-button-label');
      if (archive) archive.textContent = translate('videos-view-all', { count: state.videos.length });
      state.videos.forEach(video => {
        const link = app.querySelector(`[data-video-preview="${CSS.escape(video.id)}"] .video-preview-link`);
        link?.setAttribute('aria-label', translate('videos-view-details', { title: video.title }));
      });
      window.ResourceArchiveVideos.refreshPosterFallbacks(app);
      return;
    }
    const message = app.querySelector('[data-video-preview-error]');
    if (message) message.textContent = translate('videos-preview-error');
    const retry = app.querySelector('[data-video-preview-retry] .pixel-button-label');
    if (retry) retry.textContent = translate('videos-retry');
  }

  state.languageListener = patchPreviewsForLanguageChange;
  document.addEventListener('resource-archive-language-change', state.languageListener);
  app.addEventListener('pointerdown', prepareVideoTransition);
  app.addEventListener('keydown', prepareVideoTransition);
  app.addEventListener('focusin', prepareVideoTransition);
  app.addEventListener('pointercancel', clearVideoTransition);
  state.pagehideListener = clearVideoTransition;
  addEventListener('pagehide', state.pagehideListener);
  state.dispose = () => {
    state.disposed = true;
    document.removeEventListener('resource-archive-language-change', state.languageListener);
    app.removeEventListener('pointerdown', prepareVideoTransition);
    app.removeEventListener('keydown', prepareVideoTransition);
    app.removeEventListener('focusin', prepareVideoTransition);
    app.removeEventListener('pointercancel', clearVideoTransition);
    removeEventListener('pagehide', state.pagehideListener);
    clearVideoTransition();
    destroyCurrentRail();
  };

  window.ResourceArchiveVideos.load().then(videos => {
    if (state.disposed) return;
    state.videos = videos;
    state.error = null;
    renderPreviews(state.videos);
  }).catch(error => {
    if (state.disposed) return;
    state.error = error;
    renderError();
  });
})();
