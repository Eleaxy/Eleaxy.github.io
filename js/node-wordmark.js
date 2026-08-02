(() => {
  const CSS_CELL = 5;
  const PARTICLE_SIZE = 4;
  const MAX_DPR = 2;
  const PADDING_CELLS = 2;
  const FONT_SIZE = 28;
  const CSS_HEIGHT = 80;
  const GLYPH_WIDTH = 5;
  const GLYPH_HEIGHT = 7;
  const GLYPH_GAP = 0;
  const GLYPH_TABLE = Object.freeze({
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01110', '10000', '10000', '10111', '10001', '10001', '01110'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
    b: ['10000', '10000', '10110', '11001', '10001', '10001', '11110'],
    c: ['00000', '00000', '01111', '10000', '10000', '10000', '01111'],
    d: ['00001', '00001', '01101', '10011', '10001', '10001', '01111'],
    e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
    f: ['00110', '01001', '01000', '11100', '01000', '01000', '01000'],
    g: ['00000', '00000', '01111', '10001', '10001', '01111', '00001'],
    h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
    i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
    j: ['00010', '00000', '00110', '00010', '00010', '10010', '01100'],
    k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
    l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
    m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
    n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001'],
    o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
    p: ['00000', '00000', '11110', '10001', '10001', '11110', '10000'],
    q: ['00000', '00000', '01101', '10011', '10001', '01111', '00001'],
    r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
    s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
    t: ['01000', '01000', '11100', '01000', '01000', '01001', '00110'],
    u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
    v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
    w: ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
    x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
    y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
    z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
    6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
    '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
    '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  });

  const cappedDpr = value => Math.min(Math.max(Number(value) || 1, 1), MAX_DPR);
  const backingEdge = (cssEdge, dpr) => Math.round(cssEdge * cappedDpr(dpr));

  function fallbackResult(cssWidth) {
    return {
      mode: 'fallback',
      cssCell: CSS_CELL,
      lines: 1,
      visibleColumns: Math.max(1, Math.floor(Math.max(1, cssWidth) / CSS_CELL)),
      glyphColumns: 0,
      trackColumns: 0,
    };
  }

  function prepare({ label, cssWidth, dpr }, allowOverflow = false) {
    const visibleWidth = Math.max(1, Math.floor(Number(cssWidth) || 0));
    const visibleColumns = Math.max(1, Math.floor(visibleWidth / CSS_CELL));
    const sourceLabel = String(label ?? '');
    if (!sourceLabel || /[\u3400-\u9fff]/u.test(sourceLabel)) return fallbackResult(visibleWidth);

    const glyphs = Array.from(sourceLabel, character => GLYPH_TABLE[character]);
    if (glyphs.some(glyph => !glyph)) return fallbackResult(visibleWidth);

    const glyphColumns = glyphs.length * GLYPH_WIDTH + Math.max(0, glyphs.length - 1) * GLYPH_GAP;
    const availableColumns = visibleColumns - PADDING_CELLS * 2;
    if (!allowOverflow && glyphColumns > availableColumns) return fallbackResult(visibleWidth);

    const cells = [];
    const glyphRowOffset = Math.round((Math.floor(CSS_HEIGHT / CSS_CELL) - GLYPH_HEIGHT) / 2);
    glyphs.forEach((glyph, glyphIndex) => {
      const glyphColumnOffset = glyphIndex * (GLYPH_WIDTH + GLYPH_GAP);
      glyph.forEach((rowMask, row) => {
        Array.from(rowMask).forEach((filled, column) => {
          if (filled === '1') cells.push({ column: glyphColumnOffset + column, row: glyphRowOffset + row });
        });
      });
    });
    if (!cells.length) return fallbackResult(visibleWidth);

    return {
      mode: 'canvas',
      cssCell: CSS_CELL,
      lines: 1,
      visibleWidth,
      visibleColumns,
      glyphColumns,
      trackColumns: visibleColumns + glyphColumns - 1,
      dpr: cappedDpr(dpr),
      cells,
    };
  }

  function configureCanvas(canvas, prepared, { label, count }) {
    const { visibleWidth, dpr, glyphColumns, trackColumns } = prepared;
    const width = backingEdge(visibleWidth, dpr);
    const height = backingEdge(CSS_HEIGHT, dpr);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      canvas.width = 0;
      canvas.height = 0;
      return null;
    }
    context.imageSmoothingEnabled = false;
    canvas.style.width = `${visibleWidth}px`;
    canvas.style.height = `${CSS_HEIGHT}px`;
    canvas.style.removeProperty('transform');
    canvas.dataset.wordmarkOwner = 'resource-archive-node-wordmark';
    canvas.dataset.wordmarkCssCell = String(CSS_CELL);
    canvas.dataset.wordmarkDpr = String(dpr);
    canvas.dataset.wordmarkLabel = String(label ?? '');
    canvas.dataset.wordmarkCount = String(count ?? '');
    canvas.dataset.wordmarkFontSize = String(FONT_SIZE);
    canvas.dataset.wordmarkLineCount = '1';
    canvas.dataset.wordmarkVisibleColumns = String(prepared.visibleColumns);
    canvas.dataset.wordmarkGlyphColumns = String(glyphColumns);
    canvas.dataset.wordmarkTrackColumns = String(trackColumns);
    context.fillStyle = '#20345f';
    return { context, width, height };
  }

  function defaultOffset(prepared) {
    return prepared.glyphColumns + PADDING_CELLS - 1;
  }

  function paint(canvas, prepared, configured, offsetCells) {
    const { context, width, height } = configured;
    const { visibleWidth, dpr, glyphColumns, trackColumns } = prepared;
    const staticOffset = defaultOffset(prepared);
    const normalizedOffset = Number.isInteger(offsetCells)
      ? ((offsetCells % trackColumns) + trackColumns) % trackColumns
      : staticOffset;
    const paintedOffset = normalizedOffset + 1;
    canvas.dataset.wordmarkOffsetCells = String(normalizedOffset);
    context.clearRect(0, 0, width, height);
    prepared.cells.forEach(cell => {
      const cssX = (cell.column + paintedOffset - glyphColumns) * CSS_CELL;
      const cssY = cell.row * CSS_CELL;
      if (cssX + PARTICLE_SIZE <= 0 || cssX >= visibleWidth) return;
      const left = backingEdge(cssX, dpr);
      const top = backingEdge(cssY, dpr);
      const right = backingEdge(cssX + PARTICLE_SIZE, dpr);
      const bottom = backingEdge(cssY + PARTICLE_SIZE, dpr);
      context.fillRect(left, top, right - left, bottom - top);
    });
    return {
      mode: 'canvas',
      cssCell: CSS_CELL,
      lines: 1,
      visibleColumns: prepared.visibleColumns,
      glyphColumns,
      trackColumns,
      offsetCells: normalizedOffset,
    };
  }

  function render(options = {}) {
    const canvas = options.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) return fallbackResult(options.cssWidth);
    const prepared = prepare(options);
    if (prepared.mode === 'fallback') {
      canvas.width = 0;
      canvas.height = 0;
      return prepared;
    }
    const configured = configureCanvas(canvas, prepared, options);
    if (!configured) return fallbackResult(prepared.visibleWidth);
    return paint(canvas, prepared, configured, options.offsetCells);
  }

  function startTicker(options = {}) {
    let timer = null;
    let stopped = false;
    let offset = Number.isInteger(options.offsetCells) ? options.offsetCells : null;
    let last = null;
    const prepared = prepare(options, true);
    let configured = null;

    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      stopped = true;
    };
    const redraw = () => {
      if (stopped || !options.canvas?.isConnected) {
        stop();
        return null;
      }
      if (prepared.mode !== 'canvas') {
        options.canvas.width = 0;
        options.canvas.height = 0;
        stop();
        return prepared;
      }
      if (!configured) {
        configured = configureCanvas(options.canvas, prepared, options);
        if (!configured) {
          stop();
          return fallbackResult(prepared.visibleWidth);
        }
      }
      if (offset === null) offset = defaultOffset(prepared);
      last = paint(options.canvas, prepared, configured, offset);
      options.onRender?.(last);
      return last;
    };

    redraw();
    if (!stopped && last?.mode === 'canvas') {
      timer = window.setInterval(() => {
        if (!last?.trackColumns) return stop();
        offset = (offset + 1) % last.trackColumns;
        redraw();
      }, 90);
    }

    return {
      stop,
      reset() {
        if (stopped) return null;
        offset = null;
        return redraw();
      },
    };
  }

  function createDprWatcher(onChange) {
    let media = null;
    let listener = null;

    const unbind = () => {
      if (media && listener) {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', listener);
        } else {
          media.removeListener?.(listener);
        }
      }
      media = null;
      listener = null;
    };
    const bind = () => {
      unbind();
      if (typeof window.matchMedia !== 'function') return;
      const dpr = Number(window.devicePixelRatio) || 1;
      media = window.matchMedia(`(resolution: ${dpr}dppx)`);
      listener = () => {
        bind();
        onChange?.();
      };
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
      } else {
        media.addListener?.(listener);
      }
    };

    return Object.freeze({ bind, unbind });
  }

  window.ResourceArchiveNodeWordmark = Object.freeze({
    CSS_CELL,
    MAX_DPR,
    createDprWatcher,
    render,
    startTicker,
  });
})();
