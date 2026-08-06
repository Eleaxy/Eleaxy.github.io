(() => {
  const cache = new Map();
  const inFlight = new Map();
  let previewManifestPromise = null;
  let captureAuditPromise = null;
  const upstreamPreviewKind = 'upstream-example';
  const capturePreviewKind = 'windows-blender-node-group-capture';
  const capturePreviewMethod = 'foreground-node-editor-copy-from-screen';
  const completeNodeAssetsUrl = 'https://github.com/blueish0930/Assets/releases/latest/download/blueish.rar';
  const capturePreviewFields = new Set([
    'kind',
    'local',
    'sha256',
    'platform',
    'application',
    'application_version',
    'source_blend',
    'source_blend_sha256',
    'source_blend_provenance',
    'node_group',
    'node_tree',
    'capture_method',
    'resampled',
    'captured_at',
  ]);
  const auditedCapturePreviewFields = new Set([
    ...capturePreviewFields,
    'interface_signature_sha256',
  ]);
  const captureAuditEntryFields = new Set([
    'source_catalog_key',
    'node_group',
    'node_tree',
    'source_blend',
    'source_blend_sha256',
    'interface_signature_sha256',
    'asset_flag',
  ]);
  const identityCaptureAuditEntryFields = new Set([...captureAuditEntryFields, 'identity_basis']);
  const aliasCaptureAuditEntryFields = new Set([...identityCaptureAuditEntryFields, 'alias_basis']);
  const aliasBasisFields = new Set([
    'policy',
    'legacy_source_blend',
    'ordered_interface',
    'name_relation',
    'capture_binding',
  ]);
  const reusedCaptureBindingFields = new Set(['kind', 'source_capture_key', 'sha256']);
  const helperCaptureBindingFields = new Set(['kind', 'receipt_path', 'sha256']);
  const aliasNameRelations = new Set(['dimension-elision', 'word-order-change', 'leading-dot-helper']);
  const captureTreeByCatalogSource = Object.freeze({
    geomData: 'GeometryNodeTree',
    shaderData: 'ShaderNodeTree',
    compData: 'CompositorNodeTree',
  });
  const auditedCaptureSources = Object.freeze({
    'blender/assets/Compositor/Compositor.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/Compositor/Compositor.blend',
      sourceBlendSha256: '8aa0ce6bd99b7c7afc8f824c3a6ea9a3faabb9dbe6bc4f799c244a903c124f23',
    }),
    'blender/assets/GN/geometry_nodes_category_layout.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/GN/geometry_nodes_category_layout.blend',
      sourceBlendSha256: 'f3a80fd9c6da24e19ee6e8b3fdf157b3b6d8f4cadf1d2998e7c33f25d469dfe5',
    }),
    'blender/assets/Particle_System/Particle_System_V3_EN.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/Particle_System/Particle_System_V3_EN.blend',
      sourceBlendSha256: 'a2b191214160ed6c10b814bc3b115c9d0a7c4158a33a97a76fad7db4c2cea8b9',
    }),
    'blender/assets/RIgging_System/GN_Rigging_V3.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/RIgging_System/GN_Rigging_V3.blend',
      sourceBlendSha256: 'd51f26f20b9929fea496c5f789179bef6bb7681d7ab9cfe8d8d2aeb350863da1',
    }),
    'blender/assets/Shader/Material_Functions.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/Shader/Material_Functions.blend',
      sourceBlendSha256: 'c9e2a576da19ca7c7b853d151ec7ab828df1b59be022c690cba12e0520d60f64',
    }),
    'blender/assets/Shader/Shader_Tools.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/Shader/Shader_Tools.blend',
      sourceBlendSha256: 'd52d5df2b37698bce7f2bdf0d5282e2e5361ad07ae61bdb23a388e93eb3a8bc7',
    }),
    'blender/assets/Stylized/NPR_Shaders.blend': Object.freeze({
      kind: 'official-git-raw',
      url: 'https://raw.githubusercontent.com/blueish0930/Assets/327b3bdf6f739a07e9ae19cc5b3bcb5fc7895b07/blender/assets/Stylized/NPR_Shaders.blend',
      sourceBlendSha256: 'b8e40d91eec76b42a7048bf7f8b2ea9b0fc8974bfc2dad8a96a10337fe429173',
    }),
    'blender/assets/VFX/Flipbook/Flipbook.blend': Object.freeze({
      kind: 'official-release-archive',
      releaseUrl: 'https://github.com/blueish0930/Assets/releases/download/26/07/19/blueish.rar',
      archiveSha256: '72f61696173ed80fab58169efb3aa01db17d3a3139a2a2eb98b99bc9143a4e9c',
      sourceBlendSha256: '4f270f71b667514524e0546de14b128bafc231351b96070c2b7e4dd30cabf1c0',
    }),
  });

  const translate = (key, parameters = {}) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const valueText = value => value === undefined
    ? '—'
    : typeof value === 'string' ? value : JSON.stringify(value);
  const safeId = value => String(value).replace(/[^a-z0-9_-]/gi, '-');
  const isChinese = language => String(language || '').toLowerCase().startsWith('zh');
  const table = name => window.resourceArchiveI18n?.contentTable(name);

  function nodeDisplayName(record, language) {
    const original = record.name || record.id;
    if (!isChinese(language)) return original;
    if (String(record.name_zh || '').trim()) return record.name_zh.trim();
    return table('node-display-names')?.[`${record.catalog_source}/${record.id}`] || `未提供译名：${original}`;
  }

  function nodeSocketName(socket, language) {
    const original = typeof socket.name === 'string' ? socket.name.trim() : '';
    if (!original) return translate('nodes-dialog-unnamed-socket');
    if (!isChinese(language) || /[\u3400-\u9fff]/u.test(original)) return original;
    return table('node-socket-labels')?.[original] || `未提供译名：${original}`;
  }

  function nodeSocketDescription(socket, language) {
    if (isChinese(language)) {
      const description = socket.dz || `未提供译文：${socket.description || translate('nodes-dialog-unnamed-socket')}`;
      return [
        ['Uniform', table('node-socket-labels')?.Uniform || '均匀'],
        ['Location', table('node-socket-labels')?.Location || '位置'],
        ['Coordiante', 'nodes-dialog-source-fragment-Coordiante'],
        ['Whole', 'nodes-dialog-source-fragment-Whole'],
        ['Small', 'nodes-dialog-source-fragment-Small'],
        ['Outer', 'nodes-dialog-source-fragment-Outer'],
        ['Thermal', 'nodes-dialog-source-fragment-Thermal'],
        ['Linear', 'nodes-dialog-source-fragment-Linear'],
        ['Constant', 'nodes-dialog-source-fragment-Constant'],
      ].reduce((localized, [source, key]) => localized.replaceAll(
        source,
        key.startsWith?.('nodes-') ? translate(key) : key,
      ), description);
    }
    return socket.description || socket.dz || '—';
  }

  function sourceLabel(source, language) {
    if (!isChinese(language)) return source;
    return translate(`nodes-detail-source-${source}`);
  }

  function validate(record, source, id) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError('node detail response must be an object');
    }
    if (record.id !== id) throw new TypeError('node detail response id did not match the requested record');
    if (record.catalog_source && record.catalog_source !== source) {
      throw new TypeError('node detail response source did not match the requested record');
    }
    if (record.inputs !== undefined && !Array.isArray(record.inputs)) throw new TypeError('node detail inputs must be an array');
    if (record.outputs !== undefined && !Array.isArray(record.outputs)) throw new TypeError('node detail outputs must be an array');
    return record;
  }

  function abortError() {
    return new DOMException('node detail request aborted', 'AbortError');
  }

  function subscribe(key, entry, signal) {
    entry.subscribers += 1;
    let active = true;
    let onAbort = null;
    const release = () => {
      if (!active) return;
      active = false;
      entry.subscribers -= 1;
      signal?.removeEventListener('abort', onAbort);
      if (!entry.settled && entry.subscribers === 0) {
        if (inFlight.get(key) === entry) inFlight.delete(key);
        entry.controller.abort();
      }
    };
    if (signal?.aborted) {
      release();
      return Promise.reject(abortError());
    }
    return new Promise((resolve, reject) => {
      onAbort = () => {
        release();
        reject(abortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(
        record => {
          release();
          resolve(record);
        },
        error => {
          release();
          reject(error);
        },
      );
    });
  }

  function load(source, id, { signal } = {}) {
    if (!source || !id) throw new TypeError('node detail source and id are required');
    const key = `${source}/${id}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    let entry = inFlight.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, subscribers: 0, settled: false, promise: null };
      entry.promise = fetch(`/data/migrated/nodes/${encodeURIComponent(source)}/${encodeURIComponent(id)}.json`, { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(record => validate(record, source, id))
        .then(record => {
          cache.set(key, record);
          return record;
        })
        .finally(() => {
          entry.settled = true;
          if (inFlight.get(key) === entry) inFlight.delete(key);
        });
      inFlight.set(key, entry);
    }
    return subscribe(key, entry, signal);
  }

  function abortPending() {
    for (const entry of inFlight.values()) entry.controller.abort();
    inFlight.clear();
  }

  function socketTable(labelKey, sockets, language) {
    const label = translate(labelKey);
    const columns = [
      ['nodes-dialog-socket', socket => nodeSocketName(socket, language)],
      ['nodes-dialog-type', socket => socket.type],
      ['nodes-dialog-default', socket => valueText(socket.default)],
      ['nodes-dialog-description', socket => nodeSocketDescription(socket, language)],
    ];
    const region = node('section', 'table-region');
    region.dataset.nodeDetailSocketTable = labelKey;
    region.setAttribute('role', 'region');
    region.tabIndex = 0;
    const heading = node('h2');
    const table = document.createElement('table');
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const body = document.createElement('tbody');
    columns.forEach(([key]) => {
      const cell = node('th');
      cell.scope = 'col';
      cell.dataset.nodeDetailColumn = key;
      headerRow.append(cell);
    });
    (sockets || []).forEach(socket => {
      const row = document.createElement('tr');
      columns.forEach(([key, value]) => {
        const cell = node('td', null, value(socket) ?? '—');
        cell.dataset.label = translate(key);
        row.append(cell);
      });
      body.append(row);
    });
    header.append(headerRow);
    table.append(header, body);
    region.append(heading, table);
    region.__resourceArchiveNodeDetailLabels = { labelKey, heading, table, columns, sockets };
    return region;
  }

  function loadPreviewManifest() {
    if (!previewManifestPromise) {
      const pending = fetch('/data/node-example-images.manifest.json')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(manifest => {
          if (manifest?.version !== 2 || !manifest.images || typeof manifest.images !== 'object' || Array.isArray(manifest.images)) {
            throw new TypeError('node preview manifest is invalid');
          }
          return manifest;
        });
      previewManifestPromise = pending;
      void pending.catch(() => {
        if (previewManifestPromise === pending) previewManifestPromise = null;
      });
    }
    return previewManifestPromise;
  }

  function loadCaptureAudit() {
    if (!captureAuditPromise) {
      const pending = fetch('/data/node-example-images.capture-audit.json')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(captureAudit => {
          if ((captureAudit?.version !== 1 && captureAudit?.version !== 2)
            || !captureAudit.entries || typeof captureAudit.entries !== 'object' || Array.isArray(captureAudit.entries)) {
            throw new TypeError('node preview capture audit is invalid');
          }
          return captureAudit;
        });
      captureAuditPromise = pending;
      void pending.catch(() => {
        if (captureAuditPromise === pending) captureAuditPromise = null;
      });
    }
    return captureAuditPromise;
  }

  function localImagePathMatchesHash(entry) {
    const match = /^\/images\/nodes\/([0-9a-f]{64})\.png$/.exec(entry.local || '');
    return Boolean(match && match[1] === entry.sha256 && /^[0-9a-f]{64}$/.test(entry.sha256 || ''));
  }

  function httpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url : null;
    } catch {
      return null;
    }
  }

  function hasExactFields(value, fields) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return false;
    return Object.keys(value).every(key => fields.has(key)) && [...fields].every(key => key in value);
  }

  function captureProvenanceUrl(entry) {
    const provenance = entry.source_blend_provenance;
    if (!provenance || Array.isArray(provenance) || typeof provenance !== 'object') return null;
    const audited = auditedCaptureSources[entry.source_blend];
    if (!audited || entry.source_blend_sha256 !== audited.sourceBlendSha256) return null;
    if (audited.kind === 'official-git-raw') {
      if (!hasExactFields(provenance, new Set(['kind', 'url']))) return null;
      return provenance.kind === audited.kind && provenance.url === audited.url ? audited.url : null;
    }
    if (audited.kind === 'official-release-archive') {
      if (!hasExactFields(provenance, new Set(['kind', 'release_url', 'archive_sha256', 'object_sha256']))) return null;
      return provenance.kind === audited.kind
        && provenance.release_url === audited.releaseUrl
        && provenance.archive_sha256 === audited.archiveSha256
        && provenance.object_sha256 === audited.sourceBlendSha256
        ? audited.releaseUrl
        : null;
    }
    return null;
  }

  function isStrictUtcTimestamp(value) {
    if (typeof value !== 'string') return false;
    const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{3}))?Z$/.exec(value);
    if (!match) return false;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText] = match;
    const [year, month, day, hour, minute, second, millisecond] = [
      yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText || '0',
    ].map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
      && date.getUTCHours() === hour
      && date.getUTCMinutes() === minute
      && date.getUTCSeconds() === second
      && date.getUTCMilliseconds() === millisecond;
  }

  function captureAuditMatches(key, entry, captureAudit, manifest) {
    const audit = captureAudit?.entries?.[key];
    if (!audit || Array.isArray(audit) || typeof audit !== 'object') return false;
    const identityBasis = captureAudit.version === 1
      ? (audit.source_catalog_key === null ? 'non-asset-current-datablock' : 'source-catalog-identity')
      : audit.identity_basis;
    const isAlias = identityBasis === 'explicit-legacy-alias';
    const expectedFields = captureAudit.version === 1
      ? captureAuditEntryFields
      : (isAlias ? aliasCaptureAuditEntryFields : identityCaptureAuditEntryFields);
    if (!hasExactFields(audit, expectedFields)
      || (audit.source_catalog_key !== null && typeof audit.source_catalog_key !== 'string')
      || typeof audit.node_group !== 'string'
      || typeof audit.node_tree !== 'string'
      || typeof audit.source_blend !== 'string'
      || !/^[0-9a-f]{64}$/.test(audit.source_blend_sha256 || '')
      || !/^[0-9a-f]{64}$/.test(audit.interface_signature_sha256 || '')
      || typeof audit.asset_flag !== 'boolean') return false;
    if (!['source-catalog-identity', 'non-asset-current-datablock', 'explicit-legacy-alias'].includes(identityBasis)) return false;
    if (identityBasis === 'source-catalog-identity' && (audit.source_catalog_key === null || audit.asset_flag !== true)) return false;
    if (identityBasis === 'non-asset-current-datablock' && (audit.source_catalog_key !== null || audit.asset_flag !== false)) return false;
    if (isAlias) {
      const basis = audit.alias_basis;
      if (!hasExactFields(basis, aliasBasisFields)
        || basis.policy !== 'current-identity-ordered-interface-alias-v1'
        || basis.legacy_source_blend === audit.source_blend
        || basis.ordered_interface !== 'compatible'
        || !aliasNameRelations.has(basis.name_relation)) return false;
      const binding = basis.capture_binding;
      if (!binding || !/^[0-9a-f]{64}$/.test(binding.sha256 || '')) return false;
      if (binding.kind === 'reused-current-capture') {
        if (!hasExactFields(binding, reusedCaptureBindingFields)
          || audit.source_catalog_key !== binding.source_capture_key
          || audit.source_catalog_key === null || audit.asset_flag !== true) return false;
        const sourceCapture = manifest?.images?.[binding.source_capture_key];
        if (!sourceCapture || sourceCapture.sha256 !== entry.sha256 || sourceCapture.local !== entry.local
          || sourceCapture.source_blend !== entry.source_blend || sourceCapture.source_blend_sha256 !== entry.source_blend_sha256
          || sourceCapture.node_group !== entry.node_group || sourceCapture.node_tree !== entry.node_tree) return false;
      } else if (binding.kind === 'helper-windows-capture') {
        if (!hasExactFields(binding, helperCaptureBindingFields)
          || audit.source_catalog_key !== null || audit.asset_flag !== false
          || typeof binding.receipt_path !== 'string' || !binding.receipt_path
          || binding.receipt_path.startsWith('/') || binding.receipt_path.split('/').includes('..')) return false;
      } else return false;
      if (entry.sha256 !== binding.sha256) return false;
    }
    return entry.node_group === audit.node_group
      && entry.node_tree === audit.node_tree
      && entry.source_blend === audit.source_blend
      && entry.source_blend_sha256 === audit.source_blend_sha256
      && entry.interface_signature_sha256 === audit.interface_signature_sha256;
  }

  function capturePreviewEntry(record, key, entry, captureAudit, manifest) {
    const auditBoundCapture = hasExactFields(entry, auditedCapturePreviewFields);
    if ((!auditBoundCapture && !hasExactFields(entry, capturePreviewFields))
      || entry.kind !== capturePreviewKind
      || !localImagePathMatchesHash(entry)
      || (entry.platform !== 'Windows' && !String(entry.platform).startsWith('Windows '))
      || entry.application !== 'Blender'
      || typeof entry.application_version !== 'string' || !entry.application_version.trim()
      || !/^[0-9a-f]{64}$/.test(entry.source_blend_sha256 || '')
      || entry.capture_method !== capturePreviewMethod
      || entry.resampled !== false
      || !isStrictUtcTimestamp(entry.captured_at)
      || !captureProvenanceUrl(entry)) return null;
    if (auditBoundCapture) return captureAuditMatches(key, entry, captureAudit, manifest) ? entry : null;
    if (entry.source_blend !== record.source_blend
      || entry.node_group !== record.name
      || entry.node_tree !== captureTreeByCatalogSource[record.catalog_source]) return null;
    return entry;
  }

  async function previewEntry(record, manifest) {
    const key = `${record.catalog_source}/${record.id}`;
    const entry = manifest.images[key];
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') return null;
    if (entry.kind === upstreamPreviewKind) {
      if (entry.source_path !== record.example_image || !localImagePathMatchesHash(entry) || !httpsUrl(entry.source_url)) return null;
      return entry;
    }
    if (entry.kind === capturePreviewKind) {
      const captureAudit = hasExactFields(entry, auditedCapturePreviewFields)
        ? await loadCaptureAudit()
        : null;
      return capturePreviewEntry(record, key, entry, captureAudit, manifest);
    }
    return null;
  }

  function updatePreviewCopy(figure, record, entry = figure.__resourceArchiveNodePreviewEntry) {
    const name = record.name || record.id;
    const isCapture = entry?.kind === capturePreviewKind;
    figure.querySelector('[data-testid="node-preview-image"]')?.setAttribute(
      'alt',
      isCapture
        ? translate('nodes-dialog-capture-preview-alt', { name })
        : translate('nodes-dialog-preview-alt', { name }),
    );
    const caption = figure.querySelector('[data-node-detail-preview-caption]');
    if (caption) {
      caption.textContent = isCapture
        ? translate('nodes-dialog-capture-preview-caption', { name })
        : translate('nodes-dialog-preview-caption');
    }
    const provenance = figure.querySelector('[data-node-detail-preview-provenance]');
    if (provenance) {
      provenance.textContent = translate('nodes-dialog-view-blueish-source');
    }
    const label = figure.querySelector('[data-node-workbench-preview-label]');
    if (label) {
      label.textContent = translate(isCapture
        ? 'nodes-workbench-windows-capture-preview'
        : 'nodes-workbench-official-preview');
    }
    const version = figure.querySelector('[data-node-workbench-preview-version]');
    if (version) {
      version.textContent = isCapture
        ? ''
        : translate('nodes-workbench-preview-version', {
          version: record.version || record.last_modified_version || record.created_version || '—',
        });
    }
    updatePreviewDimensions(figure);
  }

  function updateUnavailablePreviewCopy(preview, record) {
    if (!preview) return;
    preview.textContent = translate('nodes-dialog-preview-unavailable', {
      name: nodeDisplayName(record, document.documentElement.lang),
    });
  }

  function updatePreviewDimensions(figure) {
    const image = figure.querySelector('[data-testid="node-preview-image"]');
    const dimensions = figure.querySelector('[data-node-workbench-preview-dimensions]');
    if (!image || !dimensions) return;
    if (figure.__resourceArchiveNodePreviewEntry?.kind === capturePreviewKind) {
      dimensions.textContent = '';
      return;
    }
    if (!image.naturalWidth || !image.naturalHeight) return;
    dimensions.textContent = translate('nodes-workbench-preview-dimensions', {
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
  }

  function previewFigure(record, entry, variant = 'flow') {
    const figure = node('figure', 'node-preview');
    figure.dataset.nodeDetailPreview = '';
    figure.__resourceArchiveNodePreviewEntry = entry;
    const image = document.createElement('img');
    image.className = 'node-preview-image';
    image.dataset.testid = 'node-preview-image';
    image.src = entry.local;
    image.loading = 'lazy';
    image.decoding = 'async';
    const caption = document.createElement('figcaption');
    const captionCopy = node('span');
    captionCopy.dataset.nodeDetailPreviewCaption = '';
    const provenance = entry.kind === capturePreviewKind ? null : node('a', 'node-preview-provenance');
    if (provenance) {
      provenance.dataset.nodeDetailPreviewProvenance = '';
      provenance.href = entry.source_url;
      provenance.rel = 'noopener';
      provenance.target = '_blank';
    }
    caption.append(captionCopy);
    if (provenance) caption.append(' ', provenance);
    figure.append(image, caption);
    if (variant === 'workbench') {
      const label = node('p', 'node-workbench-preview-label');
      label.dataset.nodeWorkbenchPreviewLabel = '';
      const version = node('span');
      version.dataset.nodeWorkbenchPreviewVersion = '';
      const dimensions = node('span');
      dimensions.dataset.nodeWorkbenchPreviewDimensions = '';
      caption.classList.add('node-workbench-preview-meta');
      caption.prepend(version, dimensions);
      figure.append(label);
      image.addEventListener('load', () => updatePreviewDimensions(figure), { once: true });
      if (image.complete) queueMicrotask(() => updatePreviewDimensions(figure));
    }
    updatePreviewCopy(figure, record);
    return figure;
  }

  function appendPreview(article, record) {
    const variant = article.dataset.nodeDetailVariant || 'flow';
    const urlMatchesRecord = () => new URL(window.location.href).searchParams.get('source') === record.catalog_source
      && new URL(window.location.href).searchParams.get('id') === record.id;
    const isCurrentArticle = () => article.isConnected
      && article.__resourceArchiveNodeDetail?.record === record
      && urlMatchesRecord();
    const unavailable = () => {
      const preview = node('p', 'node-preview-unavailable');
      preview.dataset.nodePreviewUnavailable = '';
      updateUnavailablePreviewCopy(preview, record);
      return preview;
    };
    const attach = () => {
      if (!isCurrentArticle() || article.querySelector('[data-node-detail-preview]')) return;
      if (document.documentElement.hasAttribute('data-internal-view-transition-pending')) {
        waitForTransition();
        return;
      }
      if (variant === 'workbench') {
        const host = article.querySelector('.node-workbench-preview-host');
        if (host && !host.childNodes.length) host.append(unavailable());
      }
      void loadPreviewManifest().then(async manifest => {
        if (!isCurrentArticle() || article.querySelector('[data-node-detail-preview]')) return;
        const entry = await previewEntry(record, manifest);
        const target = variant === 'workbench'
          ? article.querySelector('.node-workbench-preview-host')
          : article.querySelector('.node-detail-body');
        if (!target) return;
        if (!entry) {
          if (variant === 'workbench') target.replaceChildren(unavailable());
          return;
        }
        const preview = previewFigure(record, entry, variant);
        preview.querySelector('[data-testid="node-preview-image"]')?.addEventListener('error', () => {
          if (!isCurrentArticle()) return;
          if (variant === 'workbench') target.replaceChildren(unavailable());
          else preview.replaceWith(unavailable());
        }, { once: true });
        if (variant === 'workbench') target.replaceChildren(preview);
        else target.prepend(preview);
      }).catch(() => {});
    };
    const waitForTransition = () => {
      if (!isCurrentArticle()) return;
      if (!document.documentElement.hasAttribute('data-internal-view-transition-pending')) {
        attach();
        return;
      }
      const app = article.closest('#node-catalog-app');
      if (app) {
        if (article.__resourceArchiveNodePreviewTransitionListener) return;
        const resume = () => {
          if (article.__resourceArchiveNodePreviewTransitionListener === resume) {
            delete article.__resourceArchiveNodePreviewTransitionListener;
          }
          attach();
        };
        article.__resourceArchiveNodePreviewTransitionListener = resume;
        app.addEventListener('resourcearchiveinternalviewroutertransitionfinished', resume, { once: true });
        return;
      }
      attach();
    };
    if (variant === 'workbench' && !article.isConnected) {
      queueMicrotask(() => {
        if (article.isConnected && urlMatchesRecord()) {
          attach();
          return;
        }
        requestAnimationFrame(() => {
          if (article.isConnected && urlMatchesRecord()) attach();
        });
      });
      return;
    }
    attach();
  }

  function buildArticle(record, route, variant = 'flow') {
    const article = node('article', 'record-detail node-detail-view');
    article.dataset.testid = 'node-detail';
    article.dataset.nodeDetailSource = route.source;
    article.dataset.nodeDetailId = route.id;

    const backLine = node('p', 'node-detail-back-line');
    const back = node('a', 'back-link');
    back.dataset.testid = 'node-detail-back';
    back.dataset.nodeDetailBack = '';
    back.dataset.internalViewHistoryBack = '';
    back.dataset.internalViewFallbackReplace = '';
    backLine.append(back);

    const breadcrumbs = document.createElement('nav');
    breadcrumbs.className = 'node-detail-breadcrumb';
    breadcrumbs.dataset.nodeDetailBreadcrumb = '';
    breadcrumbs.setAttribute('aria-label', 'Breadcrumb');
    const root = node('a');
    root.dataset.nodeDetailCrumbRoot = '';
    root.href = '/nodes.html';
    const separator = node('span', 'node-detail-breadcrumb-separator', '/');
    separator.setAttribute('aria-hidden', 'true');
    const system = node('a');
    system.dataset.nodeDetailCrumbSystem = '';
    const categorySeparator = node('span', 'node-detail-breadcrumb-separator', '/');
    categorySeparator.setAttribute('aria-hidden', 'true');
    const category = node('a');
    category.dataset.nodeDetailCrumbCategory = '';
    const currentSeparator = node('span', 'node-detail-breadcrumb-separator', '/');
    currentSeparator.setAttribute('aria-hidden', 'true');
    const current = node('span');
    current.dataset.nodeDetailCrumbCurrent = '';
    current.setAttribute('aria-current', 'page');
    breadcrumbs.append(root, separator, system, categorySeparator, category, currentSeparator, current);

    const header = node('header', 'node-detail-header');
    const kicker = node('p', 'eyebrow');
    kicker.dataset.nodeDetailKicker = '';
    const names = node('div', 'node-detail-names');
    const title = node('h1', 'node-detail-title', record.name ?? record.id);
    title.dataset.testid = 'node-detail-title';
    title.id = `node-detail-title-${safeId(route.source)}-${safeId(route.id)}`;
    title.tabIndex = -1;
    const nameZh = node('p', 'node-detail-name-alternate');
    nameZh.dataset.testid = 'node-detail-name-zh';
    const nameEn = node('p', 'node-detail-name-alternate');
    nameEn.dataset.testid = 'node-detail-name-en';
    names.append(title, nameZh, nameEn);
    const description = node('p', 'lede');
    description.dataset.nodeDetailDescription = '';
    const meta = node('dl', 'record-meta node-detail-metadata');
    meta.dataset.nodeDetailMeta = '';
    header.append(kicker, names, description, meta);

    const descriptions = Object.values(record.param_descriptions || {}).flatMap(group => Object.values(group || {}));
    let notes = null;
    if (descriptions.length) {
      notes = node('section', 'parameter-notes');
      const heading = node('h2');
      heading.dataset.nodeDetailNotesHeading = '';
      const list = document.createElement('ul');
      descriptions.forEach(descriptionText => list.append(node('li', null, descriptionText)));
      notes.append(heading, list);
      notes.__resourceArchiveNodeDetailHeading = heading;
    }

    const inputs = socketTable('nodes-dialog-inputs', record.inputs || [], document.documentElement.lang || 'en');
    const outputs = socketTable('nodes-dialog-outputs', record.outputs || [], document.documentElement.lang || 'en');
    const provenance = node('section', 'node-detail-provenance');
    const provenanceHeading = node('h2');
    provenanceHeading.dataset.nodeDetailProvenanceHeading = '';
    const provenanceCopy = node('p', 'record-meta');
    provenanceCopy.dataset.nodeDetailProvenanceCopy = '';
    provenance.append(provenanceHeading, provenanceCopy);

    const actions = node('div', 'detail-actions');
    let downloadNote = null;
    let download = null;
    if (variant === 'workbench' || (record.download_url && record.source_blend)) {
      downloadNote = node('p', 'download-note');
      download = node('a', 'button-primary');
      download.dataset.pixelFlicker = '';
      download.dataset.testid = 'node-blend-download';
      download.href = variant === 'workbench' ? completeNodeAssetsUrl : record.download_url;
      download.rel = 'noopener';
      download.target = '_blank';
      const downloadLabel = node('span', 'pixel-button-label');
      download.append(downloadLabel);
      downloadNote.__resourceArchiveNodeDetailDownload = downloadLabel;
      actions.append(downloadNote, download);
    }
    const source = node('a', 'button-secondary');
    source.dataset.nodeDetailSourceAction = '';
    source.dataset.pixelFlicker = '';
    source.href = 'https://github.com/blueish0930/Assets';
    source.rel = 'noopener';
    source.target = '_blank';
    source.append(node('span', 'pixel-button-label'));
    actions.append(source);

    const body = node('div', 'node-detail-body');
    const content = node('div', 'node-detail-content');
    if (notes) content.append(notes);
    content.append(inputs, outputs, provenance, actions);
    body.append(content);
    if (variant === 'workbench') {
      const copy = node('button', 'button-secondary');
      copy.type = 'button';
      copy.dataset.testid = 'node-workbench-copy-link';
      copy.dataset.nodeWorkbenchCopyLink = '';
      const previewHost = node('div', 'node-workbench-preview-host');
      const information = node('div', 'node-workbench-information');
      const scroll = node('div', 'node-workbench-information-scroll');
      const sourceAction = actions.querySelector('[data-node-detail-source-action]');
      if (notes) scroll.append(header, notes);
      else scroll.append(header);
      scroll.append(inputs, outputs, provenance);
      if (downloadNote) scroll.append(downloadNote);
      if (sourceAction) scroll.append(sourceAction);
      actions.replaceChildren(copy, ...(download ? [download] : []));
      information.append(scroll, actions);
      article.append(previewHost, information);
    } else {
      article.append(backLine, breadcrumbs, header, body);
    }
    attachArticle(article, record, route);
    update(article, route, document.documentElement.lang || 'en');
    return article;
  }

  function attachArticle(article, record, route) {
    const references = {
      back: article.querySelector('[data-node-detail-back]'),
      root: article.querySelector('[data-node-detail-crumb-root]'),
      system: article.querySelector('[data-node-detail-crumb-system]'),
      category: article.querySelector('[data-node-detail-crumb-category]'),
      current: article.querySelector('[data-node-detail-crumb-current]'),
      title: article.querySelector('[data-testid="node-detail-title"]'),
      nameZh: article.querySelector('[data-testid="node-detail-name-zh"]'),
      nameEn: article.querySelector('[data-testid="node-detail-name-en"]'),
      kicker: article.querySelector('[data-node-detail-kicker]'),
      description: article.querySelector('[data-node-detail-description]'),
      meta: article.querySelector('[data-node-detail-meta]'),
      notes: article.querySelector('[data-node-detail-notes-heading]')?.parentElement || null,
      inputs: article.querySelector('[data-node-detail-socket-table="nodes-dialog-inputs"]'),
      outputs: article.querySelector('[data-node-detail-socket-table="nodes-dialog-outputs"]'),
      provenanceHeading: article.querySelector('[data-node-detail-provenance-heading]'),
      provenanceCopy: article.querySelector('[data-node-detail-provenance-copy]'),
      download: article.querySelector('[data-testid="node-blend-download"]'),
      source: article.querySelector('[data-node-detail-source-action]'),
      copy: article.querySelector('[data-node-workbench-copy-link]'),
    };
    if (references.notes) references.notes.__resourceArchiveNodeDetailHeading = references.notes.querySelector('[data-node-detail-notes-heading]');
    [references.inputs, references.outputs].filter(Boolean).forEach(region => {
      const labelKey = region.dataset.nodeDetailSocketTable;
      region.__resourceArchiveNodeDetailLabels = {
        labelKey,
        heading: region.querySelector('h2'),
        table: region.querySelector('table'),
        columns: [...region.querySelectorAll('[data-node-detail-column]')].map(column => [column.dataset.nodeDetailColumn]),
        sockets: labelKey === 'nodes-dialog-inputs' ? record.inputs || [] : record.outputs || [],
      };
    });
    article.__resourceArchiveNodeDetail = {
      record,
      route,
      references,
    };
    article.__resourceArchiveNodeDetailUpdate = (nextRoute, nextLanguage) => update(article, nextRoute, nextLanguage);
  }

  function update(article, route, language) {
    const stored = article?.__resourceArchiveNodeDetail;
    if (!stored) return;
    const taxonomy = window.ResourceArchiveNodeTaxonomy;
    const { record, references } = stored;
    const categoryLabel = taxonomy?.categoryLabel(record.category_id, language) || record.category_id;
    const systemLabel = route.parentGroup && taxonomy?.getSystem(route.parentGroup)
      ? taxonomy.systemLabel(taxonomy.getSystem(route.parentGroup), language)
      : categoryLabel;
    const chinese = isChinese(language);
    const englishName = record.name || record.id;
    const displayName = nodeDisplayName(record, language);
    const chineseName = chinese ? displayName : (typeof record.name_zh === 'string' && record.name_zh.trim() ? record.name_zh.trim() : null);
    const parentHref = route.parentHref || '/nodes.html';
    updateUnavailablePreviewCopy(article.querySelector('[data-node-preview-unavailable]'), record);
    if (references.back) {
      references.back.href = parentHref;
      references.back.textContent = translate('nodes-dialog-back-directory');
    }
    if (references.root) references.root.textContent = translate('nodes-all');
    if (references.system) {
      references.system.href = route.parentSystemHref || parentHref;
      references.system.textContent = systemLabel;
    }
    if (references.category) {
      references.category.href = parentHref;
      references.category.textContent = categoryLabel;
    }
    if (references.current) references.current.textContent = chinese ? displayName : englishName;
    article.querySelector('[data-node-detail-breadcrumb]')?.setAttribute('aria-label', translate('nodes-detail-breadcrumb'));
    references.title.textContent = chinese ? displayName : englishName;
    references.nameZh.textContent = typeof record.name_zh === 'string' ? record.name_zh.trim() : '';
    references.nameZh.hidden = !references.nameZh.textContent || chinese;
    references.nameEn.textContent = englishName;
    references.nameEn.hidden = !chinese;
    references.kicker.textContent = `${sourceLabel(record.catalog_source || route.source, language)} / ${categoryLabel}`;
    references.description.textContent = record.description || record.name_zh || translate('nodes-dialog-no-description');
    references.meta.replaceChildren();
    const appendMeta = (testId, label, value) => {
      if (value === undefined || value === null || value === '') return;
      const term = node('dt', null, label);
      const definition = node('dd', null, value);
      definition.dataset.testid = testId;
      references.meta.append(term, definition);
    };
    appendMeta('node-detail-system', translate('nodes-detail-system'), systemLabel);
    appendMeta('node-detail-category', translate('nodes-detail-category'), categoryLabel);
    appendMeta('node-detail-created-version', translate('nodes-detail-created-version'), record.created_version);
    appendMeta('node-detail-last-modified-version', translate('nodes-detail-last-modified-version'), record.last_modified_version);
    appendMeta('node-detail-version', translate('nodes-detail-version'), record.version);
    if (references.notes) references.notes.__resourceArchiveNodeDetailHeading.textContent = translate('nodes-dialog-curated-parameter-notes');
    [references.inputs, references.outputs].filter(Boolean).forEach(region => {
      const labels = region.__resourceArchiveNodeDetailLabels;
      const label = translate(labels.labelKey);
      region.setAttribute('aria-label', translate('nodes-dialog-socket-table-region', { label }));
      labels.heading.textContent = label;
      labels.table.setAttribute('aria-label', label);
      labels.columns.forEach(([key], index) => { labels.table.querySelectorAll('th')[index].textContent = translate(key); });
      labels.table.querySelectorAll('tbody tr').forEach((row, rowIndex) => {
        const socket = labels.sockets[rowIndex];
        const cells = row.querySelectorAll('td');
        if (!socket || cells.length < 4) return;
        cells[0].textContent = nodeSocketName(socket, language);
        cells[3].textContent = nodeSocketDescription(socket, language);
      });
    });
    if (references.provenanceHeading) references.provenanceHeading.textContent = translate('nodes-dialog-view-blueish-source');
    if (references.provenanceCopy) references.provenanceCopy.textContent = translate('nodes-dialog-provenance-copy');
    const downloadLabel = article.querySelector('[data-testid="node-blend-download"] .pixel-button-label');
    const isWorkbench = article.dataset.nodeDetailVariant === 'workbench';
    if (downloadLabel) downloadLabel.textContent = translate(isWorkbench
      ? 'nodes-workbench-download-assets'
      : 'nodes-dialog-download-owning');
    const note = article.querySelector('.download-note');
    if (note) note.textContent = translate(isWorkbench
      ? 'nodes-workbench-download-note'
      : 'nodes-dialog-download-note');
    references.source?.querySelector('.pixel-button-label') && (references.source.querySelector('.pixel-button-label').textContent = translate('nodes-dialog-view-blueish-source'));
    if (references.copy) references.copy.textContent = translate('nodes-workbench-copy-link');
    const preview = article.querySelector('[data-node-detail-preview]');
    if (preview) updatePreviewCopy(preview, record);
    stored.route = route;
  }

  function render(record, { route, language, article: existingArticle, variant = 'flow' } = {}) {
    const article = existingArticle || buildArticle(record, route || {}, variant);
    article.dataset.nodeDetailVariant = variant;
    if (existingArticle) attachArticle(article, record, route || {});
    update(article, route || {}, language || document.documentElement.lang || 'en');
    appendPreview(article, record);
    return article;
  }

  window.ResourceArchiveNodeDetail = Object.freeze({ load, render, abortPending });
})();
