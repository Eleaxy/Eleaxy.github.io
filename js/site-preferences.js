(() => {
  const controllerKey = '__resourceArchiveSitePreferencesController';
  window[controllerKey]?.cleanup?.();

  const themeStorageKey = 'resource-archive-theme';
  const clickBlastStorageKey = 'resource-archive-click-blast';
  const validThemes = new Set(['light', 'dark', 'system']);
  const labels = {
    en: {
      blast: 'Blast',
      blastOn: 'Click blast on',
      blastOff: 'Click blast off',
      light: 'Light',
      dark: 'Dark',
      system: 'Auto',
      systemTitle: 'Follow system appearance',
    },
    zh: {
      blast: '爆炸',
      blastOn: '点击爆炸已开启',
      blastOff: '点击爆炸已关闭',
      light: '白',
      dark: '黑',
      system: '跟随',
      systemTitle: '跟随系统',
    },
  };

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Preferences stay available for this document when storage is unavailable.
    }
  }

  function ensureControlGroup() {
    const shell = document.querySelector('.nav-shell');
    if (!shell) return null;
    const groups = [...document.querySelectorAll('.site-controls')];
    const group = groups.shift() || document.createElement('div');
    if (!group.isConnected) {
      group.className = 'site-controls';
      shell.append(group);
    } else if (group.parentElement !== shell) {
      shell.append(group);
    }
    for (const duplicate of groups) {
      const languageToggle = duplicate.querySelector('[data-testid="language-toggle"]');
      if (languageToggle && !group.querySelector('[data-testid="language-toggle"]')) group.append(languageToggle);
      duplicate.remove();
    }
    return group;
  }

  const group = ensureControlGroup();
  if (!group) return;

  function ensureSingle(selector, create) {
    const matches = [...group.querySelectorAll(selector)];
    const element = matches.shift() || create();
    matches.forEach(match => match.remove());
    return element;
  }

  const blastToggle = ensureSingle('[data-click-blast-toggle]', () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'click-blast-toggle';
    button.dataset.clickBlastToggle = '';
    return button;
  });
  const themeControls = ensureSingle('[data-theme-controls]', () => {
    const controls = document.createElement('div');
    controls.className = 'theme-controls';
    controls.dataset.themeControls = '';
    controls.setAttribute('role', 'group');
    return controls;
  });
  const themeButtons = new Map();
  for (const choice of ['light', 'dark', 'system']) {
    const button = ensureSingle(`[data-theme-control="${choice}"]`, () => {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'theme-control';
      control.dataset.themeControl = choice;
      return control;
    });
    themeButtons.set(choice, button);
    themeControls.append(button);
  }

  const languageToggle = document.querySelector('[data-testid="language-toggle"]');
  group.replaceChildren(blastToggle, themeControls, languageToggle || document.createElement('span'));
  if (!languageToggle) group.lastElementChild.remove();

  const savedTheme = readStorage(themeStorageKey);
  let theme = validThemes.has(savedTheme) ? savedTheme : 'light';
  let clickBlast = readStorage(clickBlastStorageKey) === 'on' ? 'on' : 'off';
  let systemThemeQuery = null;
  try {
    systemThemeQuery = matchMedia('(prefers-color-scheme: dark)');
  } catch {
    systemThemeQuery = null;
  }

  function resolvedTheme() {
    if (theme !== 'system') return theme;
    return systemThemeQuery?.matches ? 'dark' : 'light';
  }

  let desiredTheme = theme;
  let desiredResolvedTheme = resolvedTheme();

  function languageCopy() {
    return labels[window.resourceArchiveI18n?.language === 'zh' ? 'zh' : 'en'];
  }

  function updateLabels() {
    const copy = languageCopy();
    blastToggle.textContent = copy.blast;
    blastToggle.setAttribute('aria-label', clickBlast === 'on' ? copy.blastOn : copy.blastOff);
    blastToggle.title = blastToggle.getAttribute('aria-label');
    for (const [choice, button] of themeButtons) {
      button.textContent = copy[choice];
      const label = choice === 'system' ? copy.systemTitle : copy[choice];
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }

  function updateControls() {
    blastToggle.setAttribute('aria-pressed', String(clickBlast === 'on'));
    for (const [choice, button] of themeButtons) {
      button.setAttribute('aria-pressed', String(choice === theme));
    }
  }

  function announce(resolved = resolvedTheme()) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
    updateLabels();
    updateControls();
    document.dispatchEvent(new CustomEvent('resource-archive-preferences-change', {
      detail: { theme, resolvedTheme: resolved, clickBlast },
    }));
  }

  function commitTheme({ theme: nextTheme, resolvedTheme: nextResolved }) {
    theme = nextTheme;
    announce(nextResolved);
  }

  function requestTheme(nextTheme, sourceElement, { persist = true } = {}) {
    if (!validThemes.has(nextTheme)) return;
    const nextResolved = nextTheme === 'system'
      ? (systemThemeQuery?.matches ? 'dark' : 'light')
      : nextTheme;
    if (nextTheme === desiredTheme && nextResolved === desiredResolvedTheme) return;
    desiredTheme = nextTheme;
    desiredResolvedTheme = nextResolved;
    if (persist) writeStorage(themeStorageKey, nextTheme);
    const controller = window.ResourceArchiveThemeTransition;
    if (!controller) {
      commitTheme({ theme: nextTheme, resolvedTheme: nextResolved });
      return;
    }
    controller.request({
      theme: nextTheme,
      resolvedTheme: nextResolved,
      sourceElement,
      commit: commitTheme,
    });
  }

  function setClickBlast(nextClickBlast) {
    if (nextClickBlast !== 'on' && nextClickBlast !== 'off') return;
    if (clickBlast === nextClickBlast) return;
    clickBlast = nextClickBlast;
    writeStorage(clickBlastStorageKey, clickBlast);
    announce();
  }

  const onSystemThemeChange = () => {
    if (desiredTheme === 'system') requestTheme('system', themeButtons.get('system'), { persist: false });
  };
  const onLanguageChange = () => updateLabels();
  const onBlastToggle = () => setClickBlast(clickBlast === 'on' ? 'off' : 'on');
  const themeButtonListeners = new Map();

  blastToggle.addEventListener('click', onBlastToggle);
  for (const [choice, button] of themeButtons) {
    const onThemeButton = () => requestTheme(choice, button);
    themeButtonListeners.set(button, onThemeButton);
    button.addEventListener('click', onThemeButton);
  }
  document.addEventListener('resource-archive-language-change', onLanguageChange);
  if (typeof systemThemeQuery?.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', onSystemThemeChange);
  } else systemThemeQuery?.addListener?.(onSystemThemeChange);

  function cleanup() {
    blastToggle.removeEventListener('click', onBlastToggle);
    for (const [button, onThemeButton] of themeButtonListeners) {
      button.removeEventListener('click', onThemeButton);
    }
    document.removeEventListener('resource-archive-language-change', onLanguageChange);
    if (typeof systemThemeQuery?.removeEventListener === 'function') {
      systemThemeQuery.removeEventListener('change', onSystemThemeChange);
    } else systemThemeQuery?.removeListener?.(onSystemThemeChange);
    if (window[controllerKey]?.cleanup === cleanup) delete window[controllerKey];
  }

  window[controllerKey] = { cleanup };
  announce();
})();
