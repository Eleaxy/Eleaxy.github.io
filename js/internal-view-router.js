(() => {
  const STATE_KEY = 'resourceArchiveInternalViewRouter';
  const INTERNAL_ROOT_NAME = 'internal-view-root';
  let activeRouter = null;
  const transitionOwners = new Set();
  const pendingTransitionOwners = new Set();

  function asUrl(value) {
    return new URL(value, window.location.href);
  }

  function sameDocumentRoute(left, right) {
    const source = asUrl(left);
    const target = asUrl(right);
    return source.origin === target.origin
      && source.pathname === target.pathname
      && source.search === target.search;
  }

  function routerState(state) {
    const value = state?.[STATE_KEY];
    return value && typeof value === 'object' ? value : null;
  }

  function stateWithRouterState(state, value) {
    const current = state && typeof state === 'object' ? state : {};
    return { ...current, [STATE_KEY]: value };
  }

  function reducedMotion() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function claimInternalTransition() {
    const token = Symbol('internal-transition');
    transitionOwners.add(token);
    document.documentElement.dataset.internalTransition = '';
    let released = false;
    return () => {
      if (released) return;
      released = true;
      transitionOwners.delete(token);
      if (transitionOwners.size === 0) delete document.documentElement.dataset.internalTransition;
    };
  }

  function claimPendingInternalViewTransition() {
    const token = Symbol('internal-view-transition-pending');
    pendingTransitionOwners.add(token);
    document.documentElement.dataset.internalViewTransitionPending = '';
    let released = false;
    return () => {
      if (released) return;
      released = true;
      pendingTransitionOwners.delete(token);
      if (pendingTransitionOwners.size === 0) delete document.documentElement.dataset.internalViewTransitionPending;
    };
  }

  function newSession() {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    return `router-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function cloneSnapshot(value) {
    try {
      return structuredClone(value);
    } catch {
      throw new Error('router history snapshot is not structured-cloneable');
    }
  }

  function historyTransactionError() {
    return new Error('router history transaction failed');
  }

  function hydrationError() {
    return new Error('router afterCommit hydration failed');
  }

  function create({ root, parseUrl, render, capture, restore, restoreFragment, canHandle, focusTarget }) {
    if (!(root instanceof Element)) throw new TypeError('root must be an Element');
    if (typeof parseUrl !== 'function' || typeof render !== 'function' || typeof canHandle !== 'function') {
      throw new TypeError('parseUrl, render, and canHandle must be functions');
    }

    activeRouter?.destroy();

    let destroyed = false;
    let activeRender = null;
    let renderEpoch = 0;
    const transitionReleases = new Set();
    const pendingTransitionReleases = new Set();
    const fallbackCleanups = new Set();
    const session = newSession();
    const knownEntries = new Map();
    let lastSuccessful = null;
    let rollbackGate = null;
    let fallbackOwner = null;
    let activeRestore = null;
    const reportedRestoreErrors = new WeakSet();
    let index = Number.isInteger(routerState(history.state)?.index)
      ? routerState(history.state).index
      : 0;
    const originalTransitionName = root.style.viewTransitionName;

    root.style.viewTransitionName = INTERNAL_ROOT_NAME;

    function announceTransition(phase, detail) {
      root.dispatchEvent(new CustomEvent(`resourcearchiveinternalviewrouter${phase}`, {
        detail,
      }));
    }

    function destroyedError() {
      return new Error('internal view router has been destroyed');
    }

    function stateFor(indexValue, snapshot, fragment = null) {
      const state = { session, index: indexValue, snapshot };
      if (typeof fragment === 'string' && fragment) state.fragment = fragment;
      return state;
    }

    function restoreFragmentAnchor(fragment) {
      if (typeof fragment !== 'string' || !fragment.startsWith('#')) return;
      let id;
      try {
        id = decodeURIComponent(fragment.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      if (!target || !root.contains(target)) return;
      target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
    }

    function isKnownOwnedState(state) {
      return state?.session === session
        && Number.isInteger(state.index)
        && knownEntries.has(state.index);
    }

    function releaseTransition(release) {
      transitionReleases.delete(release);
      release();
    }

    function releaseTransitions() {
      for (const release of [...transitionReleases]) releaseTransition(release);
    }

    function releasePendingTransition(release) {
      pendingTransitionReleases.delete(release);
      release();
    }

    function releasePendingTransitions() {
      for (const release of [...pendingTransitionReleases]) releasePendingTransition(release);
    }

    function cleanupFallbacks() {
      for (const cleanup of [...fallbackCleanups]) cleanup();
    }

    function cleanupHydrations(operation) {
      if (!operation || operation.hydrationsCleaned) return;
      operation.hydrationsCleaned = true;
      for (const cleanup of [...operation.hydrationCleanups]) {
        operation.hydrationCleanups.delete(cleanup);
        runHydrationCleanup(cleanup);
      }
    }

    function runHydrationCleanup(cleanup) {
      try {
        cleanup();
      } catch {
        reportError(new Error('router afterCommit cleanup failed'));
      }
    }

    function registerHydrationCleanup(operation, cleanup) {
      if (typeof cleanup !== 'function') return;
      if (operation.hydrationsCleaned) {
        runHydrationCleanup(cleanup);
        return;
      }
      operation.hydrationCleanups.add(cleanup);
    }

    function retireActiveRender() {
      const operation = activeRender;
      if (!operation) return;
      if (activeRender === operation) activeRender = null;
      operation.controller.abort();
      cleanupHydrations(operation);
    }

    function retireActiveRestore() {
      const owner = activeRestore;
      if (!owner) return;
      if (activeRestore === owner) activeRestore = null;
      owner.controller.abort();
    }

    function restoreSnapshot(snapshot, operation = null) {
      if (operation && !operation.isCurrent()) return Promise.resolve();
      retireActiveRestore();
      const controller = new AbortController();
      const owner = {
        controller,
        isCurrent() {
          return !destroyed
            && !controller.signal.aborted
            && activeRestore === owner
            && (!operation || operation.isCurrent());
        },
      };
      activeRestore = owner;
      return Promise.resolve().then(() => {
        if (!owner.isCurrent()) return undefined;
        return restore(snapshot, {
          signal: controller.signal,
          isCurrent: owner.isCurrent,
        });
      }).catch(error => {
        if (!owner.isCurrent()) return undefined;
        reportRestoreError(error);
        throw error;
      }).finally(() => {
        if (activeRestore === owner) activeRestore = null;
      });
    }

    function cloneTargetSnapshot(target) {
      const snapshot = document.createDocumentFragment();
      for (const child of target.childNodes) snapshot.append(child.cloneNode(true));
      return snapshot;
    }

    function rememberSuccessful(entry) {
      lastSuccessful = entry;
    }

    function commitPartial(operation, onLiveCommit) {
      if (!operation.isCurrent() || operation.sealed) return false;
      root.replaceChildren(cloneTargetSnapshot(operation.target));
      operation.rendered = true;
      onLiveCommit?.();
      return true;
    }

    function commitRendered(operation, result, context, onLiveCommit) {
      if (!operation.isCurrent()) return Promise.resolve(result);
      operation.sealed = true;
      root.replaceChildren(cloneTargetSnapshot(operation.target));
      operation.rendered = true;
      onLiveCommit?.();
      return Promise.resolve().then(async () => {
        for (const hydrate of operation.afterCommit) {
          if (!operation.isCurrent()) return result;
          let cleanup;
          try {
            cleanup = await hydrate(root);
          } catch {
            if (!operation.isCurrent()) return result;
            throw hydrationError();
          }
          registerHydrationCleanup(operation, cleanup);
        }
        if (!operation.isCurrent()) return result;
        if (context.snapshot !== undefined && context.snapshot !== null && typeof restore === 'function') {
          operation.postUpdateRestore = () => restoreSnapshot(context.snapshot, operation);
          return result;
        }
        if (!operation.isCurrent()) {
          return result;
        }
        if (context.fragment) {
          restoreFragmentAnchor(context.fragment);
          return result;
        }
        if (context.initial) return result;
        const target = typeof focusTarget === 'function' ? focusTarget(context.route, context) : null;
        target?.focus?.({ preventScroll: true });
        return result;
      });
    }

    function renderRoute(route, context, onPrepared) {
      retireActiveRender();
      cleanupFallbacks();
      const controller = new AbortController();
      const operation = {
        controller,
        target: document.createDocumentFragment(),
        epoch: ++renderEpoch,
        rendered: false,
        sealed: false,
        afterCommit: [],
        hydrationCleanups: new Set(),
        hydrationsCleaned: false,
        postUpdateRestore: null,
        postUpdateRestorePromise: null,
        isCurrent() {
          return !destroyed && !controller.signal.aborted && activeRender === operation;
        },
      };
      activeRender = operation;
      const renderContext = {
        signal: controller.signal,
        direction: context.direction,
        snapshot: context.snapshot,
        initial: context.initial,
        target: operation.target,
        isCurrent: () => operation.isCurrent(),
        commit(callback) {
          if (!operation.isCurrent() || operation.sealed) return false;
          if (typeof callback !== 'function') throw new TypeError('commit callback must be a function');
          callback(operation.target);
          return true;
        },
        afterCommit(callback) {
          if (!operation.isCurrent() || operation.sealed) return false;
          if (typeof callback !== 'function') throw new TypeError('afterCommit callback must be a function');
          operation.afterCommit.push(callback);
          return true;
        },
        commitNow(callback) {
          if (callback !== undefined && typeof callback !== 'function') {
            throw new TypeError('commitNow callback must be a function');
          }
          return commitPartial(operation, () => callback?.(root));
        },
      };
      const prepared = Promise.resolve()
        .then(() => render(route, renderContext))
        .then(result => {
          if (!operation.isCurrent()) return result;
          const commit = onPrepared ?? ((currentOperation, currentResult) => commitRendered(
            currentOperation,
            currentResult,
            { ...context, route },
          ));
          return commit(operation, result, renderContext);
        });
      return { operation, updated: prepared };
    }

    function runPostUpdateRestore(operation) {
      if (!operation?.postUpdateRestore) return Promise.resolve();
      if (operation.postUpdateRestorePromise) return operation.postUpdateRestorePromise;
      operation.postUpdateRestorePromise = Promise.resolve().then(() => {
        if (!operation.isCurrent()) return undefined;
        return operation.postUpdateRestore();
      });
      return operation.postUpdateRestorePromise;
    }

    function postUpdateRestore(updated, operation) {
      return Promise.resolve(updated).then(
        () => runPostUpdateRestore(typeof operation === 'function' ? operation() : operation),
        () => undefined,
      );
    }

    function enterFallback(route, context, onPrepared, existingRender) {
      const renderOperation = existingRender ?? renderRoute(route, context, onPrepared);
      let fallback = null;
      const updated = renderOperation.updated.then(result => {
        if (!renderOperation.operation.isCurrent()) return result;
        const token = Symbol('internal-view-enter');
        let timer = null;
        let cleared = false;
        let resolveFinished;
        const finished = new Promise(resolve => { resolveFinished = resolve; });
        const clear = () => {
          if (cleared) return;
          cleared = true;
          if (timer !== null) clearTimeout(timer);
          fallbackCleanups.delete(clear);
          if (fallbackOwner?.token === token) {
            fallbackOwner = null;
            root.removeAttribute('data-internal-view-enter');
          }
          resolveFinished();
        };
        fallbackOwner?.clear();
        fallbackOwner = { token, clear };
        fallbackCleanups.add(clear);
        root.removeAttribute('data-internal-view-enter');
        void root.offsetWidth;
        root.dataset.internalViewEnter = '';
        timer = setTimeout(clear, 180);
        fallback = { clear, finished };
        return result;
      });
      return {
        operation: renderOperation.operation,
        updated,
        finished: updated.then(result => fallback ? fallback.finished.then(() => result) : result),
      };
    }

    function settleTransition(result) {
      return Promise.resolve(result.finished).then(
        () => undefined,
        error => { throw error; },
      );
    }

    function transition(route, context, onPrepared) {
      if (context.initial) {
        const renderOperation = renderRoute(route, context, onPrepared);
        const restored = postUpdateRestore(renderOperation.updated, renderOperation.operation);
        return {
          operation: renderOperation.operation,
          updated: renderOperation.updated,
          finished: Promise.all([renderOperation.updated, restored]).then(([result]) => result),
        };
      }
      const token = Symbol('internal-view-transition');
      const transitionDetail = { token, route, direction: context.direction };
      const releasePending = claimPendingInternalViewTransition();
      pendingTransitionReleases.add(releasePending);
      const finish = () => {
        releasePendingTransition(releasePending);
        announceTransition('transitionfinished', transitionDetail);
      };
      announceTransition('beforetransition', transitionDetail);
      if (reducedMotion()) {
        const renderOperation = renderRoute(route, context, onPrepared);
        const restored = postUpdateRestore(renderOperation.updated, renderOperation.operation);
        return {
          operation: renderOperation.operation,
          updated: renderOperation.updated,
          finished: Promise.all([renderOperation.updated, restored]).then(([result]) => result).finally(finish),
        };
      }
      if (typeof document.startViewTransition !== 'function') {
        const fallback = enterFallback(route, context, onPrepared);
        const restored = postUpdateRestore(fallback.updated, fallback.operation);
        return {
          ...fallback,
          finished: Promise.all([fallback.finished, restored]).then(([result]) => result).finally(finish),
        };
      }

      let renderOperation = null;
      const update = () => {
        renderOperation ??= renderRoute(route, context, onPrepared);
        return renderOperation.updated;
      };
      const release = claimInternalTransition();
      transitionReleases.add(release);
      let viewTransition;
      try {
        viewTransition = document.startViewTransition(update);
      } catch {
        releaseTransition(release);
        const fallback = enterFallback(route, context, onPrepared, renderOperation);
        const restored = postUpdateRestore(fallback.updated, fallback.operation);
        return {
          ...fallback,
          finished: Promise.all([fallback.finished, restored]).then(([result]) => result).finally(finish),
        };
      }

      const updated = viewTransition?.updateCallbackDone
        ? Promise.resolve(viewTransition.updateCallbackDone)
        : Promise.resolve().then(update);
      const restored = postUpdateRestore(updated, () => renderOperation?.operation);
      const finishedSource = viewTransition?.finished && typeof viewTransition.finished.then === 'function'
        ? viewTransition.finished
        : updated;
      return {
        get operation() { return renderOperation?.operation ?? null; },
        updated,
        finished: Promise.all([finishedSource, restored]).then(([result]) => result).finally(() => {
          releaseTransition(release);
          finish();
        }),
      };
    }

    function settleFragmentTransition(result, detail) {
      return Promise.resolve(result).then(
        value => {
          announceTransition('fragmenttransitionfinished', detail);
          return value;
        },
        error => {
          announceTransition('fragmenttransitionfinished', detail);
          throw error;
        },
      );
    }

    function applyHistory(url, snapshot, replace, fragment = null) {
      const prior = { url: window.location.href, state: history.state, index };
      const priorFragment = routerState(prior.state)?.fragment ?? null;
      const priorState = stateWithRouterState(prior.state, stateFor(prior.index, snapshot, priorFragment));
      const nextIndex = replace ? prior.index : prior.index + 1;
      const nextState = stateWithRouterState(prior.state, stateFor(nextIndex, null, fragment));
      let replacedPrior = false;
      try {
        history.replaceState(priorState, '', prior.url);
        replacedPrior = true;
        if (replace) history.replaceState(nextState, '', url.href);
        else history.pushState(nextState, '', url.href);
      } catch {
        if (replacedPrior) {
          try {
            history.replaceState(prior.state, '', prior.url);
          } catch {}
        }
        throw historyTransactionError();
      }
      index = nextIndex;
      knownEntries.set(prior.index, { index: prior.index, state: priorState, url: prior.url });
      const destination = { index: nextIndex, state: nextState, url: url.href };
      knownEntries.set(nextIndex, destination);
      return destination;
    }

    function completeNavigation(result) {
      return result.updated.then(
        () => settleTransition(result),
        error => settleTransition(result).then(
          () => { throw error; },
          () => { throw error; },
        ),
      );
    }

    function adoptInitialEntry(fragment) {
      const state = routerState(history.state);
      const entryIndex = Number.isInteger(state?.index) ? state.index : index;
      const entryFragment = typeof fragment === 'string' && fragment ? fragment : state?.fragment ?? null;
      const entryState = stateWithRouterState(history.state, stateFor(entryIndex, state?.snapshot ?? null, entryFragment));
      history.replaceState(entryState, '', window.location.href);
      index = entryIndex;
      const entry = { index: entryIndex, state: entryState, url: window.location.href };
      knownEntries.set(entryIndex, entry);
      rememberSuccessful(entry);
    }

    function syncFromLocation(options = {}) {
      return syncFromLocationInternal(options, false);
    }

    function syncFromPopstate(options = {}) {
      return syncFromLocationInternal(options, true);
    }

    function syncFromLocationInternal({ initial = false, direction = initial ? 'initial' : 'popstate', onFailure } = {}, historyTraversal) {
      if (destroyed) return Promise.reject(destroyedError());
      retireActiveRestore();
      let result = null;
      let failureHandled = false;
      let attemptedState = null;
      let owned = false;
      const fail = (error, rendered) => {
        if (!failureHandled) {
          failureHandled = true;
          onFailure?.(rendered, { state: attemptedState, owned });
        }
        throw error;
      };
      return Promise.resolve().then(() => {
        if (destroyed) throw destroyedError();
        const state = routerState(history.state);
        attemptedState = state;
        owned = isKnownOwnedState(state);
        const url = asUrl(window.location.href);
        const route = parseUrl(url);
        const context = {
          direction,
          snapshot: state?.snapshot ?? null,
          fragment: initial
            ? url.hash || (typeof state?.fragment === 'string' ? state.fragment : null)
            : owned && typeof state?.fragment === 'string' ? state.fragment : null,
          initial,
        };
        const currentEntry = lastSuccessful;
        if (!initial && owned && currentEntry && sameDocumentRoute(currentEntry.url, window.location.href)) {
          const fragmentTransition = asUrl(currentEntry.url).hash === url.hash
            ? null
            : { token: Symbol('internal-view-fragment'), direction };
          if (fragmentTransition) announceTransition('fragmentbeforetransition', fragmentTransition);
          index = state.index;
          rememberSuccessful(knownEntries.get(state.index));
          let restored;
          if (fragmentTransition) {
            if (context.snapshot !== null && typeof restoreFragment === 'function') {
              restored = Promise.resolve().then(() => restoreFragment(context.snapshot, {
                direction: fragmentTransition.direction,
                token: fragmentTransition.token,
              }));
            } else if (historyTraversal
              && context.snapshot !== null
              && typeof restoreFragment !== 'function'
              && typeof capture === 'function'
              && typeof restore === 'function') {
              restored = restoreSnapshot(context.snapshot);
            } else if (context.fragment) {
              restored = Promise.resolve().then(() => restoreFragmentAnchor(context.fragment));
            }
          } else if (context.snapshot !== null && typeof restore === 'function') {
            restored = restoreSnapshot(context.snapshot);
          } else if (context.fragment) {
            restored = restoreFragmentAnchor(context.fragment);
          }
          return fragmentTransition ? settleFragmentTransition(restored, fragmentTransition) : restored;
        }
        result = transition(route, context, (operation, value, renderContext) => commitRendered(
          operation,
          value,
          { ...context, ...renderContext, route },
          () => {
            if (initial) adoptInitialEntry(context.fragment);
            else if (owned) {
              index = state.index;
              rememberSuccessful(knownEntries.get(state.index));
            }
          },
        ));
        return result.updated.then(
          () => settleTransition(result),
          error => settleTransition(result).then(
            () => fail(error, result.operation?.rendered === true),
            () => fail(error, result.operation?.rendered === true),
          ),
        );
      }).catch(error => fail(error, result?.operation?.rendered === true));
    }

    function navigate(value, { trigger = 'programmatic', replace = false } = {}) {
      if (destroyed) return Promise.reject(destroyedError());
      let url;
      let route;
      try {
        url = asUrl(value);
        const crossShellFallback = trigger === 'fallback-back'
          && replace === true
          && url.origin === window.location.origin
          && url.pathname !== window.location.pathname;
        if (crossShellFallback) {
          window.location.replace(url.href);
          return Promise.resolve();
        }
        if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || canHandle(url) !== true) {
          throw new TypeError('navigate only accepts supported same-document URLs');
        }
        route = parseUrl(url);
      } catch (error) {
        return Promise.reject(error);
      }
      retireActiveRestore();
      return Promise.resolve().then(() => {
        if (destroyed) throw destroyedError();
        const snapshot = typeof capture === 'function' ? cloneSnapshot(capture()) : null;
        const fragment = url.hash || null;
        const context = { direction: trigger, snapshot: null, fragment, initial: false };
        const result = transition(route, context, (operation, rendered, renderContext) => {
          const destination = applyHistory(url, snapshot, replace, fragment);
          return commitRendered(
            operation,
            rendered,
            { ...context, ...renderContext, route },
            () => rememberSuccessful(destination),
          );
        });
        return completeNavigation(result);
      });
    }

    function navigateFragment(value, { trigger = 'fragment' } = {}) {
      if (destroyed) return Promise.reject(destroyedError());
      let url;
      let fragmentTransition = null;
      try {
        url = asUrl(value);
        if (!url.hash || url.origin !== window.location.origin || url.pathname !== window.location.pathname
          || url.search !== window.location.search || canHandle(url) !== true) {
          throw new TypeError('navigateFragment only accepts supported same-document fragments');
        }
        fragmentTransition = { token: Symbol('internal-view-fragment'), direction: trigger };
        announceTransition('fragmentbeforetransition', fragmentTransition);
      } catch (error) {
        if (fragmentTransition) announceTransition('fragmenttransitionfinished', fragmentTransition);
        return Promise.reject(error);
      }
      retireActiveRestore();
      const legacyFragmentRestoration = typeof restoreFragment !== 'function'
        && typeof capture === 'function'
        && typeof restore === 'function';
      const result = Promise.resolve().then(() => {
        if (destroyed) throw destroyedError();
        const snapshot = legacyFragmentRestoration
          ? cloneSnapshot(capture())
          : routerState(history.state)?.snapshot ?? null;
        const destination = applyHistory(url, snapshot, false, url.hash);
        rememberSuccessful(destination);
        restoreFragmentAnchor(url.hash);
      });
      return settleFragmentTransition(result, fragmentTransition);
    }

    function back() {
      if (destroyed) return false;
      const current = routerState(history.state);
      const previousIndex = current?.index - 1;
      if (!isKnownOwnedState(current) || !Number.isInteger(previousIndex) || !knownEntries.has(previousIndex)) {
        return false;
      }
      history.back();
      return true;
    }

    function click(event) {
      if (destroyed || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');
      if (!anchor || !root.contains(anchor) || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target.toLowerCase() !== '_self') return;

      let url;
      try {
        url = asUrl(anchor.href);
      } catch (error) {
        reportError(error);
        return;
      }

      if (anchor.hasAttribute('data-internal-view-history-back')) {
        if (back()) {
          event.preventDefault();
          return;
        }
        if (anchor.hasAttribute('data-internal-view-fallback-replace')) {
          event.preventDefault();
          navigate(anchor.href, { trigger: 'fallback-back', replace: true }).catch(reportError);
          return;
        }
      }
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || canHandle(url) !== true) return;
      if (url.hash && url.search === window.location.search) {
        event.preventDefault();
        navigateFragment(url, { trigger: 'link' }).catch(reportError);
        return;
      }
      event.preventDefault();
      navigate(url, { trigger: 'link' }).catch(reportError);
    }

    function reportError(error) {
      if (error && (typeof error === 'object' || typeof error === 'function')
        && reportedRestoreErrors.has(error)) return;
      root.dispatchEvent(new CustomEvent('resourcearchiveinternalviewroutererror', {
        bubbles: true,
        detail: { error },
      }));
    }

    function reportRestoreError(error) {
      reportError(error);
      if (error && (typeof error === 'object' || typeof error === 'function')) {
        reportedRestoreErrors.add(error);
      }
    }

    function repairLastSuccessfulEntry() {
      if (!lastSuccessful) return;
      try {
        history.replaceState(lastSuccessful.state, '', lastSuccessful.url);
        index = lastSuccessful.index;
      } catch {
        reportError(new Error('router popstate recovery failed'));
      }
    }

    function popstate(event) {
      const attempted = routerState(event.state);
      const owned = isKnownOwnedState(attempted);
      const direction = owned
        ? attempted.index < index ? 'back' : attempted.index > index ? 'forward' : 'popstate'
        : 'popstate';
      syncFromPopstate({
        direction,
        onFailure(rendered) {
          if (rendered) {
            rollbackGate = null;
            return;
          }
          if (rollbackGate !== null) {
            rollbackGate = null;
            repairLastSuccessfulEntry();
            return;
          }
          const safe = lastSuccessful;
          if (owned && safe && safe.index !== attempted.index && knownEntries.has(safe.index)) {
            rollbackGate = { source: attempted.index, target: safe.index };
            history.go(safe.index - attempted.index);
            return;
          }
          repairLastSuccessfulEntry();
        },
      }).then(() => {
        if (rollbackGate && owned && attempted.index === rollbackGate.target) rollbackGate = null;
      }).catch(reportError);
    }

    function pagehide() {
      retireActiveRestore();
      retireActiveRender();
      cleanupFallbacks();
      releaseTransitions();
      releasePendingTransitions();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      retireActiveRestore();
      retireActiveRender();
      root.removeEventListener('click', click);
      window.removeEventListener('popstate', popstate);
      window.removeEventListener('pagehide', pagehide);
      root.style.viewTransitionName = originalTransitionName;
      cleanupFallbacks();
      releaseTransitions();
      releasePendingTransitions();
      if (activeRouter === controller) activeRouter = null;
    }

    const controller = Object.freeze({ navigate, syncFromLocation, destroy });
    activeRouter = controller;
    root.addEventListener('click', click);
    window.addEventListener('popstate', popstate);
    window.addEventListener('pagehide', pagehide);
    return controller;
  }

  window.ResourceArchiveInternalViewRouter = Object.freeze({ create });
})();
