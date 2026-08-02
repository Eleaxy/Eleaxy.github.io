(() => {
  const storageKey = 'resource-archive-language';
  const navigation = {
    en: {
      lang: 'en',
      label: 'Primary',
      toggleLabel: 'Switch to Chinese',
    },
    zh: {
      lang: 'zh-CN',
      label: '主导航',
      toggleLabel: '切换到英文',
    },
  };

  const translations = {
    en: {
      'nav-home': 'Home',
      'nav-nodes': 'Nodes',
      'nav-stages': 'Stages',
      'nav-tutorials': 'Tutorials',
      'nav-plugins': 'Plugins',
      'nav-contributors': 'Contributors',
      'language-toggle': '中文',
      'skip-to-content': 'Skip to content',
      'home-title': 'Nodes process data. Scenes organise objects.',
      'home-descriptor': 'Plugins turn repeated operations into tools.',
      'home-facts': '569 node records · 12 stage files · 2 plugins',
      'home-statement': 'Objects, collections, materials, and node trees.',
      'home-nodes': 'Explore archive',
      'home-stages': 'Browse stages',
      'home-archive-status': 'Archive status',
      'home-node-records': 'Node records',
      'home-stage-records': 'Stage records',
      'home-tutorial-records': 'Tutorial records',
      'home-upstream-sources': 'Plugins',
      'nodes-eyebrow': 'Node archive',
      'nodes-title': 'Nodes',
      'nodes-search': 'Search nodes',
      'nodes-search-placeholder': 'Name, ID, or description',
      'nodes-filters-label': 'Node filters',
      'nodes-clear-filters': 'Clear filters',
      'nodes-empty-status': 'No matches',
      'nodes-empty-title': 'No matching nodes',
      'nodes-empty-copy': 'Try a different term or return to the complete archive.',
      'nodes-directory-kicker': 'Node systems',
      'nodes-directory-title': 'Browse nodes by system.',
      'nodes-directory-copy': 'Nine systems organise every source record. Enter a system to see its complete directory.',
      'nodes-loading-systems-label': 'Loading node systems',
      'nodes-loading-systems': 'Loading node systems…',
      'nodes-loading-archive-label': 'Loading node archive',
      'nodes-loading-archive': 'Loading node archive…',
      'content-table-error-status': 'Translation unavailable',
      'content-table-error-heading': 'Chinese content could not be loaded.',
      'content-table-error-message': 'The Chinese content table could not be loaded. The existing record remains available.',
      'content-table-retry': 'Retry Chinese content',
      'nodes-catalog-error-label': 'Node archive unavailable',
      'nodes-catalog-error-title': 'The node archive could not be loaded.',
      'nodes-catalog-error-message': 'Reason: {message}',
      'nodes-catalog-retrying': 'Retrying the node archive…',
      'nodes-all': 'All Nodes',
      'nodes-complete-index': 'Complete source index',
      'nodes-catalog-summary': 'Every source record is present as a lightweight link. Details load only when opened.',
      'nodes-search-clear': 'Clear search',
      'nodes-search-empty': 'No nodes match this search.',
      'nodes-subtype': 'Subtype',
      'nodes-record-count': '{count} records',
      'nodes-jump-subtype': 'Jump to node subtype',
      'nodes-jump-system': 'Jump to node system',
      'nodes-links-in-document': '{count} links in document',
      'nodes-visible-label': 'Visible:',
      'nodes-invalid-group': 'Invalid group',
      'nodes-system-directory': 'System directory',
      'nodes-parent-directory': 'Node systems directory',
      'nodes-dialog-close': 'Close',
      'nodes-dialog-back-directory': 'Back to node directory',
      'nodes-dialog-label': 'Node details',
      'nodes-dialog-loading': 'Loading node detail…',
      'nodes-dialog-error': 'Node detail unavailable',
      'nodes-dialog-retry': 'Retry',
      'nodes-dialog-no-description': 'No source description is available.',
      'nodes-dialog-preview-alt': '{name} usage example from the Blueish archive',
      'nodes-dialog-preview-unavailable': 'Preview unavailable: {name}',
      'nodes-dialog-preview-caption': 'Official usage example from the Blueish archive.',
      'nodes-dialog-curated-parameter-notes': 'Curated parameter notes',
      'nodes-dialog-inputs': 'Inputs',
      'nodes-dialog-outputs': 'Outputs',
      'nodes-dialog-socket': 'Socket',
      'nodes-dialog-unnamed-socket': 'Unnamed socket',
      'nodes-dialog-type': 'Type',
      'nodes-dialog-default': 'Default',
      'nodes-dialog-description': 'Description',
      'nodes-dialog-socket-table-region': '{label} socket table',
      'nodes-dialog-download-note': 'This node is included in the linked source .blend; it is not presented as a separate single-node file.',
      'nodes-dialog-download-owning': 'Download owning .blend · {file}',
      'nodes-dialog-view-blueish-source': 'View Blueish source archive',
      'nodes-detail-breadcrumb': 'Breadcrumb',
      'nodes-detail-system': 'System',
      'nodes-detail-category': 'Category',
      'nodes-detail-created-version': 'Created',
      'nodes-detail-last-modified-version': 'Last modified',
      'nodes-detail-version': 'Version',
      'nodes-detail-source-geomData': 'Geometry node data',
      'nodes-detail-source-shaderData': 'Shader node data',
      'nodes-detail-source-compData': 'Compositor node data',
      'nodes-dialog-source-fragment-Coordiante': 'Coordinate',
      'nodes-dialog-source-fragment-Whole': 'Whole',
      'nodes-dialog-source-fragment-Small': 'Small',
      'nodes-dialog-source-fragment-Outer': 'Outer',
      'nodes-dialog-source-fragment-Thermal': 'Thermal',
      'nodes-dialog-source-fragment-Linear': 'Linear',
      'nodes-dialog-source-fragment-Constant': 'Constant',
      'stages-eyebrow': 'Stage archive',
      'stages-title': 'Stages',
      'stages-lede': 'Complete scene records with local images. {count} stages are reachable.',
      'stages-home-title': 'Scene files, kept with their context.',
      'stages-home-copy': 'Each record retains its image, Blender version, ReadMe, usage terms and original download source.',
      'stages-loading-previews-label': 'Loading Stage previews',
      'stages-loading-previews': 'Loading Stage previews…',
      'stages-loading-archive-label': 'Loading stage archive',
      'stages-loading-archive': 'Loading stage archive…',
      'stages-preview-aria': 'Stage previews',
      'stages-view-all': 'View all {count} stages',
      'stages-preview-error': 'Stage previews unavailable: {message}',
      'stages-index-aria': 'Stage archive',
      'stages-view-details': 'View {title} details',
      'stages-media-cta': 'View stage ↗',
      'stages-rail-previous': 'Previous stages',
      'stages-rail-next': 'Next stages',
      'stages-back-all': 'Back to all stages',
      'stages-readme': 'ReadMe',
      'stages-usage-terms': 'Usage terms',
      'stages-download-from': 'Download from {source}',
      'stages-view-original-source': 'View original source',
      'stages-error-status': 'Unavailable',
      'stages-error-heading': 'The Stage archive could not be loaded.',
      'stages-unknown-heading': 'Unknown Stage: {stageId}',
      'stages-retry': 'Retry',
      'tutorials-eyebrow': 'Learning archive',
      'tutorials-title': 'Tutorials',
      'tutorials-lede': 'Practical walkthroughs will live here once source material has been verified and prepared.',
      'tutorials-status': 'Learning archive / No entries',
      'tutorials-empty-title': 'No entries yet',
      'tutorials-empty-copy': 'No verified tutorial records exist yet.',
      'tutorials-directory-eyebrow': 'Learning archive',
      'tutorials-directory-title': 'Tutorials',
      'tutorials-show-more': 'Show more',
      'tutorials-collapse': 'Collapse',
      'tutorials-back': 'Back to tutorials',
      'tutorials-hierarchy': 'Learning archive / Tutorial',
      'tutorials-loading': 'Loading tutorial records…',
      'tutorials-data-error': 'Tutorial data unavailable',
      'tutorials-data-error-title': 'Tutorial records could not be loaded.',
      'tutorials-data-error-copy': 'The tutorial archive is temporarily unavailable.',
      'tutorials-invalid': 'Invalid tutorial',
      'tutorials-invalid-title': 'This tutorial is not available.',
      'tutorials-invalid-copy': 'Return to the tutorial archive to choose a verified record.',
      'tutorials-retry': 'Retry',
      'tutorials-image-error': 'Image unavailable.',
      'plugins-eyebrow': 'Extension archive',
      'plugins-title': 'Plugins',
      'plugins-lede': 'Verified extensions and companion tools will be indexed here when records become available.',
      'plugins-status': 'Extension archive / No entries',
      'plugins-empty-title': 'No entries yet',
      'plugins-empty-copy': 'No verified plugin records exist yet.',
      'plugins-register-eyebrow': 'Extension register',
      'plugins-register-lede': 'Plugin documentation, versions, features, and downloads.',
      'plugins-loading': 'Loading plugin records…',
      'plugins-verification': 'Verification',
      'plugins-release-tag': 'Release tag',
      'plugins-manifest-version': 'Manifest version',
      'plugins-compatibility': 'Compatibility',
      'plugins-installation-artifact': 'Installation artifact',
      'plugins-license': 'License',
      'plugins-provider': 'Provider',
      'plugins-maintainer-attribution': 'Maintainer attribution',
      'plugins-documentation-claims': 'Documentary claims',
      'plugins-documentation-source': 'Documentary source',
      'plugins-source-sha256': 'SHA-256',
      'plugins-destination': 'External destination',
      'plugins-destination-invalid': 'Invalid destination; HTTPS is required.',
      'plugins-unavailable': 'Not provided',
      'plugins-artifact-unavailable': 'Installation artifact not provided.',
      'plugins-license-unavailable': 'License not provided.',
      'plugins-destination-unavailable': 'No verified external destination was provided.',
      'plugins-error-status': 'Unavailable',
      'plugins-error-heading': 'Plugin records could not be loaded.',
      'plugins-error-http': 'The server returned {message}.',
      'plugins-error-unavailable': 'The plugin archive was not available.',
      'plugins-retry': 'Retry',
      'plugins-open-detail': 'View detailed archive',
      'plugins-source-count': 'Source records',
      'plugin-detail-back': 'Back to plugin archive',
      'plugin-detail-eyebrow': 'In-site plugin archive',
      'plugin-detail-provider': 'Provider',
      'plugin-detail-verification': 'Verification',
      'plugin-detail-source': 'Source reference',
      'plugin-detail-loading': 'Loading plugin archive…',
      'plugin-detail-unavailable': 'Unavailable',
      'plugin-detail-error-heading': 'Plugin detail could not be loaded.',
      'plugin-detail-error-unavailable': 'The plugin detail record was not available.',
      'plugin-detail-retry': 'Retry',
      'plugin-detail-facts': 'Version and verification facts',
      'plugin-detail-step': 'Step',
      'plugin-detail-documented-group': 'Documented group',
      'plugin-detail-documented-nodes': 'documented nodes',
      'plugin-detail-property-flow-label': 'Property Package flow: Capture, Package, Apply, Flow',
      'plugin-detail-flow-capture': 'Capture',
      'plugin-detail-flow-package': 'Package',
      'plugin-detail-flow-apply': 'Apply',
      'plugin-detail-flow-flow': 'Flow',
      'plugin-detail-node-catalog': 'Complete 40-node catalog',
      'plugin-detail-search-label': 'Search source nodes',
      'plugin-detail-search-placeholder': 'Name, summary, or usage',
      'plugin-detail-category-filter': 'Node category filter',
      'plugin-detail-all-categories': 'All',
      'plugin-detail-nodes-visible': 'nodes visible',
      'plugin-detail-inputs': 'Inputs',
      'plugin-detail-outputs': 'Outputs',
      'plugin-detail-rendered-examples': 'Documented rendered examples',
      'plugin-detail-interface-panels': 'Documented interface panels',
      'plugin-detail-image-unavailable': 'Image unavailable',
      'plugin-detail-source-destinations': 'Source destinations',
      'plugin-detail-destination-invalid': 'Unavailable destination',
      'plugin-detail-source-ledger': 'Source ledger',
      'plugin-detail-open-source': 'Open source record',
      'contributors-eyebrow': 'Archive sources',
      'contributors-title': 'Contributors',
      'contributors-lede': 'Sources and providers behind the collection.',
      'contributors-sources': 'Archive sources',
      'contributors-loading-records-label': 'Loading sources',
      'contributors-loading-records': 'Loading sources…',
      'contributors-error-status': 'Unavailable',
      'contributors-error-heading': 'Sources could not be loaded.',
      'contributors-error-http': 'The server returned {message}.',
      'contributors-error-unavailable': 'The source archive was not available.',
      'contributors-retry': 'Retry',
      'contributors-card-kind': 'Archive sources',
      'contributors-card-verified': 'Source URL available.',
      'contributors-card-no-url': 'No source URL is available.',
      'contributors-card-visit': 'Visit {name} source',
      'contributors-identity-operator-supplied': 'Operator-supplied identity',
      'footer-collection-label': 'Resource Archive / Blender resource index',
      'footer-title': 'Nodes, stages, and plugin documentation.',
      'footer-contact-trigger': 'Get in touch',
      'footer-contact-copy': 'If you make Blender nodes, scenes, or plugins,\nand would like to share them with others,\nget in touch to join.',
      'footer-contact-dialog-title': 'Contact',
      'footer-contact-qq': 'QQ',
      'footer-contact-copy-number': 'Copy number',
      'footer-contact-close': 'Close',
      'footer-contact-copied': 'Copied',
      'footer-tetris-play': 'play',
      'footer-tetris-close': 'close',
      'footer-tetris-reduced-title': 'Animation is disabled by reduced motion settings',
      'footer-tetris-label': 'Interactive pixel skyline',
      'footer-tetris-score': 'Score',
      'footer-tetris-move-left': 'Move left',
      'footer-tetris-move-right': 'Move right',
      'footer-tetris-rotate': 'Rotate',
      'footer-tetris-hard-drop': 'Hard drop',
      'footer-tetris-close-game': 'Close game',
      'footer-home': 'Resource Archive home',
    },
    zh: {
      'nav-home': '首页',
      'nav-nodes': '节点',
      'nav-stages': '场景',
      'nav-tutorials': '教程',
      'nav-plugins': '插件',
      'nav-contributors': '贡献者',
      'language-toggle': 'EN',
      'skip-to-content': '跳到主要内容',
      'home-title': '节点处理数据，场景组织对象。',
      'home-descriptor': '插件把重复操作变成工具。',
      'home-facts': '569 条节点记录 · 12 个场景文件 · 2 个插件',
      'home-statement': '对象、集合、材质和节点树。',
      'home-nodes': '浏览档案',
      'home-stages': '浏览场景',
      'home-archive-status': '档案状态',
      'home-node-records': '节点记录',
      'home-stage-records': '场景记录',
      'home-tutorial-records': '教程记录',
      'home-upstream-sources': '插件',
      'nodes-eyebrow': '节点档案',
      'nodes-title': '节点',
      'nodes-search': '搜索节点',
      'nodes-search-placeholder': '名称、ID 或说明',
      'nodes-filters-label': '节点筛选',
      'nodes-clear-filters': '清除筛选',
      'nodes-empty-status': '没有匹配项',
      'nodes-empty-title': '没有匹配的节点',
      'nodes-empty-copy': '请尝试其他关键词，或返回完整档案。',
      'nodes-directory-kicker': '节点系统',
      'nodes-directory-title': '按系统浏览节点。',
      'nodes-directory-copy': '九个系统收录全部来源记录；进入任一系统即可查看完整目录。',
      'nodes-loading-systems-label': '正在加载节点系统',
      'nodes-loading-systems': '正在加载节点系统…',
      'nodes-loading-archive-label': '正在加载节点档案',
      'nodes-loading-archive': '正在加载节点档案…',
      'content-table-error-status': '中文内容不可用',
      'content-table-error-heading': '中文内容暂时无法加载。',
      'content-table-error-message': '中文内容表加载失败；现有档案记录仍然可用。',
      'content-table-retry': '重试中文内容',
      'nodes-catalog-error-label': '节点档案不可用',
      'nodes-catalog-error-title': '无法加载节点档案。',
      'nodes-catalog-error-message': '原因：{message}',
      'nodes-catalog-retrying': '正在重试节点档案…',
      'nodes-all': '全部节点',
      'nodes-complete-index': '完整来源索引',
      'nodes-catalog-summary': '每条来源记录都以轻量链接存在；只有打开详情时才加载完整数据。',
      'nodes-search-clear': '清空搜索',
      'nodes-search-empty': '没有节点符合当前搜索。',
      'nodes-subtype': '子类',
      'nodes-record-count': '{count} 条记录',
      'nodes-jump-subtype': '跳转到节点子类',
      'nodes-jump-system': '跳转到节点系统',
      'nodes-links-in-document': '文档内含 {count} 个链接',
      'nodes-visible-label': '可见：',
      'nodes-invalid-group': '无效分类',
      'nodes-system-directory': '系统目录',
      'nodes-parent-directory': '返回节点系统目录',
      'nodes-dialog-close': '关闭',
      'nodes-dialog-back-directory': '返回节点目录',
      'nodes-dialog-label': '节点详情',
      'nodes-dialog-loading': '正在加载节点详情…',
      'nodes-dialog-error': '节点详情不可用',
      'nodes-dialog-retry': '重试',
      'nodes-dialog-no-description': '没有可用的来源说明。',
      'nodes-dialog-preview-alt': 'Blueish 档案中的 {name} 使用示例',
      'nodes-dialog-preview-unavailable': '预览不可用：{name}',
      'nodes-dialog-preview-caption': 'Blueish 档案中的官方使用示例。',
      'nodes-dialog-curated-parameter-notes': '精选参数说明',
      'nodes-dialog-inputs': '输入',
      'nodes-dialog-outputs': '输出',
      'nodes-dialog-socket': '插槽',
      'nodes-dialog-unnamed-socket': '未命名插槽',
      'nodes-dialog-type': '类型',
      'nodes-dialog-default': '默认值',
      'nodes-dialog-description': '说明',
      'nodes-dialog-socket-table-region': '{label}插槽表',
      'nodes-dialog-download-note': '此节点包含在已链接的源 .blend 文件中；它并非单独提供的单节点文件。',
      'nodes-dialog-download-owning': '下载所属 .blend · {file}',
      'nodes-dialog-view-blueish-source': '查看 Blueish 源档案',
      'nodes-detail-breadcrumb': '路径导航',
      'nodes-detail-system': '系统',
      'nodes-detail-category': '分类',
      'nodes-detail-created-version': '创建版本',
      'nodes-detail-last-modified-version': '最后修改版本',
      'nodes-detail-version': '版本',
      'nodes-detail-source-geomData': '几何节点数据',
      'nodes-detail-source-shaderData': '着色器节点数据',
      'nodes-detail-source-compData': '合成节点数据',
      'nodes-dialog-source-fragment-Coordiante': '坐标',
      'nodes-dialog-source-fragment-Whole': '整体',
      'nodes-dialog-source-fragment-Small': '小范围',
      'nodes-dialog-source-fragment-Outer': '外层',
      'nodes-dialog-source-fragment-Thermal': '热学',
      'nodes-dialog-source-fragment-Linear': '线性',
      'nodes-dialog-source-fragment-Constant': '常量',
      'stages-eyebrow': '场景档案',
      'stages-title': '场景',
      'stages-lede': '包含本地图片的完整场景记录。可访问 {count} 个场景。',
      'stages-home-title': '场景文件，连同它们的上下文一起保存。',
      'stages-home-copy': '每条记录都保留图片、Blender 版本、ReadMe、使用条款和原始下载来源。',
      'stages-loading-previews-label': '正在加载场景预览',
      'stages-loading-previews': '正在加载场景预览…',
      'stages-loading-archive-label': '正在加载场景档案',
      'stages-loading-archive': '正在加载场景档案…',
      'stages-preview-aria': '场景预览',
      'stages-view-all': '查看全部 {count} 个场景',
      'stages-preview-error': '场景预览不可用：{message}',
      'stages-index-aria': '场景档案',
      'stages-view-details': '查看 {title} 详情',
      'stages-media-cta': '查看场景 ↗',
      'stages-rail-previous': '上一场景',
      'stages-rail-next': '下一场景',
      'stages-back-all': '返回全部场景',
      'stages-readme': '说明',
      'stages-usage-terms': '使用条款',
      'stages-download-from': '从 {source} 下载',
      'stages-view-original-source': '查看原始来源',
      'stages-error-status': '不可用',
      'stages-error-heading': '无法加载场景档案。',
      'stages-unknown-heading': '未知场景：{stageId}',
      'stages-retry': '重试',
      'tutorials-eyebrow': '学习档案',
      'tutorials-title': '教程',
      'tutorials-lede': '来源材料完成核验与整理后，实用教程会收录在这里。',
      'tutorials-status': '学习档案 / 暂无条目',
      'tutorials-empty-title': '暂无条目',
      'tutorials-empty-copy': '目前没有经过核验的教程记录。',
      'tutorials-directory-eyebrow': '学习档案',
      'tutorials-directory-title': '教程',
      'tutorials-show-more': '显示更多',
      'tutorials-collapse': '收起',
      'tutorials-back': '返回教程目录',
      'tutorials-hierarchy': '学习档案 / 教程',
      'tutorials-loading': '正在加载教程记录…',
      'tutorials-data-error': '教程数据不可用',
      'tutorials-data-error-title': '无法加载教程记录。',
      'tutorials-data-error-copy': '教程档案暂时不可用。',
      'tutorials-invalid': '无效教程',
      'tutorials-invalid-title': '此教程不可用。',
      'tutorials-invalid-copy': '请返回教程目录，选择已核验的记录。',
      'tutorials-retry': '重试',
      'tutorials-image-error': '图片不可用。',
      'plugins-eyebrow': '扩展资料库',
      'plugins-title': '插件',
      'plugins-lede': '有可用记录后，已核验的扩展和配套工具会收录在这里。',
      'plugins-status': '扩展档案 / 暂无条目',
      'plugins-empty-title': '暂无条目',
      'plugins-empty-copy': '目前没有经过核验的插件记录。',
      'plugins-register-eyebrow': '扩展登记册',
      'plugins-register-lede': '插件资料、版本、功能说明和下载入口。',
      'plugins-loading': '正在加载插件记录…',
      'plugins-verification': '核验状态',
      'plugins-release-tag': '发布标签',
      'plugins-manifest-version': '清单版本',
      'plugins-compatibility': '兼容性',
      'plugins-installation-artifact': '安装工件',
      'plugins-license': '许可证',
      'plugins-provider': '提供者',
      'plugins-maintainer-attribution': '维护者归属',
      'plugins-documentation-claims': '文档声明',
      'plugins-documentation-source': '文档来源',
      'plugins-source-sha256': 'SHA-256',
      'plugins-destination': '外部目标',
      'plugins-destination-invalid': '不可用：仅允许 HTTPS。',
      'plugins-unavailable': '未提供',
      'plugins-artifact-unavailable': '安装工件未提供。',
      'plugins-license-unavailable': '许可证未提供。',
      'plugins-destination-unavailable': '未提供已核验的外部目标。',
      'plugins-error-status': '不可用',
      'plugins-error-heading': '无法加载插件记录。',
      'plugins-error-http': '服务器返回了 {message}。',
      'plugins-error-unavailable': '插件档案当前不可用。',
      'plugins-retry': '重试',
      'plugins-open-detail': '查看详细档案',
      'plugins-source-count': '来源记录数',
      'plugin-detail-back': '返回插件档案',
      'plugin-detail-eyebrow': '站内插件档案',
      'plugin-detail-provider': '提供者',
      'plugin-detail-verification': '核验状态',
      'plugin-detail-source': '来源引用',
      'plugin-detail-loading': '正在加载插件档案…',
      'plugin-detail-unavailable': '不可用',
      'plugin-detail-error-heading': '无法加载插件详情。',
      'plugin-detail-error-unavailable': '插件详情记录当前不可用。',
      'plugin-detail-retry': '重试',
      'plugin-detail-facts': '版本与核验事实',
      'plugin-detail-step': '步骤',
      'plugin-detail-documented-group': '已记录分组',
      'plugin-detail-documented-nodes': '个已记录节点',
      'plugin-detail-property-flow-label': '属性包流程：捕获、打包、应用、流程',
      'plugin-detail-flow-capture': '捕获',
      'plugin-detail-flow-package': '打包',
      'plugin-detail-flow-apply': '应用',
      'plugin-detail-flow-flow': '流程',
      'plugin-detail-node-catalog': '完整 40 节点目录',
      'plugin-detail-search-label': '搜索来源节点',
      'plugin-detail-search-placeholder': '名称、摘要或用途',
      'plugin-detail-category-filter': '节点分类筛选',
      'plugin-detail-all-categories': '全部',
      'plugin-detail-nodes-visible': '个节点可见',
      'plugin-detail-inputs': '输入',
      'plugin-detail-outputs': '输出',
      'plugin-detail-rendered-examples': '文档中的渲染示例',
      'plugin-detail-interface-panels': '文档中的界面面板',
      'plugin-detail-image-unavailable': '图片不可用',
      'plugin-detail-source-destinations': '来源去向',
      'plugin-detail-destination-invalid': '去向不可用',
      'plugin-detail-source-ledger': '来源记录',
      'plugin-detail-open-source': '打开来源记录',
      'contributors-eyebrow': '档案来源',
      'contributors-title': '贡献者',
      'contributors-lede': '收录内容的来源与提供者。',
      'contributors-sources': '档案来源',
      'contributors-loading-records-label': '正在加载来源',
      'contributors-loading-records': '正在加载来源…',
      'contributors-error-status': '不可用',
      'contributors-error-heading': '无法加载来源。',
      'contributors-error-http': '服务器返回了 {message}。',
      'contributors-error-unavailable': '来源档案当前不可用。',
      'contributors-retry': '重试',
      'contributors-card-kind': '档案来源',
      'contributors-card-verified': '来源链接可用。',
      'contributors-card-no-url': '暂无来源链接。',
      'contributors-card-visit': '访问 {name} 来源',
      'contributors-identity-operator-supplied': '身份对应由站点维护者提供',
      'footer-collection-label': 'Resource Archive / Blender 资源索引',
      'footer-title': '节点、场景与插件资料。',
      'footer-contact-trigger': 'Get in touch',
      'footer-contact-copy': '如果你正在制作 Blender 节点、场景或插件，\n也愿意把它们分享给其他使用者，\n欢迎联系加入。',
      'footer-contact-dialog-title': '联系方式',
      'footer-contact-qq': 'QQ',
      'footer-contact-copy-number': '复制号码',
      'footer-contact-close': '关闭',
      'footer-contact-copied': '已复制',
      'footer-tetris-play': '开始游戏',
      'footer-tetris-close': '结束游戏',
      'footer-tetris-reduced-title': '已根据减少动态效果设置禁用动画',
      'footer-tetris-label': '可互动的像素天际线',
      'footer-tetris-score': '分数',
      'footer-tetris-move-left': '向左移动',
      'footer-tetris-move-right': '向右移动',
      'footer-tetris-rotate': '旋转',
      'footer-tetris-hard-drop': '快速落下',
      'footer-tetris-close-game': '关闭游戏',
      'footer-home': '返回资源档案首页',
    },
  };

  const documentTitles = {
    en: {
      '/index.html': 'Resource Archive',
      '/nodes.html': 'Nodes · Resource Archive',
      '/stages.html': 'Stages · Resource Archive',
      '/tutorials.html': 'Tutorials · Resource Archive',
      '/plugins.html': 'Plugins · Resource Archive',
      '/plugins/automation-flow.html': 'Automation Flow · Resource Archive',
      '/plugins/autocel.html': 'AutoCel · Resource Archive',
      '/contributors.html': 'Contributors · Resource Archive',
    },
    zh: {
      '/index.html': '资源档案',
      '/nodes.html': '节点 · 资源档案',
      '/stages.html': '场景 · 资源档案',
      '/tutorials.html': '教程 · 资源档案',
      '/plugins.html': '插件 · 资源档案',
      '/plugins/automation-flow.html': 'Automation Flow · 资源档案',
      '/plugins/autocel.html': 'AutoCel · 资源档案',
      '/contributors.html': '贡献者 · 资源档案',
    },
  };

  const savedLanguage = localStorage.getItem(storageKey);
  let language = savedLanguage === 'zh' ? 'zh' : 'en';
  const contentTablePaths = Object.freeze({
    'node-display-names': '/data/i18n/node-display-names.zh.json',
    'node-socket-labels': '/data/i18n/node-socket-labels.zh.json',
    'stage-copy': '/data/i18n/stage-copy.zh.json',
    'translation-allowlist': '/data/i18n/translation-allowlist.json',
  });
  const contentTablePromises = new Map();
  const contentTables = new Map();
  const contentTableFailures = new Map();

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function loadContentTable(name) {
    if (!Object.hasOwn(contentTablePaths, name)) return Promise.reject(new RangeError(`Unknown content table: ${name}`));
    if (contentTables.has(name)) return Promise.resolve(contentTables.get(name));
    if (contentTablePromises.has(name)) return contentTablePromises.get(name);
    if (contentTableFailures.has(name)) return Promise.reject(contentTableFailures.get(name));
    const pending = fetch(contentTablePaths[name]).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(value => {
      const frozen = deepFreeze(value);
      contentTables.set(name, frozen);
      return frozen;
    }).catch(error => {
      const failure = new Error(error?.message || `Content table failed: ${name}`);
      failure.name = 'ContentTableLoadError';
      failure.contentTable = name;
      failure.cause = error;
      contentTableFailures.set(name, failure);
      throw failure;
    });
    contentTablePromises.set(name, pending);
    pending.catch(() => {
      if (contentTablePromises.get(name) === pending) contentTablePromises.delete(name);
    });
    return pending;
  }

  function retryContentTable(name) {
    contentTableFailures.delete(name);
    return loadContentTable(name);
  }

  function contentTable(name) {
    return contentTables.get(name) || null;
  }

  function translate(key, parameters = {}) {
    const template = translations[language][key] ?? key;
    return Object.entries(parameters).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    );
  }

  function applyLanguage() {
    const copy = navigation[language];
    document.documentElement.lang = copy.lang;
    document.title = documentTitles[language][location.pathname] || documentTitles[language]['/index.html'];

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const translated = translations[language][element.dataset.i18n];
      if (translated !== undefined) element.textContent = translated;
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      const translated = translations[language][element.dataset.i18nAriaLabel];
      if (translated !== undefined) element.setAttribute('aria-label', translated);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const translated = translations[language][element.dataset.i18nPlaceholder];
      if (translated !== undefined) element.setAttribute('placeholder', translated);
    });

    const nav = document.querySelector('.primary-nav');
    if (nav) nav.setAttribute('aria-label', copy.label);

    const toggle = document.querySelector('[data-testid="language-toggle"]');
    if (toggle) {
      toggle.setAttribute('aria-label', copy.toggleLabel);
      toggle.setAttribute('title', copy.toggleLabel);
    }

    document.dispatchEvent(new CustomEvent('resource-archive-language-change', {
      detail: { language },
    }));
  }

  function prepareNavigationLabels() {
    document.querySelectorAll('.primary-nav a').forEach((link) => {
      if (link.querySelector(':scope > [data-i18n]')) return;
      const href = (link.getAttribute('href') || '').replace(/^\//, '');
      const target = href === 'index.html'
        ? 'home'
        : href.includes('#')
          ? href.split('#')[1]
          : href.replace(/\.html$/, '') || 'home';
      const label = document.createElement('span');
      label.dataset.i18n = `nav-${target === 'plugins-section' ? 'plugins' : target}`;
      label.textContent = link.textContent;
      link.replaceChildren(label);
    });
  }

  function createToggle() {
    const shell = document.querySelector('.nav-shell');
    if (!shell || shell.querySelector('[data-testid="language-toggle"]')) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'language-toggle';
    toggle.dataset.testid = 'language-toggle';
    const label = document.createElement('span');
    label.dataset.i18n = 'language-toggle';
    toggle.append(label);
    toggle.addEventListener('click', () => {
      language = language === 'en' ? 'zh' : 'en';
      localStorage.setItem(storageKey, language);
      applyLanguage();
    });
    shell.append(toggle);
  }

  function updateCurrentNavigation() {
    const pathSection = location.pathname.match(/^\/(nodes|stages|tutorials|contributors)\.html$/)?.[1]
      || (location.pathname.startsWith('/plugins/') ? 'plugins' : location.pathname.match(/^\/plugins\.html$/)?.[0] && 'plugins');
    const raw = location.hash.slice(1);
    const section = pathSection || (raw.startsWith('node-detail=') ? 'nodes'
      : raw.startsWith('stage-detail=') ? 'stages'
      : raw || 'home');
    document.querySelectorAll('.primary-nav a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const target = href.match(/^\/(nodes|stages|tutorials|plugins|contributors)\.html$/)?.[1]
        || href.replace(/^#/, '')
        || 'home';
      if (target === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  window.resourceArchiveI18n = {
    get language() { return language; },
    applyLanguage,
    translate,
    loadContentTable,
    retryContentTable,
    contentTable,
  };

  prepareNavigationLabels();
  createToggle();
  applyLanguage();
  updateCurrentNavigation();
  addEventListener('hashchange', updateCurrentNavigation);
  addEventListener('popstate', updateCurrentNavigation);
})();
