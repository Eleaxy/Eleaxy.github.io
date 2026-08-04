(() => {
  const validIds = new Set(['automation-flow', 'autocel']);
  const sourceKinds = new Set([
    'repository_verified',
    'isolated_gui_capture',
    'provider_documentation',
  ]);
  const sourceKindCompatibility = {
    repository_verified: new Set(['repository_verified']),
    isolated_gui_capture: new Set(['isolated_gui_capture']),
    provider_documentation: new Set(['provider_documentation']),
  };
  const translate = (key, parameters) => window.resourceArchiveI18n?.translate(key, parameters) ?? key;
  const message = (key, parameters) => translate(`plugin-detail-${key}`, parameters);
  let renderLanguage = null;
  const pluginTransitionNames = Object.freeze({
    'automation-flow': { title: 'plugin-title-automation-flow' },
    autocel: { title: 'plugin-title-autocel', art: 'plugin-art-autocel' },
  });
  const transitionName = (recordId, part) => pluginTransitionNames[recordId]?.[part] || '';
  const renderers = new Map();
  function localeText(value, language = renderLanguage || window.resourceArchiveI18n?.language || 'en') {
    if (value && typeof value === 'object') {
      return value[language] || value.en || value.zh || '';
    }
    return value || '';
  }

  function hasChinese(text) {
    return /[\u3400-\u9fff]/.test(text);
  }

  function markSourceLanguage(element, text) {
    const language = renderLanguage || window.resourceArchiveI18n?.language || 'en';
    if (language === 'en' && hasChinese(text || '')) element.lang = 'zh-CN';
    return element;
  }

  function provenance() {
    return document.createDocumentFragment();
  }

  function sourceParagraph(text, className = '') {
    const paragraph = document.createElement('p');
    if (className) paragraph.className = className;
    paragraph.textContent = text;
    return markSourceLanguage(paragraph, text);
  }

  function imageFigure(detail, asset, className = '') {
    const figure = document.createElement('figure');
    figure.className = `plugin-image ${className}`.trim();
    const image = document.createElement('img');
    const label = localeText(asset.label);
    image.src = `/assets/plugins/${detail.id}/${asset.target}`;
    image.alt = label;
    markSourceLanguage(image, label);
    image.loading = 'lazy';
    image.decoding = 'async';
    image.dataset.pluginImage = '';
    image.dataset.pluginImageLabel = label;
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    markSourceLanguage(caption, label);
    figure.append(image, caption);
    return figure;
  }

  function isLocalized(value) {
    return Boolean(value && typeof value === 'object' && typeof value.en === 'string' && value.en.trim()
      && typeof value.zh === 'string' && value.zh.trim());
  }

  function validateAutoCelPresentation(detail) {
    const presentation = detail.presentation;
    const expectedOrder = ['hero', 'quick-start', 'mmd-workflow', 'multi-light-workflow', 'panel-switcher', 'node-catalog'];
    const expectedAssets = [
      'paimon', 'silver-wolf', 'firefly', 'toon-color-mapping', 'basic-mmd-material', 'pro-lighting-info',
      'multi-lighting-extension', 'basic-general-material', 'basic-lighting-info', 'pro-general-material', 'pro-mmd-material',
    ];
    const assetIds = new Set(Object.values(detail.assets).flat().map(asset => asset?.id));
    const valid = presentation
      && Array.isArray(presentation.order)
      && presentation.order.length === expectedOrder.length
      && presentation.order.every((section, index) => section === expectedOrder[index])
      && presentation.hero?.title === 'AutoCel 智能卡通着色器'
      && isLocalized(presentation.hero?.headline)
      && isLocalized(presentation.hero?.lede)
      && isLocalized(presentation.quick_start?.title)
      && isLocalized(presentation.quick_start?.lede)
      && Array.isArray(presentation.quick_start?.steps)
      && presentation.quick_start.steps.length === 5
      && presentation.quick_start.steps.every(isLocalized)
      && isLocalized(presentation.mmd_workflow?.title)
      && isLocalized(presentation.mmd_workflow?.body)
      && isLocalized(presentation.multi_light_workflow?.title)
      && isLocalized(presentation.multi_light_workflow?.body)
      && Array.isArray(presentation.panel_switcher?.modes)
      && presentation.panel_switcher.modes.join('|') === 'general|mmd|lighting'
      && ['basic', 'pro'].every(edition => isLocalized(presentation.panel_switcher.edition_labels?.[edition]))
      && presentation.panel_switcher.modes.every(mode => isLocalized(presentation.panel_switcher.titles?.[mode]))
      && expectedAssets.every(id => assetIds.has(id));
    if (!valid) throw new Error('Invalid AutoCel presentation');
  }

  function validateDetail(detail, expectedId) {
    if (!detail || typeof detail !== 'object' || detail.id !== expectedId || detail.route !== `/plugins.html?plugin=${expectedId}`) {
      throw new Error('Invalid plugin detail record');
    }
    if (!detail.identity || !Array.isArray(detail.summary) || !detail.facts || !Array.isArray(detail.sections)
      || !detail.sources || !detail.assets
      || !Array.isArray(detail.external_destinations)) {
      throw new Error('Invalid plugin detail record');
    }
    if (detail.id === 'autocel') validateAutoCelPresentation(detail);
    if (Object.values(detail.sources).some(source => !source || !sourceKinds.has(source.kind))) {
      throw new Error('Invalid plugin provenance');
    }
    const sourced = [detail.identity, ...detail.summary, ...Object.values(detail.facts), ...detail.sections,
      ...(detail.nodes || []),
      ...Object.values(detail.assets).flat(), ...detail.external_destinations];
    if (sourced.some(item => !item || !sourceKinds.has(item.source_kind) || typeof item.source_ref !== 'string'
      || !Object.hasOwn(detail.sources, item.source_ref)
      || !sourceKindCompatibility[item.source_kind].has(detail.sources[item.source_ref].kind))) {
      throw new Error('Invalid plugin provenance');
    }
    const nodes = detail.nodes || [];
    if (nodes.some(node => {
      const labels = detail.category_labels?.[node.category_id];
      return !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(node.category_id)
        || !labels || typeof labels.en !== 'string' || typeof labels.zh !== 'string'
        || labels.zh !== node.category;
    })) {
      throw new Error('Invalid plugin categories');
    }
    return detail;
  }

  async function load(recordId, { signal } = {}) {
    if (!validIds.has(recordId)) throw new Error('Unknown plugin detail');
    const response = await fetch(`/data/plugin-details/${recordId}.json`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validateDetail(await response.json(), recordId);
  }

  function sectionContent(section) {
    const fragment = document.createDocumentFragment();
    if (Array.isArray(section.items)) {
      const list = document.createElement('ul');
      list.className = 'plugin-detail-list';
      section.items.forEach(item => {
        const listItem = document.createElement('li');
        listItem.append(sourceParagraph(localeText(item)));
        list.append(listItem);
      });
      fragment.append(list);
    }
    if (Array.isArray(section.steps)) {
      const list = document.createElement('ol');
      list.className = 'plugin-step-list';
      section.steps.forEach(step => {
        const item = document.createElement('li');
        const title = localeText(step.title || step.label || `${message('step')} ${step.step}`);
        item.append(sourceParagraph(title, 'plugin-step-title'));
        if (step.body) item.append(sourceParagraph(localeText(step.body)));
        list.append(item);
      });
      fragment.append(list);
    }
    if (Array.isArray(section.groups)) {
      const groups = document.createElement('div');
      groups.className = 'plugin-flow-groups';
      section.groups.forEach(group => {
        const item = document.createElement('section');
        item.className = 'plugin-flow-group';
        item.dataset.flowGroup = group.id;
        const name = document.createElement('h3');
        name.textContent = localeText(group.name);
        const count = document.createElement('p');
        count.textContent = group.count === undefined ? message('documented-group') : `${group.count} ${message('documented-nodes')}`;
        item.append(name, count);
        groups.append(item);
      });
      fragment.append(groups);
    }
    if (section.id === 'property-package-flow') {
      const diagram = document.createElement('div');
      diagram.className = 'plugin-flow-diagram';
      diagram.setAttribute('role', 'img');
      diagram.setAttribute('aria-label', message('property-flow-label'));
      ['flow-capture', 'flow-package', 'flow-apply', 'flow-flow'].forEach(key => {
        const step = document.createElement('span');
        step.textContent = message(key);
        diagram.append(step);
      });
      fragment.append(diagram);
    }
    if (section.body) fragment.append(sourceParagraph(localeText(section.body)));
    return fragment;
  }

  function renderSection(detail, section) {
    const element = document.createElement('section');
    element.className = 'plugin-detail-section';
    element.id = `plugin-section-${section.id}`;
    const heading = document.createElement('h2');
    heading.textContent = localeText(section.title);
    element.append(heading, sectionContent(section));
    if (section.id === 'captured-node-closeups') {
      const grid = document.createElement('div');
      grid.className = 'plugin-closeup-grid';
      (detail.assets.closeups || []).forEach(asset => {
        const figure = imageFigure(detail, asset, 'plugin-closeup');
        figure.dataset.pluginCloseup = '';
        figure.dataset.pluginCloseupId = asset.id;
        const caption = figure.querySelector('figcaption');
        const category = document.createElement('strong');
        const label = localeText(asset.label);
        category.textContent = label;
        markSourceLanguage(category, label);
        const nodeNames = document.createElement('span');
        const names = asset.nodes.map(node => localeText(node.name)).join(' · ');
        nodeNames.textContent = names;
        markSourceLanguage(nodeNames, names);
        caption.replaceChildren(category, nodeNames);
        grid.append(figure);
      });
      element.append(grid);
    }
    return element;
  }

  function renderFacts(detail) {
    const section = document.createElement('section');
    section.className = 'plugin-detail-section plugin-facts-section';
    const heading = document.createElement('h2');
    heading.textContent = message('facts');
    const definitions = document.createElement('dl');
    definitions.className = 'plugin-detail-definitions';
    Object.entries(detail.facts).forEach(([key, fact]) => {
      const term = document.createElement('dt');
      term.textContent = localeText(fact.label) || key;
      const value = document.createElement('dd');
      value.dataset.fact = key;
      const factValue = document.createElement('strong');
      factValue.textContent = localeText(fact.value);
      markSourceLanguage(factValue, localeText(fact.value));
      value.append(factValue);
      if (fact.note) value.append(sourceParagraph(localeText(fact.note), 'plugin-fact-note'));
      definitions.append(term, value);
    });
    section.append(heading, definitions);
    return section;
  }

  function renderNodes(detail) {
    if (!Array.isArray(detail.nodes)) return null;
    const section = document.createElement('section');
    section.className = 'plugin-detail-section plugin-node-section';
    const heading = document.createElement('h2');
    heading.textContent = message('node-catalog', { count: detail.nodes.length });
    const controls = document.createElement('div');
    controls.className = 'plugin-node-controls';
    const searchLabel = document.createElement('label');
    searchLabel.htmlFor = 'plugin-node-search';
    searchLabel.textContent = message('search-label');
    const search = document.createElement('input');
    search.id = searchLabel.htmlFor;
    search.type = 'search';
    search.dataset.pluginNodeSearch = '';
    search.placeholder = message('search-placeholder');
    const categories = document.createElement('div');
    categories.className = 'plugin-node-categories';
    categories.setAttribute('role', 'group');
    categories.setAttribute('aria-label', message('category-filter'));
    const categoryRecords = [['all', message('all-categories')], ...[...new Set(detail.nodes
      .map(node => node.category_id))].map(categoryId => [categoryId, localeText(detail.category_labels[categoryId])])];
    const count = document.createElement('p');
    count.className = 'plugin-node-count';
    count.dataset.pluginNodeCount = '';
    count.setAttribute('aria-live', 'polite');
    const list = document.createElement('div');
    list.className = 'plugin-node-list';
    const assetsByTarget = new Map((detail.assets.node_previews || []).map(asset => [asset.target, asset]));
    detail.nodes.forEach(node => {
      const card = document.createElement('article');
      card.className = 'plugin-node';
      card.dataset.pluginNode = node.id;
      card.dataset.nodeCategory = node.category_id;
      const cardHeading = document.createElement('h3');
      cardHeading.textContent = localeText(node.name);
      cardHeading.dataset.pluginNodeName = '';
      markSourceLanguage(cardHeading, cardHeading.textContent);
      const metadata = document.createElement('p');
      metadata.className = 'plugin-node-metadata';
      const category = document.createElement('span');
      category.dataset.pluginNodeCategoryName = '';
      category.textContent = localeText(detail.category_labels[node.category_id]);
      markSourceLanguage(category, category.textContent);
      const edition = document.createElement('span');
      edition.dataset.pluginNodeEdition = '';
      edition.textContent = localeText(node.edition);
      markSourceLanguage(edition, edition.textContent);
      metadata.append(category, document.createTextNode(' · '), edition);
      card.append(cardHeading, metadata);
      const preview = assetsByTarget.get(node.preview);
      if (preview) card.append(imageFigure(detail, preview, 'plugin-node-preview'));
      card.append(sourceParagraph(localeText(node.summary), 'plugin-node-summary'), sourceParagraph(localeText(node.usage), 'plugin-node-usage'));
      const sockets = document.createElement('dl');
      sockets.className = 'plugin-node-sockets';
      const inputs = document.createElement('dt');
      inputs.textContent = message('inputs');
      const inputValues = document.createElement('dd');
      inputValues.textContent = (node.inputs || []).map(localeText).join(' · ') || '—';
      markSourceLanguage(inputValues, inputValues.textContent);
      const outputs = document.createElement('dt');
      outputs.textContent = message('outputs');
      const outputValues = document.createElement('dd');
      outputValues.textContent = (node.outputs || []).map(localeText).join(' · ') || '—';
      markSourceLanguage(outputValues, outputValues.textContent);
      sockets.append(inputs, inputValues, outputs, outputValues);
      card.append(sockets);
      list.append(card);
      return card;
    });
    categoryRecords.forEach(([categoryId, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'plugin-category-button';
      button.dataset.pluginNodeCategory = categoryId;
      button.setAttribute('aria-pressed', String(categoryId === 'all'));
      button.textContent = label;
      markSourceLanguage(button, label);
      categories.append(button);
    });
    count.textContent = `${detail.nodes.length} / ${detail.nodes.length} ${message('nodes-visible')}`;
    controls.append(searchLabel, search, categories, count);
    section.append(heading, controls, list);
    return section;
  }

  function renderAutoCelAssets(detail) {
    if (detail.id !== 'autocel') return [];
    const sections = [];
    const logos = detail.assets.logos || [];
    if (logos.length) {
      const section = document.createElement('section');
      section.className = 'plugin-detail-section plugin-logo-band';
      section.append(...logos.map(asset => imageFigure(detail, asset, 'plugin-logo')));
      sections.push(section);
    }
    const renders = detail.assets.renders || [];
    if (renders.length) {
      const section = document.createElement('section');
      section.className = 'plugin-detail-section plugin-render-band';
      const heading = document.createElement('h2');
      heading.textContent = message('rendered-examples');
      section.append(heading, ...renders.map(asset => imageFigure(detail, asset, 'plugin-render')));
      sections.push(section);
    }
    const panels = detail.assets.panels || [];
    if (panels.length) {
      const section = document.createElement('section');
      section.className = 'plugin-detail-section plugin-panel-section';
      const heading = document.createElement('h2');
      heading.textContent = message('interface-panels');
      const grid = document.createElement('div');
      grid.className = 'plugin-panel-grid';
      panels.forEach(asset => {
        const panel = imageFigure(detail, asset, 'plugin-panel');
        panel.dataset.autocelPanel = '';
        grid.append(panel);
      });
      section.append(heading, grid);
      sections.push(section);
    }
    return sections;
  }

  function renderDestinations(detail) {
    const section = document.createElement('section');
    section.className = 'plugin-detail-section plugin-destination-section';
    const heading = document.createElement('h2');
    heading.textContent = message('source-destinations');
    const list = document.createElement('ul');
    list.className = 'plugin-destination-list';
    detail.external_destinations.forEach(destination => {
      const item = document.createElement('li');
      const safeUrl = window.ResourceArchiveExternalUrl?.safePluginSourceUrl(destination.url);
      if (safeUrl) {
        const link = document.createElement('a');
        link.dataset.pixelFlicker = '';
        link.href = safeUrl;
        link.append(Object.assign(document.createElement('span'), {
          className: 'pixel-button-label',
          textContent: localeText(destination.label),
        }));
        item.append(link);
      } else {
        const unavailable = document.createElement('span');
        unavailable.dataset.invalidDestination = '';
        unavailable.textContent = `${localeText(destination.label)} — ${message('destination-invalid')}`;
        item.append(unavailable);
      }
      if (destination.purpose) item.append(sourceParagraph(localeText(destination.purpose), 'plugin-destination-purpose'));
      list.append(item);
    });
    section.append(heading, list);
    return section;
  }

  function renderSummary(summary) {
    const record = document.createElement('div');
    record.className = 'plugin-summary-record';
    record.dataset.pluginSummary = '';
    record.append(sourceParagraph(localeText(summary.text), 'lede'));
    return record;
  }

  function renderGeneric(detail, { language } = {}) {
    renderLanguage = language || window.resourceArchiveI18n?.language || 'en';
    const article = document.createElement('article');
    article.className = `plugin-detail plugin-detail-${detail.id}`;
    const header = document.createElement('header');
    header.className = 'plugin-detail-header';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = message('eyebrow');
    const heading = document.createElement('h1');
    heading.textContent = detail.identity.name;
    markSourceLanguage(heading, detail.identity.name);
    heading.dataset.transitionPluginTitle = detail.id;
    heading.style.setProperty('view-transition-name', transitionName(detail.id, 'title'));
    const provider = document.createElement('p');
    provider.className = 'plugin-provider';
    const providerName = document.createElement('span');
    providerName.dataset.pluginProvider = '';
    providerName.textContent = detail.identity.provider;
    markSourceLanguage(providerName, detail.identity.provider);
    provider.append(document.createTextNode(`${message('provider')}: `), providerName);
    header.append(eyebrow, heading);
    if (detail.id === 'autocel') {
      const art = document.createElement('img');
      art.dataset.transitionPluginArt = '';
      art.src = '/assets/plugins/autocel/logos/autocel-basics-logo.png';
      art.alt = 'AutoCel Basic logo';
      art.width = 88;
      art.height = 88;
      art.style.cssText = 'display:block;width:88px;height:88px;object-fit:contain;margin:0 0 16px;';
      art.style.setProperty('view-transition-name', transitionName(detail.id, 'art'));
      header.append(art);
    }
    header.append(provider, ...detail.summary.map(renderSummary));
    const autoCelAssets = renderAutoCelAssets(detail);
    article.append(header, renderFacts(detail), ...detail.sections.map(section => renderSection(detail, section)), ...autoCelAssets);
    const nodes = renderNodes(detail);
    if (nodes) article.append(nodes);
    article.append(renderDestinations(detail));
    return article;
  }

  function assetUrl(detail, asset) {
    return typeof asset?.target === 'string' && asset.target ? `/assets/plugins/${detail.id}/${asset.target}` : null;
  }

  function prepareGenericCriticalAssets(detail, { decodeImage }) {
    const assets = detail.assets || {};
    const identity = assets.logos?.[0] || assets.identity?.[0] || null;
    const visual = assets.renders?.[0] || assets.closeups?.[0] || null;
    const fallback = !identity && !visual
      ? Object.values(assets).find(group => Array.isArray(group) && group.length)?.[0] || null
      : null;
    const urls = [...new Set([identity, visual, fallback].map(asset => assetUrl(detail, asset)).filter(Boolean))];
    if (!urls.length) return Promise.resolve();
    return Promise.all(urls.map(url => decodeImage(url))).then(() => undefined);
  }

  function genericHydrate() {
    return () => {};
  }

  function genericPrepareLanguage() {
    return Promise.resolve();
  }

  const genericRenderer = Object.freeze({
    render: renderGeneric,
    hydrate: genericHydrate,
    prepareCriticalAssets: prepareGenericCriticalAssets,
    prepareLanguage: genericPrepareLanguage,
  });

  function registerRenderer(id, renderer) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('Plugin renderer id must be a non-empty string');
    if (!renderer || ['render', 'hydrate', 'prepareCriticalAssets'].some(method => typeof renderer[method] !== 'function')) {
      throw new TypeError('Plugin renderer must define render, hydrate, and prepareCriticalAssets');
    }
    if (renderers.has(id)) throw new Error(`Plugin renderer already registered: ${id}`);
    renderers.set(id, Object.freeze({
      render: renderer.render,
      hydrate: renderer.hydrate,
      prepareCriticalAssets: renderer.prepareCriticalAssets,
      prepareLanguage: typeof renderer.prepareLanguage === 'function'
        ? renderer.prepareLanguage
        : genericPrepareLanguage,
    }));
  }

  function rendererFor(id) {
    return renderers.get(id) || genericRenderer;
  }

  function render(detail, { language, route } = {}) {
    return rendererFor(detail.id).render(detail, { language, route });
  }

  function hydrate(root, detail, { language, route } = {}) {
    const cleanup = rendererFor(detail.id).hydrate(root, detail, { language, route });
    return typeof cleanup === 'function' ? cleanup : () => {};
  }

  function prepareLanguage(id, language) {
    return Promise.resolve(rendererFor(id).prepareLanguage(language));
  }

  window.ResourceArchivePluginDetail = Object.freeze({
    load,
    provenance,
    registerRenderer,
    rendererFor,
    render,
    hydrate,
    prepareLanguage,
  });
})();
