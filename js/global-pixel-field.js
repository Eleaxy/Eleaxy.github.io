(() => {
  const controllerKey = '__resourceArchivePixelFieldController';
  const previousController = window[controllerKey];
  if (previousController?.cleanup) previousController.cleanup();
  else window.ResourceArchivePixelField?.cleanup?.();

  const hero = document.querySelector('#home');
  const mainContent = document.querySelector('main[data-main-content]');
  let heroStage = document.querySelector('[data-hero-field]');
  const canvas = document.querySelector('[data-testid="global-pixel-field"]');
  if (!canvas) return;

  const arrowTargetDiagnosticsEnabled = window.__resourceArchiveArrowTargetDiagnostics === true;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  const EMPTY_BOUNDS = Object.freeze({
    top: -100000,
    right: 0,
    bottom: -100000,
    left: 0,
    width: 0,
    height: 0,
    x: 0,
    y: -100000,
  });
  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerCapabilityQuery = matchMedia('(hover: hover) and (pointer: fine)');
  let reducedMotion = reducedMotionQuery.matches;
  let touch = !pointerCapabilityQuery.matches;
  let dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  const cell = 9;
  const brush = 10;
  const bands = [
    [0.36, '#2b416f'],
    [0.46, '#3b5bd9'],
    [0.62, '#f5c518'],
    [0.78, '#e0492a'],
  ];
  const seed = 3.91;
  const footerHeatDecay = 0.878;
  const footerReferenceFrameMs = 1000 / 60;
  const footerCellsPerMillisecond = 0.0084;
  const footerMaskText = 'RESOURCE ARCHIVE     ';
  const footerMaskSourceHeight = 20;

  let width = 1;
  let height = 1;
  let columns = 1;
  let rows = 1;
  let heat = new Float32Array(1);
  let dissolve = new Float32Array(1);
  let heartInk = new Float32Array(1);
  let footerHeat = new Float32Array(1);
  let footerActiveIndices = new Uint32Array(1);
  let footerActive = new Uint8Array(1);
  let footerActiveCount = 0;
  let pointerX = -1;
  let pointerY = -1;
  let arrowTarget = null;
  let arrowGeometry = [];
  let arrowTargetDiagnosticPresent = false;
  let arrowGeometryFrame = 0;
  let arrowGeometryFrameDelayed = false;
  let arrowGeometryRevision = 0;
  let domMapDirty = false;
  let interactionGeometry = {
    contributorCards: [],
    contributorsBounds: EMPTY_BOUNDS,
    footerBounds: EMPTY_BOUNDS,
    footerExclusions: [],
    footerSafeBounds: EMPTY_BOUNDS,
    heroBounds: EMPTY_BOUNDS,
    stageBounds: EMPTY_BOUNDS,
    touchTargets: [],
  };
  let footerDocumentGeometry = {
    safe: EMPTY_BOUNDS,
    exclusions: [],
  };
  let previousX = -1;
  let previousY = -1;
  let lastMove = -Infinity;
  let cursorZone = '';
  let pointerInHeartZone = false;
  let charging = false;
  let chargeStarted = 0;
  let chargeX = 0;
  let chargeY = 0;
  let pacmanX = -1;
  let pacmanY = -1;
  let pacmanDirection = 1;
  let pacmanAge = 0;
  let pacmanStart = 0;
  let shake = 0;
  let introStarted = performance.now();
  let filteredHeroBottom = -1;
  let frame = 0;
  let geometryRefreshPending = false;
  let staticDrawPending = false;
  let staticDrawGeneration = 0;
  let pageSuspended = false;
  let suspended = document.hidden;
  let disposed = false;
  let footerPhase = 0;
  let footerPhaseTime = 0;
  let footerHeatTime = 0;
  const waves = [];
  const heartSparks = [];
  const heartState = {
    phase: 'idle',
    enterStarted: 0,
    leavingStarted: 0,
    recoveryStarted: 0,
    recoveryDuration: 0,
    recoveryOpacity: 1,
    coreScale: 2,
    coreStrength: 1,
    coreReveal: 1,
    compositeOpacity: 1,
    exitCoreScale: 2,
    exitCoreStrength: 1,
    exitCoreReveal: 1,
    exitCompositeOpacity: 1,
    anchor: null,
  };
  let footerVisible = false;
  const suppressedRects = new Map();
  let footerStampRevision = 0;
  let footerStampedLeft = Infinity;
  let footerStampedRight = -Infinity;
  let committedMainFlowSize = { width: -1, height: -1 };

  let headings = [];
  let touchTargets = [];
  let contributorCards = [];
  let observedGeometryElements = new Set();
  let pendingInitialResizeObserverTargets = new Set();
  const observedInlineSvgRoots = new Set();

  let contributors = null;
  let footer = null;
  let footerSafe = null;
  let footerExclusionElements = [];

  const arrowTargetSelector = [
    '[data-pixel-arrow-target]',
    '#home-title',
    '.archive-statement h2',
    '.stage-preview-heading h2',
    '.node-directory-side h2',
    '.catalog-header h1',
    '.catalog-subtype h2',
    '#tutorials-title',
    '#plugins-title',
    '#contributors-title',
    '.record-detail h1',
    '.record-detail h2',
  ].join(',');
  let graphemeSegmenter = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }
  } catch {
    graphemeSegmenter = null;
  }
  const touchTargetSelector = [
    '[data-node-system]',
    '[data-node-link]',
    '[data-stage-preview]',
    '[data-stage-card]',
    '.button-primary',
    '.button-secondary',
    '.back-link',
  ].join(',');
  const footerExclusionSelector = '.footer-copy, .tetris-toggle, #footer-tetris';
  const interactionTargetSelector = [
    arrowTargetSelector,
    touchTargetSelector,
    '[data-contributor]',
    '#contributors',
    '.site-footer',
    '.footer-marquee-safe',
    footerExclusionSelector,
    '#home',
    '[data-hero-field]',
  ].join(',');
  const selectorAttributeNames = new Set([
    'class',
    'id',
    'data-pixel-arrow-target',
    'data-node-system',
    'data-node-link',
    'data-stage-preview',
    'data-stage-card',
    'data-contributor',
    'data-hero-field',
  ]);
  const selectorClassNames = new Set([
    'archive-statement',
    'stage-preview-heading',
    'node-directory-side',
    'catalog-header',
    'catalog-subtype',
    'record-detail',
    'button-primary',
    'button-secondary',
    'back-link',
    'site-footer',
    'footer-marquee-safe',
    'footer-copy',
    'tetris-toggle',
  ]);
  const selectorIds = new Set([
    'home',
    'home-title',
    'tutorials-title',
    'plugins-title',
    'contributors-title',
    'contributors',
    'footer-tetris',
  ]);
  const alphaVisibilityAttributeNames = new Set(['class', 'style', 'src', 'srcset']);
  const alphaVisibilitySelector = 'img, svg, canvas, video, iframe';
  const computedSvgStyleAttributeNames = new Set(['class', 'id', 'hidden', 'style', 'media', 'href', 'disabled']);
  const inlineSvgRootExternalStyleProperties = [
    'position',
    'inset',
    'top',
    'right',
    'bottom',
    'left',
    'inset-block',
    'inset-inline',
    'inset-block-start',
    'inset-block-end',
    'inset-inline-start',
    'inset-inline-end',
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'margin-block',
    'margin-inline',
    'margin-block-start',
    'margin-block-end',
    'margin-inline-start',
    'margin-inline-end',
    'z-index',
    'pointer-events',
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
    'box-sizing',
    'transform',
    'translate',
    'scale',
    'rotate',
    'transform-origin',
    'transform-box',
    'opacity',
  ];
  const alphaCoverInlineStyleProperties = [
    'background',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-origin',
    'background-clip',
    'opacity',
    'filter',
    'display',
    'visibility',
    'content-visibility',
    'position',
    'inset',
    'top',
    'right',
    'bottom',
    'left',
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
    'box-sizing',
    'transform',
    'translate',
    'scale',
    'rotate',
    'z-index',
    'pointer-events',
    'clip-path',
    'overflow',
    'border',
    'border-width',
    'border-color',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'object-fit',
    'object-position',
  ];
  const alphaCoverPreviousStyle = document.createElement('span').style;

  const alphaResourceCache = new Map();
  const inlineSvgSourceCache = new Map();
  const sampledImageSources = new WeakMap();
  const alphaVisibilityCandidates = new WeakSet();
  const alphaVisibilityCandidateRechecks = new Set();
  const opaqueAlphaResource = Object.freeze({ status: 'opaque' });
  let footerMask = null;
  let footerMaskBuildQueued = false;

  canvas.dataset.footerMaskKind = '';
  canvas.dataset.footerMaskWidth = '0';
  canvas.dataset.footerMaskHeight = '0';
  canvas.dataset.footerPhase = '0.0000';
  canvas.dataset.footerPaintedRowStart = '';
  canvas.dataset.footerPaintedRowEnd = '';

  canvas.dataset.motion = reducedMotion ? 'reduced' : (touch ? 'touch' : 'active');
  canvas.dataset.dpr = String(dpr);
  canvas.dataset.owner = 'global-main-stage';
  canvas.dataset.seed = String(seed);
  setHeartPhase('idle');
  canvas.dataset.heartSparks = '0';
  canvas.dataset.heartSparkRadius = '0';
  canvas.dataset.footerStampRevision = '0';

  function hash(x, y = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
    return value - Math.floor(value);
  }

  const clamp = value => Math.max(0, Math.min(1, value));

  function cubicBezierCoordinate(value, first, second) {
    const inverse = 1 - value;
    return 3 * inverse * inverse * value * first
      + 3 * inverse * value * value * second
      + value * value * value;
  }

  function strongEaseOut(value) {
    const progress = clamp(value);
    if (progress === 0 || progress === 1) return progress;
    let lower = 0;
    let upper = 1;
    let parameter = progress;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const x = cubicBezierCoordinate(parameter, .23, .32);
      if (Math.abs(x - progress) < .00001) break;
      if (x < progress) lower = parameter;
      else upper = parameter;
      parameter = (lower + upper) / 2;
    }
    return cubicBezierCoordinate(parameter, 1, 1);
  }


  function base(nx, ny, time) {
    const a = Math.sin(nx * 7.1 + ny * 2.9 + time * 0.21 + seed);
    const b = Math.cos(nx * 3.2 - ny * 8.4 - time * 0.16 - seed * 0.6);
    const c = Math.sin((nx + ny) * 8.7 + time * 0.13 + 0.9);
    return 0.46 + a * 0.16 + b * 0.14 + c * 0.08;
  }

  function region(nx, ny, time) {
    const broad = 0.5
      + Math.sin(nx * 3.1 + ny * 1.7 + time * 0.09 + seed) * 0.24
      + Math.cos(nx * 1.8 - ny * 3.8 - time * 0.07) * 0.18
      + Math.sin((nx + ny) * 2.5 + 1.4) * 0.12;
    return clamp(broad);
  }

  function rebuildDomMap() {
    headings = [...document.querySelectorAll(arrowTargetSelector)];
    touchTargets = [...document.querySelectorAll(touchTargetSelector)];
    contributorCards = [...document.querySelectorAll('[data-contributor]')];
    heroStage = document.querySelector('[data-hero-field]');
    contributors = document.querySelector('#contributors');
    footer = document.querySelector('.site-footer');
    footerSafe = document.querySelector('.footer-marquee-safe');
    footerExclusionElements = [...document.querySelectorAll(footerExclusionSelector)];
  }

  function resetFooterStampEnvelope() {
    footerStampedLeft = Infinity;
    footerStampedRight = -Infinity;
    delete canvas.dataset.footerLeft;
    delete canvas.dataset.footerRight;
  }

  function resize() {
    if (disposed) return;
    const nextWidth = Math.max(1, innerWidth);
    const nextHeight = Math.max(1, innerHeight);
    const nextDpr = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
    const sizeChanged = Math.round(nextWidth) !== Math.round(width) || Math.round(nextHeight) !== Math.round(height);
    const dprChanged = nextDpr !== dpr;
    if (!sizeChanged && !dprChanged) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    columns = Math.ceil(width / cell) + 1;
    rows = Math.ceil(height / cell) + 1;
    heat = new Float32Array(columns * rows);
    dissolve = new Float32Array(columns * rows);
    heartInk = new Float32Array(columns * rows);
    footerHeat = new Float32Array(columns * rows);
    footerActiveIndices = new Uint32Array(columns * rows);
    footerActive = new Uint8Array(columns * rows);
    footerActiveCount = 0;
    footerHeatTime = 0;
    resetFooterStampEnvelope();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.dataset.width = String(Math.round(width));
    canvas.dataset.height = String(Math.round(height));
    canvas.dataset.dpr = String(dpr);
    filteredHeroBottom = -1;
    if (reducedMotion) drawStatic();
    else requestRender();
  }

  function deposit(x, y, amount, sigma = brush) {
    const centerColumn = x / cell;
    const centerRow = y / cell;
    const radius = Math.ceil(sigma * 1.6);
    const inverse = 1 / Math.max(0.001, 2 * sigma * sigma * 0.18);
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const column = (centerColumn + offsetX) | 0;
        const row = (centerRow + offsetY) | 0;
        if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
        const dx = column + 0.5 - centerColumn;
        const dy = row + 0.5 - centerRow;
        const weight = Math.exp(-(dx * dx + dy * dy) * inverse);
        if (weight < 0.02) continue;
        const index = row * columns + column;
        heat[index] = Math.min(1, heat[index] + amount * weight);
      }
    }
  }

  function follow(x, y, radius = brush) {
    if (previousX < 0) {
      previousX = x;
      previousY = y;
    }
    const dx = x - previousX;
    const dy = y - previousY;
    const steps = Math.max(1, Math.min(48, Math.round(Math.hypot(dx, dy) / (cell * 0.8))));
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      deposit(previousX + dx * progress, previousY + dy * progress, 0.16, radius);
    }
    previousX = x;
    previousY = y;
  }

  function boundsSpanViewport(bounds, viewportY) {
    return bounds.width > 1 && bounds.top <= viewportY && bounds.bottom >= viewportY;
  }

  function zoneAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return '';
    if (element.closest('#contributors')) return 'heart';
    if (element.closest('.site-footer')) return 'footer';
    return '';
  }

  function pointerIsOnContributorCard(x, y) {
    return Boolean(document.elementFromPoint(x, y)?.closest('[data-contributor]'));
  }

  function isVisuallyPresent(element) {
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      const opacity = Number.parseFloat(style.opacity);
      if (style.display === 'none' || style.visibility !== 'visible' || style.contentVisibility === 'hidden'
        || (Number.isFinite(opacity) && opacity <= 0.001)) return false;
    }
    return true;
  }

  function textGraphemes(text) {
    if (graphemeSegmenter) {
      return Array.from(
        graphemeSegmenter.segment(text),
        ({ index, segment }) => ({ start: index, end: index + segment.length, segment }),
      );
    }
    const graphemes = [];
    let offset = 0;
    for (const segment of text) {
      const start = offset;
      offset += segment.length;
      graphemes.push({ start, end: offset, segment });
    }
    return graphemes;
  }

  function textGlyphRects(element) {
    if (!isVisuallyPresent(element)) return [];
    const glyphRects = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
      const text = textNode.textContent;
      if (!text?.trim() || !isVisuallyPresent(textNode.parentElement)) continue;
      for (const grapheme of textGraphemes(text)) {
        if (!/\S/u.test(grapheme.segment)) continue;
        const range = document.createRange();
        range.setStart(textNode, grapheme.start);
        range.setEnd(textNode, grapheme.end);
        for (const bounds of range.getClientRects()) {
          if (bounds.width <= 1 || bounds.height <= 1 || bounds.right <= 0 || bounds.left >= width
            || bounds.bottom <= 0 || bounds.top >= height) continue;
          glyphRects.push({
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
            width: bounds.width,
            height: bounds.height,
          });
        }
      }
    }
    return glyphRects;
  }

  function colorAlpha(color) {
    if (!color || color === 'transparent') return 0;
    const hex = color.match(/^#([\da-f]{4}|[\da-f]{8})$/i);
    if (hex) {
      const alpha = hex[1].length === 4 ? hex[1].slice(3).repeat(2) : hex[1].slice(6);
      return Number.parseInt(alpha, 16) / 255;
    }
    const functional = color.match(/^(?:rgba?|hsla?)\((.*)\)$/i);
    if (!functional) return 1;
    const body = functional[1];
    if (body.includes('/')) {
      const alphaValue = body.split('/').pop().trim();
      const alpha = Number.parseFloat(alphaValue);
      return Number.isFinite(alpha) ? alpha / (alphaValue.endsWith('%') ? 100 : 1) : 1;
    }
    const parts = body.split(',').map(part => part.trim());
    if (parts.length < 4) return 1;
    const alpha = Number.parseFloat(parts[3]);
    return Number.isFinite(alpha) ? alpha / (parts[3].endsWith('%') ? 100 : 1) : 1;
  }

  function splitBackgroundLayers(backgroundImage) {
    const layers = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < backgroundImage.length; index += 1) {
      const character = backgroundImage[index];
      if (character === '(') depth += 1;
      else if (character === ')') depth = Math.max(0, depth - 1);
      else if (character === ',' && depth === 0) {
        layers.push(backgroundImage.slice(start, index).trim());
        start = index + 1;
      }
    }
    layers.push(backgroundImage.slice(start).trim());
    return layers;
  }

  function simpleVerticalRgbaGradientAlphas(layer) {
    const simpleGradient = layer.match(
      /^linear-gradient\(\s*(rgba\([^()]*\))\s*,\s*(rgba\([^()]*\))\s*\)$/i,
    );
    if (!simpleGradient) return null;
    const simpleRgba = /^rgba\(\s*(?:\d+(?:\.\d+)?|\.\d+)\s*,\s*(?:\d+(?:\.\d+)?|\.\d+)\s*,\s*(?:\d+(?:\.\d+)?|\.\d+)\s*,\s*(?:\d+(?:\.\d+)?|\.\d+)%?\s*\)$/i;
    if (!simpleGradient.slice(1).every(color => simpleRgba.test(color))) return null;
    return simpleGradient.slice(1).map(colorAlpha);
  }

  function supportsSimpleGradientPlacement(style) {
    return style.backgroundOrigin === 'padding-box'
      && style.backgroundClip === 'border-box'
      && style.backgroundPosition === '0% 0%'
      && style.backgroundSize === 'auto'
      && style.backgroundRepeat === 'repeat'
      && style.backgroundAttachment === 'scroll';
  }

  function sampleableImageSource(source) {
    if (!source) return '';
    try {
      const url = new URL(source, document.baseURI);
      if (url.protocol === 'data:') return url.href;
      if (url.origin === location.origin && ['http:', 'https:'].includes(url.protocol)) return url.href;
      if (url.protocol === 'file:' && location.protocol === 'file:') return url.href;
    } catch {
      return '';
    }
    return '';
  }

  function captureAlphaResource(record, image) {
    const sourceWidth = Number(image.naturalWidth || image.videoWidth || 0);
    const sourceHeight = Number(image.naturalHeight || image.videoHeight || 0);
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      record.status = 'opaque';
      return;
    }
    const ratio = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
    const maskWidth = Math.max(1, Math.round(sourceWidth * ratio));
    const maskHeight = Math.max(1, Math.round(sourceHeight * ratio));
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskContext) {
      record.status = 'opaque';
      return;
    }
    try {
      maskContext.clearRect(0, 0, maskWidth, maskHeight);
      maskContext.drawImage(image, 0, 0, maskWidth, maskHeight);
      const pixels = maskContext.getImageData(0, 0, maskWidth, maskHeight).data;
      const alpha = new Uint8ClampedArray(maskWidth * maskHeight);
      for (let index = 0; index < alpha.length; index += 1) alpha[index] = pixels[index * 4 + 3];
      Object.assign(record, {
        status: 'ready',
        sourceWidth,
        sourceHeight,
        width: maskWidth,
        height: maskHeight,
        alpha,
      });
    } catch {
      record.status = 'opaque';
    }
  }

  function settleAlphaResource(record, image) {
    image.onload = null;
    image.onerror = null;
    record.loader = null;
    captureAlphaResource(record, image);
    if (!disposed && alphaResourceCache.get(record.source) === record) scheduleArrowGeometryRefresh();
  }

  function alphaResourceFor(source, decodedImage = null) {
    const normalizedSource = sampleableImageSource(source);
    if (!normalizedSource) return opaqueAlphaResource;
    const cached = alphaResourceCache.get(normalizedSource);
    if (cached) return cached;
    const record = { status: 'loading', source: normalizedSource, loader: null };
    alphaResourceCache.set(normalizedSource, record);
    const decodedSource = sampleableImageSource(decodedImage?.currentSrc || decodedImage?.src);
    if (decodedImage?.complete && decodedImage.naturalWidth > 0 && decodedSource === normalizedSource) {
      captureAlphaResource(record, decodedImage);
      return record;
    }
    const loader = new Image();
    record.loader = loader;
    loader.decoding = 'async';
    loader.onload = () => settleAlphaResource(record, loader);
    loader.onerror = () => {
      loader.onload = null;
      loader.onerror = null;
      record.loader = null;
      record.status = 'opaque';
      if (!disposed && alphaResourceCache.get(record.source) === record) scheduleArrowGeometryRefresh();
    };
    loader.src = normalizedSource;
    return record;
  }

  function resourcePaintsOpaqueAt(resource, u, v, opacity) {
    if (resource.status !== 'ready') return true;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const column = Math.min(resource.width - 1, Math.max(0, Math.floor(u * resource.width)));
    const row = Math.min(resource.height - 1, Math.max(0, Math.floor(v * resource.height)));
    return resource.alpha[row * resource.width + column] / 255 * opacity >= .99;
  }

  function numericStyle(style, property) {
    return Number.parseFloat(style[property]) || 0;
  }

  function insetBox(bounds, top, right, bottom, left) {
    return {
      top: bounds.top + top,
      right: bounds.right - right,
      bottom: bounds.bottom - bottom,
      left: bounds.left + left,
      width: Math.max(0, bounds.width - left - right),
      height: Math.max(0, bounds.height - top - bottom),
    };
  }

  function elementContentBox(element, style) {
    const bounds = element.getBoundingClientRect();
    return insetBox(
      bounds,
      numericStyle(style, 'borderTopWidth') + numericStyle(style, 'paddingTop'),
      numericStyle(style, 'borderRightWidth') + numericStyle(style, 'paddingRight'),
      numericStyle(style, 'borderBottomWidth') + numericStyle(style, 'paddingBottom'),
      numericStyle(style, 'borderLeftWidth') + numericStyle(style, 'paddingLeft'),
    );
  }

  function positionComponent(value, freeSpace) {
    const token = (value || '50%').toLowerCase();
    if (token === 'center') return freeSpace / 2;
    if (token === 'left' || token === 'top') return 0;
    if (token === 'right' || token === 'bottom') return freeSpace;
    if (token.endsWith('%')) return freeSpace * (Number.parseFloat(token) || 0) / 100;
    if (token.endsWith('px')) return Number.parseFloat(token) || 0;
    return freeSpace / 2;
  }

  function positionedOffset(value, freeWidth, freeHeight) {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    let horizontal = tokens[0] || '50%';
    let vertical = tokens[1] || '50%';
    if (tokens.length === 1 && ['top', 'bottom'].includes(horizontal.toLowerCase())) {
      vertical = horizontal;
      horizontal = '50%';
    } else if (['top', 'bottom'].includes(horizontal.toLowerCase())
      || ['left', 'right'].includes(vertical.toLowerCase())) {
      [horizontal, vertical] = [vertical, horizontal];
    }
    return {
      x: positionComponent(horizontal, freeWidth),
      y: positionComponent(vertical, freeHeight),
    };
  }

  function supportsObjectPosition(value) {
    return value.trim().split(/\s+/).filter(Boolean).length <= 2;
  }

  function backgroundImagePaintsOpaqueAt(element, style, x, y, opacity) {
    if (!style.backgroundImage || style.backgroundImage === 'none') return false;
    const layers = splitBackgroundLayers(style.backgroundImage);
    if (layers.length !== 1) return true;
    const [layer] = layers;
    if (/gradient\(/i.test(layer)) {
      const alphas = simpleVerticalRgbaGradientAlphas(layer);
      if (!alphas || !supportsSimpleGradientPlacement(style)) return true;
      const bounds = element.getBoundingClientRect();
      const top = bounds.top + numericStyle(style, 'borderTopWidth');
      const bottom = bounds.bottom - numericStyle(style, 'borderBottomWidth');
      if (bottom <= top) return true;
      const vertical = clamp((y - top) / (bottom - top));
      const alpha = alphas[0] + (alphas[1] - alphas[0]) * vertical;
      return alpha * opacity >= .99;
    }
    // CSS image placement has many browser-specific corner cases. The field only
    // permits a proven-transparent gradient to reveal text; every URL or unknown
    // image form remains an opaque visual cover.
    return true;
  }

  function effectiveOpacity(element) {
    let opacity = 1;
    for (let current = element; current; current = current.parentElement) {
      const value = Number.parseFloat(getComputedStyle(current).opacity);
      if (Number.isFinite(value)) opacity *= value;
    }
    return opacity;
  }

  function replacedImagePoint(element, style, resource, x, y) {
    const area = elementContentBox(element, style);
    if (area.width <= 0 || area.height <= 0) return null;
    const fit = style.objectFit || 'fill';
    const containRatio = Math.min(area.width / resource.sourceWidth, area.height / resource.sourceHeight);
    const coverRatio = Math.max(area.width / resource.sourceWidth, area.height / resource.sourceHeight);
    let renderedWidth = area.width;
    let renderedHeight = area.height;
    if (fit === 'contain' || fit === 'cover') {
      const ratio = fit === 'cover' ? coverRatio : containRatio;
      renderedWidth = resource.sourceWidth * ratio;
      renderedHeight = resource.sourceHeight * ratio;
    } else if (fit === 'none') {
      renderedWidth = resource.sourceWidth;
      renderedHeight = resource.sourceHeight;
    } else if (fit === 'scale-down') {
      const ratio = Math.min(1, containRatio);
      renderedWidth = resource.sourceWidth * ratio;
      renderedHeight = resource.sourceHeight * ratio;
    }
    const offset = positionedOffset(
      style.objectPosition || '50% 50%',
      area.width - renderedWidth,
      area.height - renderedHeight,
    );
    const localX = x - area.left - offset.x;
    const localY = y - area.top - offset.y;
    if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) return null;
    return { u: localX / renderedWidth, v: localY / renderedHeight };
  }

  function imagePaintsOpaqueAt(element, style, x, y, opacity) {
    if (!supportsObjectPosition(style.objectPosition || '50% 50%')) return true;
    const source = element.currentSrc || element.src;
    const normalizedSource = sampleableImageSource(source);
    if (normalizedSource) sampledImageSources.set(element, normalizedSource);
    else sampledImageSources.delete(element);
    const resource = alphaResourceFor(source, element);
    if (resource.status !== 'ready') return true;
    const point = replacedImagePoint(element, style, resource, x, y);
    return Boolean(point && resourcePaintsOpaqueAt(resource, point.u, point.v, opacity));
  }

  function canvasPaintsOpaqueAt(element, x, y, opacity) {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || element.width <= 0 || element.height <= 0) return false;
    const sourceX = Math.min(element.width - 1, Math.max(0, Math.floor((x - bounds.left) / bounds.width * element.width)));
    const sourceY = Math.min(element.height - 1, Math.max(0, Math.floor((y - bounds.top) / bounds.height * element.height)));
    try {
      const canvasContext = element.getContext('2d', { willReadFrequently: true });
      if (!canvasContext) return true;
      return canvasContext.getImageData(sourceX, sourceY, 1, 1).data[3] / 255 * opacity >= .99;
    } catch {
      return true;
    }
  }

  function inlineSvgRootTransformMapsToBounds(style) {
    if ((style.rotate || 'none') !== 'none' || (style.scale || 'none') !== 'none') return false;
    if (style.transform === 'none') return true;
    const match = /^matrix\(([^)]+)\)$/.exec(style.transform);
    if (!match) return false;
    const values = match[1].split(',').map(value => Number.parseFloat(value.trim()));
    if (values.length !== 6 || values.some(value => !Number.isFinite(value))) return false;
    const [a, b, c, d] = values;
    return Math.abs(a - 1) < .000001 && Math.abs(b) < .000001
      && Math.abs(c) < .000001 && Math.abs(d - 1) < .000001;
  }

  function copyComputedSvgStyles(sourceRoot, cloneRoot) {
    const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
    const cloneElements = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
    if (sourceElements.length !== cloneElements.length) throw new Error('SVG clone shape changed');
    for (let index = 0; index < sourceElements.length; index += 1) {
      const computed = getComputedStyle(sourceElements[index]);
      const cloneStyle = cloneElements[index].style;
      for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
        const property = computed[propertyIndex];
        cloneStyle.setProperty(property, computed.getPropertyValue(property));
      }
    }
  }

  function inlineSvgSnapshotSource(root, bounds) {
    const rootStyle = getComputedStyle(root);
    if (!inlineSvgRootTransformMapsToBounds(rootStyle)) return '';
    const sourceRoot = root.cloneNode(true);
    copyComputedSvgStyles(root, sourceRoot);
    for (const property of inlineSvgRootExternalStyleProperties) sourceRoot.style.removeProperty(property);
    sourceRoot.removeAttribute('transform');
    sourceRoot.removeAttribute('opacity');
    sourceRoot.setAttribute('width', String(bounds.width));
    sourceRoot.setAttribute('height', String(bounds.height));
    return new XMLSerializer().serializeToString(sourceRoot);
  }

  function inlineSvgHasUncancelledAnimation(root) {
    try {
      if (typeof root.getAnimations !== 'function') return true;
      return root.getAnimations({ subtree: true }).length > 0;
    } catch {
      return true;
    }
  }

  function inlineSvgPaintsOpaqueAt(element, x, y) {
    const root = element.tagName === 'svg' ? element : element.ownerSVGElement;
    if (!root) return true;
    const bounds = root.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    if (inlineSvgHasUncancelledAnimation(root)) return true;
    let cached = inlineSvgSourceCache.get(root);
    try {
      if (!cached || cached.width !== bounds.width || cached.height !== bounds.height) {
        if (cached) invalidateInlineSvgResource(root);
        const snapshotSource = inlineSvgSnapshotSource(root, bounds);
        if (!snapshotSource) return true;
        const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSource)}`;
        cached = {
          height: bounds.height,
          resource: alphaResourceFor(source),
          width: bounds.width,
        };
        inlineSvgSourceCache.set(root, cached);
      }
    } catch {
      return true;
    }
    return resourcePaintsOpaqueAt(
      cached.resource,
      (x - bounds.left) / bounds.width,
      (y - bounds.top) / bounds.height,
      effectiveOpacity(root),
    );
  }

  function hasOpaqueBorderAt(element, style, x, y, opacity) {
    const bounds = element.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return false;
    const borders = [
      ['Top', y - bounds.top],
      ['Right', bounds.right - x],
      ['Bottom', bounds.bottom - y],
      ['Left', x - bounds.left],
    ];
    return borders.some(([side, distance]) => {
      const borderWidth = Number.parseFloat(style[`border${side}Width`]) || 0;
      return distance <= borderWidth && colorAlpha(style[`border${side}Color`]) * opacity >= 0.99;
    });
  }

  function elementPaintsOpaqueAt(element, x, y) {
    if (!isVisuallyPresent(element)) return false;
    const opacity = effectiveOpacity(element);
    if (opacity < 0.99) return false;
    const style = getComputedStyle(element);
    if (colorAlpha(style.backgroundColor) * opacity >= 0.99
      || backgroundImagePaintsOpaqueAt(element, style, x, y, opacity)) return true;
    if (hasOpaqueBorderAt(element, style, x, y, opacity)) return true;
    if (element.tagName === 'IMG') return imagePaintsOpaqueAt(element, style, x, y, opacity);
    if (element.tagName === 'CANVAS') return canvasPaintsOpaqueAt(element, x, y, opacity);
    if (element instanceof SVGElement) return inlineSvgPaintsOpaqueAt(element, x, y);
    if (['IFRAME', 'VIDEO'].includes(element.tagName)) return true;
    if (element.matches?.(arrowTargetSelector) && colorAlpha(style.color) * opacity >= .99) {
      return textGlyphRects(element).some(bounds => (
        x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
      ));
    }
    for (const pseudo of ['::before', '::after']) {
      const pseudoStyle = getComputedStyle(element, pseudo);
      if (pseudoStyle.content === 'none' || pseudoStyle.content === 'normal') continue;
      const pseudoOpacity = Number.parseFloat(pseudoStyle.opacity);
      const compositeOpacity = opacity * (Number.isFinite(pseudoOpacity) ? pseudoOpacity : 1);
      if (pseudoStyle.display === 'none' || ['hidden', 'collapse'].includes(pseudoStyle.visibility)
        || pseudoStyle.contentVisibility === 'hidden' || compositeOpacity < .99) continue;
      if (colorAlpha(pseudoStyle.backgroundColor) * compositeOpacity >= 0.99
        || (pseudoStyle.backgroundImage && pseudoStyle.backgroundImage !== 'none')) return true;
    }
    return false;
  }

  function targetVisibleAtPoint(element, x, y) {
    const stack = document.elementsFromPoint(x, y);
    const targetIndex = stack.findIndex(candidate => candidate === element || element.contains(candidate));
    if (targetIndex < 0) return false;
    for (let index = 0; index < targetIndex; index += 1) {
      const candidate = stack[index];
      if (candidate === element || element.contains(candidate)) continue;
      if (elementPaintsOpaqueAt(candidate, x, y)) return false;
    }
    return true;
  }

  function directlyHitsTarget(element, x, y) {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && (hit === element || element.contains(hit)));
  }

  function visibleGlyphRegions(element, bounds) {
    const left = Math.max(0, bounds.left);
    const right = Math.min(width, bounds.right);
    const top = Math.max(0, bounds.top);
    const bottom = Math.min(height, bounds.bottom);
    if (right - left <= 1 || bottom - top <= 1) return [];
    const columnCount = Math.max(1, Math.min(9, Math.ceil((right - left) / 24)));
    const rowCount = 2;
    const regionWidth = (right - left) / columnCount;
    const regionHeight = (bottom - top) / rowCount;
    const regions = [];
    for (let column = 0; column < columnCount; column += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const region = {
          left: left + regionWidth * column,
          right: left + regionWidth * (column + 1),
          top: top + regionHeight * row,
          bottom: top + regionHeight * (row + 1),
        };
        region.x = region.left + regionWidth / 2;
        region.y = region.top + regionHeight / 2;
        if (targetVisibleAtPoint(element, region.x, region.y)) regions.push(region);
      }
    }
    return regions;
  }

  function snapshotBounds(element) {
    if (!element) return EMPTY_BOUNDS;
    const bounds = element.getBoundingClientRect();
    return {
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
    };
  }

  function snapshotFooterDocumentBounds(element, expansion = 0) {
    const bounds = snapshotBounds(element);
    return {
      top: bounds.top + scrollY - expansion,
      right: bounds.right + scrollX + expansion,
      bottom: bounds.bottom + scrollY + expansion,
      left: bounds.left + scrollX - expansion,
      width: bounds.width + expansion * 2,
      height: bounds.height + expansion * 2,
      x: bounds.x + scrollX - expansion,
      y: bounds.y + scrollY - expansion,
    };
  }

  function projectFooterDocumentBounds(bounds) {
    return {
      top: bounds.top - scrollY,
      right: bounds.right - scrollX,
      bottom: bounds.bottom - scrollY,
      left: bounds.left - scrollX,
      width: bounds.width,
      height: bounds.height,
      x: bounds.x - scrollX,
      y: bounds.y - scrollY,
    };
  }

  function cacheFooterDocumentGeometry() {
    const currentFooterSafe = document.querySelector('.footer-marquee-safe');
    const currentFooterExclusions = [...document.querySelectorAll(footerExclusionSelector)];
    footerDocumentGeometry = {
      safe: snapshotFooterDocumentBounds(currentFooterSafe),
      exclusions: currentFooterExclusions.map(element => snapshotFooterDocumentBounds(element, cell)),
    };
  }

  function footerViewportGeometry() {
    return {
      safe: projectFooterDocumentBounds(footerDocumentGeometry.safe),
      exclusions: footerDocumentGeometry.exclusions.map(projectFooterDocumentBounds),
    };
  }

  function boundsChanged(current, committed) {
    return Math.abs(current.top - committed.top) > .01
      || Math.abs(current.right - committed.right) > .01
      || Math.abs(current.bottom - committed.bottom) > .01
      || Math.abs(current.left - committed.left) > .01
      || Math.abs(current.width - committed.width) > .01
      || Math.abs(current.height - committed.height) > .01;
  }

  function refreshArrowGeometry(options) {
    const renderAfter = !options || typeof options !== 'object' || options.renderAfter !== false;
    arrowGeometryFrame = 0;
    arrowGeometryFrameDelayed = false;
    if (disposed || suspended || document.hidden) return;
    if (domMapDirty) {
      rebuildDomMap();
      syncResizeObserverTargets();
      syncFooterVisibilityObserver();
      domMapDirty = false;
    }
    const mainBounds = snapshotBounds(mainContent);
    interactionGeometry = {
      contributorCards: contributorCards.map(element => ({ element, bounds: snapshotBounds(element) })),
      contributorsBounds: snapshotBounds(contributors),
      footerBounds: snapshotBounds(footer),
      footerExclusions: footerExclusionElements.map(snapshotBounds),
      footerSafeBounds: snapshotBounds(footerSafe),
      heroBounds: snapshotBounds(hero),
      stageBounds: snapshotBounds(heroStage),
      touchTargets: (touch ? touchTargets : []).map(element => ({ element, bounds: snapshotBounds(element) })),
    };
    cacheFooterDocumentGeometry();
    committedMainFlowSize = { width: mainBounds.width, height: mainBounds.height };
    arrowGeometry = headings.map((element, order) => {
      const bounds = snapshotBounds(element);
      const visibleBounds = {
        left: Math.max(0, bounds.left),
        right: Math.min(width, bounds.right),
        top: Math.max(0, bounds.top),
        bottom: Math.min(height, bounds.bottom),
      };
      visibleBounds.width = Math.max(0, visibleBounds.right - visibleBounds.left);
      visibleBounds.height = Math.max(0, visibleBounds.bottom - visibleBounds.top);
      return {
        element,
        order,
        bounds: visibleBounds,
        regions: textGlyphRects(element).flatMap(region => visibleGlyphRegions(element, region)),
      };
    }).filter(target => target.bounds.width > 1 && target.bounds.height > 1 && target.regions.length);
    for (const element of alphaVisibilityCandidateRechecks) {
      if (!element.isConnected || !elementHasActiveAlphaCover(element)) alphaVisibilityCandidates.delete(element);
    }
    alphaVisibilityCandidateRechecks.clear();
    arrowGeometryRevision += 1;
    canvas.dataset.arrowGeometryRevision = String(arrowGeometryRevision);
    geometryRefreshPending = false;
    if (!touch && !reducedMotion && pointerX >= 0) {
      cursorZone = zoneAtPoint(pointerX, pointerY);
      pointerInHeartZone = cursorZone === 'heart';
      arrowTarget = pointerIsOnContributorCard(pointerX, pointerY) ? null : nearHeading(pointerX, pointerY);
      pacmanX = -1;
    }
    if (!renderAfter) return;
    if (reducedMotion) drawStatic();
    else requestRender();
  }

  function scheduleArrowGeometryRefresh({ rebuildMap = false, afterResize = false } = {}) {
    if (disposed || suspended || document.hidden) return;
    geometryRefreshPending = true;
    if (rebuildMap) domMapDirty = true;
    if (reducedMotion) {
      drawStatic();
      return;
    }
    if (arrowGeometryFrame) {
      if (!afterResize && arrowGeometryFrameDelayed) {
        cancelAnimationFrame(arrowGeometryFrame);
        arrowGeometryFrame = requestAnimationFrame(refreshArrowGeometry);
        arrowGeometryFrameDelayed = false;
      }
      return;
    }
    arrowGeometryFrameDelayed = afterResize;
    if (!afterResize) {
      arrowGeometryFrame = requestAnimationFrame(refreshArrowGeometry);
      return;
    }
    arrowGeometryFrame = requestAnimationFrame(() => {
      if (disposed || suspended || document.hidden) {
        arrowGeometryFrame = 0;
        arrowGeometryFrameDelayed = false;
        return;
      }
      arrowGeometryFrame = requestAnimationFrame(refreshArrowGeometry);
    });
  }

  function targetForRegion(element, region, x = region.x, y = region.y) {
    return {
      x: Math.max(region.left, Math.min(region.right, x)),
      y: Math.max(region.top, Math.min(region.bottom, y)),
      element,
    };
  }

  function nearestVisibleTargetPoint(target, x, y) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const region of target.regions) {
      const candidate = targetForRegion(target.element, region, x, y);
      const distance = Math.hypot(x - candidate.x, y - candidate.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { ...candidate, target, distance };
      }
    }
    return nearest;
  }

  function nearHeading(x, y) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const target of arrowGeometry) {
      const candidate = nearestVisibleTargetPoint(target, x, y);
      if (!candidate) continue;
      const { distance } = candidate;
      const sameDistance = Math.abs(distance - nearestDistance) < .0001;
      if (distance > 150 || (distance > nearestDistance && !sameDistance)
        || (sameDistance && nearest && target.order > nearest.order)) continue;
      nearestDistance = distance;
      nearest = candidate;
    }
    return nearest;
  }

  function visibleTouchHeading() {
    for (const target of arrowGeometry) {
      const top = Math.min(...target.regions.map(bounds => bounds.top));
      const bottom = Math.max(...target.regions.map(bounds => bounds.bottom));
      const left = Math.min(...target.regions.map(bounds => bounds.left));
      const right = Math.max(...target.regions.map(bounds => bounds.right));
      const centerY = top + (bottom - top) / 2;
      if (centerY > height * 0.30 && centerY < height * 0.64) {
        return { x: left + (right - left) / 2, y: centerY, element: target.element };
      }
    }
    return null;
  }

  function nearestTouchTarget(viewportY) {
    let best = null;
    let distance = Infinity;
    for (const target of interactionGeometry.touchTargets) {
      const bounds = target.bounds;
      if (bounds.width < 2 || bounds.height < 2 || bounds.bottom < 0 || bounds.top > height) continue;
      const centerY = bounds.top + bounds.height / 2;
      const delta = Math.abs(centerY - viewportY);
      if (delta < distance) {
        distance = delta;
        best = { x: bounds.left + bounds.width / 2, y: centerY };
      }
    }
    return distance < height * 0.46 ? best : null;
  }

  function pointArrow(x, y, target, now) {
    const angle = Math.atan2(target.y - y, target.x - x);
    const length = brush * 8.5;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const pulse = (now * 0.0009) % 1;
    for (let distance = 0; distance <= length; distance += cell * 0.45) {
      const progress = distance / length;
      const highlight = Math.exp(-Math.pow((progress - pulse) * 3, 2));
      deposit(x + ux * distance, y + uy * distance, 0.52 + highlight * 0.42, 0.95);
    }
    const tipX = x + ux * length;
    const tipY = y + uy * length;
    for (const side of [-1, 1]) {
      const barbAngle = angle + Math.PI + side * 0.62;
      for (let distance = 0; distance <= brush * 3.4; distance += cell * 0.45) {
        deposit(tipX + Math.cos(barbAngle) * distance, tipY + Math.sin(barbAngle) * distance, 0.72, 0.95);
      }
    }
  }

  function heartAnchor(x, y) {
    const leftRadius = cell * 8;
    const rightRadius = cell * 8;
    const topRadius = cell * 5.6;
    const bottomRadius = cell * 8.4;
    return {
      x: Math.max(leftRadius, Math.min(width - rightRadius, x)),
      y: Math.max(topRadius, Math.min(height - bottomRadius, y)),
    };
  }

  function resetPacman(x, y) {
    pacmanX = x;
    pacmanY = y;
    pacmanDirection = x < width / 2 ? 1 : -1;
    pacmanStart = x;
    pacmanAge = 0;
  }

  function wander(x, y) {
    const radius = brush * 3.4;
    if (pacmanX < 0) resetPacman(x, y);
    pacmanX += pacmanDirection * 2.6;
    if (pacmanX > width + radius || pacmanX < -radius) {
      pacmanDirection = Math.random() < 0.5 ? -1 : 1;
      pacmanX = pacmanDirection > 0 ? -radius : width + radius;
      pacmanY = radius + Math.random() * Math.max(1, height - radius * 2);
      pacmanStart = pacmanX;
    }
    pacmanAge += 1;
    const mouth = 0.05 + 0.6 * Math.abs(Math.sin(pacmanAge * 0.16));
    const facing = pacmanDirection > 0 ? 0 : Math.PI;
    for (let row = Math.floor((pacmanY - radius) / cell); row <= Math.ceil((pacmanY + radius) / cell); row += 1) {
      for (let column = Math.floor((pacmanX - radius) / cell); column <= Math.ceil((pacmanX + radius) / cell); column += 1) {
        if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
        const dx = (column + 0.5) * cell - pacmanX;
        const dy = (row + 0.5) * cell - pacmanY;
        if (dx * dx + dy * dy > radius * radius) continue;
        const delta = Math.abs((((Math.atan2(dy, dx) - facing) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (delta >= mouth) heat[row * columns + column] = Math.max(heat[row * columns + column], 0.72);
      }
    }
    for (let index = 1; index <= 80; index += 1) {
      const foodX = pacmanStart + pacmanDirection * brush * 3.4 * index;
      if ((pacmanDirection > 0 && foodX <= pacmanX + radius)
        || (pacmanDirection < 0 && foodX >= pacmanX - radius)) continue;
      if (foodX < 0 || foodX > width) continue;
      const column = Math.round(foodX / cell);
      const row = Math.round(pacmanY / cell);
      if (column >= 0 && row >= 0 && column < columns && row < rows) {
        heat[row * columns + column] = Math.max(heat[row * columns + column], 0.72);
      }
    }
  }

  const heartShape = [
    '01100110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000',
  ];
  let canonicalHeartCellCapacity = 0;
  for (let row = 0; row < heartShape.length; row += 1) {
    for (let column = 0; column < heartShape[row].length; column += 1) {
      if (heartShape[row][column] === '1') canonicalHeartCellCapacity += 4;
    }
  }
  // Weighted occupied-cell center: each mask cell contributes from its rendered cell center.
  const heartVisualCenter = { x: 4, y: 3.1 };
  const settledHeartBase = .86;
  const settledHeartAmplitude = .11;
  const settledHeartSpatialPhase = .6;
  const settledHeartSpeed = .006;

  function setHeartPhase(phase) {
    heartState.phase = phase;
    canvas.dataset.heartPhase = phase;
  }

  function stampHeart(x, y, scale = 2, strength = 1, reveal = 1, waveTime = null) {
    const logical = cell * Math.max(.5, scale);
    const originX = x - heartVisualCenter.x * logical;
    const originY = y - heartVisualCenter.y * logical;
    const firstColumn = Math.floor(originX / cell);
    const lastColumn = Math.ceil((originX + heartShape[0].length * logical) / cell) - 1;
    const firstRow = Math.floor(originY / cell);
    const lastRow = Math.ceil((originY + heartShape.length * logical) / cell) - 1;
    let cells = 0;
    let capacity = 0;
    for (let gridRow = firstRow; gridRow <= lastRow; gridRow += 1) {
      for (let gridColumn = firstColumn; gridColumn <= lastColumn; gridColumn += 1) {
        if (gridColumn < 0 || gridRow < 0 || gridColumn >= columns || gridRow >= rows) continue;
        const shapeColumn = Math.floor(((gridColumn + .5) * cell - originX) / logical);
        const shapeRow = Math.floor(((gridRow + .5) * cell - originY) / logical);
        if (heartShape[shapeRow]?.[shapeColumn] !== '1') continue;
        capacity += 1;
        if (hash(gridColumn * 1.73 + 19, gridRow * 1.37 + 7) > reveal) continue;
        cells += 1;
        const value = Number.isFinite(waveTime)
          ? (settledHeartBase + settledHeartAmplitude * Math.sin(
            (gridColumn + gridRow) * settledHeartSpatialPhase - waveTime * settledHeartSpeed,
          )) * strength
          : (0.86 + hash(shapeColumn, shapeRow) * 0.12) * strength;
        const index = gridRow * columns + gridColumn;
        heartInk[index] = value;
      }
    }
    return { cells, capacity };
  }

  function countCanonicalHeartCompositeCells(x, y) {
    const canonicalColumn = Math.round(x / cell - heartVisualCenter.x * 2);
    const canonicalRow = Math.round(y / cell - heartVisualCenter.y * 2);
    let cells = 0;
    for (let shapeRow = 0; shapeRow < heartShape.length; shapeRow += 1) {
      for (let shapeColumn = 0; shapeColumn < heartShape[shapeRow].length; shapeColumn += 1) {
        if (heartShape[shapeRow][shapeColumn] !== '1') continue;
        for (let offsetY = 0; offsetY < 2; offsetY += 1) {
          const gridRow = canonicalRow + shapeRow * 2 + offsetY;
          for (let offsetX = 0; offsetX < 2; offsetX += 1) {
            const gridColumn = canonicalColumn + shapeColumn * 2 + offsetX;
            if (gridColumn < 0 || gridRow < 0 || gridColumn >= columns || gridRow >= rows) continue;
            const index = gridRow * columns + gridColumn;
            const fieldVisible = heat[index] * .9 >= .36;
            const heartVisible = heartState.compositeOpacity >= .04 && heartInk[index] > 0;
            if (fieldVisible || heartVisible) cells += 1;
          }
        }
      }
    }
    return cells;
  }

  function startHeart(anchor, now) {
    heartState.anchor = anchor;
    heartState.enterStarted = now;
    heartState.leavingStarted = 0;
    heartState.recoveryStarted = 0;
    heartState.recoveryDuration = 0;
    heartState.recoveryOpacity = 1;
    heartState.coreScale = 1.9;
    heartState.coreStrength = .58;
    heartState.coreReveal = .08;
    heartState.compositeOpacity = 1;
    heartSparks.length = 0;
    for (let index = 0; index < 16; index += 1) {
      const angle = index / 16 * Math.PI * 2;
      const speed = brush * (0.7 + hash(index, anchor.x) * 0.7) / (1000 / 60);
      heartSparks.push({
        originX: anchor.x,
        originY: anchor.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        bornAt: now,
      });
    }
    canvas.dataset.heartSparkRadius = '0';
    setHeartPhase('assembling');
  }

  function recoverHeart(anchor, now) {
    const exitAge = Math.max(0, now - heartState.leavingStarted);
    heartState.anchor = anchor;
    heartState.recoveryStarted = now;
    heartState.recoveryDuration = Math.max(1, Math.min(260, exitAge));
    heartState.recoveryOpacity = heartState.compositeOpacity;
    heartState.leavingStarted = 0;
    heartState.coreScale = heartState.exitCoreScale;
    heartState.coreStrength = heartState.exitCoreStrength;
    heartState.coreReveal = heartState.exitCoreReveal;
    setHeartPhase('recovering');
  }

  function updateHeartSparks(now) {
    const drag = -Math.log(.88) / (1000 / 60);
    const lifetime = 280;
    let radius = 0;
    for (let index = heartSparks.length - 1; index >= 0; index -= 1) {
      const spark = heartSparks[index];
      const age = Math.max(0, now - spark.bornAt);
      if (age >= lifetime) {
        heartSparks.splice(index, 1);
        continue;
      }
      const displacement = (1 - Math.exp(-drag * age)) / drag;
      const x = spark.originX + spark.vx * displacement;
      const y = spark.originY + spark.vy * displacement;
      const life = 1 - age / lifetime;
      radius = Math.max(radius, Math.hypot(x - spark.originX, y - spark.originY));
      deposit(x, y, 0.45 + 0.45 * life, 1.6);
    }
    canvas.dataset.heartSparks = String(heartSparks.length);
    canvas.dataset.heartSparkRadius = radius.toFixed(2);
  }

  function updateHeartState(now, active, anchor) {
    if (reducedMotion) return;
    if (active && anchor) {
      if (heartState.phase === 'idle') startHeart(anchor, now);
      else if (heartState.phase === 'leaving') recoverHeart(anchor, now);
      else heartState.anchor = anchor;
      canvas.dataset.heartCentroidX = heartState.anchor.x.toFixed(2);
      canvas.dataset.heartCentroidY = heartState.anchor.y.toFixed(2);
      const elapsed = now - heartState.enterStarted;
      const assembling = heartState.phase === 'assembling';
      const recovering = heartState.phase === 'recovering';
      let progress = 1;
      let eased = 1;
      if (assembling) {
        progress = clamp(elapsed / 240);
        eased = strongEaseOut(progress);
        heartState.coreScale = 1.9 + eased * .1;
        heartState.coreStrength = .58 + eased * .42;
        heartState.coreReveal = .08 + eased * .92;
        heartState.compositeOpacity = 1;
        if (progress >= 1) setHeartPhase('settled');
      } else if (recovering) {
        progress = clamp((now - heartState.recoveryStarted) / heartState.recoveryDuration);
        eased = strongEaseOut(progress);
        heartState.coreScale = heartState.exitCoreScale + (2 - heartState.exitCoreScale) * eased;
        heartState.coreStrength = heartState.exitCoreStrength + (1 - heartState.exitCoreStrength) * eased;
        heartState.coreReveal = heartState.exitCoreReveal + (1 - heartState.exitCoreReveal) * eased;
        heartState.compositeOpacity = heartState.recoveryOpacity + (1 - heartState.recoveryOpacity) * eased;
        if (progress >= 1) setHeartPhase('settled');
      } else {
        heartState.coreScale = 2;
        heartState.coreStrength = 1;
        heartState.coreReveal = 1;
        heartState.compositeOpacity = 1;
      }
      const entry = stampHeart(
        anchor.x,
        anchor.y,
        heartState.coreScale,
        heartState.coreStrength,
        heartState.coreReveal,
      );
      const canonicalCompositeCells = countCanonicalHeartCompositeCells(anchor.x, anchor.y);
      if (recovering
        && heartState.phase === 'recovering'
        && canonicalCompositeCells === canonicalHeartCellCapacity) {
        setHeartPhase('settled');
      }
      if (heartState.phase === 'settled') stampHeart(anchor.x, anchor.y, 2, 1, 1, now);
      canvas.dataset.heartEntryEased = eased.toFixed(4);
      canvas.dataset.heartEntryCells = String(entry.cells);
      canvas.dataset.heartEntryCapacity = String(entry.capacity);
      canvas.dataset.heartOuterMix = '0.0000';
    } else if (heartState.phase !== 'idle') {
      if (heartState.phase !== 'leaving') {
        heartState.leavingStarted = now;
        heartState.exitCoreScale = heartState.coreScale;
        heartState.exitCoreStrength = heartState.coreStrength;
        heartState.exitCoreReveal = heartState.coreReveal;
        heartState.exitCompositeOpacity = heartState.compositeOpacity;
        setHeartPhase('leaving');
      }
      const leaving = Math.min(1, (now - heartState.leavingStarted) / 260);
      const remaining = 1 - leaving;
      heartState.compositeOpacity = heartState.exitCompositeOpacity * remaining;
      if (heartState.anchor && remaining > 0) {
        stampHeart(
          heartState.anchor.x,
          heartState.anchor.y,
          heartState.exitCoreScale,
          heartState.exitCoreStrength,
          heartState.exitCoreReveal,
        );
      }
      canvas.dataset.heartOuterMix = '0.0000';
      if (leaving >= 1) {
        heartState.anchor = null;
        setHeartPhase('idle');
        delete canvas.dataset.heartCentroidX;
        delete canvas.dataset.heartCentroidY;
      }
    }
    updateHeartSparks(now);
  }

  function updateFooterMaskDiagnostics() {
    canvas.dataset.footerMaskKind = footerMask?.kind || '';
    canvas.dataset.footerMaskWidth = String(footerMask?.width || 0);
    canvas.dataset.footerMaskHeight = String(footerMask?.height || 0);
  }

  function buildFooterMask() {
    const source = document.createElement('canvas');
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return;
    sourceContext.font = '18px "Geist", system-ui, sans-serif';
    const sourceWidth = Math.max(1, Math.ceil(sourceContext.measureText(footerMaskText).width));
    source.width = sourceWidth;
    source.height = footerMaskSourceHeight;
    sourceContext.font = '18px "Geist", system-ui, sans-serif';
    sourceContext.textBaseline = 'middle';
    sourceContext.fillStyle = '#000';
    sourceContext.fillText(footerMaskText, 0, footerMaskSourceHeight / 2);
    const pixels = sourceContext.getImageData(0, 0, sourceWidth, footerMaskSourceHeight).data;
    const data = new Uint8Array(sourceWidth * footerMaskSourceHeight);
    for (let index = 0; index < data.length; index += 1) data[index] = pixels[index * 4 + 3] > 0 ? 1 : 0;
    footerMask = {
      kind: 'font-alpha',
      width: sourceWidth,
      height: footerMaskSourceHeight,
      data,
    };
    footerPhase %= footerMask.width;
    updateFooterMaskDiagnostics();
  }

  function scheduleFooterMaskBuild() {
    if (disposed || footerMaskBuildQueued) return;
    footerMaskBuildQueued = true;
    const build = () => {
      footerMaskBuildQueued = false;
      if (disposed) return;
      buildFooterMask();
      if (reducedMotion) drawStatic();
      else requestRender();
    };
    const ready = document.fonts?.ready;
    if (ready?.then) ready.then(build, build);
    else build();
  }

  function onFooterFontLoadingDone() {
    if (disposed) return;
    buildFooterMask();
    if (reducedMotion) drawStatic();
    else requestRender();
  }

  function advanceFooterPhase(now) {
    const elapsed = footerPhaseTime > 0
      ? Math.max(0, now - footerPhaseTime)
      : footerReferenceFrameMs;
    footerPhaseTime = now;
    footerPhase = (footerPhase + elapsed * footerCellsPerMillisecond) % footerMask.width;
    canvas.dataset.footerPhase = footerPhase.toFixed(4);
  }

  function decayFooterHeat(now) {
    const elapsed = footerHeatTime > 0
      ? Math.max(0, now - footerHeatTime)
      : footerReferenceFrameMs;
    footerHeatTime = now;
    const decayFactor = footerHeatDecay ** (elapsed / footerReferenceFrameMs);
    let nextActiveCount = 0;
    for (let activeIndex = 0; activeIndex < footerActiveCount; activeIndex += 1) {
      const index = footerActiveIndices[activeIndex];
      const value = footerHeat[index] * decayFactor;
      if (value >= .003) {
        footerHeat[index] = value;
        footerActiveIndices[nextActiveCount] = index;
        nextActiveCount += 1;
      } else {
        footerHeat[index] = 0;
        footerActive[index] = 0;
      }
    }
    footerActiveCount = nextActiveCount;
  }

  function stampFooterHeat(index, value) {
    if (!footerActive[index]) {
      footerActive[index] = 1;
      footerActiveIndices[footerActiveCount] = index;
      footerActiveCount += 1;
    }
    footerHeat[index] = Math.max(footerHeat[index], value);
  }

  function clearFooterHeat() {
    for (let activeIndex = 0; activeIndex < footerActiveCount; activeIndex += 1) {
      const index = footerActiveIndices[activeIndex];
      footerHeat[index] = 0;
      footerActive[index] = 0;
    }
    footerActiveCount = 0;
    footerPhase = 0;
    footerPhaseTime = 0;
    footerHeatTime = 0;
    canvas.dataset.footerPhase = '0.0000';
    canvas.dataset.footerHeatCells = '0';
    canvas.dataset.footerTrailCells = '0';
    resetFooterStampEnvelope();
  }

  function fadeFooterHeat(now) {
    if (!footerActiveCount) return;
    advanceFooterPhase(now);
    decayFooterHeat(now);
    canvas.dataset.footerScrollCells = footerPhase.toFixed(4);
    canvas.dataset.footerPhaseCells = footerPhase.toFixed(4);
    canvas.dataset.footerPhase = footerPhase.toFixed(4);
    canvas.dataset.footerHeatCells = String(footerActiveCount);
    canvas.dataset.footerTrailCells = String(footerActiveCount);
  }

  function hasActiveFooterHeat() {
    return footerActiveCount > 0;
  }

  function footerCellIntersectsExclusion(left, top, right, bottom, exclusions, expansion = 0) {
    for (let index = 0; index < exclusions.length; index += 1) {
      const exclusion = exclusions[index];
      if (exclusion.width > 0 && exclusion.height > 0
          && left < exclusion.right + expansion
          && right > exclusion.left - expansion
          && top < exclusion.bottom + expansion
          && bottom > exclusion.top - expansion) return true;
    }
    return false;
  }

  function stampFooterMarquee(bounds, exclusions, now, staticFrame = false) {
    if (!footerMask) return;
    footerStampRevision += 1;
    canvas.dataset.footerStampRevision = String(footerStampRevision);
    if (staticFrame) {
      clearFooterHeat();
    } else {
      advanceFooterPhase(now);
      decayFooterHeat(now);
    }
    canvas.dataset.footerScrollCells = footerPhase.toFixed(4);
    canvas.dataset.footerPhaseCells = footerPhase.toFixed(4);
    canvas.dataset.footerPhase = footerPhase.toFixed(4);
    const sourceOffset = staticFrame
      ? 0
      : (footerMask.width - Math.floor(footerPhase)) % footerMask.width;
    const scrollOffset = touch ? 0 : scrollY % cell;
    const baseRow = Math.round((bounds.top + bounds.height / 2 + scrollOffset) / cell) - (footerMask.height >> 1);
    const lastVisibleColumn = Math.max(0, Math.ceil(width / cell) - 1);
    const maskColumnForViewportColumn = column => (
      ((column - sourceOffset) % footerMask.width + footerMask.width) % footerMask.width
    );
    let paintedRowStart = Infinity;
    let paintedRowEnd = -Infinity;
    for (let column = 0; column < columns; column += 1) {
      const maskColumn = maskColumnForViewportColumn(column);
      for (let row = 0; row < footerMask.height; row += 1) {
        if (!footerMask.data[row * footerMask.width + maskColumn]) continue;
        const gridRow = baseRow + row;
        if (gridRow < 0 || gridRow >= rows) continue;
        const left = column * cell;
        const right = left + cell;
        const top = gridRow * cell;
        const bottom = top + cell;
        if (footerCellIntersectsExclusion(left, top, right, bottom, exclusions)) continue;
        const index = gridRow * columns + column;
        const value = .84 + .14 * Math.sin((column * .6 + row * .6) - now * .006);
        stampFooterHeat(index, value);
        paintedRowStart = Math.min(paintedRowStart, row);
        paintedRowEnd = Math.max(paintedRowEnd, row);
        const stampedLeft = column * cell;
        if (stampedLeft < width) {
          footerStampedLeft = Math.min(footerStampedLeft, Math.max(0, stampedLeft));
          footerStampedRight = Math.max(footerStampedRight, Math.min(width, stampedLeft + cell));
        }
      }
    }
    canvas.dataset.footerPaintedRowStart = Number.isFinite(paintedRowStart) ? String(paintedRowStart) : '';
    canvas.dataset.footerPaintedRowEnd = Number.isFinite(paintedRowEnd) ? String(paintedRowEnd) : '';
    if (Number.isFinite(footerStampedLeft) && Number.isFinite(footerStampedRight)) {
      canvas.dataset.footerLeft = footerStampedLeft.toFixed(2);
      canvas.dataset.footerRight = footerStampedRight.toFixed(2);
    }
    canvas.dataset.footerHeatCells = String(footerActiveCount);
    canvas.dataset.footerTrailCells = String(footerActiveCount);
  }

  function addWave(x, y, power) {
    waves.push({ x, y, started: performance.now(), power });
  }

  function updateWaves(now, heroBounds) {
    for (let index = waves.length - 1; index >= 0; index -= 1) {
      const wave = waves[index];
      const age = (now - wave.started) / 1000;
      if (age > 1.5) {
        waves.splice(index, 1);
        continue;
      }
      const radius = age * Math.hypot(width, height) * 1.7;
      const sigma = cell * 5.5 * wave.power;
      const amplitude = Math.max(0, 1 - age / 1.5) * 1.2 * wave.power;
      const inverse = 1 / (2 * sigma * sigma);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const dx = (column + 0.5) * cell - wave.x;
          const dy = (row + 0.5) * cell - wave.y;
          const value = amplitude * Math.exp(-((Math.hypot(dx, dy) - radius) ** 2) * inverse);
          if (value <= 0.02) continue;
          const heatIndex = row * columns + column;
          heat[heatIndex] = Math.max(heat[heatIndex], value);
          if ((row + 0.5) * cell > heroBounds.bottom && value > 0.25 && dissolve[heatIndex] === 0) {
            dissolve[heatIndex] = 0.45 + hash(column, row) * 0.7;
          }
        }
      }
    }
  }

  function updateTouchTarget(now) {
    const viewportCenter = height * 0.5;
    const heading = visibleTouchHeading();
    let targetX;
    let targetY;
    cursorZone = '';
    if (heading) {
      const progress = clamp((height * 0.64 - heading.y) / (height * 0.34));
      targetX = heading.x + (progress - 0.5) * width * 0.5;
      targetY = heading.y - 104;
    } else if (boundsSpanViewport(interactionGeometry.contributorsBounds, viewportCenter)) {
      cursorZone = 'heart';
      targetX = width * 0.5 + Math.sin(scrollY * 0.0026 + 0.6) * width * 0.33;
      targetY = height * 0.5 + Math.sin(scrollY * 0.0052) * height * 0.2;
    } else if (boundsSpanViewport(interactionGeometry.footerBounds, viewportCenter)) {
      cursorZone = 'footer';
      targetX = width * 0.5 + Math.sin(scrollY * 0.0026 + 0.6) * width * 0.33;
      targetY = height * 0.5 + Math.sin(scrollY * 0.0052) * height * 0.2;
    } else {
      const target = nearestTouchTarget(viewportCenter);
      targetX = target?.x ?? width * 0.5 + Math.sin(scrollY * 0.0026 + 0.6) * width * 0.33;
      targetY = target?.y ?? height * 0.5 + Math.sin(scrollY * 0.0052) * height * 0.2;
    }
    pointerInHeartZone = cursorZone === 'heart';
    if (pointerX < 0) pointerX = targetX;
    if (pointerY < 0) pointerY = targetY;
    pointerX += (targetX - pointerX) * 0.11;
    pointerY += (targetY - pointerY) * 0.11;
    pointerX = Math.max(8, Math.min(width - 8, pointerX));
    pointerY = Math.max(8, Math.min(height - 8, pointerY));
    return heading;
  }

  function decay(heroBottom) {
    for (let index = 0; index < heat.length; index += 1) {
      heartInk[index] = 0;
      const row = Math.floor(index / columns);
      if (dissolve[index] > 0 && (row + 0.5) * cell > heroBottom) {
        dissolve[index] -= 0.007;
        if (dissolve[index] <= 0) {
          dissolve[index] = 0;
          heat[index] = 0;
        } else if (dissolve[index] < 0.3) heat[index] *= 0.88;
        else heat[index] = Math.max(heat[index] * 0.95, 0.9);
      } else {
        if (dissolve[index] > 0) dissolve[index] = 0;
        heat[index] *= touch ? 0.85 : 0.878;
        if (heat[index] < 0.003) heat[index] = 0;
      }
    }
  }

  function drawFooterCell(index, value, viewOffset, exclusions, shakeExpansion) {
    if (value < .30) return;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cell;
    const y = row * cell + viewOffset;
    if (x >= width || y + cell <= 0 || y >= height) return;
    if (footerCellIntersectsExclusion(x, y, x + cell - 1, y + cell - 1, exclusions, shakeExpansion)) return;
    let color = '#1c2541';
    if (value >= .46) color = '#3b5bd9';
    if (value >= .62) color = '#f5c518';
    if (value >= .78) color = '#e0492a';
    if (value >= .86 && value < 1.02) color = '#d8ff00';
    context.fillStyle = color;
    context.fillRect(x, y, cell - 1, cell - 1);
  }

  function drawFooterComposite(scrollOffset) {
    const viewOffset = Math.round(scrollOffset / cell) * cell - scrollOffset;
    const exclusions = footerViewportGeometry().exclusions;
    const shakeExpansion = shake > 0.01 ? shake * 10 + 1 : 0;
    for (let activeIndex = 0; activeIndex < footerActiveCount; activeIndex += 1) {
      const index = footerActiveIndices[activeIndex];
      drawFooterCell(index, footerHeat[index], viewOffset, exclusions, shakeExpansion);
    }
  }

  function normalizeSuppressedRect(rectOrNull) {
    if (!rectOrNull) return null;
    const values = [rectOrNull.left, rectOrNull.top, rectOrNull.right, rectOrNull.bottom].map(Number);
    if (values.some(value => !Number.isFinite(value))) return null;
    const [rawLeft, rawTop, rawRight, rawBottom] = values;
    const left = Math.max(0, Math.min(width, rawLeft));
    const top = Math.max(0, Math.min(height, rawTop));
    const right = Math.max(0, Math.min(width, rawRight));
    const bottom = Math.max(0, Math.min(height, rawBottom));
    if (right <= left || bottom <= top) return null;
    return { left, top, right, bottom };
  }

  function suppressedRectOwner(owner) {
    return typeof owner === 'string' && owner ? owner : 'legacy';
  }

  function getSuppressedRect(owner) {
    const rect = suppressedRects.get(suppressedRectOwner(owner));
    return rect ? { ...rect } : null;
  }

  function setSuppressedRect(rectOrNull, owner) {
    const key = suppressedRectOwner(owner);
    const next = normalizeSuppressedRect(rectOrNull);
    const current = suppressedRects.get(key);
    const unchanged = next?.left === current?.left
      && next?.top === current?.top
      && next?.right === current?.right
      && next?.bottom === current?.bottom;
    if (unchanged) return;
    if (next) suppressedRects.set(key, next);
    else suppressedRects.delete(key);
    if (reducedMotion) drawStatic();
    else requestRender();
  }

  function isSuppressedDynamicCell(x, y, footerExclusions, expansion = 0) {
    return Boolean(
      [...suppressedRects.values()].some(rect => (
        x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
      ))
      || footerCellIntersectsExclusion(x - cell * .5, y - cell * .5, x + cell * .5, y + cell * .5,
        footerExclusions, expansion),
    );
  }

  function draw(now, heroBounds, stageBounds, heroIsActive) {
    context.save();
    if (shake > 0.01) {
      shake *= 0.9;
      context.translate((Math.random() - 0.5) * shake * 20, (Math.random() - 0.5) * shake * 20);
    } else shake = 0;
    const footerExclusions = footerViewportGeometry().exclusions;
    const shakeExpansion = shake > 0.01 ? shake * 10 + 1 : 0;
    context.clearRect(-40, -40, width + 80, height + 80);
    context.fillStyle = '#fff';
    context.fillRect(-40, -40, width + 80, height + 80);

    const scrollOffset = touch ? 0 : scrollY;
    const offset = scrollOffset - Math.floor(scrollOffset / cell) * cell;
    context.strokeStyle = '#fafafa';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= width; x += cell) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
    }
    for (let y = -offset; y <= height; y += cell) {
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
    }
    context.stroke();


    if (filteredHeroBottom < 0) filteredHeroBottom = stageBounds.bottom;
    else filteredHeroBottom += (stageBounds.bottom - filteredHeroBottom) * (touch ? 0.2 : 1);
    const stageTop = stageBounds.top + scrollOffset;
    const stageBottom = filteredHeroBottom + scrollOffset;
    const stageHeight = Math.max(cell, stageBottom - stageTop);
    const heroEnd = stageTop + stageHeight * 0.66;
    const fadeSpan = Math.max(cell, stageHeight * 0.22);
    const amplitude = height * 0.14;
    const intro = reducedMotion ? 1 : Math.min(1, (now - introStarted) / 1600);
    const startRow = Math.floor(scrollOffset / cell) - 1;
    const endRow = Math.floor((scrollOffset + height) / cell) + 1;
    const time = Date.now() * 0.001;

    for (let documentRow = startRow; documentRow <= endRow; documentRow += 1) {
      const viewY = documentRow * cell - scrollOffset;
      const viewRow = Math.floor((viewY + cell * 0.5) / cell);
      const inViewRow = viewRow >= 0 && viewRow < rows;
      const documentY = documentRow * cell;
      const insideStage = heroIsActive
        && documentY >= stageTop - cell
        && documentY <= stageBottom + cell;
      const ny = documentY / height;
      for (let column = 0; column < columns; column += 1) {
        const centerX = (column + 0.5) * cell;
        const nx = column * cell / width;
        const cutoffNoise = Math.max(0,
          (Math.sin(column * 0.5 + seed) + Math.sin(column * 0.21 - seed * 1.3)) * 0.16
          + hash(Math.floor(column / 2) + 3.3, Math.floor(documentRow / 4)) * 0.6 + 0.15);
        const depth = documentY + cutoffNoise * amplitude;
        const threshold = depth <= heroEnd ? 0 : Math.min(1, (depth - heroEnd) / fadeSpan);
        const index = viewRow * columns + column;
        let value = inViewRow ? heat[index] * 0.9 : 0;
        if (insideStage && region(nx, ny, time) > Math.min(1, threshold + 0.12) && hash(column * 1.7 + 11.3, documentRow * 1.3 + 5.1) < intro) {
          value += base(nx, ny, time) + (hash(column, documentRow) - 0.5) * 0.12
            + Math.sin(column * 0.6 + documentRow * 0.8 + time * 1.7) * 0.045;
        }
        if (value < 0.36 && !(value >= 0.86 && value < 1.02)) continue;
        let color = bands[0][1];
        if (value >= bands[1][0]) color = bands[1][1];
        if (value >= bands[2][0]) color = bands[2][1];
        if (value >= bands[3][0]) color = bands[3][1];
        if (value >= 0.86 && value < 1.02) color = '#d8ff00';
        if (!isSuppressedDynamicCell(centerX, viewY + cell * .5, footerExclusions, shakeExpansion)) {
          context.fillStyle = color;
          context.fillRect(column * cell, viewY, cell - 1, cell - 1);
        }
      }
    }
    drawFooterComposite(scrollOffset);
    drawHeartComposite(scrollOffset, footerExclusions, shakeExpansion);
    context.restore();
  }

  function drawHeartComposite(scrollOffset, footerExclusions, shakeExpansion) {
    if (heartState.compositeOpacity <= 0) return;
    context.save();
    context.globalAlpha = heartState.compositeOpacity;
    const startRow = Math.floor(scrollOffset / cell) - 1;
    const endRow = Math.floor((scrollOffset + height) / cell) + 1;
    for (let documentRow = startRow; documentRow <= endRow; documentRow += 1) {
      const viewY = documentRow * cell - scrollOffset;
      const viewRow = Math.floor((viewY + cell * .5) / cell);
      if (viewRow < 0 || viewRow >= rows) continue;
      for (let column = 0; column < columns; column += 1) {
        const value = heartInk[viewRow * columns + column] * .9;
        if (value <= 0) continue;
        const x = column * cell;
        if (footerCellIntersectsExclusion(x, viewY, x + cell - 1, viewY + cell - 1,
          footerExclusions, shakeExpansion)) continue;
        let color = bands[0][1];
        if (value >= bands[1][0]) color = bands[1][1];
        if (value >= bands[2][0]) color = bands[2][1];
        if (value >= bands[3][0]) color = bands[3][1];
        if (value >= .86 && value < 1.02) color = '#d8ff00';
        context.fillStyle = color;
        context.fillRect(x, viewY, cell - 1, cell - 1);
      }
    }
    context.restore();
  }

  function clearArrowTargetDiagnostic() {
    if (!arrowTargetDiagnosticsEnabled || !arrowTargetDiagnosticPresent) return;
    arrowTargetDiagnosticPresent = false;
    delete canvas.dataset.arrowTargetId;
    delete canvas.dataset.arrowTargetX;
    delete canvas.dataset.arrowTargetY;
    delete canvas.dataset.arrowTargetSemantics;
  }

  function arrowTargetDiagnosticIdentity(element) {
    if (element.id) return { id: element.id, selector: `#${CSS.escape(element.id)}` };
    const declaredIdentity = element.getAttribute('data-pixel-arrow-target');
    if (declaredIdentity) {
      return {
        id: declaredIdentity,
        selector: `[data-pixel-arrow-target="${CSS.escape(declaredIdentity)}"]`,
      };
    }
    if (element.matches('.node-directory-side h2')) return { id: 'node-directory-side-title', selector: '.node-directory-side h2' };
    if (element.matches('.catalog-header h1')) return { id: 'catalog-header-title', selector: '.catalog-header h1' };
    if (element.matches('.catalog-subtype h2')) return { id: 'catalog-subtype-title', selector: '.catalog-subtype h2' };
    if (element.matches('.record-detail h1')) return { id: 'record-detail-title', selector: '.record-detail h1' };
    if (element.matches('.record-detail h2')) return { id: 'record-detail-subtitle', selector: '.record-detail h2' };
    return { id: element.tagName.toLowerCase(), selector: element.tagName.toLowerCase() };
  }

  function arrowTargetSemanticCandidate(target, x, y) {
    const nearest = nearestVisibleTargetPoint(target, x, y);
    if (!nearest) return null;
    const identity = arrowTargetDiagnosticIdentity(target.element);
    return {
      ...identity,
      text: target.element.textContent.trim().replace(/\s+/gu, ' '),
      glyphRects: target.regions.map(region => ({
        left: region.left,
        right: region.right,
        top: region.top,
        bottom: region.bottom,
        width: region.right - region.left,
        height: region.bottom - region.top,
        x: region.left,
        y: region.top,
      })),
      nearestPoint: { x: nearest.x, y: nearest.y },
      distance: nearest.distance,
    };
  }

  function exposeArrowTargetDiagnostic(target) {
    const candidates = arrowGeometry
      .map(candidate => arrowTargetSemanticCandidate(candidate, pointerX, pointerY))
      .filter(Boolean);
    const winner = candidates.find(candidate => candidate.id === arrowTargetDiagnosticIdentity(target.element).id);
    if (!winner) {
      clearArrowTargetDiagnostic();
      return;
    }
    arrowTargetDiagnosticPresent = true;
    canvas.dataset.arrowTargetId = winner.id;
    canvas.dataset.arrowTargetX = target.x.toFixed(2);
    canvas.dataset.arrowTargetY = target.y.toFixed(2);
    canvas.dataset.arrowTargetSemantics = JSON.stringify({
      pointer: { x: pointerX, y: pointerY },
      winner,
      candidates,
    });
  }

  function hasActivePixels() {
    for (let index = 0; index < heat.length; index += 1) {
      if (heat[index] >= 0.003 || dissolve[index] > 0) return true;
    }
    return false;
  }

  function footerSafeIsVisible() {
    const bounds = footerViewportGeometry().safe;
    if (bounds.width <= 1 || bounds.height <= 1) return false;
    return footerVisible || (bounds.bottom > 0 && bounds.top < height);
  }

  function shouldKeepRendering(heroIsActive, interactionActive, homeIdlePacmanEligible) {
    return heroIsActive
      || interactionActive
      || homeIdlePacmanEligible
      || charging
      || waves.length > 0
      || heartSparks.length > 0
      || heartState.phase !== 'idle'
      || footerSafeIsVisible()
      || hasActiveFooterHeat()
      || shake > 0.01
      || hasActivePixels();
  }

  function render(now) {
    frame = 0;
    if (disposed || suspended || document.hidden || reducedMotion) return;
    const heroBounds = interactionGeometry.heroBounds;
    const stageBounds = interactionGeometry.stageBounds;
    const heroIsActive = Boolean(hero && stageBounds.bottom > 0 && stageBounds.top < height);
    canvas.dataset.density = heroIsActive ? 'hero' : 'low';
    canvas.dataset.overlay = '';
    decay(heroBounds.bottom);
    const footerGeometry = footerViewportGeometry();
    const footerIsVisible = footerSafeIsVisible();
    if (footerIsVisible) {
      stampFooterMarquee(footerGeometry.safe, footerGeometry.exclusions, now);
    } else if (hasActiveFooterHeat()) fadeFooterHeat(now);
    const touchHeading = touch ? updateTouchTarget(now) : null;
    const heading = touch ? touchHeading : arrowTarget;
    const idle = now - lastMove;
    const interactionActive = heroIsActive || (pointerX >= 0 && pointerY >= 0 && idle < 750);
    const homeIdlePacmanEligible = Boolean(
      hero && !touch && pointerX >= 0 && pointerY >= 0 && cursorZone !== 'heart' && cursorZone !== 'footer',
    );
    let heartActive = false;
    let nextHeartAnchor = null;

    if (pointerX >= 0 && pointerY >= 0) {
      if (heading) {
        if (homeIdlePacmanEligible && idle >= 2400) {
          wander(pointerX, pointerY);
          canvas.dataset.mode = 'pacman';
        } else if (interactionActive || homeIdlePacmanEligible) {
          pointArrow(pointerX, pointerY, heading, now);
          canvas.dataset.mode = 'title-arrow';
          if (arrowTargetDiagnosticsEnabled) exposeArrowTargetDiagnostic(heading);
          pacmanX = -1;
        } else {
          canvas.dataset.mode = touch ? 'touch-route' : 'follow';
          pacmanX = -1;
        }
      } else if (pointerInHeartZone) {
        heartActive = true;
        nextHeartAnchor = heartAnchor(pointerX, pointerY);
        canvas.dataset.mode = 'heart';
        pacmanX = -1;
      } else if (cursorZone === 'footer') {
        if (interactionActive) follow(pointerX, pointerY, brush * 0.5);
        canvas.dataset.mode = 'footer-marquee';
        pacmanX = -1;
      } else if (homeIdlePacmanEligible && idle > 1500) {
        wander(pointerX, pointerY);
        canvas.dataset.mode = 'pacman';
      } else if (interactionActive) {
        follow(pointerX, pointerY, pointerY > heroBounds.bottom ? brush * 0.5 : brush);
        canvas.dataset.mode = touch ? 'touch-route' : 'follow';
        pacmanX = -1;
      } else {
        canvas.dataset.mode = touch ? 'touch-route' : 'follow';
        pacmanX = -1;
      }
    } else {
      canvas.dataset.mode = heroIsActive ? 'ambient' : 'static';
      pacmanX = -1;
    }

    updateHeartState(now, heartActive, nextHeartAnchor);
    if (footerIsVisible) {
      canvas.dataset.overlay = 'footer-marquee';
      if (canvas.dataset.mode === 'ambient' || canvas.dataset.mode === 'static' || canvas.dataset.mode === 'touch-route') {
        canvas.dataset.mode = 'footer-marquee';
      }
    }
    if (charging) {
      const charge = Math.min((now - chargeStarted) / 2200, 1);
      deposit(chargeX, chargeY, 0.45 + charge * 0.5, brush * (2 + charge * 8));
      shake = Math.max(shake, 0.12 + charge * 0.35);
      canvas.dataset.mode = 'charge';
      clearArrowTargetDiagnostic();
    }
    updateWaves(now, heroBounds);
    if (waves.length) {
      canvas.dataset.mode = 'blast';
    }
    if (arrowTargetDiagnosticsEnabled && canvas.dataset.mode !== 'title-arrow') clearArrowTargetDiagnostic();
    draw(now, heroBounds, stageBounds, heroIsActive);
    if (shouldKeepRendering(heroIsActive, interactionActive, homeIdlePacmanEligible)) requestRender();
  }

  function isControlTarget(target) {
    return Boolean(target.closest('a, button, input, select, textarea, .site-header, .archive-preview, .stage-media, .media-crumble-canvas'));
  }

  function onPointerMove(event) {
    if (touch || reducedMotion) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    lastMove = performance.now();
    cursorZone = zoneAtPoint(pointerX, pointerY);
    pointerInHeartZone = cursorZone === 'heart';
    arrowTarget = pointerIsOnContributorCard(pointerX, pointerY) ? null : nearHeading(pointerX, pointerY);
    pacmanX = -1;
    requestRender();
  }

  function onPointerScroll() {
    scheduleArrowGeometryRefresh();
    if (reducedMotion) return;
    if (touch || pointerX >= 0) lastMove = performance.now();
    pacmanX = -1;
    requestRender();
  }

  function onPointerDown(event) {
    if (touch || reducedMotion || event.button !== 0) return;
    lastMove = performance.now();
    pacmanX = -1;
    if (isControlTarget(event.target)) return;
    charging = true;
    chargeStarted = performance.now();
    chargeX = event.clientX;
    chargeY = event.clientY;
    requestRender();
  }

  const releaseCharge = () => {
    if (!charging) return;
    charging = false;
    lastMove = performance.now();
    pacmanX = -1;
    const duration = Math.min((performance.now() - chargeStarted) / 2200, 1);
    deposit(chargeX, chargeY, 1, brush * (2.5 + duration * 18));
    addWave(chargeX, chargeY, 0.35 + duration * 2.1);
    shake = Math.max(shake, 0.45 + duration * 1.9);
    requestRender();
  };
  function onDoubleClick(event) {
    if (touch || reducedMotion || isControlTarget(event.target)) return;
    addWave(event.clientX, event.clientY, 2.8);
    deposit(event.clientX, event.clientY, 1, brush * 22);
    shake = 2.4;
    lastMove = performance.now();
    requestRender();
  }

  function mutationAffectsArrowGeometry(mutation) {
    if (mutation.type === 'attributes') return attributeAffectsArrowGeometry(mutation);
    if (nodeIsWithinGeometryBoundary(mutation.target) || nodeIsWithinArrowHeading(mutation.target)) return true;
    if (mutation.type !== 'childList') return false;
    return [...mutation.addedNodes, ...mutation.removedNodes].some(node => (
      nodeContainsInteractionTarget(node) || nodeIsGeometryBoundary(node) || nodeIsArrowHeading(node)
    ));
  }

  const mutationObserver = new MutationObserver(mutations => {
    const alphaVisibilityChanged = mutations.some(mutationAffectsAlphaVisibility);
    const geometryChanged = mutations.some(mutationAffectsArrowGeometry);
    const computedStyleRoots = computedStyleAffectedInlineSvgRoots(mutations);
    invalidateInlineSvgRoots(computedStyleRoots);
    if (mutations.some(mutationChangesInlineSvgRoots)) syncInlineSvgMutationObserverTargets();
    invalidateMutationAlphaResources(mutations);
    const mainFlowChanged = mutations.some(mutation => mutation.type === 'childList' && mutation.target === mainContent);
    if (mainFlowChanged || geometryChanged) cacheFooterDocumentGeometry();
    if (alphaVisibilityChanged || geometryChanged || mainFlowChanged || computedStyleRoots.size) {
      scheduleArrowGeometryRefresh({ rebuildMap: geometryChanged, afterResize: geometryChanged });
    }
  });
  const inlineSvgMutationObserver = new MutationObserver(mutations => {
    const roots = new Set();
    for (const mutation of mutations) {
      const root = inlineSvgRootForNode(mutation.target);
      if (root && observedInlineSvgRoots.has(root)) roots.add(root);
    }
    if (!roots.size) return;
    for (const root of roots) invalidateInlineSvgResource(root);
    scheduleArrowGeometryRefresh();
  });
  const resizeObserver = new ResizeObserver(entries => {
    let hasMeasuredResize = false;
    for (const { target } of entries) {
      if (pendingInitialResizeObserverTargets.has(target)) {
        pendingInitialResizeObserverTargets.delete(target);
        continue;
      }
      if (target !== mainContent) {
        hasMeasuredResize = true;
        continue;
      }
      const bounds = snapshotBounds(mainContent);
      if (Math.abs(bounds.width - committedMainFlowSize.width) > .01
        || Math.abs(bounds.height - committedMainFlowSize.height) > .01) hasMeasuredResize = true;
    }
    if (hasMeasuredResize) {
      cacheFooterDocumentGeometry();
      scheduleArrowGeometryRefresh();
    }
  });
  const footerVisibilityObserver = new IntersectionObserver(entries => {
    const entry = entries.find(candidate => candidate.target === footerSafe);
    if (!entry || disposed || suspended || document.hidden) return;
    footerVisible = entry.isIntersecting;
    if (geometryRefreshPending || boundsChanged(snapshotBounds(footerSafe), interactionGeometry.footerSafeBounds)) {
      scheduleArrowGeometryRefresh();
    } else if (reducedMotion) drawStatic();
    else requestRender();
  }, { threshold: .01 });

  function mappedGeometryElements() {
    return [
      mainContent,
      ...geometryBoundaryElements(),
      ...headings,
    ].filter(Boolean);
  }

  function geometryBoundaryElements() {
    return [
      hero,
      heroStage,
      contributors,
      footer,
      footerSafe,
      ...footerExclusionElements,
      ...contributorCards,
      ...(touch ? touchTargets : []),
    ].filter(Boolean);
  }

  function syncFooterVisibilityObserver() {
    footerVisibilityObserver.disconnect();
    footerVisible = false;
    if (!disposed && !suspended && !document.hidden && footerSafe) footerVisibilityObserver.observe(footerSafe);
  }

  function elementForNode(node) {
    return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  }

  function nodeIsGeometryBoundary(node) {
    const element = elementForNode(node);
    return Boolean(element) && geometryBoundaryElements().includes(element);
  }

  function nodeIsWithinGeometryBoundary(node) {
    const element = elementForNode(node);
    if (!element) return false;
    return geometryBoundaryElements().some(boundary => boundary === element || boundary.contains(element));
  }

  function nodeIsArrowHeading(node) {
    const element = elementForNode(node);
    return Boolean(element) && headings.includes(element);
  }

  function nodeIsWithinArrowHeading(node) {
    const element = elementForNode(node);
    if (!element) return false;
    return headings.some(heading => heading === element || heading.contains(element));
  }

  function nodeAffectsArrowHeadingText(node) {
    const element = elementForNode(node);
    if (!element) return false;
    return headings.some(heading => {
      if (element === heading || element.contains(heading)) return true;
      return heading.contains(element) && Boolean(element.textContent?.trim());
    });
  }

  function attributeAffectsArrowGeometry(mutation) {
    const element = elementForNode(mutation.target);
    if (!element) return false;
    if (attributeChangesInteractionSelector(mutation, element)) return true;
    if (geometryBoundaryElements().some(boundary => element === boundary || element.contains(boundary))) return true;
    return nodeAffectsArrowHeadingText(element);
  }

  function nodeMayAffectAlphaVisibility(node) {
    const element = elementForNode(node);
    if (!element) return false;
    return [element, ...element.querySelectorAll(alphaVisibilitySelector)]
      .some(elementMayAffectAlphaVisibility);
  }

  function mutationAffectsAlphaVisibility(mutation) {
    if (mutation.type === 'attributes') {
      if (!alphaVisibilityAttributeNames.has(mutation.attributeName)) return false;
      const element = elementForNode(mutation.target);
      if (!element) return false;
      if (mutation.attributeName === 'src' || mutation.attributeName === 'srcset') return true;
      if (mutation.attributeName === 'style' && !inlineStyleChangesAlphaCover(mutation, element)) return false;
      return elementMayAffectAlphaVisibility(element);
    }
    return mutation.type === 'childList' && [...mutation.addedNodes, ...mutation.removedNodes]
      .some(nodeMayAffectAlphaVisibility);
  }

  function imageElementsInNode(node) {
    const element = elementForNode(node);
    if (!element) return [];
    return [
      ...(element instanceof HTMLImageElement ? [element] : []),
      ...element.querySelectorAll('img'),
    ];
  }

  function inlineSvgRootForNode(node) {
    const element = elementForNode(node);
    if (!(element instanceof SVGElement)) return null;
    return element.tagName.toLowerCase() === 'svg' ? element : element.ownerSVGElement;
  }

  function inlineSvgRootsInNode(node) {
    const element = elementForNode(node);
    if (!element) return [];
    const root = inlineSvgRootForNode(element);
    return [
      ...(root ? [root] : []),
      ...element.querySelectorAll('svg'),
    ];
  }

  function mutationChangesInlineSvgRoots(mutation) {
    return mutation.type === 'childList' && [...mutation.addedNodes, ...mutation.removedNodes]
      .some(node => inlineSvgRootsInNode(node).length > 0);
  }

  function stylesheetElement(element) {
    if (!element) return false;
    if (element.tagName?.toLowerCase() === 'style') return true;
    return element.tagName?.toLowerCase() === 'link' && element.rel?.split(/\s+/).includes('stylesheet');
  }

  function nodeContainsStylesheet(node) {
    const element = elementForNode(node);
    return stylesheetElement(element) || Boolean(element?.querySelector('style, link[rel~="stylesheet"]'));
  }

  function invalidateInlineSvgRoots(roots) {
    for (const root of roots) invalidateInlineSvgResource(root);
  }

  function invalidateObservedInlineSvgResources() {
    invalidateInlineSvgRoots(observedInlineSvgRoots);
  }

  function computedStyleAffectedInlineSvgRoots(mutations) {
    const roots = new Set();
    let stylesheetChanged = false;
    for (const mutation of mutations) {
      const target = elementForNode(mutation.target);
      if (stylesheetElement(target)) stylesheetChanged = true;
      if (mutation.type === 'attributes') {
        if (!computedSvgStyleAttributeNames.has(mutation.attributeName)) continue;
        for (const root of inlineSvgRootsInNode(target)) roots.add(root);
        continue;
      }
      if (mutation.type !== 'childList') continue;
      if ([...mutation.addedNodes, ...mutation.removedNodes].some(nodeContainsStylesheet)) stylesheetChanged = true;
    }
    if (stylesheetChanged) {
      for (const root of observedInlineSvgRoots) roots.add(root);
    }
    return roots;
  }

  function invalidateMutationAlphaResources(mutations) {
    const images = new Set();
    const svgRoots = new Set();
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        if ((mutation.attributeName === 'src' || mutation.attributeName === 'srcset')
          && mutation.target instanceof HTMLImageElement) images.add(mutation.target);
        continue;
      }
      if (mutation.type !== 'childList') continue;
      for (const node of mutation.removedNodes) {
        for (const image of imageElementsInNode(node)) images.add(image);
        for (const root of inlineSvgRootsInNode(node)) svgRoots.add(root);
      }
    }
    for (const image of images) invalidateAlphaResourceForImage(image);
    for (const root of svgRoots) invalidateInlineSvgResource(root);
  }

  function inlineStyleChangesAlphaCover(mutation, element) {
    alphaCoverPreviousStyle.cssText = mutation.oldValue || '';
    return alphaCoverInlineStyleProperties.some(property => (
      alphaCoverPreviousStyle.getPropertyValue(property) !== element.style.getPropertyValue(property)
      || alphaCoverPreviousStyle.getPropertyPriority(property) !== element.style.getPropertyPriority(property)
    ));
  }

  function elementMayAffectAlphaVisibility(element) {
    if (element.closest('.pixel-button-effect')) return false;
    if (elementHasActiveAlphaCover(element)) {
      alphaVisibilityCandidates.add(element);
      return true;
    }
    if (!alphaVisibilityCandidates.has(element)) return false;
    alphaVisibilityCandidateRechecks.add(element);
    return true;
  }

  function elementHasActiveAlphaCover(element) {
    if (element.matches(alphaVisibilitySelector)) return true;
    const style = getComputedStyle(element);
    const paintsAlpha = (style.backgroundImage && style.backgroundImage !== 'none')
      || colorPaintsAlpha(style.backgroundColor);
    if (!paintsAlpha) return false;
    if (!['absolute', 'fixed', 'sticky'].includes(style.position)) return false;
    const bounds = element.getBoundingClientRect();
    return headings.some(heading => textGlyphRects(heading).some(region => (
      bounds.right > region.left && bounds.left < region.right
      && bounds.bottom > region.top && bounds.top < region.bottom
    )));
  }

  function colorPaintsAlpha(color) {
    if (!color || color === 'transparent') return false;
    if (!color.startsWith('rgba(')) return true;
    const alpha = Number.parseFloat(color.slice(color.lastIndexOf(',') + 1));
    return Number.isFinite(alpha) && alpha > 0;
  }

  function clearAlphaResources() {
    for (const resource of alphaResourceCache.values()) {
      if (!resource.loader) continue;
      resource.loader.onload = null;
      resource.loader.onerror = null;
      resource.loader = null;
    }
    alphaResourceCache.clear();
    inlineSvgSourceCache.clear();
  }

  function invalidateAlphaResourceSources(sources) {
    for (const source of sources) {
      if (!source) continue;
      const resource = alphaResourceCache.get(source);
      if (!resource) continue;
      if (resource.loader) {
        resource.loader.onload = null;
        resource.loader.onerror = null;
        resource.loader = null;
      }
      alphaResourceCache.delete(source);
    }
  }

  function invalidateAlphaResourceForImage(image) {
    const sources = new Set([
      sampledImageSources.get(image),
      sampleableImageSource(image.currentSrc),
      sampleableImageSource(image.src),
    ]);
    sampledImageSources.delete(image);
    invalidateAlphaResourceSources(sources);
  }

  function invalidateInlineSvgResource(root) {
    const cached = inlineSvgSourceCache.get(root);
    if (!cached) return;
    inlineSvgSourceCache.delete(root);
    invalidateAlphaResourceSources([cached.resource.source]);
  }

  function attributeChangesInteractionSelector(mutation, element) {
    if (!selectorAttributeNames.has(mutation.attributeName)) return false;
    if (mutation.attributeName.startsWith('data-')) return true;
    if (nodeContainsInteractionTarget(element)) return true;
    if (mutation.attributeName === 'class') {
      return mutation.oldValue?.split(/\s+/).some(name => selectorClassNames.has(name)) || false;
    }
    return selectorIds.has(mutation.oldValue || '');
  }

  function nodeContainsInteractionTarget(node) {
    if (node?.nodeType !== Node.ELEMENT_NODE) return false;
    return node.matches(interactionTargetSelector) || Boolean(node.querySelector(interactionTargetSelector));
  }

  function syncResizeObserverTargets() {
    const nextElements = new Set(mappedGeometryElements());
    for (const element of observedGeometryElements) {
      if (!nextElements.has(element)) {
        resizeObserver.unobserve(element);
        pendingInitialResizeObserverTargets.delete(element);
      }
    }
    for (const element of nextElements) {
      if (!observedGeometryElements.has(element)) {
        pendingInitialResizeObserverTargets.add(element);
        resizeObserver.observe(element);
      }
    }
    observedGeometryElements = nextElements;
  }

  function disconnectInlineSvgMutationObserver() {
    inlineSvgMutationObserver.disconnect();
    observedInlineSvgRoots.clear();
  }

  function syncInlineSvgMutationObserverTargets() {
    disconnectInlineSvgMutationObserver();
    if (disposed || suspended || document.hidden) return;
    for (const root of document.querySelectorAll('svg')) {
      if (!root.isConnected) continue;
      observedInlineSvgRoots.add(root);
      inlineSvgMutationObserver.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  const observe = () => {
    if (disposed || suspended || document.hidden) return;
    mutationObserver.observe(document.documentElement, {
      attributeFilter: [
        'class',
        'id',
        'hidden',
        'style',
        'media',
        'href',
        'disabled',
        'src',
        'srcset',
        'data-pixel-arrow-target',
        'data-node-system',
        'data-node-link',
        'data-stage-preview',
        'data-stage-card',
        'data-contributor',
        'data-hero-field',
      ],
      attributeOldValue: true,
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    syncInlineSvgMutationObserverTargets();
    syncResizeObserverTargets();
  };

  function onResize() {
    invalidateObservedInlineSvgResources();
    resize();
    scheduleArrowGeometryRefresh();
    if (!reducedMotion) requestRender();
  }

  resize();
  rebuildDomMap();
  observe();
  syncFooterVisibilityObserver();
  scheduleArrowGeometryRefresh();
  scheduleFooterMaskBuild();
  document.fonts?.addEventListener?.('loadingdone', onFooterFontLoadingDone);

  function renderStatic() {
    const heroBounds = interactionGeometry.heroBounds;
    const stageBounds = interactionGeometry.stageBounds;
    const heroIsActive = Boolean(hero && stageBounds.bottom > 0 && stageBounds.top < height);
    canvas.dataset.density = heroIsActive ? 'hero' : 'low';
    canvas.dataset.mode = 'static';
    clearArrowTargetDiagnostic();
    heartInk.fill(0);
    const contributorBounds = interactionGeometry.contributorsBounds;
    if (boundsSpanViewport(contributorBounds, height * .5)) {
      setHeartPhase('static');
      stampHeart(width * .5, height * .5, 2);
    } else setHeartPhase('idle');
    const footerGeometry = footerViewportGeometry();
    const footerIsVisible = footerSafeIsVisible();
    if (footerIsVisible) {
      stampFooterMarquee(footerGeometry.safe, footerGeometry.exclusions, performance.now(), true);
    } else clearFooterHeat();
    canvas.dataset.heartSparks = '0';
    canvas.dataset.overlay = footerIsVisible ? 'footer-marquee' : '';
    draw(performance.now() + 1600, heroBounds, stageBounds, heroIsActive);
  }

  function drawStatic() {
    if (disposed) return;
    if (suspended || document.hidden || staticDrawPending) return;
    staticDrawPending = true;
    const generation = staticDrawGeneration;
    queueMicrotask(() => {
      if (generation !== staticDrawGeneration) return;
      staticDrawPending = false;
      if (disposed || suspended || document.hidden) return;
      if (geometryRefreshPending) refreshArrowGeometry({ renderAfter: false });
      renderStatic();
    });
  }

  function cancelStaticDraw() {
    staticDrawGeneration += 1;
    staticDrawPending = false;
  }

  function cancelRender() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function requestRender() {
    if (disposed || suspended || document.hidden || reducedMotion || frame) return;
    frame = requestAnimationFrame(render);
  }

  function clearDynamicState() {
    heat.fill(0);
    dissolve.fill(0);
    clearFooterHeat();
    pointerX = -1;
    pointerY = -1;
    arrowTarget = null;
    clearArrowTargetDiagnostic();
    previousX = -1;
    previousY = -1;
    lastMove = -Infinity;
    cursorZone = '';
    pointerInHeartZone = false;
    charging = false;
    chargeStarted = 0;
    chargeX = 0;
    chargeY = 0;
    pacmanX = -1;
    pacmanY = -1;
    pacmanAge = 0;
    shake = 0;
    heartState.anchor = null;
    heartState.enterStarted = 0;
    heartState.leavingStarted = 0;
    heartState.recoveryStarted = 0;
    heartState.recoveryDuration = 0;
    heartState.recoveryOpacity = 1;
    heartState.coreScale = 2;
    heartState.coreStrength = 1;
    heartState.coreReveal = 1;
    heartState.compositeOpacity = 1;
    heartState.exitCoreScale = 2;
    heartState.exitCoreStrength = 1;
    heartState.exitCoreReveal = 1;
    heartState.exitCompositeOpacity = 1;
    heartInk.fill(0);
    setHeartPhase('idle');
    waves.length = 0;
    heartSparks.length = 0;
    canvas.dataset.heartSparks = '0';
    canvas.dataset.heartSparkRadius = '0';
    canvas.dataset.heartOuterMix = '0.0000';
    delete canvas.dataset.heartEntryEased;
    delete canvas.dataset.heartEntryCells;
    delete canvas.dataset.heartEntryCapacity;
    delete canvas.dataset.heartCentroidX;
    delete canvas.dataset.heartCentroidY;
    resetFooterStampEnvelope();
    delete canvas.dataset.footerTrailCells;
    delete canvas.dataset.footerScrollCells;
    delete canvas.dataset.footerPhaseCells;
    delete canvas.dataset.footerHeatCells;
    footerStampRevision = 0;
    canvas.dataset.footerStampRevision = '0';
  }

  function updateReducedMotion(nextReducedMotion) {
    if (disposed || reducedMotion === nextReducedMotion) return;
    invalidateObservedInlineSvgResources();
    reducedMotion = nextReducedMotion;
    canvas.dataset.motion = reducedMotion ? 'reduced' : (touch ? 'touch' : 'active');
    if (reducedMotion) {
      cancelRender();
      if (arrowGeometryFrame) cancelAnimationFrame(arrowGeometryFrame);
      arrowGeometryFrame = 0;
      arrowGeometryFrameDelayed = false;
      clearDynamicState();
      drawStatic();
    } else {
      cancelStaticDraw();
      if (geometryRefreshPending) scheduleArrowGeometryRefresh();
      else requestRender();
    }
  }

  function updatePointerCapability(nextTouch) {
    if (disposed || touch === nextTouch) return;
    invalidateObservedInlineSvgResources();
    touch = nextTouch;
    cancelRender();
    clearDynamicState();
    canvas.dataset.motion = reducedMotion ? 'reduced' : (touch ? 'touch' : 'active');
    canvas.dataset.mode = reducedMotion ? 'static' : (touch ? 'touch-route' : 'ambient');
    resize();
    scheduleArrowGeometryRefresh({ rebuildMap: true });
    if (reducedMotion) drawStatic();
    else requestRender();
  }

  const onReducedMotionChange = event => updateReducedMotion(Boolean(event.matches));
  const onPointerCapabilityChange = event => updatePointerCapability(!Boolean(event.matches));
  function listenForReducedMotion() {
    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', onReducedMotionChange);
    } else reducedMotionQuery.addListener?.(onReducedMotionChange);
  }

  function unlistenForReducedMotion() {
    if (typeof reducedMotionQuery.removeEventListener === 'function') {
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    } else reducedMotionQuery.removeListener?.(onReducedMotionChange);
  }

  function listenForPointerCapability() {
    if (typeof pointerCapabilityQuery.addEventListener === 'function') {
      pointerCapabilityQuery.addEventListener('change', onPointerCapabilityChange);
    } else pointerCapabilityQuery.addListener?.(onPointerCapabilityChange);
  }

  function unlistenForPointerCapability() {
    if (typeof pointerCapabilityQuery.removeEventListener === 'function') {
      pointerCapabilityQuery.removeEventListener('change', onPointerCapabilityChange);
    } else pointerCapabilityQuery.removeListener?.(onPointerCapabilityChange);
  }

  function suspendRendering() {
    if (disposed) return;
    suspended = true;
    cancelRender();
    cancelStaticDraw();
    if (arrowGeometryFrame) cancelAnimationFrame(arrowGeometryFrame);
    arrowGeometryFrame = 0;
    arrowGeometryFrameDelayed = false;
    mutationObserver.disconnect();
    disconnectInlineSvgMutationObserver();
    resizeObserver.disconnect();
    footerVisibilityObserver.disconnect();
    footerVisible = false;
    observedGeometryElements.clear();
    pendingInitialResizeObserverTargets.clear();
    clearAlphaResources();
    clearDynamicState();
    canvas.dataset.mode = 'static';
    canvas.dataset.overlay = '';
  }

  function resumeRendering() {
    if (disposed || pageSuspended || document.hidden || !suspended) return;
    suspended = false;
    updatePointerCapability(!Boolean(pointerCapabilityQuery.matches));
    resize();
    rebuildDomMap();
    observe();
    syncFooterVisibilityObserver();
    scheduleArrowGeometryRefresh();
    if (reducedMotion) {
      drawStatic();
    }
    else requestRender();
  }

  function onPageHide() {
    pageSuspended = true;
    suspendRendering();
  }

  function onPageShow(event) {
    if (disposed || (!pageSuspended && !event.persisted)) return;
    pageSuspended = false;
    resumeRendering();
  }

  function onVisibilityChange() {
    if (document.hidden) suspendRendering();
    else resumeRendering();
  }

  function onResourceLoad(event) {
    if (event.target instanceof HTMLImageElement) {
      invalidateAlphaResourceForImage(event.target);
      scheduleArrowGeometryRefresh();
      return;
    }
    if (event.target instanceof HTMLLinkElement && stylesheetElement(event.target)) {
      invalidateObservedInlineSvgResources();
      scheduleArrowGeometryRefresh();
    }
  }

  function onTutorialRender() {
    scheduleArrowGeometryRefresh({ rebuildMap: true });
  }

  function attachOwnedListeners() {
    addEventListener('pointermove', onPointerMove, { passive: true });
    addEventListener('scroll', onPointerScroll, { passive: true });
    addEventListener('pointerdown', onPointerDown);
    addEventListener('pointerup', releaseCharge);
    addEventListener('pointercancel', releaseCharge);
    addEventListener('dblclick', onDoubleClick);
    addEventListener('resize', onResize, { passive: true });
    addEventListener('pagehide', onPageHide);
    addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('load', onResourceLoad, true);
    document.addEventListener('error', onResourceLoad, true);
    document.addEventListener('resource-archive-tutorial-render', onTutorialRender);
  }

  function detachOwnedListeners() {
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('scroll', onPointerScroll);
    removeEventListener('pointerdown', onPointerDown);
    removeEventListener('pointerup', releaseCharge);
    removeEventListener('pointercancel', releaseCharge);
    removeEventListener('dblclick', onDoubleClick);
    removeEventListener('resize', onResize);
    removeEventListener('pagehide', onPageHide);
    removeEventListener('pageshow', onPageShow);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('load', onResourceLoad, true);
    document.removeEventListener('error', onResourceLoad, true);
    document.removeEventListener('resource-archive-tutorial-render', onTutorialRender);
  }

  function refreshTargets() {
    scheduleArrowGeometryRefresh({ rebuildMap: true });
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    suspended = true;
    cancelRender();
    cancelStaticDraw();
    if (arrowGeometryFrame) cancelAnimationFrame(arrowGeometryFrame);
    arrowGeometryFrame = 0;
    arrowGeometryFrameDelayed = false;
    mutationObserver.disconnect();
    disconnectInlineSvgMutationObserver();
    resizeObserver.disconnect();
    footerVisibilityObserver.disconnect();
    observedGeometryElements.clear();
    pendingInitialResizeObserverTargets.clear();
    detachOwnedListeners();
    unlistenForReducedMotion();
    unlistenForPointerCapability();
    clearDynamicState();
    suppressedRects.clear();
    headings = [];
    touchTargets = [];
    contributorCards = [];
    arrowGeometry = [];
    contributors = null;
    footer = null;
    footerSafe = null;
    footerExclusionElements = [];
    footerMask = null;
    document.fonts?.removeEventListener?.('loadingdone', onFooterFontLoadingDone);
    clearAlphaResources();
    if (window[controllerKey]?.cleanup === cleanup) delete window[controllerKey];
    if (window.ResourceArchivePixelField?.cleanup === cleanup) delete window.ResourceArchivePixelField;
  }

  attachOwnedListeners();
  listenForReducedMotion();
  listenForPointerCapability();

  if (reducedMotion) {
    clearDynamicState();
    drawStatic();
  } else requestRender();

  const api = Object.freeze({ refreshTargets, setSuppressedRect, getSuppressedRect, cleanup });
  window[controllerKey] = { api, cleanup };
  window.ResourceArchivePixelField = api;
  document.dispatchEvent(new CustomEvent('resource-archive-pixel-field-ready'));
})();
