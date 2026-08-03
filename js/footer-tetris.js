(() => {
  window.__resourceArchiveFooterTetrisCleanup?.();

  const canvas = document.querySelector('#footer-tetris');
  const toggle = document.querySelector('.tetris-toggle');
  const shell = canvas?.closest('.footer-tetris-shell');
  const footer = canvas?.closest('.site-footer');
  if (!canvas || !toggle || !shell || !footer) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotionFocusTarget = document.querySelector('#footer-contact-toggle');
  const reducedMotionFocusTargetAttributes = reducedMotionFocusTarget && {
    dataFocus: reducedMotionFocusTarget.getAttribute('data-footer-tetris-reduced-focus'),
    tabIndex: reducedMotionFocusTarget.getAttribute('tabindex'),
  };

  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedMotionQuery.matches;
  const cell = 9;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const palette = ['#2b416f', '#3b5bd9', '#f5c518', '#e0492a', '#d8ff00'];
  const shapes = [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ];

  let width = 1;
  let height = 1;
  let columns = 1;
  let rows = 1;
  let grid = new Uint8Array(1);
  let piece = null;
  let phase = 'idle';
  let flick = 0;
  let score = 0;
  let frame = 0;
  let entryFrame = 0;
  let lastStep = 0;
  let visible = false;
  let disposed = false;
  let suspended = false;
  let controlsAttached = false;
  let resizeObserved = false;
  let visibilityObserver = null;
  let observingVisibility = false;
  let hud = null;
  let scoreElement = null;
  const entryTimers = new Set();

  function translate(key, fallback) {
    return window.resourceArchiveI18n?.translate(key) || fallback;
  }

  function syncToggleLabel() {
    const key = phase === 'idle' ? 'footer-tetris-play' : 'footer-tetris-close';
    let label = toggle.querySelector(':scope > .pixel-button-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'pixel-button-label';
      toggle.append(label);
    }
    delete toggle.dataset.i18n;
    label.dataset.i18n = key;
    label.textContent = translate(key, phase === 'idle' ? 'play' : 'close');
  }

  function syncReducedMotionTitle() {
    if (!reducedMotion) {
      toggle.removeAttribute('title');
      return;
    }
    const key = 'footer-tetris-reduced-title';
    toggle.title = window.resourceArchiveI18n?.translate(key)
      || 'Animation is disabled by reduced motion settings';
  }

  function resetScore() {
    score = 0;
    if (scoreElement) scoreElement.textContent = String(score).padStart(6, '0');
  }

  function syncHudLabels() {
    if (!hud) return;
    hud.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const key = element.dataset.i18nAriaLabel;
      element.setAttribute('aria-label', translate(key, element.getAttribute('aria-label') || ''));
    });
  }

  function addHudControl(pad, className, labelKey, fallback, glyph, action) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = `footer-tetris-control ${className}`;
    control.dataset.i18nAriaLabel = labelKey;
    control.setAttribute('aria-label', translate(labelKey, fallback));
    control.textContent = glyph;
    control.addEventListener('click', event => {
      event.stopPropagation();
      if (phase === 'play') action();
    });
    pad.append(control);
  }

  function ensureHud() {
    if (hud) return;
    hud = document.createElement('div');
    hud.className = 'footer-tetris-hud';
    hud.hidden = true;

    scoreElement = document.createElement('output');
    scoreElement.className = 'footer-tetris-score';
    scoreElement.dataset.i18nAriaLabel = 'footer-tetris-score';
    scoreElement.setAttribute('aria-label', translate('footer-tetris-score', 'Score'));
    hud.append(scoreElement);

    const pad = document.createElement('div');
    pad.className = 'footer-tetris-pad';
    addHudControl(pad, 'footer-tetris-move-left', 'footer-tetris-move-left', 'Move left', '←', () => move(-1));
    addHudControl(pad, 'footer-tetris-move-right', 'footer-tetris-move-right', 'Move right', '→', () => move(1));
    addHudControl(pad, 'footer-tetris-rotate', 'footer-tetris-rotate', 'Rotate', '↻', rotate);
    addHudControl(pad, 'footer-tetris-hard-drop', 'footer-tetris-hard-drop', 'Hard drop', '↓', hardDrop);
    hud.append(pad);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'footer-tetris-close';
    close.dataset.i18nAriaLabel = 'footer-tetris-close-game';
    close.setAttribute('aria-label', translate('footer-tetris-close-game', 'Close game'));
    close.textContent = '×';
    close.addEventListener('click', event => {
      event.stopPropagation();
      endGame();
    });
    hud.append(close);

    shell.append(hud);
    resetScore();
  }

  function setHudVisible(isVisible) {
    if (hud) hud.hidden = !isVisible;
  }

  const hash = value => {
    const result = Math.sin(value * 12.9898) * 43758.5453;
    return result - Math.floor(result);
  };

  function seed() {
    grid.fill(0);
    for (let column = 0; column < columns; column += 1) {
      if (hash(column * 2.3 + 1.1) < 0.34) continue;
      const skyline = 1 + Math.floor(hash(column * 4.7 + 0.5) * Math.max(2, rows * 0.46));
      for (let row = rows - 1; row >= rows - skyline && row >= 0; row -= 1) {
        const color = 1 + Math.min(4, Math.floor(hash(column * 9.1 + row * 3.7) * 5));
        grid[row * columns + column] = color;
      }
    }
  }

  function remapGrid(previousGrid, previousColumns, previousRows) {
    for (let row = 0; row < previousRows; row += 1) {
      for (let column = 0; column < previousColumns; column += 1) {
        const color = previousGrid[row * previousColumns + column];
        if (!color) continue;
        const nextColumn = Math.min(columns - 1, Math.floor(column * columns / previousColumns));
        const depthFromBottom = previousRows - 1 - row;
        const nextRow = Math.max(0, rows - 1 - Math.floor(depthFromBottom * rows / previousRows));
        grid[nextRow * columns + nextColumn] = color;
      }
    }
  }

  function restorePiece(previousPiece, previousColumns, previousRows) {
    if (!previousPiece) {
      spawn();
      return;
    }
    const shapeWidth = Math.max(...previousPiece.shape.map(point => point[0])) + 1;
    const shapeHeight = Math.max(...previousPiece.shape.map(point => point[1])) + 1;
    if (shapeWidth > columns || shapeHeight > rows) {
      spawn();
      return;
    }
    const mappedX = Math.min(
      columns - shapeWidth,
      Math.max(0, Math.round(previousPiece.x * columns / previousColumns)),
    );
    const mappedY = Math.min(
      rows - shapeHeight,
      Math.round(previousPiece.y * rows / previousRows),
    );
    for (const x of [mappedX, mappedX - 1, mappedX + 1, mappedX - 2, mappedX + 2]) {
      if (x < 0 || x > columns - shapeWidth || collides(previousPiece.shape, x, mappedY)) continue;
      piece = { ...previousPiece, x, y: mappedY };
      return;
    }
    spawn();
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 2 || bounds.height < 2) return;
    const previousGrid = grid;
    const previousColumns = columns;
    const previousRows = rows;
    const previousPiece = piece && {
      ...piece,
      shape: piece.shape.map(([x, y]) => [x, y]),
    };
    width = bounds.width;
    height = bounds.height;
    columns = Math.ceil(width / cell);
    rows = Math.floor(height / cell);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    grid = new Uint8Array(columns * rows);
    if (phase === 'play') {
      remapGrid(previousGrid, previousColumns, previousRows);
      piece = null;
      restorePiece(previousPiece, previousColumns, previousRows);
    } else {
      piece = null;
      seed();
    }
    draw();
  }

  function spawn() {
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const shapeWidth = Math.max(...shape.map(point => point[0])) + 1;
    piece = {
      shape,
      x: Math.max(0, Math.floor(Math.random() * Math.max(1, columns - shapeWidth))),
      y: -2,
      color: 1 + Math.floor(Math.random() * palette.length),
    };
  }

  function collides(shape, x, y) {
    return shape.some(([offsetX, offsetY]) => {
      const column = x + offsetX;
      const row = y + offsetY;
      return column < 0 || column >= columns || row >= rows || (row >= 0 && grid[row * columns + column]);
    });
  }

  function merge() {
    piece.shape.forEach(([offsetX, offsetY]) => {
      const column = piece.x + offsetX;
      const row = piece.y + offsetY;
      if (row >= 0 && row < rows) grid[row * columns + column] = piece.color;
    });
    piece = null;
  }

  function clearLines() {
    for (let row = rows - 1; row >= 0; row -= 1) {
      let full = true;
      for (let column = 0; column < columns; column += 1) {
        if (!grid[row * columns + column]) {
          full = false;
          break;
        }
      }
      if (!full) continue;
      for (let target = row; target > 0; target -= 1) {
        for (let column = 0; column < columns; column += 1) {
          grid[target * columns + column] = grid[(target - 1) * columns + column];
        }
      }
      grid.fill(0, 0, columns);
      row += 1;
    }
  }

  function step() {
    if (!piece) spawn();
    if (collides(piece.shape, piece.x, piece.y + 1)) {
      merge();
      clearLines();
      spawn();
    } else piece.y += 1;
  }

  function rotate() {
    if (!piece) return;
    const maxX = Math.max(...piece.shape.map(point => point[0]));
    const rotated = piece.shape.map(([x, y]) => [maxX - y, x]);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(rotated, piece.x + kick, piece.y)) {
        piece.shape = rotated;
        piece.x += kick;
        break;
      }
    }
  }

  function move(direction) {
    if (!piece || collides(piece.shape, piece.x + direction, piece.y)) return;
    piece.x += direction;
    draw();
  }

  function hardDrop() {
    if (!piece) return;
    while (!collides(piece.shape, piece.x, piece.y + 1)) piece.y += 1;
    merge();
    clearLines();
    spawn();
    draw();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const color = grid[row * columns + column];
        if (!color) continue;
        if (phase === 'flick' && hash(column * 19.1 + row * 7.3 + flick * 17.7) < flick) continue;
        context.fillStyle = palette[color - 1];
        context.fillRect(column * cell, row * cell, cell - 1, cell - 1);
      }
    }
    if (!piece) return;
    context.fillStyle = palette[piece.color - 1];
    piece.shape.forEach(([offsetX, offsetY]) => {
      const row = piece.y + offsetY;
      if (row >= 0) context.fillRect((piece.x + offsetX) * cell, row * cell, cell - 1, cell - 1);
    });
  }

  function cancelLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    canvas.dataset.running = 'false';
  }

  function startLoop() {
    if (disposed || reducedMotion || !visible || frame) return;
    frame = requestAnimationFrame(loop);
    canvas.dataset.running = 'true';
  }

  function loop(now) {
    frame = 0;
    if (disposed || reducedMotion || !visible) {
      canvas.dataset.running = 'false';
      return;
    }
    if (phase === 'flick') {
      flick = Math.min(1, flick + .06);
      draw();
    } else if (now - lastStep > (phase === 'play' ? 260 : 520)) {
      step();
      draw();
      lastStep = now;
    }
    startLoop();
  }

  function cancelEntry() {
    entryTimers.forEach(timer => clearTimeout(timer));
    entryTimers.clear();
    if (entryFrame) cancelAnimationFrame(entryFrame);
    entryFrame = 0;
  }

  function scheduleEntry(callback, delay) {
    const timer = setTimeout(() => {
      entryTimers.delete(timer);
      callback();
    }, delay);
    entryTimers.add(timer);
  }

  function glideToFooter() {
    const start = scrollY;
    const startTime = performance.now();
    const glide = now => {
      if (disposed || suspended || phase === 'idle') {
        entryFrame = 0;
        return;
      }
      const progress = Math.min(1, (now - startTime) / 560);
      const eased = 1 - (1 - progress) ** 3;
      const target = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      scrollTo({ top: start + (target - start) * eased, behavior: 'instant' });
      if (progress < 1) entryFrame = requestAnimationFrame(glide);
      else entryFrame = 0;
    };
    entryFrame = requestAnimationFrame(glide);
  }

  function beginPlay() {
    if (disposed || suspended || phase !== 'expand') return;
    phase = 'play';
    syncToggleLabel();
    footer.classList.remove('is-tetris-opening');
    footer.classList.add('is-tetris-active');
    grid.fill(0);
    piece = null;
    resetScore();
    canvas.tabIndex = 0;
    spawn();
    draw();
    scrollTo({ top: Math.max(0, document.documentElement.scrollHeight - innerHeight), behavior: 'instant' });
    scheduleEntry(() => {
      if (phase === 'play') scrollTo({ top: Math.max(0, document.documentElement.scrollHeight - innerHeight), behavior: 'instant' });
    }, 80);
  }

  function startGame() {
    if (disposed || suspended || reducedMotion || phase !== 'idle') return;
    cancelEntry();
    ensureHud();
    setHudVisible(false);
    toggle.setAttribute('aria-pressed', 'true');
    grid.fill(0);
    piece = null;
    seed();
    flick = .001;
    phase = 'flick';
    syncToggleLabel();
    draw();
    scheduleEntry(() => {
      if (disposed || phase !== 'flick') return;
      phase = 'expand';
      footer.classList.add('is-tetris-opening');
      setHudVisible(true);
      glideToFooter();
      scheduleEntry(beginPlay, 580);
    }, 280);
  }

  function endGame({ focusToggle = true } = {}) {
    cancelEntry();
    phase = 'idle';
    syncToggleLabel();
    flick = 0;
    footer.classList.remove('is-tetris-opening', 'is-tetris-active');
    setHudVisible(false);
    toggle.setAttribute('aria-pressed', 'false');
    canvas.tabIndex = -1;
    grid.fill(0);
    piece = null;
    resetScore();
    seed();
    draw();
    if (focusToggle) toggle.focus({ preventScroll: true });
  }

  function onToggleClick() {
    startGame();
  }

  function preservesNativeKeyboard(event) {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (target.closest([
      'input',
      'select',
      'textarea',
      'summary',
      '[contenteditable]:not([contenteditable="false"])',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="option"]',
      '[role="tree"]',
      '[role="treeitem"]',
      '[role="grid"]',
      '[role="gridcell"]',
      '[role="radio"]',
      '[role="slider"]',
      '[role="spinbutton"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="textbox"]',
    ].join(','))) return true;
    if (event.key !== ' ' && event.key !== 'Enter') return false;
    return Boolean(target.closest([
      'button',
      'a[href]',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="switch"]',
    ].join(',')));
  }

  function onKeydown(event) {
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && phase !== 'idle') {
      endGame();
      event.preventDefault();
      return;
    }
    if (preservesNativeKeyboard(event)) return;
    if (phase !== 'play') return;
    if (event.key === 'ArrowLeft') move(-1);
    else if (event.key === 'ArrowRight') move(1);
    else if (event.key === 'ArrowUp') rotate();
    else if (event.key === 'ArrowDown' || event.key === ' ') hardDrop();
    else return;
    event.preventDefault();
  }

  function onLanguageChange() {
    syncToggleLabel();
    syncHudLabels();
    syncReducedMotionTitle();
  }

  const resizeObserver = new ResizeObserver(resize);

  function observeResize() {
    if (disposed || resizeObserved) return;
    resizeObserver.observe(canvas);
    resizeObserved = true;
  }

  function disconnectResize() {
    if (!resizeObserved) return;
    resizeObserver.disconnect();
    resizeObserved = false;
  }

  function observeVisibility() {
    if (disposed || reducedMotion || observingVisibility) return;
    visibilityObserver ||= new IntersectionObserver(([entry]) => {
      if (disposed || !observingVisibility) return;
      visible = entry.isIntersecting;
      if (visible) startLoop();
      else cancelLoop();
    }, { rootMargin: '120px 0px' });
    visibilityObserver.observe(canvas);
    observingVisibility = true;
  }

  function disconnectVisibility() {
    if (observingVisibility) visibilityObserver?.disconnect();
    observingVisibility = false;
    visible = false;
    cancelLoop();
  }

  function attachControls() {
    if (disposed || controlsAttached) return;
    toggle.addEventListener('click', onToggleClick);
    document.addEventListener('keydown', onKeydown);
    controlsAttached = true;
  }

  function detachControls() {
    if (!controlsAttached) return;
    toggle.removeEventListener('click', onToggleClick);
    document.removeEventListener('keydown', onKeydown);
    controlsAttached = false;
  }

  function suspend() {
    if (disposed) return;
    suspended = true;
    endGame({ focusToggle: false });
    disconnectVisibility();
    detachControls();
    disconnectResize();
  }

  function resume() {
    if (disposed) return;
    suspended = false;
    visible = false;
    observeResize();
    resize();
    if (reducedMotion) {
      canvas.dataset.running = 'false';
      return;
    }
    attachControls();
    observeVisibility();
  }

  function disableReducedMotionControls() {
    if (reducedMotionFocusTarget) reducedMotionFocusTarget.dataset.footerTetrisReducedFocus = 'true';
    toggle.disabled = true;
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-disabled', 'true');
    syncReducedMotionTitle();
    canvas.tabIndex = -1;
  }

  function enableMotionControls() {
    restoreReducedMotionFocusTarget();
    toggle.disabled = false;
    toggle.removeAttribute('aria-disabled');
    syncReducedMotionTitle();
  }

  function moveFocusToReducedMotionTarget(hadGameFocus) {
    if (!hadGameFocus || !reducedMotionFocusTarget?.isConnected) return;
    reducedMotionFocusTarget.focus({ preventScroll: true });
  }

  function gameOwnsFocus() {
    const activeElement = document.activeElement;
    return activeElement === toggle || activeElement === canvas || Boolean(hud?.contains(activeElement));
  }

  function restoreReducedMotionFocusTarget() {
    if (!reducedMotionFocusTarget || !reducedMotionFocusTargetAttributes) return;
    const { dataFocus, tabIndex } = reducedMotionFocusTargetAttributes;
    if (dataFocus === null) reducedMotionFocusTarget.removeAttribute('data-footer-tetris-reduced-focus');
    else reducedMotionFocusTarget.setAttribute('data-footer-tetris-reduced-focus', dataFocus);
    if (tabIndex === null) reducedMotionFocusTarget.removeAttribute('tabindex');
    else reducedMotionFocusTarget.setAttribute('tabindex', tabIndex);
  }

  function updateReducedMotion(nextReducedMotion) {
    if (disposed || reducedMotion === nextReducedMotion) return;
    reducedMotion = nextReducedMotion;
    if (reducedMotion) {
      const hadGameFocus = gameOwnsFocus();
      endGame({ focusToggle: false });
      disconnectVisibility();
      detachControls();
      disableReducedMotionControls();
      moveFocusToReducedMotionTarget(hadGameFocus);
      if (!suspended) observeResize();
      canvas.dataset.running = 'false';
      return;
    }
    enableMotionControls();
    if (!suspended) resume();
  }

  const onReducedMotionChange = event => updateReducedMotion(Boolean(event.matches));
  const listenForChanges = query => {
    if (query.addEventListener) query.addEventListener('change', onReducedMotionChange);
    else query.addListener?.(onReducedMotionChange);
  };
  const unlistenForChanges = query => {
    if (query.removeEventListener) query.removeEventListener('change', onReducedMotionChange);
    else query.removeListener?.(onReducedMotionChange);
  };

  function cleanup() {
    if (disposed) return;
    endGame({ focusToggle: false });
    disposed = true;
    disconnectVisibility();
    detachControls();
    disconnectResize();
    footer.classList.remove('is-tetris-opening', 'is-tetris-active');
    hud?.remove();
    hud = null;
    scoreElement = null;
    removeEventListener('pagehide', suspend);
    removeEventListener('pageshow', resume);
    document.removeEventListener('resource-archive-language-change', onLanguageChange);
    unlistenForChanges(reducedMotionQuery);
    restoreReducedMotionFocusTarget();
    if (window.__resourceArchiveFooterTetrisCleanup === cleanup) {
      delete window.__resourceArchiveFooterTetrisCleanup;
    }
  }

  if (reducedMotion) {
    disableReducedMotionControls();
  } else enableMotionControls();
  resize();
  syncToggleLabel();
  listenForChanges(reducedMotionQuery);
  document.addEventListener('resource-archive-language-change', onLanguageChange);
  addEventListener('pagehide', suspend);
  addEventListener('pageshow', resume);
  window.__resourceArchiveFooterTetrisCleanup = cleanup;
  resume();
})();
