(() => {
  const requiredKeys = ['id', 'source_number', 'title', 'date', 'duration', 'poster', 'source_url', 'downloads'];
  const downloadKeys = ['filename', 'url', 'extraction_code', 'variant'];
  const videoIdPattern = /^BV[0-9A-Za-z]{10}$/;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const durationPattern = /^\d{2}:[0-5]\d$/;
  const extractionCodePattern = /^(?:[0-9A-Za-z]{4}|[0-9A-Za-z]{4}[\u4e00-\u9fff])$/;
  const downloadVariants = new Set(['default', 'outer', 'inner']);
  let recordsPromise = null;

  function posterFallbackLabel(title) {
    return window.resourceArchiveI18n?.translate('videos-poster-fallback', { title })
      ?? `Missing video poster: ${title}`;
  }

  function updatePosterFallback(fallback) {
    const label = posterFallbackLabel(fallback.dataset.videoPosterTitle || '');
    fallback.setAttribute('aria-label', label);
    fallback.textContent = label;
  }

  function refreshPosterFallbacks(root = document) {
    root.querySelectorAll?.('[data-video-poster-fallback]').forEach(updatePosterFallback);
  }

  function invalid(message) {
    throw new TypeError(`Invalid video record: ${message}`);
  }

  function hasExactKeys(value, keys) {
    const valueKeys = Object.keys(value).sort();
    return valueKeys.length === keys.length
      && keys.every(key => valueKeys.includes(key));
  }

  function isHttpsHost(value, host) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === host;
    } catch {
      return false;
    }
  }

  function validateDownload(download, recordIndex) {
    if (!download || typeof download !== 'object' || Array.isArray(download)
      || !hasExactKeys(download, downloadKeys)) {
      invalid(`at index ${recordIndex} has an invalid download`);
    }
    let url;
    try {
      url = new URL(download.url);
    } catch {
      invalid(`at index ${recordIndex} has an invalid download`);
    }
    if (typeof download.filename !== 'string' || !download.filename.trim()
      || url.protocol !== 'https:' || url.host !== 'pan.baidu.com' || !url.pathname.startsWith('/s/')
      || typeof download.extraction_code !== 'string' || !extractionCodePattern.test(download.extraction_code)
      || !downloadVariants.has(download.variant)) {
      invalid(`at index ${recordIndex} has an invalid download`);
    }
    return Object.freeze({
      filename: download.filename,
      url: download.url,
      extraction_code: download.extraction_code,
      variant: download.variant,
    });
  }

  function validateRecord(record, index, ids, sourceNumbers) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || !hasExactKeys(record, requiredKeys)) {
      invalid(`at index ${index} has an unexpected shape`);
    }
    if (typeof record.id !== 'string' || !videoIdPattern.test(record.id) || ids.has(record.id)) {
      invalid(`at index ${index} has an invalid or duplicate BV ID`);
    }
    if (!Number.isInteger(record.source_number) || record.source_number < 1 || sourceNumbers.has(record.source_number)) {
      invalid(`at index ${index} has an invalid or duplicate source number`);
    }
    if (typeof record.title !== 'string' || !record.title.trim()) invalid(`at index ${index} has no title`);
    if (typeof record.date !== 'string' || !datePattern.test(record.date)) invalid(`at index ${index} has an invalid date`);
    if (typeof record.duration !== 'string' || !durationPattern.test(record.duration)) invalid(`at index ${index} has an invalid duration`);
    if (typeof record.poster !== 'string' || !isHttpsHost(record.poster, 'i1.hdslb.com')) invalid(`at index ${index} has an invalid poster`);
    if (record.source_url !== `https://www.bilibili.com/video/${record.id}`) invalid(`at index ${index} has an invalid source URL`);
    if (!Array.isArray(record.downloads)) invalid(`at index ${index} has invalid downloads`);
    const downloads = Object.freeze(record.downloads.map(download => validateDownload(download, index)));

    ids.add(record.id);
    sourceNumbers.add(record.source_number);
    return Object.freeze({
      id: record.id,
      source_number: record.source_number,
      title: record.title,
      date: record.date,
      duration: record.duration,
      poster: record.poster,
      source_url: record.source_url,
      downloads,
    });
  }

  function validateManifest(manifest) {
    if (!Array.isArray(manifest)) {
      throw new TypeError('Invalid video manifest: expected an array of records');
    }
    const ids = new Set();
    const sourceNumbers = new Set();
    return Object.freeze(manifest.map((record, index) => validateRecord(record, index, ids, sourceNumbers)));
  }

  function load() {
    if (!recordsPromise) {
      const pending = fetch('/data/videos.json?v=20260818-goose', { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(validateManifest);
      recordsPromise = pending;
      void pending.catch(() => {
        if (recordsPromise === pending) recordsPromise = null;
      });
    }
    return recordsPromise;
  }

  function localPosterPath(record) {
    return `/images/videos/${encodeURIComponent(record.id)}.jpg`;
  }

  function replaceWithPosterFallback(image, record) {
    const fallback = document.createElement('div');
    fallback.className = 'video-poster-fallback missing-image';
    fallback.dataset.videoPosterFallback = '';
    fallback.dataset.videoPosterTitle = record.title;
    fallback.setAttribute('role', 'img');
    updatePosterFallback(fallback);
    fallback.style.aspectRatio = '16 / 9';
    image.replaceWith(fallback);
  }

  function poster(record) {
    const image = document.createElement('img');
    image.alt = record.title;
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      if (image.dataset.videoPosterSource !== 'remote') {
        image.dataset.videoPosterSource = 'remote';
        image.src = record.poster;
        return;
      }
      replaceWithPosterFallback(image, record);
    });
    image.dataset.videoPosterSource = 'local';
    image.src = localPosterPath(record);
    return image;
  }

  window.ResourceArchiveVideos = Object.freeze({ load, poster, localPosterPath, refreshPosterFallbacks });
})();
