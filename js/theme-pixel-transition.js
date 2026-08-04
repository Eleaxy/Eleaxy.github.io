(() => {
  const GRID_SIZE = 9;
  const DURATION_MS = 900;
  const FRAME_COUNT = 48;
  const MAX_DPR = 2;
  const PROTOTYPE_PHASE_SPAN = 400;
  const NEON_YELLOW = [216, 255, 0];
  const controllerKey = 'ResourceArchiveThemeTransition';

  window[controllerKey]?.cleanup?.();

  let active = null;
  let latest = null;
  let transitionSequence = 0;
  let lifecycle = new AbortController();

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function hash(x, y, seed = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function mixNoise(column, row) {
    const near = hash(column, row);
    const medium = hash(Math.floor(column / 3), Math.floor(row / 3), 1);
    const broad = hash(Math.floor(column / 7), Math.floor(row / 7), 2);
    return near * .28 + medium * .38 + broad * .34 - .5;
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
      accent: readOpaqueColor(style.getPropertyValue('--accent'), '#3b5bd9'),
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

  function sameIntent(left, right) {
    return Boolean(left && right)
      && left.theme === right.theme
      && left.resolvedTheme === right.resolvedTheme;
  }

  function resolveOrigin(sourceElement) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rectangle = sourceElement instanceof Element ? sourceElement.getBoundingClientRect() : null;
    if (!rectangle || (!rectangle.width && !rectangle.height)) return { x: width / 2, y: height / 2 };
    return {
      x: clamp(rectangle.left + rectangle.width / 2, 0, width),
      y: clamp(rectangle.top + rectangle.height / 2, 0, height),
    };
  }

  function normalizeArrival(tiles, sourceKey, targetKey) {
    const ordered = [...tiles].sort((left, right) => left[sourceKey] - right[sourceKey]);
    const lastIndex = Math.max(1, ordered.length - 1);
    for (let index = 0; index < ordered.length; index += 1) {
      ordered[index][targetKey] = index / lastIndex * .96;
    }
  }

  function buildBoundaryTiles(transition) {
    transition.clipWidth = Math.ceil(Math.max(1, window.innerWidth) / GRID_SIZE) * GRID_SIZE;
    transition.clipHeight = Math.ceil(Math.max(1, window.innerHeight) / GRID_SIZE) * GRID_SIZE;
    const width = transition.clipWidth;
    const height = transition.clipHeight;
    const centerX = width / 2 - transition.origin.x;
    const centerY = height / 2 - transition.origin.y;
    const centerLength = Math.max(1, Math.hypot(centerX, centerY));
    const directionX = centerX / centerLength;
    const directionY = centerY / centerLength;
    const far = Math.max(
      Math.hypot(transition.origin.x, transition.origin.y),
      Math.hypot(width - transition.origin.x, transition.origin.y),
      Math.hypot(transition.origin.x, height - transition.origin.y),
      Math.hypot(width - transition.origin.x, height - transition.origin.y),
      1,
    );
    transition.prototypeScale = PROTOTYPE_PHASE_SPAN / far;
    transition.boundaryTiles = [];
    for (let y = 0, row = 0; y < height; y += GRID_SIZE, row += 1) {
      for (let x = 0, column = 0; x < width; x += GRID_SIZE, column += 1) {
        const dx = x + GRID_SIZE / 2 - transition.origin.x;
        const dy = y + GRID_SIZE / 2 - transition.origin.y;
        const radial = Math.hypot(dx, dy) / far;
        const lead = (dx * directionX + dy * directionY) / far * .12;
        const field = mixNoise(column, row) * .25 * transition.prototypeScale;
        const baseArrival = radial * .91 - lead + field;
        const island = hash(column * 5, row * 7, 4) > .91 ? -.12 * transition.prototypeScale : 0;
        const hollow = hash(column * 7, row * 11, 5) > .86 ? .1 * transition.prototypeScale : 0;
        transition.boundaryTiles.push({
          x,
          y,
          row,
          rawClipArrival: clamp(baseArrival, 0, .96),
          rawCoverArrival: clamp(baseArrival + island + hollow, 0, .96),
          spark: hash(column, row, 7) > .87,
        });
      }
    }
    normalizeArrival(transition.boundaryTiles, 'rawClipArrival', 'clipArrival');
    normalizeArrival(transition.boundaryTiles, 'rawCoverArrival', 'coverArrival');
    transition.boundaryRows = [];
    for (const tile of transition.boundaryTiles) {
      (transition.boundaryRows[tile.row] ||= []).push(tile);
    }
  }

  function removeBoundaryOverlay(transition) {
    if (!transition) return;
    if (transition.boundaryRaf) cancelAnimationFrame(transition.boundaryRaf);
    transition.boundaryRaf = 0;
    if (transition.boundaryCanvas?.matches(':popover-open')) {
      try {
        transition.boundaryCanvas.hidePopover();
      } catch {
        // Removing the element below is the authoritative cleanup path.
      }
    }
    transition.boundaryCanvas?.remove();
    transition.boundaryCanvas = null;
    transition.boundaryContext = null;
    transition.boundaryStartedAt = 0;
  }

  function ensureBoundaryOverlay(transition) {
    removeBoundaryOverlay(transition);
    const canvas = document.createElement('canvas');
    canvas.className = 'theme-pixel-transition';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('popover', 'manual');
    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    document.body.append(canvas);
    const context = canvas.getContext('2d', { alpha: true });
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    transition.boundaryCanvas = canvas;
    transition.boundaryContext = context;
    try {
      canvas.showPopover();
    } catch {
      // The direct reveal remains usable if a browser lacks Popover top-layer support.
    }
  }

  function fillBoundaryTile(context, tile, color) {
    context.fillStyle = colorString(color);
    context.fillRect(tile.x, tile.y, GRID_SIZE, GRID_SIZE);
  }

  function paintBoundaryOverlay(transition, progress) {
    const context = transition.boundaryContext;
    if (!context) return;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const phaseScale = transition.prototypeScale;
    const frameIndex = Math.min(
      transition.clipFrameBounds.length - 1,
      Math.max(0, Math.round(progress * (transition.clipFrameBounds.length - 1))),
    );
    const bounds = transition.clipFrameBounds[frameIndex];
    for (const tile of transition.boundaryTiles) {
      const front = progress - tile.coverArrival;
      const centerX = tile.x + GRID_SIZE / 2;
      const clipCovered = centerX >= bounds.left[tile.row] && centerX <= bounds.right[tile.row];
      const erosionCovered = progress >= tile.coverArrival;
      let color = erosionCovered === clipCovered
        ? null
        : (erosionCovered ? transition.targetPalette.page : transition.oldPalette.page);

      if (front > -.03 * phaseScale && front < .12 * phaseScale) {
        color = transition.direction === 'light'
          ? mixColor(
            transition.targetPalette.page,
            tile.spark ? NEON_YELLOW : transition.targetPalette.accent,
            .72,
          )
          : mixColor(transition.targetPalette.page, transition.targetPalette.surface, .94);
      } else if (transition.direction === 'dark'
        && front > .02 * phaseScale && front < .16 * phaseScale && tile.spark) {
        color = mixColor(transition.targetPalette.page, transition.oldPalette.accent, .38);
      } else if (transition.direction === 'light'
        && front > -.12 * phaseScale && front < -.04 * phaseScale && tile.spark) {
        color = mixColor(transition.targetPalette.page, transition.targetPalette.accent, .42);
      }
      if (color) fillBoundaryTile(context, tile, color);
    }
  }

  function tickBoundaryOverlay(transition, timestamp) {
    if (active !== transition || !transition.boundaryCanvas?.isConnected) return;
    const progress = clamp((timestamp - transition.boundaryStartedAt) / DURATION_MS, 0, 1);
    paintBoundaryOverlay(transition, progress);
    if (progress < 1) transition.boundaryRaf = requestAnimationFrame(next => tickBoundaryOverlay(transition, next));
  }

  function startBoundaryOverlay(transition) {
    if (active !== transition) return;
    ensureBoundaryOverlay(transition);
    transition.boundaryStartedAt = performance.now();
    paintBoundaryOverlay(transition, 0);
    transition.boundaryRaf = requestAnimationFrame(timestamp => tickBoundaryOverlay(transition, timestamp));
  }

  function buildClipPolygon(transition, progress, finalFrame) {
    const { clipWidth: width, clipHeight: height } = transition;
    const left = [];
    const right = [];
    const originX = clamp(Math.round(transition.origin.x / GRID_SIZE) * GRID_SIZE, 0, width);
    const originColumn = Math.min(
      Math.max(0, Math.floor(transition.origin.x / GRID_SIZE)),
      Math.max(0, (transition.boundaryRows[0]?.length || 1) - 1),
    );

    for (let y = 0, row = 0; y <= height; y += GRID_SIZE, row += 1) {
      if (finalFrame) {
        left.push(0);
        right.push(width);
        continue;
      }
      const tiles = transition.boundaryRows[Math.min(row, transition.boundaryRows.length - 1)] || [];
      const seed = tiles[originColumn];
      if (!seed || seed.clipArrival > progress) {
        left.push(originX);
        right.push(originX);
        continue;
      }
      let first = originColumn;
      let last = originColumn;
      while (first > 0 && tiles[first - 1].clipArrival <= progress) first -= 1;
      while (last + 1 < tiles.length && tiles[last + 1].clipArrival <= progress) last += 1;
      left.push(first * GRID_SIZE);
      right.push(Math.min(width, (last + 1) * GRID_SIZE));
    }

    const points = [`${left[0]}px 0px`];
    for (let row = 1; row < left.length; row += 1) {
      const y = row * GRID_SIZE;
      points.push(`${left[row - 1]}px ${y}px`, `${left[row]}px ${y}px`);
    }
    points.push(`${right[right.length - 1]}px ${height}px`);
    for (let row = right.length - 2; row >= 0; row -= 1) {
      const y = row * GRID_SIZE;
      points.push(`${right[row + 1]}px ${y}px`, `${right[row]}px ${y}px`);
    }
    return { clipPath: `polygon(${points.join(',')})`, left, right };
  }

  function buildClipFrames(transition) {
    const width = Math.ceil(Math.max(1, window.innerWidth) / GRID_SIZE) * GRID_SIZE;
    const height = Math.ceil(Math.max(1, window.innerHeight) / GRID_SIZE) * GRID_SIZE;
    transition.clipWidth = width;
    transition.clipHeight = height;
    const frames = Array.from({ length: FRAME_COUNT }, (_, index) => buildClipPolygon(
      transition,
      index / (FRAME_COUNT - 1),
      index === FRAME_COUNT - 1,
    ));
    transition.clipFrames = frames.map(frame => frame.clipPath);
    transition.clipFrameBounds = frames.map(frame => ({ left: frame.left, right: frame.right }));
  }

  function setTransitionState(transition) {
    const root = document.documentElement;
    root.dataset.themeTransition = 'active';
    root.style.setProperty('--theme-transition-origin-x', `${transition.origin.x}px`);
    root.style.setProperty('--theme-transition-origin-y', `${transition.origin.y}px`);
    buildBoundaryTiles(transition);
    buildClipFrames(transition);
    transition.animationName = `theme-pixel-reveal-${++transitionSequence}`;
    const frameRules = transition.clipFrames.map((clipPath, index) => {
      const percentage = (index / (FRAME_COUNT - 1)) * 100;
      return `${percentage}% {clip-path: ${clipPath};}`;
    }).join('\n');
    const firstFrame = transition.clipFrames[0];
    const style = document.createElement('style');
    style.dataset.themePixelTransition = '';
    style.textContent = `
      @keyframes ${transition.animationName} {
        ${frameRules}
      }
      html[data-theme-transition]::view-transition-new(root) {
        clip-path: ${firstFrame};
        animation: ${DURATION_MS}ms linear both ${transition.animationName} !important;
      }
    `;
    document.head.append(style);
    transition.maskStyle = style;
    transition.maskRule = [...(style.sheet?.cssRules || [])]
      .find(rule => rule.selectorText === 'html[data-theme-transition]::view-transition-new(root)') || null;
  }

  function clearTransitionState(transition) {
    const root = document.documentElement;
    removeBoundaryOverlay(transition);
    delete root.dataset.themeTransition;
    root.style.removeProperty('--theme-transition-origin-x');
    root.style.removeProperty('--theme-transition-origin-y');
    root.style.removeProperty('--theme-transition-clip');
    transition?.maskStyle?.remove();
    if (transition) {
      transition.maskStyle = null;
      transition.maskRule = null;
      transition.clipFrames = null;
      transition.clipFrameBounds = null;
      transition.animationName = null;
      transition.clipWidth = 0;
      transition.clipHeight = 0;
      transition.clipRadius = 0;
      transition.boundaryTiles = null;
      transition.boundaryRows = null;
      transition.prototypeScale = 0;
    }
  }

  function commitOnce(request) {
    if (!request || request.committed) return;
    request.committed = true;
    request.commit({ theme: request.theme, resolvedTheme: request.resolvedTheme });
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

  function canUseNativeTransition() {
    return typeof document.startViewTransition === 'function';
  }

  function finishActive(transition) {
    if (active !== transition) return;
    commitOnce(transition);
    active = null;
    clearTransitionState(transition);
    drainLatest(transition);
  }

  function drainLatest(finished) {
    if (active || !latest) return;
    const next = latest;
    latest = null;
    if (sameIntent(next, finished) || next.resolvedTheme === document.documentElement.dataset.resolvedTheme) {
      commitOnce(next);
      return;
    }
    start(next);
  }

  function start(request) {
    const transition = {
      ...request,
      committed: false,
      origin: resolveOrigin(request.sourceElement),
      viewTransition: null,
      maskStyle: null,
      maskRule: null,
      clipFrames: null,
      clipFrameBounds: null,
      animationName: null,
      clipWidth: 0,
      clipHeight: 0,
      clipRadius: 0,
      oldPalette: readOpaquePalette(),
      targetPalette: readOpaquePaletteForTheme(request.resolvedTheme),
      direction: request.resolvedTheme,
      boundaryTiles: null,
      boundaryRows: null,
      boundaryCanvas: null,
      boundaryContext: null,
      boundaryRaf: 0,
      boundaryStartedAt: 0,
      prototypeScale: 0,
    };
    active = transition;
    setTransitionState(transition);

    try {
      transition.viewTransition = document.startViewTransition(() => {
        commitOnce(transition);
      });
    } catch {
      if (active === transition) {
        active = null;
        clearTransitionState(transition);
      }
      commitOnce(transition);
      drainLatest(transition);
      return;
    }

    Promise.resolve(transition.viewTransition.ready).then(() => {
      startBoundaryOverlay(transition);
    }, () => finishActive(transition));
    Promise.resolve(transition.viewTransition.finished).then(
      () => finishActive(transition),
      () => finishActive(transition),
    );
  }

  function cancel({ commitLatest = false } = {}) {
    const finalRequest = latest || active;
    const transition = active;
    active = null;
    latest = null;
    clearTransitionState(transition);
    transition?.viewTransition?.skipTransition?.();
    if (commitLatest) commitOnce(finalRequest);
  }

  function request({ theme, resolvedTheme, sourceElement, commit }) {
    if (typeof commit !== 'function' || (resolvedTheme !== 'light' && resolvedTheme !== 'dark')) return;
    const next = { theme, resolvedTheme, sourceElement, commit, committed: false };
    if (active) {
      latest = sameIntent(next, active) ? null : next;
      if (latest) active.viewTransition?.skipTransition?.();
      return;
    }
    if (resolvedTheme === document.documentElement.dataset.resolvedTheme
      || reducedMotion()
      || modalIsOpen()
      || !canUseNativeTransition()) {
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
