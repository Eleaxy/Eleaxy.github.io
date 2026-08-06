(() => {
  const root = document.documentElement;
  const page = document.body.dataset.page || 'home';
  const homeSectionIds = ['home', 'tutorials', 'stages', 'nodes', 'plugins-section', 'videos', 'contributors'];
  const standalonePageForPath = pathname => ({
    '/tutorials.html': 'tutorials',
    '/stages.html': 'stages',
    '/nodes.html': 'nodes',
    '/plugins.html': 'plugins',
    '/videos.html': 'videos',
    '/contributors.html': 'contributors',
  }[pathname] || null);
  const currentPage = () => standalonePageForPath(location.pathname) || page;
  const sectionFromLocation = () => {
    const locatedPage = currentPage();
    if (locatedPage !== 'home') return locatedPage;
    const hash = location.hash.slice(1);
    return homeSectionIds.includes(hash) ? hash : 'home';
  };

  function setCurrentSection(section) {
    root.dataset.currentSection = section;
    document.querySelectorAll('.primary-nav a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const target = href.match(/\/(nodes|stages|tutorials|plugins|videos|contributors)\.html/)?.[1]
        || href.match(/#(home|nodes|stages|tutorials|plugins-section|videos|contributors)$/)?.[1]
        || 'home';
      if (target === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function sectionFromScroll() {
    if (page !== 'home') return sectionFromLocation();
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
    const readingLine = Math.min(
      innerHeight - 1,
      headerBottom + Math.min(220, Math.max(1, (innerHeight - headerBottom) * .28)),
    );
    let current = 'home';
    for (const id of homeSectionIds) {
      const section = document.getElementById(id);
      if (!section) continue;
      if (section.getBoundingClientRect().top > readingLine) break;
      current = id;
    }
    const documentBottom = document.documentElement.scrollHeight;
    if (Math.ceil(scrollY + innerHeight) >= documentBottom) current = homeSectionIds.at(-1);
    return current;
  }

  let currentSectionFrame = null;
  function scheduleCurrentSectionUpdate() {
    if (currentSectionFrame !== null) return;
    currentSectionFrame = requestAnimationFrame(() => {
      currentSectionFrame = null;
      setCurrentSection(sectionFromScroll());
    });
  }

  function updateCurrentSectionFromLocation() {
    setCurrentSection(sectionFromLocation());
    scheduleCurrentSectionUpdate();
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
  updateCurrentSectionFromLocation();
  addEventListener('hashchange', updateCurrentSectionFromLocation);
  addEventListener('popstate', updateCurrentSectionFromLocation);
  addEventListener('scroll', scheduleCurrentSectionUpdate, { passive: true });
  addEventListener('resize', scheduleCurrentSectionUpdate);

  let homeSectionResizeObserver = null;
  if (page === 'home' && typeof ResizeObserver === 'function') {
    homeSectionResizeObserver = new ResizeObserver(scheduleCurrentSectionUpdate);
    homeSectionIds.forEach(id => {
      const section = document.getElementById(id);
      if (section) homeSectionResizeObserver.observe(section);
    });
  }

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

  addEventListener('pageshow', event => {
    restoreHomeAnchor();
    scheduleCurrentSectionUpdate();
    if (event.persisted && homeSectionResizeObserver === null && page === 'home' && typeof ResizeObserver === 'function') {
      homeSectionResizeObserver = new ResizeObserver(scheduleCurrentSectionUpdate);
      homeSectionIds.forEach(id => {
        const section = document.getElementById(id);
        if (section) homeSectionResizeObserver.observe(section);
      });
    }
  });
  addEventListener('hashchange', restoreHomeAnchor);
  addEventListener('pagehide', event => {
    disconnectAnchorObserver();
    if (currentSectionFrame !== null) cancelAnimationFrame(currentSectionFrame);
    currentSectionFrame = null;
    if (!event.persisted) {
      homeSectionResizeObserver?.disconnect();
      homeSectionResizeObserver = null;
    }
  });

})();
