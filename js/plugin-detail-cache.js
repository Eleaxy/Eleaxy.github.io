(() => {
  function abortError() {
    return new DOMException('Plugin detail consumer aborted', 'AbortError');
  }

  function create({ loadDetail, rendererFor }) {
    if (typeof loadDetail !== 'function' || typeof rendererFor !== 'function') {
      throw new TypeError('loadDetail and rendererFor must be functions');
    }

    const prepared = new Map();
    const pending = new Map();
    const jsonByUrl = new Map();
    const imageByUrl = new Map();
    const controllers = new Set();

    function track(controller) {
      controllers.add(controller);
      return () => controllers.delete(controller);
    }

    function loadJson(url, validate) {
      if (jsonByUrl.has(url)) return jsonByUrl.get(url);
      const controller = new AbortController();
      const release = track(controller);
      const request = fetch(url, { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(value => typeof validate === 'function' ? validate(value) : value)
        .finally(release);
      jsonByUrl.set(url, request);
      request.then(undefined, () => {
        if (jsonByUrl.get(url) === request) jsonByUrl.delete(url);
      });
      return request;
    }

    function decodeImage(url) {
      if (imageByUrl.has(url)) return imageByUrl.get(url);
      const request = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
          Promise.resolve(decoded).then(resolve, reject);
        };
        image.onerror = () => reject(new Error(`Image failed to load: ${url}`));
        image.src = url;
      });
      imageByUrl.set(url, request);
      request.then(undefined, () => {
        if (imageByUrl.get(url) === request) imageByUrl.delete(url);
      });
      return request;
    }

    function prepare(id) {
      if (prepared.has(id)) return Promise.resolve(prepared.get(id));
      if (pending.has(id)) return pending.get(id).promise;
      const controller = new AbortController();
      const release = track(controller);
      const entry = { controller, promise: null };
      entry.promise = Promise.resolve()
        .then(() => loadDetail(id, { signal: controller.signal }))
        .then(detail => {
          const renderer = rendererFor(id);
          if (!renderer || typeof renderer.prepareCriticalAssets !== 'function') {
            throw new TypeError('Plugin detail renderer must prepare critical assets');
          }
          return Promise.resolve(renderer.prepareCriticalAssets(detail, {
            loadJson,
            decodeImage,
            viewportWidth: window.innerWidth,
          })).then(() => ({ detail, criticalAssetsReady: true }));
        })
        .then(record => {
          prepared.set(id, record);
          return record;
        })
        .finally(() => {
          release();
          if (pending.get(id) === entry) pending.delete(id);
        });
      pending.set(id, entry);
      return entry.promise;
    }

    function get(id, { signal } = {}) {
      const shared = prepare(id);
      if (!signal) return shared;
      if (signal.aborted) return Promise.reject(abortError());
      return new Promise((resolve, reject) => {
        const onAbort = () => reject(abortError());
        signal.addEventListener('abort', onAbort, { once: true });
        shared.then(
          value => {
            signal.removeEventListener('abort', onAbort);
            resolve(value);
          },
          error => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
          },
        );
      });
    }

    function prefetch(id) {
      return prepare(id);
    }

    function peek(id) {
      return prepared.get(id) || null;
    }

    function abortAll() {
      for (const controller of [...controllers]) controller.abort();
      pending.clear();
    }

    return Object.freeze({ get, prefetch, peek, abortAll });
  }

  window.ResourceArchivePluginDetailCache = Object.freeze({ create });
})();
