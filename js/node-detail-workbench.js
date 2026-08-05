(() => {
  const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]';

  function isReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isVisible(node) {
    return Boolean(node?.isConnected && node.getClientRects().length);
  }

  function steppedRectPolygon({ left, top, right, bottom, width, height, step = 8 }) {
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    const snap = value => Math.round(value / step) * step;
    const extentX = Math.ceil(width / step) * step;
    const extentY = Math.ceil(height / step) * step;
    const l = clamp(snap(left), 0, Math.max(0, extentX - step * 2));
    const t = clamp(snap(top), 0, Math.max(0, extentY - step * 2));
    const r = clamp(snap(right), l + step * 2, extentX);
    const b = clamp(snap(bottom), t + step * 2, extentY);
    const points = [
      [l + step, t], [r - step, t], [r - step, t + step], [r, t + step],
      [r, b - step], [r - step, b - step], [r - step, b], [l + step, b],
      [l + step, b - step], [l, b - step], [l, t + step], [l + step, t + step],
    ];
    return `polygon(${points.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;
  }

  function anchorPixelPolygon(panel, anchor, step = 8) {
    const target = panel.getBoundingClientRect();
    const source = anchor?.getBoundingClientRect();
    const snap = value => Math.round(value / step) * step;
    const left = snap(source ? source.left - target.left : target.width / 2);
    const top = snap(source ? source.top - target.top : target.height / 2);
    const right = snap(source ? source.right - target.left : target.width / 2);
    const bottom = snap(source ? source.bottom - target.top : target.height / 2);
    return steppedRectPolygon({ left, top, right, bottom, width: target.width, height: target.height, step });
  }

  function fullPixelPolygon(panel, step = 8) {
    const { width, height } = panel.getBoundingClientRect();
    return steppedRectPolygon({ left: 0, top: 0, right: width, bottom: height, width, height, step });
  }

  function edgePixelPolygon(panel, step = 8) {
    const { width, height } = panel.getBoundingClientRect();
    return steppedRectPolygon({
      left: step,
      top: step,
      right: width - step,
      bottom: height - step,
      width,
      height,
      step,
    });
  }

  function verticalMotionOffset(panel, desired = 10) {
    const remaining = innerHeight - panel.getBoundingClientRect().bottom;
    return remaining >= desired ? desired : 0;
  }

  function finished(animation) {
    return animation?.finished?.catch(() => undefined) || Promise.resolve();
  }

  function cancel(animation) {
    if (!animation) return;
    try { animation.cancel(); } catch { /* already detached */ }
  }

  function create({ app, translate }) {
    let state = null;

    function findOrigin(activeKey, anchor) {
      if (isVisible(anchor) && app.contains(anchor)) return anchor;
      if (!activeKey) return null;
      const match = app.querySelector(`[data-node-key="${CSS.escape(activeKey)}"]`);
      return isVisible(match) ? match : null;
    }

    function markOrigin(origin) {
      if (!origin) return;
      origin.setAttribute('aria-current', 'true');
      origin.classList.add('is-node-workbench-origin');
    }

    function releaseOrigin(origin) {
      if (!origin) return;
      origin.removeAttribute('aria-current');
      origin.classList.remove('is-node-workbench-origin');
    }

    function shell({ parentHref, activeKey }) {
      const layer = document.createElement('div');
      layer.className = 'node-workbench-layer';
      layer.dataset.nodeWorkbenchLayer = '';
      const scrim = document.createElement('div');
      scrim.className = 'node-workbench-scrim';
      const dialog = document.createElement('section');
      dialog.className = 'node-detail-workbench';
      dialog.dataset.nodeDetailWorkbench = '';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', translate('nodes-dialog-label'));
      dialog.tabIndex = -1;
      const closeLink = document.createElement('a');
      closeLink.href = parentHref;
      closeLink.className = 'node-workbench-close';
      closeLink.dataset.testid = 'node-detail-back';
      closeLink.dataset.nodeDetailBack = '';
      closeLink.dataset.internalViewHistoryBack = '';
      closeLink.dataset.internalViewFallbackReplace = '';
      closeLink.setAttribute('aria-label', translate('nodes-dialog-close'));
      closeLink.textContent = '×';
      const topbar = document.createElement('header');
      topbar.className = 'node-workbench-topbar';
      const breadcrumb = document.createElement('nav');
      breadcrumb.className = 'node-workbench-breadcrumb';
      const counter = document.createElement('span');
      counter.className = 'node-workbench-counter';
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.dataset.testid = 'node-workbench-previous';
      previous.className = 'node-workbench-edge-control node-workbench-edge-control--previous';
      previous.textContent = '<';
      const next = document.createElement('button');
      next.type = 'button';
      next.dataset.testid = 'node-workbench-next';
      next.className = 'node-workbench-edge-control node-workbench-edge-control--next';
      next.textContent = '>';
      topbar.append(breadcrumb, counter, closeLink);
      const body = document.createElement('div');
      body.className = 'node-workbench-body';
      const panel = document.createElement('div');
      panel.className = 'node-workbench-panel';
      panel.append(topbar, body);
      const edgeNavigation = document.createElement('nav');
      edgeNavigation.className = 'node-workbench-edge-navigation';
      edgeNavigation.setAttribute('aria-label', translate('nodes-dialog-label'));
      edgeNavigation.append(previous, next);
      dialog.append(panel, edgeNavigation);
      layer.append(scrim, dialog);
      app.append(layer);
      const requestClose = event => {
        if (!state || state.closing) {
          event.preventDefault();
          return;
        }
        if (state.routeCommitted) return;
        event.preventDefault();
        void close();
      };
      closeLink.addEventListener('click', requestClose);
      const requestBackdropClose = event => {
        if (event.target !== scrim || !state || state.closing) return;
        state.close.click();
      };
      scrim.addEventListener('click', requestBackdropClose);
      return {
        layer, dialog, scrim, panel, close: closeLink, body, breadcrumb, counter, previous, next, activeKey, requestClose, requestBackdropClose,
      };
    }

    function trapFocus(event) {
      if (event.key !== 'Tab' || !state || state.closing) return;
      const items = [...state.dialog.querySelectorAll(focusableSelector)].filter(node => isVisible(node)
        && node.tabIndex >= 0
        && !node.matches(':disabled, [aria-disabled="true"]'));
      if (!items.length) {
        event.preventDefault();
        state.dialog.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items.at(-1);
      if (document.activeElement === state.dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!state.dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onKeydown(event) {
      if (!state || state.closing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        state.close.click();
        return;
      }
      trapFocus(event);
    }

    function claimModalState(current) {
      const compensation = innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--node-scrollbar-compensation', `${compensation}px`);
      current.inertChildren = [...app.children]
        .filter(child => child !== current.layer)
        .map(child => ({ child, inert: child.inert }));
      current.inertChildren.forEach(({ child }) => { child.inert = true; });
      document.body.classList.add('has-node-workbench');
      document.addEventListener('keydown', onKeydown);
      markOrigin(current.origin);
    }

    function syncHeaderOffset(current) {
      const bottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom;
      if (Number.isFinite(bottom) && bottom > 0) {
        current.layer.style.setProperty('--node-workbench-header-offset', `${bottom}px`);
      } else {
        current.layer.style.removeProperty('--node-workbench-header-offset');
      }
    }

    function observeHeaderOffset(current) {
      const header = document.querySelector('.site-header');
      if (!header) return;
      current.headerOffsetSync = () => syncHeaderOffset(current);
      current.headerOffsetSync();
      if (typeof ResizeObserver === 'function') {
        current.headerResizeObserver = new ResizeObserver(current.headerOffsetSync);
        current.headerResizeObserver.observe(header);
      }
      addEventListener('resize', current.headerOffsetSync, { passive: true });
    }

    function releaseHeaderOffset(current) {
      current.headerResizeObserver?.disconnect();
      current.headerResizeObserver = null;
      if (current.headerOffsetSync) removeEventListener('resize', current.headerOffsetSync);
      current.headerOffsetSync = null;
      current.layer.style.removeProperty('--node-workbench-header-offset');
    }

    function disconnectLayerObserver(current) {
      current.layerObserver?.disconnect();
      current.layerObserver = null;
    }

    function releaseModalState(current) {
      if (current.released) return;
      current.released = true;
      disconnectLayerObserver(current);
      releaseHeaderOffset(current);
      document.removeEventListener('keydown', onKeydown);
      (current.inertChildren || []).forEach(({ child, inert }) => {
        if (child.parentElement === app) child.inert = inert;
      });
      current.inertChildren = [];
      document.body.classList.remove('has-node-workbench');
      document.documentElement.style.removeProperty('--node-scrollbar-compensation');
      releaseOrigin(current.origin);
      cancel(current.openAnimation);
      cancel(current.closeAnimation);
      cancel(current.scrimAnimation);
      (current.replaceAnimations || []).forEach(cancel);
      current.openAnimation = null;
      current.closeAnimation = null;
      current.scrimAnimation = null;
      current.replaceAnimations = [];
    }

    function finishExternalRemoval(current) {
      if (current.released) return;
      releaseModalState(current);
      current.close.removeEventListener('click', current.requestClose);
      current.scrim.removeEventListener('click', current.requestBackdropClose);
      if (state === current) state = null;
      app.dispatchEvent(new CustomEvent('resourcearchivenodeworkbenchclosed', { bubbles: true }));
    }

    function observeLayer(current) {
      current.layerObserver = new MutationObserver(() => {
        if (current.layer.parentElement !== app) finishExternalRemoval(current);
      });
      current.layerObserver.observe(app, { childList: true });
    }

    function liveState() {
      if (state && state.layer.parentElement !== app) finishExternalRemoval(state);
      return state;
    }

    function finishClose(current, { restoreFocus = true } = {}) {
      if (current.released) return;
      releaseModalState(current);
      current.close.removeEventListener('click', current.requestClose);
      current.scrim.removeEventListener('click', current.requestBackdropClose);
      current.layer.remove();
      if (state === current) state = null;
      app.dispatchEvent(new CustomEvent('resourcearchivenodeworkbenchclosed', { bubbles: true }));
      if (restoreFocus && isVisible(current.origin)) current.origin.focus({ preventScroll: true });
    }

    function startOpenAnimation(current) {
      if (isReducedMotion()) return;
      const opening = anchorPixelPolygon(current.dialog, current.origin);
      const full = fullPixelPolygon(current.dialog, 8);
      current.motionOffset = verticalMotionOffset(current.dialog);
      const openAnimation = current.dialog.animate([
        { clipPath: opening, opacity: .25, transform: `translateY(${current.motionOffset}px)` },
        { clipPath: full, opacity: 1, transform: 'translateY(0)' },
      ], { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
      const scrimAnimation = current.scrim.animate([
        { opacity: 0 },
        { opacity: 1 },
      ], { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
      current.openAnimation = openAnimation;
      current.scrimAnimation = scrimAnimation;
      void Promise.all([openAnimation.finished, scrimAnimation.finished]).then(() => {
        if (state !== current || current.released || current.closing || current.layer.parentElement !== app
          || current.openAnimation !== openAnimation || current.scrimAnimation !== scrimAnimation) return;
        openAnimation.cancel();
        scrimAnimation.cancel();
        current.openAnimation = null;
        current.scrimAnimation = null;
      }).catch(() => {
        if (state === current && !current.closing) finishClose(current, { restoreFocus: false });
      });
    }

    function animateReplacement(nodes, direction) {
      if (isReducedMotion()) return Promise.resolve();
      const x = direction === 'previous' ? -14 : 14;
      const animations = nodes.map(node => node.animate([
        { opacity: .35, transform: `translateX(${x}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }));
      state.replaceAnimations?.forEach(cancel);
      state.replaceAnimations = animations;
      return Promise.all(animations.map(finished));
    }

    function loadingView() {
      const loading = document.createElement('div');
      loading.className = 'node-workbench-loading';
      loading.dataset.testid = 'node-workbench-loading';
      loading.setAttribute('role', 'status');
      const copy = document.createElement('p');
      copy.dataset.i18n = 'nodes-dialog-loading';
      copy.textContent = translate('nodes-dialog-loading');
      const skeleton = document.createElement('div');
      skeleton.setAttribute('aria-hidden', 'true');
      loading.append(copy, skeleton);
      return loading;
    }

    function openPending(options) {
      const current = liveState();
      if (current) {
        current.activeKey = options.activeKey || current.activeKey;
        current.pendingDirection = options.direction || null;
        current.dialog.setAttribute('aria-busy', 'true');
        current.body.firstElementChild?.setAttribute('aria-busy', 'true');
        return current.body;
      }
      state = shell(options);
      state.origin = findOrigin(options.activeKey, options.anchor);
      state.pendingDirection = options.direction || null;
      state.hasContent = false;
      state.replaceAnimations = [];
      observeHeaderOffset(state);
      state.body.replaceChildren(loadingView());
      claimModalState(state);
      observeLayer(state);
      state.close.focus({ preventScroll: true });
      startOpenAnimation(state);
      return state.body;
    }

    function showContent(content, { direction = state?.pendingDirection || null } = {}) {
      const current = liveState();
      if (!current || current.closing) return false;
      const replacing = current.hasContent && Boolean(direction);
      current.body.replaceChildren(content);
      const copy = current.body.querySelector('[data-node-workbench-copy-link]');
      if (copy) copy.onclick = () => { void copyCurrentLink(copy); };
      current.dialog.removeAttribute('aria-busy');
      current.pendingDirection = null;
      if (!current.hasContent) {
        current.hasContent = true;
      } else if (replacing) {
        void animateReplacement([
          ...current.body.querySelectorAll('.node-workbench-preview-host, .node-workbench-information'),
        ], direction);
      }
      return true;
    }

    function showError(content) { return showContent(content); }
    function breadcrumbHref(route, index) {
      if (index === 0) return '/nodes.html';
      if (index === 1) return route.parentSystemHref || route.parentHref || '/nodes.html';
      if (index === 2) return route.parentHref || '/nodes.html';
      return null;
    }
    function writeBreadcrumb(route, items) {
      state.breadcrumb.replaceChildren();
      items.forEach((label, index) => {
        if (index) state.breadcrumb.append(' / ');
        const href = breadcrumbHref(route, index);
        if (href) {
          const link = document.createElement('a');
          link.href = href;
          link.textContent = label;
          state.breadcrumb.append(link);
          return;
        }
        const current = document.createElement('span');
        current.textContent = label;
        current.setAttribute('aria-current', 'page');
        state.breadcrumb.append(current);
      });
    }
    function emitNavigation(item, direction) {
      const current = liveState();
      if (current) {
        current.pendingDirection = direction;
        current.dialog.setAttribute('aria-busy', 'true');
        current.body.firstElementChild?.setAttribute('aria-busy', 'true');
      }
      app.dispatchEvent(new CustomEvent('resourcearchivenodeworkbenchnavigate', {
        bubbles: true,
        detail: { href: item.href, key: item.key, direction },
      }));
    }
    function updateChrome(options = {}) {
      const current = liveState();
      if (!current) return false;
      const chrome = current.chrome || {};
      const route = options.route || chrome.route || {};
      const sequence = options.sequence || chrome.sequence || [];
      const activeKey = options.activeKey || chrome.activeKey || current.activeKey;
      const breadcrumb = options.breadcrumb?.length ? options.breadcrumb : (chrome.breadcrumb || []);
      const code = options.code || chrome.code || 'ND';
      current.activeKey = activeKey || current.activeKey;
      if (breadcrumb.length) writeBreadcrumb(route, breadcrumb);
      const index = sequence.findIndex(item => item.key === current.activeKey);
      current.counter.textContent = translate('nodes-workbench-record-counter', {
        code,
        index: index < 0 ? 0 : index + 1,
        total: sequence.length,
      });
      const bind = (button, item, direction) => {
        button.disabled = !item;
        button.setAttribute('aria-label', translate(`nodes-workbench-${direction}`));
        button.onclick = item ? () => emitNavigation(item, direction) : null;
      };
      bind(current.previous, index > 0 ? sequence[index - 1] : null, 'previous');
      bind(current.next, index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null, 'next');
      current.chrome = { route, sequence, activeKey: current.activeKey, breadcrumb, code };
      return true;
    }
    async function copyCurrentLink(button) {
      const originalLabel = translate('nodes-workbench-copy-link');
      try {
        await navigator.clipboard.writeText(window.location.href);
        button.textContent = translate('nodes-workbench-copy-complete');
        window.setTimeout(() => {
          if (button.isConnected) button.textContent = translate('nodes-workbench-copy-link');
        }, 1200);
      } catch (error) {
        button.textContent = originalLabel;
        app.dispatchEvent(new CustomEvent('resourcearchivenodeworkbenchcopyerror', {
          bubbles: true,
          detail: { error },
        }));
      }
    }
    function isOpen() { return Boolean(liveState()); }
    function currentKey() { return liveState()?.activeKey || null; }
    function markRouteCommitted({ direct = false } = {}) {
      const current = liveState();
      if (!current) return false;
      current.routeCommitted = true;
      current.direct = direct;
      return true;
    }
    function close({ restoreFocus = true, immediate = false } = {}) {
      const current = liveState();
      if (!current) return Promise.resolve();
      if (current.closePromise) return current.closePromise;
      current.closing = true;
      cancel(current.openAnimation);
      cancel(current.scrimAnimation);
      current.openAnimation = null;
      current.scrimAnimation = null;
      if (immediate || isReducedMotion()) {
        finishClose(current, { restoreFocus });
        return Promise.resolve();
      }
      const useOrigin = isVisible(current.origin) && app.contains(current.origin);
      const duration = useOrigin ? 520 : 220;
      const offset = useOrigin ? (current.motionOffset ?? verticalMotionOffset(current.dialog)) : 18;
      const from = fullPixelPolygon(current.dialog, 8);
      const to = useOrigin ? anchorPixelPolygon(current.dialog, current.origin) : edgePixelPolygon(current.dialog, 8);
      current.closeAnimation = current.dialog.animate([
        { clipPath: from, opacity: 1, transform: 'translateY(0)' },
        { clipPath: to, opacity: useOrigin ? .25 : 0, transform: `translateY(${offset}px)` },
      ], { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
      current.scrimAnimation = current.scrim.animate([
        { opacity: 1 },
        { opacity: 0 },
      ], { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
      current.closePromise = Promise.all([finished(current.closeAnimation), finished(current.scrimAnimation)])
        .then(() => finishClose(current, { restoreFocus }));
      return current.closePromise;
    }

    function destroy() {
      if (state) finishClose(state, { restoreFocus: false });
    }
    return Object.freeze({ openPending, showContent, showError, updateChrome, markRouteCommitted, close, isOpen, currentKey, destroy });
  }
  window.ResourceArchiveNodeWorkbench = Object.freeze({ create });
})();
