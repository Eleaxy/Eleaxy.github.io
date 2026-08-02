(() => {
  const state = {
    category: 'all',
    query: '',
    edition: 'basic',
    mode: 'general',
    focusSearch: false,
  };
  const text = key => window.resourceArchiveI18n?.translate(`plugin-detail-${key}`) ?? key;
  const languageFor = language => language || window.resourceArchiveI18n?.language || 'en';
  const localized = (value, language) => {
    if (value && typeof value === 'object') return value[languageFor(language)] || value.en || value.zh || '';
    return value || '';
  };
  const sourceHasChinese = value => /[\u3400-\u9fff]/.test(value || '');

  function append(element, ...children) {
    element.append(...children.filter(Boolean));
    return element;
  }

  function element(tag, { className, dataset, textContent, attributes } = {}, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (dataset) Object.assign(node.dataset, dataset);
    if (textContent !== undefined) node.textContent = textContent;
    if (attributes) Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    return append(node, ...children);
  }

  function sourceLanguage(node, value, language) {
    if (languageFor(language) === 'en' && sourceHasChinese(value)) node.lang = 'zh-CN';
    return node;
  }

  function withProvenance(node) {
    return node;
  }

  function sectionRecord(detail, id) {
    return detail.sections.find(section => section.id === id);
  }

  function appendSourceLanguageFragments(node, value) {
    String(value).split(/([\u3400-\u9fff]+)/).filter(Boolean).forEach(fragment => {
      if (!sourceHasChinese(fragment)) {
        node.append(document.createTextNode(fragment));
        return;
      }
      node.append(element('span', { textContent: fragment, attributes: { lang: 'zh-CN' } }));
    });
  }

  function assetUrl(detail, asset) {
    return `/assets/plugins/${detail.id}/${asset.target}`;
  }

  function assetsById(detail) {
    return new Map(Object.values(detail.assets).flat().map(asset => [asset.id, asset]));
  }

  function assetFigure(detail, asset, { className = '', data = {}, eager = false, language } = {}) {
    const figure = withProvenance(
      element('figure', { className: `autocel-figure ${className}`.trim(), dataset: data }),
      asset,
    );
    const label = localized(asset.label, language);
    const image = element('img', {
      dataset: { pluginImage: '', autocelAsset: asset.id, autocelAssetRecord: asset.id },
      attributes: {
        src: assetUrl(detail, asset),
        alt: label,
        loading: eager ? 'eager' : 'lazy',
        decoding: 'async',
      },
    });
    withProvenance(sourceLanguage(image, label, language), asset);
    const caption = sourceLanguage(element('figcaption', { textContent: label }), label, language);
    figure.append(image, caption);
    return figure;
  }

  function renderDestinations(detail, language) {
    const section = element('section', {
      className: 'autocel-destinations plugin-destination-section',
      dataset: { autocelSection: 'destinations' },
      attributes: { 'aria-labelledby': 'autocel-destinations-heading' },
    });
    const heading = element('h2', { textContent: languageFor(language) === 'zh' ? '下载与说明' : 'Downloads and information' });
    heading.id = 'autocel-destinations-heading';
    const destinations = element('ul', { className: 'autocel-destination-list' });
    detail.external_destinations.forEach(destination => {
      const item = element('li');
      const safeUrl = window.ResourceArchiveExternalUrl?.safePluginSourceUrl(destination.url);
      if (safeUrl) {
        const link = element('a', {
          dataset: { pixelFlicker: '' },
          attributes: { href: safeUrl },
        }, element('span', { className: 'pixel-button-label', textContent: localized(destination.label, language) }));
        item.append(link);
      } else {
        item.append(element('span', { textContent: `${localized(destination.label, language)} — ${text('destination-invalid')}` }));
      }
      item.append(sourceLanguage(element('p', { textContent: localized(destination.purpose, language) }), localized(destination.purpose, language), language));
      destinations.append(item);
    });
    section.append(heading, destinations);
    return section;
  }

  function renderHero(detail, presentation, assets, language) {
    const section = withProvenance(element('section', {
      className: 'autocel-hero',
      dataset: { autocelSection: 'hero', autocelHero: '' },
      attributes: { 'aria-labelledby': 'autocel-title' },
    }), detail.identity);
    const copy = element('div', { className: 'autocel-hero-copy' });
    const eyebrow = element('p', { className: 'eyebrow', textContent: languageFor(language) === 'zh' ? '插件档案 / AutoCel' : 'PLUGIN ARCHIVE / AUTOCEL' });
    const title = element('h1', { textContent: presentation.hero.title, dataset: { transitionPluginTitle: 'autocel' } });
    title.id = 'autocel-title';
    title.style.setProperty('view-transition-name', 'plugin-title-autocel');
    const headline = sourceLanguage(element('p', { className: 'autocel-headline', textContent: localized(presentation.hero.headline, language) }), localized(presentation.hero.headline, language), language);
    const lede = sourceLanguage(element('p', { className: 'lede', textContent: localized(presentation.hero.lede, language) }), localized(presentation.hero.lede, language), language);
    const provider = element('p', { className: 'autocel-provider' }, document.createTextNode(`${text('provider')}: `));
    const providerName = sourceLanguage(element('span', { dataset: { pluginProvider: '' }, textContent: detail.identity.provider }), detail.identity.provider, language);
    provider.append(providerName);
    copy.append(eyebrow, title, headline, lede, provider);
    const art = assetFigure(detail, assets.get('paimon'), { className: 'autocel-hero-art', data: { transitionPluginArt: '' }, eager: true, language });
    art.style.setProperty('view-transition-name', 'plugin-art-autocel');
    section.append(copy, art);
    return section;
  }

  function renderQuickStart(detail, presentation, assets, language) {
    const section = withProvenance(element('section', {
      className: 'autocel-quick-start',
      dataset: { autocelSection: 'quickStart'.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`) },
      attributes: { 'aria-labelledby': 'autocel-quick-start-heading' },
    }), sectionRecord(detail, 'quick-start'));
    const heading = element('h2', { textContent: localized(presentation.quick_start.title, language) });
    heading.id = 'autocel-quick-start-heading';
    const lede = sourceLanguage(element('p', { className: 'autocel-section-lede', textContent: localized(presentation.quick_start.lede, language) }), localized(presentation.quick_start.lede, language), language);
    const rail = element('ol', { className: 'autocel-quick-start-rail' });
    presentation.quick_start.steps.forEach((step, index) => {
      const item = element('li', { dataset: { autocelQuickStartStep: '' } });
      item.append(element('span', { className: 'autocel-step-number', textContent: String(index + 1).padStart(2, '0') }));
      item.append(sourceLanguage(element('strong', { textContent: localized(step, language) }), localized(step, language), language));
      rail.append(item);
    });
    const proof = assetFigure(detail, assets.get('toon-color-mapping'), {
      className: 'autocel-inline-proof',
      data: { autocelPanelProof: 'toon-color-mapping' },
      language,
    });
    section.append(heading, lede, rail, proof);
    return section;
  }

  function renderWorkflow(detail, presentation, assets, language, kind) {
    const mmd = kind === 'mmd';
    const asset = assets.get(mmd ? 'silver-wolf' : 'firefly');
    const proofAsset = assets.get(mmd ? 'basic-mmd-material' : 'pro-lighting-info');
    const presentationKey = mmd ? 'mmd_workflow' : 'multi_light_workflow';
    const section = withProvenance(element('section', {
      className: `autocel-workflow autocel-workflow-${kind}`,
      dataset: { autocelSection: mmd ? 'mmd-workflow' : 'multi-light-workflow', autocelWorkflow: mmd ? 'mmd' : 'multi-light' },
      attributes: { 'aria-labelledby': `autocel-${kind}-heading` },
    }), sectionRecord(detail, 'workflows'));
    const render = assetFigure(detail, asset, { className: 'autocel-workflow-render', language });
    const copy = element('div', { className: 'autocel-workflow-copy' });
    const eyebrow = element('p', { className: 'eyebrow', textContent: languageFor(language) === 'zh' ? (mmd ? 'MMD 材质' : 'Pro 多光源') : (mmd ? 'MMD MATERIAL' : 'PRO MULTI-LIGHT') });
    const heading = element('h2', { textContent: localized(presentation[presentationKey].title, language) });
    heading.id = `autocel-${kind}-heading`;
    const body = sourceLanguage(element('p', { textContent: localized(presentation[presentationKey].body, language) }), localized(presentation[presentationKey].body, language), language);
    copy.append(eyebrow, heading, body);
    if (!mmd) {
      copy.append(assetFigure(detail, assets.get('multi-lighting-extension'), {
        className: 'autocel-workflow-node-proof',
        data: { autocelNodeProof: 'multi-lighting-extension' },
        language,
      }));
    }
    const proof = assetFigure(detail, proofAsset, {
      className: 'autocel-workflow-proof',
      data: { autocelPanelProof: mmd ? 'basic-mmd-material' : 'pro-lighting-info' },
      language,
    });
    section.append(render, copy, proof);
    return section;
  }

  function panelAssetId() {
    return `${state.edition === 'pro' ? 'pro' : 'basic'}-${state.mode === 'general' ? 'general-material' : state.mode === 'mmd' ? 'mmd-material' : 'lighting-info'}`;
  }

  function panelImage(detail, asset, language) {
    const label = localized(asset.label, language);
    const image = element('img', {
      dataset: { pluginImage: '', autocelPanel: asset.id, autocelAssetRecord: asset.id },
      attributes: { src: assetUrl(detail, asset), alt: label, decoding: 'async' },
    });
    return withProvenance(sourceLanguage(image, label, language), asset);
  }

  function renderPanelSwitcher(detail, presentation, assets, language) {
    const section = withProvenance(element('section', {
      className: 'autocel-panel-switcher',
      dataset: { autocelSection: 'panel-switcher' },
      attributes: { 'aria-labelledby': 'autocel-panel-heading' },
    }), sectionRecord(detail, 'editions'));
    const brief = element('div', { className: 'autocel-panel-brief' });
    const heading = element('h2', { textContent: languageFor(language) === 'zh' ? '基础版 / Pro 功能面板' : 'Basic / Pro feature panels' });
    heading.id = 'autocel-panel-heading';
    const editions = element('div', { className: 'autocel-edition-controls', attributes: { role: 'group', 'aria-label': languageFor(language) === 'zh' ? '版本选择' : 'Edition selection' } });
    ['basic', 'pro'].forEach(edition => {
      const label = localized(presentation.panel_switcher.edition_labels[edition], language);
      editions.append(element('button', {
        className: 'autocel-tab',
        dataset: { autocelEdition: edition },
        textContent: label,
        attributes: { type: 'button', 'aria-pressed': String(state.edition === edition) },
      }));
    });
    const modes = element('div', { className: 'autocel-mode-controls', attributes: { role: 'group', 'aria-label': languageFor(language) === 'zh' ? '面板模式' : 'Panel mode' } });
    presentation.panel_switcher.modes.forEach(mode => {
      const label = localized(presentation.panel_switcher.titles[mode], language);
      modes.append(element('button', {
        className: 'autocel-mode-button',
        dataset: { autocelPanelMode: mode },
        textContent: label,
        attributes: { type: 'button', 'aria-pressed': String(state.mode === mode) },
      }));
    });
    brief.append(element('p', { className: 'eyebrow', textContent: languageFor(language) === 'zh' ? '功能面板' : 'FEATURE PANELS' }), heading, editions, modes);
    const slot = element('div', { className: 'autocel-panel-slot', dataset: { autocelPanelSlot: '' }, attributes: { 'aria-live': 'polite' } });
    slot.append(panelImage(detail, assets.get(panelAssetId()), language));
    const copy = element('div', { className: 'autocel-panel-copy' });
    const copyEdition = localized(presentation.panel_switcher.edition_labels[state.edition], language);
    const copyMode = localized(presentation.panel_switcher.titles[state.mode], language);
    copy.append(
      element('p', { className: 'eyebrow', dataset: { autocelPanelEditionLabel: '' }, textContent: copyEdition }),
      element('h3', { dataset: { autocelPanelModeLabel: '' }, textContent: copyMode }),
      sourceLanguage(element('p', { textContent: languageFor(language) === 'zh' ? '一次只显示当前版本和模式对应的真实面板，避免并排堆叠两套大图。' : 'One fixed slot shows the current edition and mode, without stacking two large panel grids.' }), languageFor(language) === 'zh' ? '一次只显示当前版本和模式对应的真实面板，避免并排堆叠两套大图。' : '', language),
    );
    section.append(brief, slot, copy);
    return section;
  }

  function renderNodeCatalog(detail, presentation, assets, language) {
    const section = element('section', {
      className: 'autocel-node-catalog',
      dataset: { autocelSection: 'node-catalog' },
      attributes: { 'aria-labelledby': 'autocel-node-catalog-heading' },
    });
    const heading = element('h2', { textContent: languageFor(language) === 'zh' ? '材质节点库' : 'Material node library' });
    heading.id = 'autocel-node-catalog-heading';
    const metadata = element('p', { className: 'autocel-node-metadata', textContent: languageFor(language) === 'zh' ? '40 个节点 · 7 个分类 · 23 张预览' : '40 nodes · 7 categories · 23 previews' });
    const searchLabel = element('label', { className: 'autocel-search-label', textContent: languageFor(language) === 'zh' ? '搜索节点名称或用途' : 'Search node name or usage' });
    const search = element('input', {
      dataset: { autocelNodeSearch: '', pluginNodeSearch: '' },
      attributes: { type: 'search', value: state.query, placeholder: languageFor(language) === 'zh' ? '名称、分类、摘要或用途' : 'Name, category, summary, or usage' },
    });
    searchLabel.htmlFor = 'autocel-node-search';
    search.id = searchLabel.htmlFor;
    const clear = element('button', {
      className: 'autocel-search-clear',
      dataset: { autocelNodeClear: '' },
      textContent: languageFor(language) === 'zh' ? '清除搜索' : 'Clear search',
      attributes: { type: 'button' },
    });
    const count = element('p', { className: 'autocel-node-count', dataset: { autocelNodeCount: '', pluginNodeCount: '' }, attributes: { 'aria-live': 'polite' } });
    const controls = element('div', { className: 'autocel-node-controls' }, searchLabel, search, clear, count);
    const categories = element('div', {
      className: 'autocel-categories',
      attributes: { role: 'group', 'aria-label': text('category-filter') },
    });
    const categoryRecords = [['all', languageFor(language) === 'zh' ? '全部' : 'All'], ...Object.keys(detail.category_labels)
      .map(category => [category, localized(detail.category_labels[category], language)])];
    categoryRecords.forEach(([category, label]) => {
      categories.append(element('button', {
        className: 'plugin-category-button autocel-category-button',
        dataset: { autocelCategory: category, pluginNodeCategory: category },
        textContent: label,
        attributes: { type: 'button', 'aria-pressed': String(state.category === category) },
      }));
    });
    const list = element('div', { className: 'autocel-node-list' });
    const previews = new Map((detail.assets.node_previews || []).map(asset => [asset.target, asset]));
    detail.nodes.forEach(node => {
      const card = withProvenance(element('article', {
        className: 'autocel-node-row plugin-node',
        dataset: { autocelNode: node.id, pluginNode: node.id, nodeCategory: node.category_id },
      }), node);
      const preview = previews.get(node.preview);
      if (preview) {
        const thumbnail = element('div', { className: 'autocel-node-thumbnail' });
        const image = panelImage(detail, preview, language);
        image.dataset.autocelNodePreview = '';
        thumbnail.append(image);
        card.append(thumbnail);
      } else {
        card.append(element('div', { className: 'autocel-node-thumbnail autocel-node-thumbnail-empty', textContent: '—' }));
      }
      const nameText = localized(node.name, language);
      const editionText = localized(node.edition, language);
      const summaryText = localized(node.summary, language);
      const usageText = localized(node.usage, language);
      const name = sourceLanguage(element('h3', { dataset: { pluginNodeName: '' }, textContent: nameText }), nameText, language);
      const edition = sourceLanguage(element('span', { className: 'autocel-node-edition', dataset: { pluginNodeEdition: '' }, textContent: editionText }), editionText, language);
      const label = localized(detail.category_labels[node.category_id], language);
      const category = sourceLanguage(element('span', { className: 'autocel-node-category-name', dataset: { pluginNodeCategoryName: '' }, textContent: label }), label, language);
      const metadata = element('p', { className: 'plugin-node-metadata' }, category, document.createTextNode(' · '), edition);
      const identity = element('div', { className: 'autocel-node-identity' }, name, metadata);
      const descriptionText = `${summaryText} ${usageText}`.trim();
      const description = sourceLanguage(element('p', { className: 'autocel-node-description', textContent: descriptionText }), descriptionText, language);
      card.dataset.autocelSearchIndex = [
        node.id,
        localized(node.name, 'en'), localized(node.name, 'zh'), node.category,
        localized(node.summary, 'en'), localized(node.summary, 'zh'),
        localized(node.usage, 'en'), localized(node.usage, 'zh'),
        detail.category_labels[node.category_id].en, detail.category_labels[node.category_id].zh,
      ].join(' ').toLocaleLowerCase();
      card.append(identity, description);
      list.append(card);
    });
    const empty = element('p', { className: 'autocel-empty-state', dataset: { autocelEmpty: '' }, attributes: { hidden: '' }, textContent: languageFor(language) === 'zh' ? '没有匹配的节点。' : 'No matching nodes.' });
    section.append(heading, metadata, controls, categories, list, empty);
    return section;
  }

  function render(detail, { language } = {}) {
    const presentation = detail.presentation;
    const assets = assetsById(detail);
    const article = element('article', { className: 'plugin-detail plugin-detail-autocel', dataset: { autocelDetail: '' } });
    article.append(
      renderHero(detail, presentation, assets, language),
      renderQuickStart(detail, presentation, assets, language),
      renderWorkflow(detail, presentation, assets, language, 'mmd'),
      renderWorkflow(detail, presentation, assets, language, 'multi-light'),
      renderPanelSwitcher(detail, presentation, assets, language),
      renderNodeCatalog(detail, presentation, assets, language),
      renderDestinations(detail, language),
    );
    return article;
  }

  function updateFilters(root, language) {
    const query = state.query.trim().toLocaleLowerCase();
    let visible = 0;
    root.querySelectorAll('[data-autocel-node]').forEach(card => {
      const matchesQuery = !query || card.dataset.autocelSearchIndex.includes(query);
      const matchesCategory = state.category === 'all' || card.dataset.nodeCategory === state.category;
      const show = matchesQuery && matchesCategory;
      card.hidden = !show;
      card.setAttribute('aria-hidden', String(!show));
      if (show) visible += 1;
    });
    root.querySelectorAll('[data-autocel-category]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.autocelCategory === state.category));
    });
    const count = root.querySelector('[data-autocel-node-count]');
    if (count) count.textContent = `${visible} / 40 ${languageFor(language) === 'zh' ? '个节点可见' : 'nodes visible'}`;
    const empty = root.querySelector('[data-autocel-empty]');
    if (empty) empty.hidden = visible !== 0;
  }

  function updatePanelControls(root, detail, language, { animate = true } = {}) {
    const assets = assetsById(detail);
    const slot = root.querySelector('[data-autocel-panel-slot]');
    const asset = assets.get(panelAssetId());
    root.querySelectorAll('[data-autocel-edition]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.autocelEdition === state.edition)));
    root.querySelectorAll('[data-autocel-panel-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.autocelPanelMode === state.mode)));
    root.querySelector('[data-autocel-panel-edition-label]')?.replaceChildren(localized(detail.presentation.panel_switcher.edition_labels[state.edition], language));
    root.querySelector('[data-autocel-panel-mode-label]')?.replaceChildren(localized(detail.presentation.panel_switcher.titles[state.mode], language));
    if (!slot || !asset) return;
    const replace = () => slot.replaceChildren(panelImage(detail, asset, language));
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      replace();
      return;
    }
    slot.classList.remove('is-entering');
    slot.classList.add('is-exiting');
    const exit = setTimeout(() => {
      replace();
      slot.classList.remove('is-exiting');
      slot.classList.add('is-entering');
      const entry = setTimeout(() => slot.classList.remove('is-entering'), 150);
      slot.__autocelEntryTimer = entry;
    }, 90);
    slot.__autocelExitTimer = exit;
  }

  function hydrate(root, detail, { language } = {}) {
    const search = root.querySelector('[data-autocel-node-search]');
    let cleaned = false;
    let focusFrame = null;
    const clearTimers = () => {
      const slot = root.querySelector('[data-autocel-panel-slot]');
      clearTimeout(slot?.__autocelExitTimer);
      clearTimeout(slot?.__autocelEntryTimer);
    };
    const stop = event => event.stopImmediatePropagation();
    const onClick = event => {
      const control = event.target.closest?.('[data-autocel-edition], [data-autocel-panel-mode], [data-autocel-category], [data-autocel-node-clear]');
      if (!control || !root.contains(control)) return;
      stop(event);
      if (control.dataset.autocelEdition) {
        state.edition = control.dataset.autocelEdition;
        clearTimers();
        updatePanelControls(root, detail, language);
        return;
      }
      if (control.dataset.autocelPanelMode) {
        state.mode = control.dataset.autocelPanelMode;
        clearTimers();
        updatePanelControls(root, detail, language);
        return;
      }
      if (control.dataset.autocelCategory) {
        state.category = control.dataset.autocelCategory;
        updateFilters(root, language);
        return;
      }
      state.query = '';
      if (search) {
        search.value = '';
        state.focusSearch = true;
        search.focus({ preventScroll: true });
      }
      updateFilters(root, language);
    };
    const onInput = event => {
      if (!event.target.matches?.('[data-autocel-node-search]')) return;
      stop(event);
      state.query = event.target.value;
      state.focusSearch = document.activeElement === event.target;
      updateFilters(root, language);
    };
    root.addEventListener('click', onClick, true);
    root.addEventListener('input', onInput, true);
    updateFilters(root, language);
    if (state.focusSearch && search) {
      focusFrame = requestAnimationFrame(() => {
        focusFrame = null;
        if (!cleaned) search.focus({ preventScroll: true });
      });
    }
    return () => {
      if (cleaned) return;
      cleaned = true;
      clearTimers();
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('input', onInput, true);
    };
  }

  function prepareCriticalAssets(_detail, { decodeImage }) {
    return Promise.all([
      decodeImage('/assets/plugins/autocel/logos/autocel-basics-logo.png'),
      decodeImage('/assets/plugins/autocel/renders/paimon.png'),
    ]).then(() => undefined);
  }

  window.ResourceArchivePluginDetail.registerRenderer('autocel', { render, hydrate, prepareCriticalAssets });
})();
