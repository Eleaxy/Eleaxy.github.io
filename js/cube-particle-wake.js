(() => {
  const controllerKey = '__resourceArchiveCubeParticleWakeController';
  const cellSize = 9;
  const vertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const styleRoles = Object.freeze({
    wakeParticle: .64,
    wakeActive: .78,
    echoOne: .54,
    echoTwo: .34,
    echoThree: .2,
    mainEdge: .8,
    mainVertex: 1,
    mainFace: .36,
  });
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const snap = value => Math.round(value / cellSize) * cellSize;
  const unit = value => {
    const noise = Math.sin(value * 12.9898) * 43758.5453;
    return noise - Math.floor(noise);
  };

  function mount(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('ResourceArchiveCubeParticleWake.mount requires a canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('ResourceArchiveCubeParticleWake requires a 2D canvas');

    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = matchMedia('(hover: hover) and (pointer: fine)');
    const now = () => Number(options.now?.() ?? performance.now());
    let width = 1;
    let height = 1;
    let dpr = 1;
    let visible = false;
    let pageSuspended = false;
    let disposed = false;
    let reducedMotion = motionQuery.matches;
    let raf = 0;
    let frame = 0;
    let lastTime = 0;
    let pointer = null;
    let pointerStrength = 0;
    let pointerListening = false;
    let baseCells = [];
    let drawCells = [];
    let cellCounts = emptyCounts();
    let scene = null;
    const drawPositions = new Map();

    function emptyCounts() {
      return {
        wakeParticle: 0,
        wakeActive: 0,
        echoOne: 0,
        echoTwo: 0,
        echoThree: 0,
        mainEdge: 0,
        mainVertex: 0,
        mainFace: 0,
        main: 0,
        completeMainCube: 0,
      };
    }

    function canDraw() {
      return !disposed && visible && !pageSuspended && !document.hidden;
    }

    function canAnimate() {
      return canDraw() && !reducedMotion;
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(bounds.width));
      const nextHeight = Math.max(1, Math.round(bounds.height));
      const nextDpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
      if (nextWidth === width && nextHeight === height && nextDpr === dpr) return false;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    function project(point, angleY, angleX, scale, centerX, centerY) {
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const x = point[0] * cosY - point[2] * sinY;
      const z = point[0] * sinY + point[2] * cosY;
      const y = point[1] * cosX - z * sinX;
      return [snap(centerX + x * scale), snap(centerY + y * scale)];
    }

    function sceneState(time) {
      const narrow = width < 560;
      const angle = reducedMotion ? .58 : .58 + Math.sin(time * .00016) * .16;
      return {
        narrow,
        scale: Math.min(narrow ? width * .16 : 94, height * .31),
        centerX: width * (narrow ? .28 : .3),
        centerY: height * .5,
        angle,
        angleX: -.48,
        echoAngles: [1, 2, 3].map(index => angle - .07 * index),
      };
    }

    function buildCells(time) {
      const nextScene = sceneState(time);
      const cells = [];
      const keys = new Set();
      const counts = emptyCounts();
      const addCell = (x, y, kind, size = 6, identity = '', opacity = 1, phase = 0, flowing = false, progress) => {
        const cellX = snap(x);
        const cellY = snap(y);
        const key = identity ? `${kind}:${identity}` : `${kind}:${cellX}:${cellY}`;
        if (keys.has(key)) return;
        keys.add(key);
        const item = {
          key: identity || key,
          x: cellX,
          y: cellY,
          kind,
          size,
          opacity,
          phase,
          flowing,
        };
        if (progress !== undefined) item.progress = progress;
        cells.push(item);
        counts[kind] = (counts[kind] || 0) + 1;
        if (kind === 'mainEdge' || kind === 'mainVertex' || kind === 'mainFace') counts.main += 1;
      };
      const addLine = (from, to, kind, density = 9, size = 6, identity = '', opacity = 1) => {
        const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const steps = Math.max(1, Math.ceil(distance / density));
        for (let step = 0; step <= steps; step += 1) {
          const progress = step / steps;
          addCell(
            from[0] + (to[0] - from[0]) * progress,
            from[1] + (to[1] - from[1]) * progress,
            kind,
            size,
            `${identity}-${step}`,
            opacity,
          );
        }
      };

      const streams = nextScene.narrow
        ? [
            { count: 17, base: .25, spread: .22, seed: 2.2, speed: .86 },
            { count: 20, base: .5, spread: .26, seed: 5.4, speed: 1 },
            { count: 17, base: .75, spread: .21, seed: 8.7, speed: .78 },
          ]
        : [
            { count: 18, base: .24, spread: .24, seed: 2.2, speed: .86 },
            { count: 22, base: .5, spread: .3, seed: 5.4, speed: 1 },
            { count: 18, base: .76, spread: .23, seed: 8.7, speed: .78 },
          ];
      const wakeStart = nextScene.narrow ? .34 : .35;
      const wakeEnd = .985;
      streams.forEach((stream, streamIndex) => {
        for (let index = 0; index < stream.count; index += 1) {
          const baseProgress = index / stream.count + unit(index * 4.17 + stream.seed) * .06;
          const motion = reducedMotion ? 0 : time * .000008 * stream.speed;
          const progress = (baseProgress + motion) % 1;
          const jitter = (unit(index * 7.31 + stream.seed) - .5) * stream.spread;
          const slowDrift = reducedMotion ? 0 : Math.sin(time * .00035 + index * .73 + stream.seed) * 4;
          const boundaryFade = Math.min(1, progress / .08, (1 - progress) / .09);
          const outwardFade = .98 - progress * .28;
          const active = (index + streamIndex * 3) % 9 === 0;
          const sizeChoice = unit(index * 9.13 + stream.seed);
          const size = active ? 8 : sizeChoice > .7 ? 6 : sizeChoice > .32 ? 5 : 4;
          addCell(
            width * (wakeStart + progress * (wakeEnd - wakeStart)),
            height * (stream.base + jitter) + slowDrift,
            active ? 'wakeActive' : 'wakeParticle',
            size,
            `wake-${streamIndex}-${index}`,
            Math.max(0, boundaryFade) * outwardFade,
            index * .67 + stream.seed,
            true,
            progress,
          );
        }
      });

      const echoSpecs = nextScene.narrow
        ? [
            { x: .55, y: .42, scale: .66, edges: [0, 1, 4, 5, 8, 9, 10], kind: 'echoOne' },
            { x: .75, y: .59, scale: .46, edges: [1, 5, 9, 10], kind: 'echoTwo' },
            { x: .91, y: .43, scale: .31, edges: [1, 5], kind: 'echoThree' },
          ]
        : [
            { x: .57, y: .43, scale: .68, edges: [0, 1, 4, 5, 8, 9, 10], kind: 'echoOne' },
            { x: .75, y: .56, scale: .48, edges: [1, 5, 9, 10], kind: 'echoTwo' },
            { x: .9, y: .42, scale: .32, edges: [1, 5], kind: 'echoThree' },
          ];
      echoSpecs.forEach((spec, echoIndex) => {
        const points = vertices.map(point => project(
          point,
          nextScene.echoAngles[echoIndex],
          nextScene.angleX,
          nextScene.scale * spec.scale,
          width * spec.x,
          height * spec.y,
        ));
        spec.edges.forEach((edgeIndex, index) => {
          const edge = edges[edgeIndex];
          addLine(points[edge[0]], points[edge[1]], spec.kind, 10 + echoIndex * 3, 5 - echoIndex, `echo-${echoIndex}-${index}`);
        });
        const visibleVertices = echoIndex === 0 ? [0, 1, 4, 5, 6] : echoIndex === 1 ? [1, 5, 6] : [1, 5];
        visibleVertices.forEach((vertexIndex, index) => {
          addCell(points[vertexIndex][0], points[vertexIndex][1], spec.kind, 7 - echoIndex, `echo-v-${echoIndex}-${index}`);
        });
      });

      const mainPoints = vertices.map(point => project(
        point,
        nextScene.angle,
        nextScene.angleX,
        nextScene.scale,
        nextScene.centerX,
        nextScene.centerY,
      ));
      edges.forEach((edge, index) => addLine(mainPoints[edge[0]], mainPoints[edge[1]], 'mainEdge', 8, 6, `main-${index}`));
      mainPoints.forEach((point, index) => addCell(point[0], point[1], 'mainVertex', 9, `main-vertex-${index}`));
      const face = [mainPoints[4], mainPoints[5], mainPoints[6], mainPoints[7]];
      [[.34, .34], [.66, .34], [.34, .66], [.66, .66]].forEach((uv, index) => {
        const topX = face[0][0] + (face[1][0] - face[0][0]) * uv[0];
        const topY = face[0][1] + (face[1][1] - face[0][1]) * uv[0];
        const bottomX = face[3][0] + (face[2][0] - face[3][0]) * uv[0];
        const bottomY = face[3][1] + (face[2][1] - face[3][1]) * uv[0];
        addCell(topX + (bottomX - topX) * uv[1], topY + (bottomY - topY) * uv[1], 'mainFace', 5, `face-${index}`);
      });
      counts.completeMainCube = 1;
      return { cells, counts, scene: nextScene };
    }

    function palette() {
      const rootStyle = getComputedStyle(document.documentElement);
      return {
        series: rootStyle.getPropertyValue('--accent').trim() || '#0058c7',
        muted: rootStyle.getPropertyValue('--text-secondary').trim() || '#525252',
      };
    }

    function draw(time) {
      if (!canDraw()) return;
      const frameTime = reducedMotion ? 0 : time;
      const geometry = buildCells(frameTime);
      baseCells = geometry.cells;
      cellCounts = geometry.counts;
      scene = geometry.scene;
      lastTime = frameTime;
      pointerStrength += (((pointer?.inside) ? 1 : 0) - pointerStrength) * .1;
      const colors = palette();
      context.clearRect(0, 0, width, height);
      drawCells = baseCells.map(cell => {
        const previous = drawPositions.get(cell.key) || { x: cell.x, y: cell.y, progress: cell.progress };
        const dx = cell.x - (pointer?.x ?? -1000);
        const dy = cell.y - (pointer?.y ?? -1000);
        const distance = Math.hypot(dx, dy);
        let targetX = cell.x;
        let targetY = cell.y;
        if (!reducedMotion && pointerStrength > .001 && distance < 96 && distance > .001) {
          const force = (1 - distance / 96) ** 2 * 36 * pointerStrength;
          targetX += dx / distance * force;
          targetY += dy / distance * force;
        }
        targetX = clamp(targetX, 0, Math.max(0, width - cell.size));
        targetY = clamp(targetY, 0, Math.max(0, height - cell.size));
        if (cell.flowing && Math.abs(targetX - previous.x) > width * .35) {
          previous.x = targetX;
          previous.y = targetY;
        }
        const drawX = reducedMotion ? cell.x : clamp(previous.x + (targetX - previous.x) * .22, 0, Math.max(0, width - cell.size));
        const drawY = reducedMotion ? cell.y : clamp(previous.y + (targetY - previous.y) * .22, 0, Math.max(0, height - cell.size));
        const pulse = cell.flowing && !reducedMotion ? .8 + Math.sin(frameTime * .001 + cell.phase) * .2 : 1;
        const renderAlpha = styleRoles[cell.kind] * cell.opacity * pulse;
        const item = { ...cell, drawX, drawY, renderAlpha };
        drawPositions.set(cell.key, { x: drawX, y: drawY, progress: cell.progress });
        context.globalAlpha = clamp(renderAlpha, 0, 1);
        context.fillStyle = cell.kind === 'mainEdge' || cell.kind === 'mainVertex' || cell.kind === 'mainFace' || cell.kind === 'wakeActive'
          ? colors.series
          : colors.muted;
        context.fillRect(Math.round(drawX), Math.round(drawY), cell.size, cell.size);
        return item;
      });
      context.globalAlpha = 1;
      canvas.dataset.drawRevision = String(Number(canvas.dataset.drawRevision || 0) + 1);
      canvas.dataset.dpr = String(dpr);
    }

    function schedule() {
      if (!canAnimate() || raf) return;
      raf = requestAnimationFrame(render);
    }

    function cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function render(rafTime) {
      raf = 0;
      if (!canAnimate()) return;
      frame += 1;
      draw(Number(options.now?.() ?? rafTime));
      schedule();
    }

    function drawAndSchedule() {
      if (!canDraw()) return;
      draw(now());
      schedule();
    }

    function onPointerMove(event) {
      if (reducedMotion || !finePointerQuery.matches || disposed) return;
      const bounds = canvas.getBoundingClientRect();
      pointer = {
        x: clamp(event.clientX - bounds.left, 0, width),
        y: clamp(event.clientY - bounds.top, 0, height),
        inside: true,
      };
      schedule();
    }

    function onPointerLeave() {
      if (pointer) pointer.inside = false;
      schedule();
    }

    function syncPointerListeners() {
      const shouldListen = !disposed && finePointerQuery.matches;
      if (shouldListen === pointerListening) return;
      pointerListening = shouldListen;
      if (shouldListen) {
        canvas.addEventListener('pointermove', onPointerMove, { passive: true });
        canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
      } else {
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        pointer = null;
      }
    }

    function onIntersection(entries) {
      const entry = entries.find(candidate => candidate.target === canvas);
      if (!entry || disposed) return;
      visible = entry.isIntersecting;
      if (!visible) {
        cancel();
        return;
      }
      resize();
      drawAndSchedule();
    }

    function onResize() {
      if (!canDraw()) return;
      resize();
      drawAndSchedule();
    }

    function onVisibilityChange() {
      if (document.hidden) {
        cancel();
        return;
      }
      drawAndSchedule();
    }

    function onPageHide() {
      pageSuspended = true;
      cancel();
    }

    function onPageShow() {
      pageSuspended = false;
      drawAndSchedule();
    }

    function onMotionChange(event) {
      reducedMotion = event.matches;
      if (reducedMotion) {
        cancel();
        if (canDraw()) draw(0);
      } else {
        drawAndSchedule();
      }
    }

    function onFinePointerChange() {
      syncPointerListeners();
    }

    const intersectionObserver = new IntersectionObserver(onIntersection, { threshold: .08 });
    const resizeObserver = new ResizeObserver(onResize);
    intersectionObserver.observe(canvas);
    resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', onVisibilityChange);
    addEventListener('pagehide', onPageHide);
    addEventListener('pageshow', onPageShow);
    motionQuery.addEventListener?.('change', onMotionChange);
    motionQuery.addListener?.(onMotionChange);
    finePointerQuery.addEventListener?.('change', onFinePointerChange);
    finePointerQuery.addListener?.(onFinePointerChange);
    syncPointerListeners();

    const controller = {
      snapshot() {
        return {
          frame,
          time: lastTime,
          angle: scene?.angle ?? .58 + Math.sin(lastTime * .00016) * .16,
          scene: scene ? { ...scene, echoAngles: [...scene.echoAngles] } : null,
          styleRoles: { ...styleRoles },
          pointerStrength,
          visible,
          reducedMotion,
          rafActive: Boolean(raf),
          cellCounts: { ...cellCounts },
          baseCells: baseCells.map(cell => ({ ...cell })),
          drawCells: drawCells.map(cell => ({ ...cell })),
        };
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        cancel();
        intersectionObserver.disconnect();
        resizeObserver.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        removeEventListener('pagehide', onPageHide);
        removeEventListener('pageshow', onPageShow);
        motionQuery.removeEventListener?.('change', onMotionChange);
        motionQuery.removeListener?.(onMotionChange);
        finePointerQuery.removeEventListener?.('change', onFinePointerChange);
        finePointerQuery.removeListener?.(onFinePointerChange);
        if (pointerListening) {
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerleave', onPointerLeave);
          pointerListening = false;
        }
        if (window[controllerKey] === controller) delete window[controllerKey];
      },
    };
    return controller;
  }

  window.ResourceArchiveCubeParticleWake = Object.freeze({ mount });

  function autoMount() {
    const canvas = document.querySelector('.cube-particle-wake-canvas');
    if (!canvas) return;
    window[controllerKey]?.destroy();
    window[controllerKey] = mount(canvas);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  else autoMount();
})();
