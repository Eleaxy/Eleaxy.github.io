(() => {
  const app = document.querySelector('#stage-preview-app');
  if (!app || !window.ResourceArchiveStages) return;

  const stateKey = '__resourceArchiveStagePreviewState';
  app[stateKey]?.dispose?.();

  const state = {
    disposed: false,
    stages: null,
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

  function clearStageTransition() {
    document.querySelectorAll('[data-transition-stage]').forEach(node => {
      node.removeAttribute('data-transition-stage');
      node.style.removeProperty('view-transition-name');
    });
  }

  function prepareStageTransition(event) {
    const primaryPointer = event.type === 'pointerdown'
      && event.button === 0 && (event.isPrimary !== false || !event.pointerType)
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const primaryKey = event.type === 'keydown' && event.key === 'Enter'
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if ((event.type === 'pointerdown' || event.type === 'keydown') && !primaryPointer && !primaryKey) {
      clearStageTransition();
      return;
    }
    const link = event.target.closest?.('.stage-preview-link, .stage-archive-link');
    if (!link || !app.contains(link)) return clearStageTransition();
    clearStageTransition();
    const media = link.querySelector('.stage-media');
    if (!media) return;
    media.dataset.transitionStage = '';
    media.style.setProperty('view-transition-name', 'stage-media');
  }

  function preview(stage) {
    const item = element('article', 'stage-preview-item');
    item.dataset.stagePreview = stage.id;
    const link = element('a', 'stage-preview-link');
    link.href = `/stages.html?stage=${encodeURIComponent(stage.id)}&origin=home-stages`;
    const media = element('div', 'stage-media');
    media.dataset.stageMedia = stage.id;
    media.dataset.localImage = stage.image.local;
    const image = window.ResourceArchiveStages.image(stage);
    image.loading = 'lazy';
    media.append(image);
    link.append(media, element('p', 'source-kind', stage.date), element('h3', null, stage.title));
    item.append(link);
    return item;
  }

  function destroyCurrentRail() {
    app.__stagePreviewRail?.destroy();
    app.__stagePreviewRail = null;
  }

  function renderPreviews(stages) {
    destroyCurrentRail();
    const rail = element('div', 'stage-rail');
    rail.dataset.stageRail = '';
    rail.setAttribute('aria-label', translate('stages-preview-aria'));
    const track = element('div', 'stage-track');
    track.dataset.stageTrack = '';
    track.append(...stages.map(preview));
    rail.append(track);
    const archive = element('a', 'button-secondary');
    archive.dataset.pixelFlicker = '';
    archive.href = '/stages.html?origin=home-stages';
    archive.append(element('span', 'pixel-button-label', translate('stages-view-all', { count: stages.length })));
    app.replaceChildren(rail, archive);
    app.__stagePreviewRail = new window.StageRail(rail);
    window.ResourceArchiveStageMediaMotion?.enhance(rail);
  }

  function renderError(error) {
    destroyCurrentRail();
    const retry = element('button', 'button-secondary');
    retry.dataset.pixelFlicker = '';
    retry.type = 'button';
    retry.append(element('span', 'pixel-button-label', translate('stages-retry')));
    retry.addEventListener('click', () => location.reload());
    app.replaceChildren(element('p', 'error-state', translate('stages-preview-error', { message: error.message })), retry);
  }

  function render() {
    if (state.disposed) return;
    if (state.stages) renderPreviews(state.stages);
    else if (state.error) renderError(state.error);
  }

  state.languageListener = render;
  document.addEventListener('resource-archive-language-change', state.languageListener);
  app.addEventListener('pointerdown', prepareStageTransition);
  app.addEventListener('keydown', prepareStageTransition);
  app.addEventListener('focusin', prepareStageTransition);
  app.addEventListener('pointercancel', clearStageTransition);
  state.pagehideListener = clearStageTransition;
  addEventListener('pagehide', state.pagehideListener);
  state.dispose = () => {
    state.disposed = true;
    document.removeEventListener('resource-archive-language-change', state.languageListener);
    app.removeEventListener('pointerdown', prepareStageTransition);
    app.removeEventListener('keydown', prepareStageTransition);
    app.removeEventListener('focusin', prepareStageTransition);
    app.removeEventListener('pointercancel', clearStageTransition);
    removeEventListener('pagehide', state.pagehideListener);
    destroyCurrentRail();
  };

  window.ResourceArchiveStages.load().then(stages => {
    if (state.disposed) return;
    state.stages = stages;
    state.error = null;
    render();
  }).catch(error => {
    if (state.disposed) return;
    state.error = error;
    render();
  });
})();
