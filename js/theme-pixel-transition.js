(() => {
  const GRID_SIZE = 9;
  const DURATION_MS = 900;
  const LIGHT_ENERGY_MS = 100;
  const MAX_DPR = 2;
  const controllerKey = 'ResourceArchiveThemeTransition';

  window[controllerKey]?.cleanup?.();

  let canvas = null;
  let context = null;
  let rafId = 0;
  let active = null;
  let latest = null;
  let lifecycle = new AbortController();

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function hash(x, y, seed = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function mixNoise(x, y) {
    const coarse = hash(Math.floor(x / 5), Math.floor(y / 5), 1) * 2 - 1;
    const medium = hash(Math.floor(x / 2), Math.floor(y / 2), 2) * 2 - 1;
    const fine = hash(x, y, 3) * 2 - 1;
    return coarse * 0.62 + medium * 0.28 + fine * 0.1;
  }

  function readOpaqueColor(value, fallback) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const probeContext = probe.getContext('2d', { alpha: false, willReadFrequently: true });
    probeContext.fillStyle = fallback;
    try {
      probeContext.fillStyle = value.trim() || fallback;
    } catch {
      probeContext.fillStyle = fallback;
    }
    probeContext.fillRect(0, 0, 1, 1);
    return [...probeContext.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }

  function readOpaquePalette() {
    const style = getComputedStyle(document.documentElement);
    return {
      page: readOpaqueColor(style.getPropertyValue('--page'), '#000000'),
      surface: readOpaqueColor(style.getPropertyValue('--surface'), '#000000'),
      text: readOpaqueColor(style.getPropertyValue('--text'), '#ffffff'),
      accent: readOpaqueColor(style.getPropertyValue('--accent'), '#ffffff'),
      solidFill: readOpaqueColor(style.getPropertyValue('--solid-fill'), '#000000'),
    };
  }

  function readOpaquePaletteForTheme(resolvedTheme) {
    const root = document.documentElement;
    const previous = root.dataset.resolvedTheme;
    root.dataset.resolvedTheme = resolvedTheme;
    const palette = readOpaquePalette();
    root.dataset.resolvedTheme = previous;
    return palette;
  }

  function mixColor(left, right, amount) {
    return left.map((channel, index) => Math.round(channel + (right[index] - channel) * amount));
  }

  function colorString(color) {
    return `rgb(${color[0]} ${color[1]} ${color[2]})`;
  }

  function resolveOrigin(sourceElement) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rectangle = sourceElement instanceof Element ? sourceElement.getBoundingClientRect() : null;
    if (!rectangle || (!rectangle.width && !rectangle.height)) {
      return { x: width / 2, y: height / 2 };
    }
    return {
      x: clamp(rectangle.left + rectangle.width / 2, 0, width),
      y: clamp(rectangle.top + rectangle.height / 2, 0, height),
    };
  }

  function ensureCanvas() {
    if (canvas?.isConnected && context) return;
    canvas = document.createElement('canvas');
    canvas.className = 'theme-pixel-transition';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    context = canvas.getContext('2d', { alpha: true });
  }

  function removeCanvas() {
    canvas?.remove();
    canvas = null;
    context = null;
  }

  function resizeCanvas(transition) {
    ensureCanvas();
    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    transition.viewport = { width, height };
  }

  function sameIntent(left, right) {
    return Boolean(left && right)
      && left.theme === right.theme
      && left.resolvedTheme === right.resolvedTheme;
  }

  function buildPhaseTiles(transition, progress, elapsed) {
    const { width, height } = transition.viewport;
    const maxDistance = Math.max(
      Math.hypot(transition.origin.x, transition.origin.y),
      Math.hypot(width - transition.origin.x, transition.origin.y),
      Math.hypot(transition.origin.x, height - transition.origin.y),
      Math.hypot(width - transition.origin.x, height - transition.origin.y),
    ) + GRID_SIZE * 4;
    const front = -GRID_SIZE * 1.5 + maxDistance * progress;
    const lightEnergyActive = transition.direction === 'light' && elapsed <= LIGHT_ENERGY_MS;
    const tiles = [];
    for (let y = 0, row = 0; y < height; y += GRID_SIZE, row += 1) {
      for (let x = 0, column = 0; x < width; x += GRID_SIZE, column += 1) {
        const centerX = x + GRID_SIZE / 2;
        const centerY = y + GRID_SIZE / 2;
        const distance = Math.hypot(centerX - transition.origin.x, centerY - transition.origin.y);
        const phaseDistance = distance + mixNoise(column, row) * GRID_SIZE * 2.15;
        const difference = front - phaseDistance;
        const seed = hash(column, row, 4);
        const boundaryWake = difference < GRID_SIZE * 5.2;
        let state = 'old';

        if (progress >= 1) state = 'target';
        else if (difference > GRID_SIZE * 2.4) {
          if (boundaryWake && seed > 0.982 && progress < 0.9) state = 'hole';
          else if (boundaryWake && seed < 0.014 && progress < 0.94) state = 'remnant';
          else state = 'target';
        } else if (difference > -GRID_SIZE * 1.2) {
          if (seed > 0.9 && difference < GRID_SIZE * 0.7) state = 'leading';
          else if (transition.direction === 'light' && lightEnergyActive) state = 'bright-edge';
          else state = transition.direction === 'light' ? 'leading' : 'absorptive-edge';
        } else if (seed > 0.982 && difference > -GRID_SIZE * 3.2) {
          state = 'leading';
        }
        tiles.push({ x, y, state });
      }
    }
    return tiles;
  }

  function paintFrame(transition, progress, elapsed) {
    if (!canvas || !context) return;
    const { width, height } = transition.viewport;
    context.clearRect(0, 0, width, height);
    const tiles = buildPhaseTiles(transition, progress, elapsed);
    const bright = mixColor(transition.targetPalette.surface, [255, 255, 255], 0.82);
    const absorptive = mixColor(transition.targetPalette.page, [0, 0, 0], 0.72);
    for (const tile of tiles) {
      if (tile.state === 'hole') continue;
      let color = transition.oldPalette.page;
      if (tile.state === 'target' || tile.state === 'leading') color = transition.targetPalette.page;
      if (tile.state === 'bright-edge') color = hash(tile.x / GRID_SIZE, tile.y / GRID_SIZE, 8) > 0.84
        ? transition.targetPalette.accent : bright;
      if (tile.state === 'absorptive-edge') color = hash(tile.x / GRID_SIZE, tile.y / GRID_SIZE, 9) > 0.9
        ? transition.targetPalette.accent : absorptive;
      context.fillStyle = colorString(color);
      context.fillRect(tile.x + 1, tile.y + 1, GRID_SIZE - 1, GRID_SIZE - 1);
    }
  }

  function commitOnce(transition) {
    if (!transition || transition.committed) return;
    transition.committed = true;
    transition.commit({ theme: transition.theme, resolvedTheme: transition.resolvedTheme });
    transition.targetPalette = readOpaquePalette();
  }

  function finishActive() {
    if (!active) return;
    const finished = active;
    rafId = 0;
    commitOnce(finished);
    paintFrame(finished, 1, DURATION_MS);
    active = null;
    removeCanvas();
    drainLatest(finished);
  }

  function drainLatest(finished) {
    if (active || !latest) return;
    const next = latest;
    latest = null;
    if (sameIntent(next, finished)) return;
    if (next.resolvedTheme === document.documentElement.dataset.resolvedTheme) {
      commitOnce(next);
      return;
    }
    start(next);
  }

  function tick(timestamp) {
    if (!active) return;
    const elapsed = Math.max(0, timestamp - active.startedAt);
    const progress = clamp(elapsed / DURATION_MS, 0, 1);
    paintFrame(active, progress, elapsed);
    if (progress >= 0.72) commitOnce(active);
    if (progress >= 1) {
      finishActive();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start(request) {
    active = {
      ...request,
      committed: false,
      startedAt: performance.now(),
      origin: resolveOrigin(request.sourceElement),
      oldPalette: readOpaquePalette(),
      targetPalette: readOpaquePaletteForTheme(request.resolvedTheme),
      viewport: null,
      direction: request.resolvedTheme,
    };
    resizeCanvas(active);
    paintFrame(active, 0, 0);
    rafId = requestAnimationFrame(tick);
  }

  function cancel({ commitLatest = false } = {}) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    const finalRequest = latest || active;
    active = null;
    latest = null;
    removeCanvas();
    if (commitLatest) commitOnce(finalRequest);
  }

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function modalIsOpen() {
    return [...document.querySelectorAll('dialog[open]')].some(dialog => {
      try {
        return dialog.matches(':modal');
      } catch {
        return true;
      }
    });
  }

  function request({ theme, resolvedTheme, sourceElement, commit }) {
    if (typeof commit !== 'function' || (resolvedTheme !== 'light' && resolvedTheme !== 'dark')) return;
    const next = { theme, resolvedTheme, sourceElement, commit, committed: false };
    if (active) {
      latest = sameIntent(next, active) ? null : next;
      return;
    }
    if (resolvedTheme === document.documentElement.dataset.resolvedTheme || reducedMotion() || modalIsOpen()) {
      commitOnce(next);
      return;
    }
    start(next);
  }

  function cleanup() {
    cancel({ commitLatest: true });
    lifecycle.abort();
  }

  const cancelOnLifecycle = () => cancel({ commitLatest: true });
  window.addEventListener('pagehide', cancelOnLifecycle, { signal: lifecycle.signal });
  window.addEventListener('resize', cancelOnLifecycle, { signal: lifecycle.signal });
  document.addEventListener(
    'resourcearchiveinternalviewrouterbeforetransition',
    cancelOnLifecycle,
    { capture: true, signal: lifecycle.signal },
  );

  window[controllerKey] = Object.freeze({ request, cancel, cleanup });
})();
