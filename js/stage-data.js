(() => {
  let promise = null;
  let manifestPromise = null;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function loadManifest() {
    if (!manifestPromise) {
      const pending = fetch('/data/migrated/manifest.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
      manifestPromise = pending;
      void pending.catch(() => {
        if (manifestPromise === pending) manifestPromise = null;
      });
    }
    return manifestPromise;
  }

  function load() {
    if (!promise) {
      const pending = loadManifest().then(manifest => Promise.all(manifest.stages.map(async entry => {
        const response = await fetch(`/data/migrated/${entry.file}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })));
      promise = pending;
      void pending.catch(() => {
        if (promise === pending) promise = null;
      });
    }
    return promise;
  }

  function configureImage(image, stage, className = '') {
    image.className = className;
    image.src = stage.image.local;
    image.alt = stage.image.alt;
    if (!image.dataset.stageImageFallback) {
      image.dataset.stageImageFallback = '';
      image.addEventListener('error', () => {
        const fallback = element('div', `${className} missing-image`.trim(), `Missing image: ${stage.image.alt}`);
        fallback.setAttribute('role', 'img');
        fallback.setAttribute('aria-label', stage.image.alt);
        image.replaceWith(fallback);
      }, { once: true });
    }
    return image;
  }

  function image(stage, className = '') {
    return configureImage(document.createElement('img'), stage, className);
  }

  window.ResourceArchiveStages = { load, loadManifest, image, configureImage };
})();
