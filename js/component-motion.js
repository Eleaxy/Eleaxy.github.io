(() => {
  const buttonSelector = '[data-pixel-flicker]';
  const colors = ['#d8ff00', '#f5c518', '#e0492a', '#0a0a0a'];
  const finePointerQuery = typeof matchMedia === 'function'
    ? matchMedia('(hover: hover) and (pointer: fine)')
    : null;
  const reducedMotionQuery = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const states = new Set();
  const statesByButton = new WeakMap();
  let finePointer = Boolean(finePointerQuery?.matches);
  let reducedMotion = Boolean(reducedMotionQuery?.matches);
  let mutationObserver;

  function normalizeLayers(button) {
    const label = button.querySelector(':scope > .pixel-button-label');
    if (!label) return null;

    const effects = [...button.querySelectorAll(':scope > .pixel-button-effect')];
    const effect = effects.shift() || document.createElement('span');
    if (!effect.parentElement) {
      effect.className = 'pixel-button-effect';
      effect.setAttribute('aria-hidden', 'true');
      button.append(effect);
    }
    effects.forEach(duplicate => duplicate.remove());
    button.dataset.pixelButton = 'ready';
    return effect;
  }

  function rebuild(state) {
    const { button, effect } = state;
    const columns = Math.ceil(button.clientWidth / 9);
    const rows = Math.ceil(button.clientHeight / 9);
    effect.replaceChildren(...Array.from({ length: columns * rows }, (_, index) => {
      const pixel = document.createElement('i');
      pixel.style.setProperty('--column', String(index % columns));
      pixel.style.setProperty('--row', String(Math.floor(index / columns)));
      return pixel;
    }));
  }

  function clearPixels(state) {
    if (!state.effect) return;
    state.effect.style.opacity = '0';
    state.effect.querySelectorAll('i').forEach(pixel => {
      pixel.style.opacity = '0';
      pixel.style.background = 'transparent';
    });
  }

  function refresh(state) {
    state.effect.style.opacity = '1';
    state.effect.querySelectorAll('i').forEach(pixel => {
      const active = Math.random() < 0.14;
      pixel.style.opacity = active ? '1' : '0';
      pixel.style.background = active ? colors[Math.floor(Math.random() * colors.length)] : 'transparent';
    });
  }

  function stop(state) {
    if (state.timer !== null) {
      clearInterval(state.timer);
      state.timer = null;
    }
    clearPixels(state);
  }

  function start(state) {
    if (!finePointer || reducedMotion || state.timer !== null || !state.button.isConnected) return;
    refresh(state);
    state.timer = window.setInterval(() => {
      if (!finePointer || reducedMotion || !state.button.isConnected) return stop(state);
      refresh(state);
    }, 130);
  }

  function observeButton(state) {
    if (state.resizeObserver || !state.button.isConnected) return;
    state.resizeObserver = new ResizeObserver(() => rebuild(state));
    state.resizeObserver.observe(state.button);
  }

  function disconnectButton(state) {
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
  }

  function dispose(state, { removeEffect = false } = {}) {
    stop(state);
    disconnectButton(state);
    state.button.removeEventListener('mouseenter', state.enter);
    state.button.removeEventListener('mouseleave', state.leave);
    if (removeEffect) {
      state.effect?.remove();
      delete state.button.dataset.pixelButton;
    }
    states.delete(state);
    statesByButton.delete(state.button);
  }

  function clearButton(button) {
    const state = statesByButton.get(button);
    if (state) {
      dispose(state, { removeEffect: true });
      return;
    }
    button.querySelectorAll(':scope > .pixel-button-effect').forEach(effect => effect.remove());
    delete button.dataset.pixelButton;
  }

  function enhanceButton(button) {
    const effect = normalizeLayers(button);
    if (!effect) return;

    let state = statesByButton.get(button);
    if (!state) {
      state = {
        button,
        effect,
        timer: null,
        resizeObserver: null,
        enter: null,
        leave: null,
      };
      state.enter = () => start(state);
      state.leave = () => stop(state);
      button.addEventListener('mouseenter', state.enter);
      button.addEventListener('mouseleave', state.leave);
      states.add(state);
      statesByButton.set(button, state);
    } else if (state.effect !== effect) {
      stop(state);
      state.effect = effect;
    }

    rebuild(state);
    observeButton(state);
  }

  function buttonsIn(node) {
    if (!(node instanceof Element)) return [];
    const buttons = [];
    if (node.matches(buttonSelector)) buttons.push(node);
    node.querySelectorAll(buttonSelector).forEach(button => buttons.push(button));
    return buttons;
  }

  function observeMutations(records) {
    records.forEach(record => {
      record.addedNodes.forEach(node => buttonsIn(node).forEach(button => {
        if (finePointer && !reducedMotion) enhanceButton(button);
        else clearButton(button);
      }));
      record.removedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        [...states].forEach(state => {
          if ((node === state.button || node.contains(state.button)) && !state.button.isConnected) {
            dispose(state);
          }
        });
      });
    });
  }

  function disconnectDocumentObserver() {
    mutationObserver?.disconnect();
    mutationObserver = null;
  }

  function clearDocumentButtons() {
    document.querySelectorAll(buttonSelector).forEach(clearButton);
  }

  function observeDocument() {
    if (!finePointer || reducedMotion || !document.body) return;
    mutationObserver ||= new MutationObserver(observeMutations);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(buttonSelector).forEach(enhanceButton);
  }

  finePointerQuery?.addEventListener('change', event => {
    if (finePointer === event.matches) return;
    finePointer = event.matches;
    if (finePointer && !reducedMotion) observeDocument();
    else {
      disconnectDocumentObserver();
      clearDocumentButtons();
    }
  });

  reducedMotionQuery?.addEventListener('change', event => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      disconnectDocumentObserver();
      clearDocumentButtons();
    }
    else if (finePointer) observeDocument();
  });

  addEventListener('pagehide', () => {
    states.forEach(state => {
      dispose(state);
    });
    disconnectDocumentObserver();
  });

  addEventListener('pageshow', () => {
    if (finePointer && !reducedMotion) observeDocument();
  });

  if (finePointer && !reducedMotion) observeDocument();
  else clearDocumentButtons();
})();
