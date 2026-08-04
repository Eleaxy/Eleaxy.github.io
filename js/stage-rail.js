(() => {
  const finePointerQuery = '(hover: hover) and (pointer: fine) and (min-width: 761px)';
  const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
  const translate = (key, fallback) => window.resourceArchiveI18n?.translate(key) ?? fallback;

  class StageRail {
    constructor(viewport, options = {}) {
      viewport.__stageRail?.destroy();
      this.viewport = viewport;
      this.track = viewport.querySelector('[data-stage-track]');
      if (!this.track) throw new Error('StageRail requires a [data-stage-track] element');
      this.previousKey = options.previousKey ?? 'stages-rail-previous';
      this.previousFallback = options.previousFallback ?? 'Previous stages';
      this.nextKey = options.nextKey ?? 'stages-rail-next';
      this.nextFallback = options.nextFallback ?? 'Next stages';
      this.mediaSelector = options.mediaSelector ?? '.stage-media';
      this.fineQuery = matchMedia(finePointerQuery);
      this.reducedQuery = matchMedia(reducedMotionQuery);
      this.fine = this.fineQuery.matches;
      this.reduced = this.reducedQuery.matches;
      this.x = 0;
      this.velocity = 0;
      this.dragging = false;
      this.moved = false;
      this.pointerId = null;
      this.dragController = null;
      this.frame = 0;
      this.returnTimer = 0;
      this.returnTransitionHandler = null;
      this.destroyed = false;
      this.suspended = false;
      this.desktopInstalled = false;
      this.listeners = [];
      this.desktopListeners = [];
      this.arrowGeometryObserver = null;
      this.initialTransform = this.track.style.transform;
      this.hadFineClass = this.viewport.classList.contains('is-fine-rail');
      this.viewport.__stageRail = this;

      this.listenMediaQuery(this.fineQuery);
      this.listenMediaQuery(this.reducedQuery);
      this.listen(document, 'resource-archive-language-change', () => {
        this.updateArrowLabels();
        this.updateArrowGeometry();
      });
      this.listen(window, 'pagehide', () => this.suspend());
      this.listen(window, 'pageshow', () => this.resume());
      this.reconcile();
    }

    get minX() {
      const contentRight = [...this.track.children]
        .filter(card => card.isConnected)
        .reduce((right, card) => Math.max(right, card.offsetLeft + card.offsetWidth), 0);
      return Math.min(0, this.viewport.clientWidth - contentRight);
    }

    clamp(value) {
      return Math.max(this.minX, Math.min(0, value));
    }

    cardPitch() {
      const cards = [...this.track.children].filter(card => card.isConnected);
      if (cards.length > 1) {
        const first = cards[0].getBoundingClientRect();
        const second = cards[1].getBoundingClientRect();
        const pitch = Math.abs(second.left - first.left);
        if (pitch > 0) return pitch;
      }
      return (cards[0]?.getBoundingClientRect().width || 0) + 28;
    }

    wheelUnit(deltaMode) {
      if (deltaMode === 1) {
        const lineHeight = Number.parseFloat(getComputedStyle(this.viewport).lineHeight);
        return Number.isFinite(lineHeight) ? lineHeight : 16;
      }
      if (deltaMode === 2) return window.innerHeight || this.viewport.clientHeight || 1;
      return 1;
    }

    wheelDelta(event) {
      const unit = this.wheelUnit(event.deltaMode);
      const deltaX = event.deltaX * unit;
      const deltaY = event.deltaY * unit;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      const next = this.clamp(this.x - delta);
      return { delta, next, handoff: next === this.x };
    }

    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this.listeners.push(() => target.removeEventListener(type, handler, options));
    }

    listenDesktop(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this.desktopListeners.push(() => target.removeEventListener(type, handler, options));
    }

    listenMediaQuery(query) {
      const handler = () => this.reconcile();
      if (query.addEventListener) {
        query.addEventListener('change', handler);
        this.listeners.push(() => query.removeEventListener('change', handler));
      } else {
        query.addListener(handler);
        this.listeners.push(() => query.removeListener(handler));
      }
    }

    setX(value) {
      if (this.destroyed) return;
      this.x = value;
      this.track.style.transform = `translate3d(${value}px, 0, 0)`;
      this.updateArrows();
    }

    resisted(value) {
      if (value > 0) return 18 * (1 - Math.exp(-value / 36));
      if (value < this.minX) return this.minX - 18 * (1 - Math.exp(-(this.minX - value) / 36));
      return value;
    }

    renderedX() {
      const transform = getComputedStyle(this.track).transform;
      if (transform === 'none') return 0;
      try {
        return new DOMMatrixReadOnly(transform).m41;
      } catch {
        return this.x;
      }
    }

    clearEndpointReturn({ freeze = false } = {}) {
      if (this.returnTimer) clearTimeout(this.returnTimer);
      this.returnTimer = 0;
      if (this.returnTransitionHandler) {
        this.track.removeEventListener('transitionend', this.returnTransitionHandler);
        this.returnTransitionHandler = null;
      }
      if (!this.track.classList.contains('stage-rail-returning')) return;
      const current = freeze ? this.renderedX() : this.x;
      this.track.classList.remove('stage-rail-returning');
      if (freeze && !this.destroyed) this.setX(current);
    }

    returnToBoundary(target) {
      if (this.destroyed || this.suspended || !this.desktopInstalled) return;
      this.cancelInertia();
      this.clearEndpointReturn();
      this.velocity = 0;
      const endpoint = this.clamp(target);
      if (this.reduced || this.x === endpoint) {
        this.setX(endpoint);
        return;
      }
      this.track.classList.add('stage-rail-returning');
      void this.track.offsetWidth;
      this.setX(endpoint);
      const complete = event => {
        if (event && (event.target !== this.track || event.propertyName !== 'transform')) return;
        this.clearEndpointReturn();
      };
      this.returnTransitionHandler = complete;
      this.track.addEventListener('transitionend', complete);
      this.returnTimer = window.setTimeout(complete, 180);
    }

    cancelInertia() {
      if (!this.frame) return;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    stopMotion({ clamp = true, freezeEndpointReturn = false } = {}) {
      this.cancelInertia();
      this.clearEndpointReturn({ freeze: freezeEndpointReturn });
      this.velocity = 0;
      if (clamp && this.desktopInstalled && !this.destroyed) this.setX(this.clamp(this.x));
    }

    releasePointer(pointerId = this.pointerId) {
      if (pointerId === this.pointerId) this.pointerId = null;
    }

    stopPointerTracking() {
      this.dragController?.abort();
      this.dragController = null;
    }

    stopDragging() {
      this.stopPointerTracking();
      this.releasePointer();
      this.dragging = false;
      this.moved = false;
    }

    settle() {
      if (this.destroyed || this.suspended || !this.desktopInstalled) return;
      this.cancelInertia();
      this.clearEndpointReturn();
      if (this.reduced) {
        this.velocity = 0;
        this.setX(this.clamp(this.x));
        return;
      }
      const step = () => {
        if (this.destroyed || this.suspended || this.reduced || !this.desktopInstalled) {
          this.frame = 0;
          this.velocity = 0;
          if (!this.destroyed && this.desktopInstalled) this.setX(this.clamp(this.x));
          return;
        }
        const proposed = this.x + this.velocity;
        const next = this.clamp(proposed);
        if (next !== proposed) {
          this.velocity = 0;
          this.setX(next);
          this.frame = 0;
          return;
        }
        this.setX(next);
        this.velocity *= .94;
        if (Math.abs(this.velocity) < .06) {
          const endpointRange = 7;
          if (this.x >= -endpointRange) {
            this.setX(0);
          } else if (this.x <= this.minX + endpointRange) {
            this.setX(this.minX);
          } else {
            const snapped = Math.round(this.clamp(this.x) / 14) * 14;
            this.setX(this.clamp(snapped));
          }
          this.frame = 0;
          return;
        }
        this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    }

    createArrows() {
      if (this.previous?.isConnected && this.next?.isConnected) return;
      this.previous?.remove();
      this.next?.remove();
      const previous = document.createElement('button');
      const next = document.createElement('button');
      previous.className = next.className = 'stage-rail-arrow';
      previous.type = next.type = 'button';
      previous.textContent = '←';
      next.textContent = '→';
      previous.dataset.direction = '-1';
      next.dataset.direction = '1';
      this.viewport.after(previous, next);
      this.previous = previous;
      this.next = next;
      this.updateArrowLabels();
      this.observeArrowGeometry();
      this.updateArrowGeometry();
    }

    updateArrowLabels() {
      this.previous?.setAttribute('aria-label', translate(this.previousKey, this.previousFallback));
      this.next?.setAttribute('aria-label', translate(this.nextKey, this.nextFallback));
    }

    updateArrowGeometry() {
      if (this.destroyed || !this.desktopInstalled || !this.previous || !this.next) return;
      const media = [...this.track.querySelectorAll(this.mediaSelector)].find(node => node.isConnected);
      const host = this.next.offsetParent || this.previous.offsetParent;
      if (!media || !host) return;
      const mediaBounds = media.getBoundingClientRect();
      const hostBounds = host.getBoundingClientRect();
      const top = mediaBounds.top - hostBounds.top + mediaBounds.height / 2;
      if (!Number.isFinite(top)) return;
      this.previous.style.top = `${top}px`;
      this.next.style.top = `${top}px`;
    }

    observeArrowGeometry() {
      this.arrowGeometryObserver?.disconnect();
      this.arrowGeometryObserver = null;
      if (typeof ResizeObserver !== 'function' || !this.previous || !this.next) return;
      const media = [...this.track.querySelectorAll(this.mediaSelector)].find(node => node.isConnected);
      const host = this.next.offsetParent || this.previous.offsetParent;
      const observer = new ResizeObserver(() => {
        if (this.arrowGeometryObserver === observer) this.updateArrowGeometry();
      });
      [this.viewport, this.track, media, host].filter(Boolean).forEach(node => observer.observe(node));
      this.arrowGeometryObserver = observer;
    }

    disconnectArrowGeometryObserver() {
      this.arrowGeometryObserver?.disconnect();
      this.arrowGeometryObserver = null;
    }

    attachDesktopListeners() {
      if (this.desktopListeners.length) return;
      this.listenDesktop(this.previous, 'click', () => {
        this.stopMotion();
        this.setX(this.clamp(this.x + this.cardPitch()));
      });
      this.listenDesktop(this.next, 'click', () => {
        this.stopMotion();
        this.setX(this.clamp(this.x - this.cardPitch()));
      });
      this.listenDesktop(this.viewport, 'pointerdown', event => {
        if (this.destroyed || this.suspended || !this.desktopInstalled || event.button !== 0) return;
        this.stopDragging();
        this.stopMotion({ clamp: false, freezeEndpointReturn: true });
        this.dragging = true;
        this.moved = false;
        this.pointerId = event.pointerId;
        this.startX = event.clientX;
        this.startOffset = this.x;
        this.lastX = event.clientX;
        this.lastTime = performance.now();
        const controller = new AbortController();
        this.dragController = controller;
        const move = moveEvent => {
          if (!this.dragging || moveEvent.pointerId !== this.pointerId) return;
          const delta = moveEvent.clientX - this.startX;
          if (Math.abs(delta) > 5) this.moved = true;
          const now = performance.now();
          const elapsed = Math.max(1, now - this.lastTime);
          this.velocity = this.reduced ? 0 : (moveEvent.clientX - this.lastX) / elapsed * 16;
          this.lastX = moveEvent.clientX;
          this.lastTime = now;
          const proposed = this.startOffset + delta;
          this.setX(this.reduced ? this.clamp(proposed) : this.resisted(proposed));
        };
        const release = releaseEvent => {
          if (!this.dragging || releaseEvent.pointerId !== this.pointerId) return;
          this.dragging = false;
          this.stopPointerTracking();
          this.releasePointer(releaseEvent.pointerId);
          if (this.x > 0 || this.x < this.minX) {
            this.returnToBoundary(this.x > 0 ? 0 : this.minX);
          } else {
            this.settle();
          }
        };
        document.addEventListener('pointermove', move, { signal: controller.signal });
        document.addEventListener('pointerup', release, { signal: controller.signal });
        document.addEventListener('pointercancel', release, { signal: controller.signal });
      });
      this.listenDesktop(this.viewport, 'dragstart', event => {
        if (!this.dragging || !this.moved) return;
        event.preventDefault();
      });
      this.listenDesktop(this.viewport, 'click', event => {
        if (!this.moved) return;
        event.preventDefault();
        event.stopPropagation();
        this.moved = false;
      }, true);
      this.listenDesktop(this.viewport, 'wheel', event => {
        const wheel = this.wheelDelta(event);
        if (wheel.handoff) return;
        event.preventDefault();
        this.setX(wheel.next);
      }, { passive: false });
      this.listenDesktop(window, 'resize', () => {
        if (!this.destroyed && !this.suspended && this.desktopInstalled) {
          this.stopMotion();
          this.updateArrowGeometry();
        }
      }, { passive: true });
    }

    detachDesktopListeners() {
      this.desktopListeners.splice(0).forEach(remove => remove());
    }

    installDesktop() {
      if (this.destroyed || this.suspended || !this.fine) return;
      this.desktopInstalled = true;
      this.viewport.classList.add('is-fine-rail');
      this.createArrows();
      if (!this.arrowGeometryObserver) this.observeArrowGeometry();
      this.attachDesktopListeners();
      this.setX(this.clamp(this.x));
      this.updateArrowGeometry();
    }

    removeDesktop() {
      this.disconnectArrowGeometryObserver();
      if (!this.desktopInstalled) return;
      this.stopMotion();
      this.stopDragging();
      this.detachDesktopListeners();
      this.previous?.remove();
      this.next?.remove();
      this.previous = null;
      this.next = null;
      this.desktopInstalled = false;
      this.viewport.classList.toggle('is-fine-rail', this.hadFineClass);
      this.track.style.transform = this.initialTransform;
      this.x = 0;
    }

    reconcile() {
      if (this.destroyed || this.suspended) return;
      this.fine = this.fineQuery.matches;
      this.reduced = this.reducedQuery.matches;
      if (!this.fine) {
        this.removeDesktop();
        return;
      }
      this.installDesktop();
      if (this.reduced) this.stopMotion();
      else this.updateArrows();
    }

    suspend() {
      if (this.destroyed || this.suspended) return;
      this.suspended = true;
      this.stopMotion();
      this.stopDragging();
      this.detachDesktopListeners();
      this.disconnectArrowGeometryObserver();
      if (this.previous) this.previous.disabled = true;
      if (this.next) this.next.disabled = true;
    }

    resume() {
      if (this.destroyed || !this.suspended) return;
      this.suspended = false;
      this.reconcile();
    }

    updateArrows() {
      if (this.destroyed || !this.previous || this.suspended) return;
      const atStart = this.x >= -.5;
      const atEnd = this.x <= this.minX + .5;
      this.previous.disabled = atStart;
      this.previous.hidden = atStart;
      this.previous.style.pointerEvents = atStart ? 'none' : '';
      this.next.disabled = atEnd;
      this.next.hidden = atEnd;
      this.next.style.pointerEvents = atEnd ? 'none' : '';
    }

    destroy() {
      if (this.destroyed) return;
      this.clearEndpointReturn();
      this.destroyed = true;
      this.cancelInertia();
      this.velocity = 0;
      this.stopDragging();
      this.detachDesktopListeners();
      this.disconnectArrowGeometryObserver();
      this.listeners.splice(0).forEach(remove => remove());
      this.previous?.remove();
      this.next?.remove();
      this.previous = null;
      this.next = null;
      this.desktopInstalled = false;
      this.viewport.classList.toggle('is-fine-rail', this.hadFineClass);
      this.track.style.transform = this.initialTransform;
      if (this.viewport.__stageRail === this) delete this.viewport.__stageRail;
    }
  }

  window.StageRail = StageRail;
})();
