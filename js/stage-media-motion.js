(() => {
  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const controllerKey = '__resourceArchiveStageMediaMotionController';
  if (window[controllerKey]) {
    window.ResourceArchiveStageMediaMotion = window[controllerKey].api;
    return;
  }

  const selector = '.stage-media[data-local-image]';
  const SAMPLE_CELL = 14;
  const DRAW_CELL = 13;
  const PROMPT_HEIGHT = 56;
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lifecycle = new AbortController();
  const queryCleanups = [];
  const records = new Set();
  const recordsByMedia = new WeakMap();
  const sample = document.createElement('canvas');
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  let canvas = null;
  let context = null;
  let target = null;
  let frame = 0;
  let started = 0;
  let suspended = false;
  let activeRect = null;
  let disposed = false;

  function motionAllowed() {
    return !disposed && !suspended && fineQuery.matches && !reducedQuery.matches;
  }

  function cancelFrame() {
    if (!frame) return;
    window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function clear() {
    if (context && canvas) context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function boundsRect(bounds) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
    };
  }

  function visibleMediaRect(record, bounds = record?.media.getBoundingClientRect()) {
    const media = boundsRect(bounds);
    if (!record || !media) return null;
    const rail = boundsRect(record.media.closest('[data-stage-rail]')?.getBoundingClientRect());
    if (!rail) return null;
    const left = Math.max(media.left, rail.left, 0);
    const top = Math.max(media.top, rail.top, 0);
    const right = Math.min(media.right, rail.right, window.innerWidth);
    const bottom = Math.min(media.bottom, rail.bottom, window.innerHeight);
    if (right <= left || bottom <= top) return null;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function publishActiveRect(rect) {
    activeRect = rect ? { ...rect } : null;
    window.ResourceArchivePixelField?.setSuppressedRect?.(activeRect);
  }

  function resize() {
    if (!canvas || !context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    clear();
  }

  function ensureCanvas() {
    if (canvas?.isConnected && context) return true;
    if (!document.body) return false;
    canvas = document.createElement('canvas');
    canvas.className = 'stage-crumble-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      canvas.remove();
      canvas = null;
      return false;
    }
    document.body.append(canvas);
    resize();
    return true;
  }

  function removeCanvas() {
    cancelFrame();
    clear();
    canvas?.remove();
    canvas = null;
    context = null;
  }

  function removeMask(record) {
    record.mask?.remove();
    record.mask = null;
  }

  function cancelImageWait(record) {
    record.imageWait?.abort();
    record.imageWait = null;
  }

  function deactivateRecord(record) {
    if (!record) return;
    record.media.classList.remove('is-media-active');
    cancelImageWait(record);
    if (target !== record) return;
    target = null;
    publishActiveRect(null);
    cancelFrame();
    clear();
  }

  function removeLayers() {
    records.forEach(record => {
      record.media.classList.remove('is-media-active');
      cancelImageWait(record);
      removeMask(record);
    });
    target = null;
    publishActiveRect(null);
    removeCanvas();
  }

  function releaseRecord(record) {
    deactivateRecord(record);
    removeMask(record);
    record.listeners.abort();
    records.delete(record);
    recordsByMedia.delete(record.media);
  }

  function pruneDisconnected() {
    [...records].forEach(record => {
      if (!record.media.isConnected) releaseRecord(record);
    });
  }

  function ensureMask(record) {
    if (!motionAllowed() || !record.media.isConnected || !isVisible(record) || record.mask?.isConnected) return;
    const mask = document.createElement('span');
    mask.className = 'stage-media-mask';
    mask.setAttribute('aria-hidden', 'true');
    const cta = document.createElement('span');
    cta.className = 'stage-media-cta';
    cta.textContent = translate('stages-media-cta');
    mask.append(cta);
    record.media.append(mask);
    record.mask = mask;
  }

  function imageReady(image) {
    return Boolean(image?.complete && image.naturalWidth && image.naturalHeight);
  }

  function isVisible(record) {
    return Boolean(visibleMediaRect(record));
  }

  function waitForImage(record, image) {
    cancelImageWait(record);
    if (!image) return;
    const controller = new AbortController();
    record.imageWait = controller;
    const begin = () => {
      if (record.imageWait !== controller) return;
      record.imageWait = null;
      controller.abort();
      if (target === record && motionAllowed() && imageReady(image)) startDrawing(record);
    };
    const stop = () => {
      if (record.imageWait !== controller) return;
      record.imageWait = null;
      controller.abort();
      deactivateRecord(record);
    };
    image.addEventListener('load', begin, { once: true, signal: controller.signal });
    image.addEventListener('error', stop, { once: true, signal: controller.signal });
  }

  function draw(now) {
    frame = 0;
    const active = target;
    if (!motionAllowed() || !active || !active.media.isConnected || !isVisible(active)) {
      deactivateRecord(active);
      return;
    }
    const image = active.media.querySelector('img');
    if (!imageReady(image)) {
      clear();
      deactivateRecord(active);
      return;
    }
    if (!ensureCanvas() || !sampleContext) return;
    const bounds = active.media.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      deactivateRecord(active);
      return;
    }
    const visible = visibleMediaRect(active, bounds);
    if (!visible) {
      deactivateRecord(active);
      return;
    }

    publishActiveRect(visible);
    clear();
    context.save();
    context.beginPath();
    context.rect(visible.left, visible.top, visible.width, visible.height);
    context.clip();
    try {
      const columns = Math.ceil(bounds.width / SAMPLE_CELL);
      const rows = Math.ceil(bounds.height / SAMPLE_CELL);
      sample.width = columns;
      sample.height = rows;
      const imageRatio = image.naturalWidth / image.naturalHeight;
      const boxRatio = bounds.width / bounds.height;
      let sx = 0;
      let sy = 0;
      let sw = image.naturalWidth;
      let sh = image.naturalHeight;
      if (imageRatio > boxRatio) {
        sw = image.naturalHeight * boxRatio;
        sx = (image.naturalWidth - sw) / 2;
      } else {
        sh = image.naturalWidth / boxRatio;
        sy = (image.naturalHeight - sh) / 2;
      }
      sampleContext.clearRect(0, 0, columns, rows);
      sampleContext.drawImage(image, sx, sy, sw, sh, 0, 0, columns, rows);
      const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
      const phase = Math.floor((now - started) / 90);
      const radius = Math.min(columns, rows) * .62;
      const protectedLeft = bounds.left + bounds.width * .3;
      const protectedRight = bounds.left + bounds.width * .7;
      const protectedTop = bounds.top + bounds.height * .3;
      const protectedBottom = Math.min(bounds.top + bounds.height * .7, bounds.bottom - PROMPT_HEIGHT);
      const firstRow = Math.max(0, Math.floor((visible.top - bounds.top - DRAW_CELL) / SAMPLE_CELL));
      const lastRow = Math.min(rows - 1, Math.ceil((visible.bottom - bounds.top) / SAMPLE_CELL) - 1);
      const firstColumn = Math.max(0, Math.floor((visible.left - bounds.left - DRAW_CELL) / SAMPLE_CELL));
      const lastColumn = Math.min(columns - 1, Math.ceil((visible.right - bounds.left) / SAMPLE_CELL) - 1);
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const closestCorner = Math.min(
            Math.hypot(column, row),
            Math.hypot(columns - 1 - column, row),
            Math.hypot(column, rows - 1 - row),
            Math.hypot(columns - 1 - column, rows - 1 - row),
          );
          if (closestCorner > radius) continue;
          const falloff = (1 - closestCorner / radius) ** 2;
          const hash = Math.imul(column + 1, 73856093)
            ^ Math.imul(row + 1, 19349663)
            ^ Math.imul(phase + 1, 83492791);
          if (((hash >>> 0) % 10000) / 10000 > falloff) continue;
          const index = (row * columns + column) * 4;
          if (pixels[index + 3] < 32) continue;
          const x = bounds.left + column * SAMPLE_CELL;
          const y = bounds.top + row * SAMPLE_CELL;
          const left = Math.max(x, bounds.left, visible.left);
          const top = Math.max(y, bounds.top, visible.top);
          const right = Math.min(x + DRAW_CELL, bounds.right, visible.right);
          const bottom = Math.min(y + DRAW_CELL, bounds.bottom, visible.bottom);
          const width = right - left;
          const height = bottom - top;
          if (width <= 0 || height <= 0) continue;
          const overlapsProtectedCenter = left < protectedRight && right > protectedLeft
            && top < protectedBottom && bottom > protectedTop;
          if (overlapsProtectedCenter) continue;
          context.fillStyle = `rgb(${pixels[index]}, ${pixels[index + 1]}, ${pixels[index + 2]})`;
          context.fillRect(left, top, width, height);
        }
      }
    } catch (error) {
      active.media.dataset.pixelSampling = 'unavailable';
      deactivateRecord(active);
      return;
    } finally {
      context.restore();
    }
    if (target === active && motionAllowed()) frame = window.requestAnimationFrame(draw);
  }

  function startDrawing(record) {
    const visible = visibleMediaRect(record);
    if (target !== record || !motionAllowed() || !visible) {
      deactivateRecord(record);
      return;
    }
    publishActiveRect(visible);
    cancelFrame();
    const image = record.media.querySelector('img');
    if (!imageReady(image)) {
      if (image?.complete) {
        deactivateRecord(record);
        return;
      }
      waitForImage(record, image);
      return;
    }
    if (ensureCanvas()) frame = window.requestAnimationFrame(draw);
  }

  function activate(record) {
    if (!motionAllowed() || !record.media.isConnected || !visibleMediaRect(record)) return;
    if (target && target !== record) deactivateRecord(target);
    ensureMask(record);
    if (!ensureCanvas()) return;
    target = record;
    started = window.performance.now();
    record.media.classList.add('is-media-active');
    startDrawing(record);
  }

  function register(media) {
    const existing = recordsByMedia.get(media);
    if (existing) return existing;
    const record = {
      media,
      mask: null,
      imageWait: null,
      listeners: new AbortController(),
    };
    media.addEventListener('mouseenter', event => {
      if (event.relatedTarget?.isConnected === false) return;
      activate(record);
    }, { signal: record.listeners.signal });
    const deactivate = () => deactivateRecord(record);
    media.addEventListener('mouseleave', deactivate, { signal: record.listeners.signal });
    media.addEventListener('pointerleave', deactivate, { signal: record.listeners.signal });
    media.addEventListener('pointercancel', deactivate, { signal: record.listeners.signal });
    records.add(record);
    recordsByMedia.set(media, record);
    return record;
  }

  function reconcile() {
    pruneDisconnected();
    if (!motionAllowed()) {
      removeLayers();
      return;
    }
    let eligibleRecords = 0;
    records.forEach(record => {
      const rail = boundsRect(record.media.closest('[data-stage-rail]')?.getBoundingClientRect());
      if (!rail) {
        deactivateRecord(record);
        removeMask(record);
        return;
      }
      eligibleRecords += 1;
      if (!isVisible(record)) {
        deactivateRecord(record);
        removeMask(record);
        return;
      }
      ensureMask(record);
    });
    if (eligibleRecords) ensureCanvas();
    else removeCanvas();
  }

  function enhance(root = document) {
    if (disposed || !root) return;
    if (root.nodeType === 1 && root.matches(selector)) register(root);
    root.querySelectorAll?.(selector).forEach(register);
    reconcile();
  }

  const listenForChanges = query => {
    if (query.addEventListener) {
      query.addEventListener('change', reconcile, { signal: lifecycle.signal });
      queryCleanups.push(() => query.removeEventListener('change', reconcile));
    } else {
      query.addListener(reconcile);
      queryCleanups.push(() => query.removeListener(reconcile));
    }
  };

  listenForChanges(fineQuery);
  listenForChanges(reducedQuery);
  document.addEventListener('resource-archive-language-change', () => {
    removeLayers();
    reconcile();
  }, { signal: lifecycle.signal });
  document.addEventListener(
    'resourcearchiveinternalviewrouterbeforetransition',
    removeLayers,
    { capture: true, signal: lifecycle.signal },
  );
  window.addEventListener('popstate', removeLayers, { signal: lifecycle.signal });
  window.addEventListener('hashchange', removeLayers, { signal: lifecycle.signal });
  window.addEventListener('resize', resize, { passive: true, signal: lifecycle.signal });
  window.addEventListener('pagehide', () => {
    suspended = true;
    removeLayers();
  }, { signal: lifecycle.signal });
  window.addEventListener('pageshow', () => {
    suspended = false;
    reconcile();
  }, { signal: lifecycle.signal });
  const observer = new MutationObserver(pruneDisconnected);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function cleanup() {
    if (disposed) return;
    disposed = true;
    lifecycle.abort();
    queryCleanups.splice(0).forEach(removeListener => {
      try {
        removeListener();
      } catch {
      }
    });
    observer.disconnect();
    removeLayers();
    [...records].forEach(releaseRecord);
    if (window[controllerKey]?.api === api) delete window[controllerKey];
    if (window.ResourceArchiveStageMediaMotion === api) delete window.ResourceArchiveStageMediaMotion;
  }

  const api = {
    enhance,
    visibleMediaRect: media => {
      const record = recordsByMedia.get(media);
      return record ? visibleMediaRect(record) : null;
    },
    activeBounds: () => activeRect && { ...activeRect },
    getActiveRect: () => activeRect && { ...activeRect },
    cleanup,
  };
  window[controllerKey] = { api, observer, cleanup };
  window.ResourceArchiveStageMediaMotion = api;
})();
