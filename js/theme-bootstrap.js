(() => {
  const themeStorageKey = 'resource-archive-theme';
  const validThemes = new Set(['light', 'dark', 'system']);

  let theme = 'light';
  try {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (validThemes.has(savedTheme)) theme = savedTheme;
  } catch {
    theme = 'light';
  }

  let systemDark = false;
  try {
    systemDark = Boolean(matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    systemDark = false;
  }

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
})();
