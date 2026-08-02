(() => {
  const root = document.documentElement;
  const page = document.body.dataset.page || 'home';
  const sectionFromLocation = () => {
    if (page !== 'home') return page;
    const hash = location.hash.slice(1);
    return ['nodes', 'stages', 'tutorials', 'plugins-section', 'contributors'].includes(hash) ? hash : 'home';
  };

  function updateCurrentSection() {
    const section = sectionFromLocation();
    root.dataset.currentSection = section;
    document.querySelectorAll('.primary-nav a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const target = href.match(/\/(nodes|stages|tutorials|plugins|contributors)\.html/)?.[1]
        || href.match(/#(home|nodes|stages|tutorials|plugins-section|contributors)$/)?.[1]
        || 'home';
      if (target === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  [
    ['.site-header', 'site-header'],
    ['.global-pixel-field', 'global-pixel-field'],
  ].forEach(([selector, name]) => {
    document.querySelector(selector)?.style.setProperty('view-transition-name', name);
  });
  function ensureFooterMarqueeSafeHost() {
    const footer = document.querySelector('.site-footer');
    if (!footer || footer.querySelector('.footer-marquee-safe')) return;
    const host = document.createElement('div');
    host.className = 'footer-marquee-safe';
    host.setAttribute('aria-hidden', 'true');
    footer.insertBefore(host, footer.querySelector('#footer-tetris') || null);
  }

  ensureFooterMarqueeSafeHost();
  updateCurrentSection();
  addEventListener('hashchange', updateCurrentSection);
  addEventListener('popstate', updateCurrentSection);

  const reducedMotionPageswapListenerKey = '__resourceArchiveReducedMotionPageswapListenerInstalled';

  function reportPageswapError(error) {
    if (typeof globalThis.reportError === 'function') {
      globalThis.reportError(error);
      return;
    }
    setTimeout(() => { throw error; });
  }

  function installReducedMotionPageswapListener() {
    if (globalThis[reducedMotionPageswapListenerKey]) return;
    globalThis[reducedMotionPageswapListenerKey] = true;
    addEventListener('pageswap', event => {
      const transition = event.viewTransition;
      if (!transition) return;
      try {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        Promise.resolve(transition.finished).then(() => {}, () => {});
        Promise.resolve(transition.ready).then(() => {}, () => {});
        transition.skipTransition();
      } catch (error) {
        reportPageswapError(error);
      }
    });
  }

  installReducedMotionPageswapListener();

  let anchorObserver = null;

  function disconnectAnchorObserver() {
    anchorObserver?.disconnect();
    anchorObserver = null;
  }

  function homeModulesSettled() {
    const stageApp = document.querySelector('#stage-preview-app');
    const nodeApp = document.querySelector('#node-directory-app');
    const stageSettled = stageApp?.querySelector('[data-stage-preview], .error-state');
    const nodeSettled = nodeApp?.querySelector('[data-node-system], .error-state');
    return Boolean(stageSettled && nodeSettled);
  }

  function restoreHomeAnchorWhenReady() {
    if (page !== 'home') return;
    const section = location.hash.slice(1);
    if (!section) return;
    const target = document.getElementById(section);
    if (!target) return;
    if (!homeModulesSettled()) return false;
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    return true;
  }

  function restoreHomeAnchor() {
    if (page !== 'home') return;
    disconnectAnchorObserver();
    if (restoreHomeAnchorWhenReady()) return;
    anchorObserver = new MutationObserver(() => {
      if (!restoreHomeAnchorWhenReady()) return;
      disconnectAnchorObserver();
    });
    anchorObserver.observe(document.body, { childList: true, subtree: true });
  }

  addEventListener('pageshow', restoreHomeAnchor);
  addEventListener('hashchange', restoreHomeAnchor);
  addEventListener('pagehide', () => {
    disconnectAnchorObserver();
  });

})();
