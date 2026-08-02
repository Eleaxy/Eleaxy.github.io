(() => {
  const skippedViewTransitionMessage = 'Transition was skipped';
  const listenerKey = '__resourceArchiveSkippedViewTransitionCompatibilityListenerInstalled';

  function isCatalogRestore() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation?.type !== 'back_forward') return false;
    const url = new URL(location.href);
    if (url.pathname === '/stages.html') return !url.searchParams.has('stage');
    if (url.pathname === '/plugins.html') return !url.searchParams.has('plugin');
    return false;
  }

  function isSkippedViewTransition(reason) {
    return reason === skippedViewTransitionMessage || reason?.message === skippedViewTransitionMessage;
  }

  if (globalThis[listenerKey]) return;
  globalThis[listenerKey] = true;
  addEventListener('unhandledrejection', event => {
    if (!isCatalogRestore()) return;
    if (!isSkippedViewTransition(event.reason)) return;
    event.preventDefault();
  });
})();
