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

  function installScrollEdgeControls() {
    if (document.querySelector('[data-scroll-edge-controls]')) return;

    const rail = document.createElement('div');
    rail.className = 'scroll-edge-controls';
    rail.dataset.scrollEdgeControls = '';
    rail.dataset.testid = 'scroll-edge-controls';

    function makeButton({ className, testId, dataAttr, glyph, i18nKey, fallback }) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.dataset[dataAttr] = '';
      button.dataset.testid = testId;
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
      const mark = document.createElement('span');
      mark.className = 'scroll-edge-glyph';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = glyph;
      button.append(mark);
      button.__caption = () => window.resourceArchiveI18n?.translate?.(i18nKey) || fallback;
      return button;
    }

    const toTop = makeButton({
      className: 'scroll-edge-button scroll-to-top',
      testId: 'scroll-to-top',
      dataAttr: 'scrollToTop',
      glyph: '↑',
      i18nKey: 'scroll-to-top',
      fallback: 'Back to top',
    });
    const toBottom = makeButton({
      className: 'scroll-edge-button scroll-to-bottom',
      testId: 'scroll-to-bottom',
      dataAttr: 'scrollToBottom',
      glyph: '↓',
      i18nKey: 'scroll-to-bottom',
      fallback: 'Jump to bottom',
    });
    rail.append(toTop, toBottom);

    function reducedMotion() {
      return typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function syncLabels() {
      [toTop, toBottom].forEach(button => {
        const text = button.__caption();
        button.setAttribute('aria-label', text);
        button.setAttribute('title', text);
      });
    }

    function setButtonVisible(button, show) {
      button.hidden = !show;
      button.setAttribute('aria-hidden', show ? 'false' : 'true');
      button.tabIndex = show ? 0 : -1;
    }

    function maxScrollY() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function updateVisibility() {
      if (document.body.classList.contains('has-node-workbench')) {
        setButtonVisible(toTop, false);
        setButtonVisible(toBottom, false);
        return;
      }
      const max = maxScrollY();
      // Only useful when the page actually scrolls.
      if (max < 120) {
        setButtonVisible(toTop, false);
        setButtonVisible(toBottom, false);
        return;
      }
      const y = window.scrollY;
      const edge = Math.max(80, Math.min(220, Math.round(window.innerHeight * 0.12)));
      setButtonVisible(toTop, y > edge);
      setButtonVisible(toBottom, y < max - edge);
    }

    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, left: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      toTop.blur();
    });
    toBottom.addEventListener('click', () => {
      window.scrollTo({ top: maxScrollY(), left: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      toBottom.blur();
    });

    let frame = null;
    function scheduleUpdate() {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        updateVisibility();
      });
    }

    syncLabels();
    updateVisibility();
    document.body.append(rail);
    addEventListener('scroll', scheduleUpdate, { passive: true });
    addEventListener('resize', scheduleUpdate);
    document.addEventListener('resource-archive-language-change', syncLabels);
    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleUpdate)
      : null;
    observer?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // Late-loading archive content can grow scroll height without a scroll event.
    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(document.documentElement);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installScrollEdgeControls, { once: true });
  } else {
    installScrollEdgeControls();
  }

})();
