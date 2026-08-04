(() => {
  const CATALOG_URL = '/data/plugin-details/automation-flow-catalog.json';
  const AUTOMATION_FLOW_BRAND_SOURCE = 'data/plugins.json#/0/external_destinations/0/label/zh';
  const AUTOMATION_FLOW_PROVIDER_SOURCE = 'data/plugin-details/automation-flow.json#/identity/provider';
  const summaryMap = Object.freeze({
    AFNodeDelayWait: '让流程暂停指定秒数，并按设定间隔检查等待状态。',
    AFNodeEnd: '标记主流程的结束位置。',
    AFNodeFlowTrigger: '把触发信号转换为可继续传递的流程输入。',
    AFNodeFlowToggle: '在初始状态与当前状态之间切换流程。',
    AFNodeReloadAfterTask: '等待任务完成并重载状态后继续流程。',
    AFNodeRunBackgroundTaskPlan: '在后台执行任务计划，并返回可追踪的任务句柄。',
    AFNodeRunTaskPlan: '按任务计划执行步骤，并依据失败策略控制后续流程。',
    AFNodeStart: '作为自动化流程的起始入口。',
    AFNodeTaskStatusOverride: '用输入状态覆写当前任务的结果。',
    AFNodeWaitForTask: '等待指定任务句柄完成后继续。',
    AFNodeBranchEnd: '汇合并结束一条分流路径。',
    AFNodeBranchStart: '从当前流程拆出一条可独立执行的分流路径。',
    AFNodeRepeatEnd: '结束重复区段，并回到对应的重复起点。',
    AFNodeRepeatStart: '按指定数量开启一段重复流程。',
    AFNodeSubflowJoin: '把子流程结果重新并入外层流程。',
    AFNodeSubflowStart: '从当前位置启动一段可复用的子流程。',
    AFNodeBooleanEdge: '在布尔值出现上升沿或下降沿变化时输出状态。',
    AFNodeBooleanLatch: '保存布尔状态，并提供开始与重置控制。',
    AFNodeBooleanToggle: '在触发时翻转并保存布尔状态。',
    AFNodeFlowTriggerState: '读取当前流程触发器的运行状态。',
    AFNodeObjectInteractionState: '读取物体活动项与交互模式状态。',
    AFNodePlaybackState: '读取场景播放、开始与暂停状态。',
    AFNodeViewportShadingState: '读取当前三维视口的着色模式。',
    AFNodeExtractPropertyAssignments: '按当前属性上下文，从属性包中提取属性赋值。',
    AFNodeMergePropertyAssignments: '把多组属性赋值合并为一组结果。',
    AFNodeModifierPropertyData: '记录或输出修改器相关的属性数据。',
    AFNodeObjectDisplayPropertyData: '记录或输出物体显示相关的属性数据。',
    AFNodePropertyContext: '定义属性操作所使用的物体、场景与采样上下文。',
    AFNodePublishGeometryAttribute: '把上下文值发布为几何属性。',
    AFNodeReadGeometryAttribute: '从几何数据中读取指定属性。',
    AFNodeReduceContextValue: '按归约方式汇总上下文中的多个值。',
    AFNodeSampleContextData: '从当前属性上下文采样所需数据。',
    AFNodeSetGeometryAttribute: '把输入值写入指定几何属性。',
    AFNodeObjectTransformPropertyData: '记录或输出物体变换相关的属性数据。',
    AFNodeApplyObjectProperties: '把属性包中的记录应用到目标物体。',
    AFNodeApplyPropertyPackage: '把一个属性包应用到当前目标。',
    AFNodeCreatePropertyPackage: '把多条属性赋值整理为新的属性包。',
    AFNodeFilterPropertyPackage: '按条件保留属性包中的指定项目。',
    AFNodeMergePropertyPackages: '把多个属性包合并为一个结果。',
    AFNodeParsePropertyPackage: '解析属性包，并输出其中的结构化数据。',
    AFNodeReadPropertyPackage: '读取已经保存的属性包内容。',
    AFNodeRecordPropertyPackage: '记录当前属性包，供后续流程使用。',
    AFNodeRefreshPropertyPackage: '从源对象重新获取并刷新属性包。',
    AFNodeStorePropertyPackage: '把属性包持久保存到指定位置。',
    AFNodeRenderTask: '创建场景渲染任务，并输出任务引用。',
    AFNodeEvaluateTaskDependencies: '检查任务涉及物体之间的依赖关系。',
    AFNodeResolveTaskRef: '把任务引用解析为可供后续节点使用的任务对象。',
    AFNodeTaskOutput: '定义任务内部需要返回的输出。',
    AFNodeTaskStart: '标记任务流程的开始位置。',
    AFNodeTaskStep: '把一个操作登记为任务计划中的步骤。',
    AFNodeBakeTask: '为几何节点烘焙创建任务目标。',
    AFNodePhysicsBakeSettings: '集中设置物理烘焙的帧范围与缓存选项。',
    AFNodePhysicsBakeTask: '为物理模拟烘焙创建任务目标。',
    AFNodePropertyPackageBakeTarget: '把属性包记录设为可执行的烘焙目标。',
    AFNodeRenderTarget: '定义渲染任务的场景、输出与执行方式。',
    AFNodeAddToCollection: '把指定物体加入目标集合。',
    AFNodeCollectionExpand: '展开集合，并输出其中包含的物体。',
    AFNodeCollectionList: '把多个集合引用整理为集合列表。',
    AFNodeCreateCollection: '在指定层级创建新的集合。',
    AFNodeCreateObject: '按输入数据创建新的场景物体。',
    AFNodeDeleteObject: '从场景中删除指定物体。',
    AFNodeDuplicateObject: '复制指定物体，并输出新对象。',
    AFNodeObjectInfo: '读取物体本身及其基础信息。',
    AFNodeObjectList: '把多个物体引用整理为物体列表。',
    AFNodeSceneObjectList: '读取场景中的物体并生成列表。',
    AFNodeSetActiveCamera: '把指定摄像机设为场景的活动摄像机。',
    AFNodeGroup: '把一组节点封装为可复用的群组。',
    AFNodeIndexSwitch: '根据编号，从多路输入中选择一个值。',
    AFNodeMix: '按混合因子组合两路输入数据。',
    AFNodePreviewData: '在节点中预览输入数据，便于检查流程结果。',
    AFNodeRandomValue: '按数据类型和范围生成随机值。',
    AFNodeSwitch: '根据条件在两路输入之间切换。',
  });
  const chineseNameOverrides = Object.freeze({
    AFNodeBakeTask: '几何节点烘焙目标',
  });
  const interfaceChinese = Object.freeze({
    ' ': '未命名接口',
    0: '常量 0',
    A: '第一输入值',
    Active: '活动状态',
    'Add Collections': '添加集合',
    'Add Objects': '添加物体',
    'Add Property Assignment': '添加属性赋值',
    'Add Property Package': '添加属性包',
    Angle: '角度',
    Axis: '轴',
    B: '第二输入值',
    'Bake Objects': '烘焙物体',
    'Base Objects': '基础物体',
    'Base Property Assignment': '基础属性赋值',
    'Base Property Package': '基础属性包',
    Boolean: '布尔值',
    'Branch Flow': '分支流程',
    'Carrier Object': '载体物体',
    'Collection List': '集合列表',
    'Column 1 Row 1': '第 1 列第 1 行',
    'Column 1 Row 2': '第 1 列第 2 行',
    'Column 1 Row 3': '第 1 列第 3 行',
    'Column 1 Row 4': '第 1 列第 4 行',
    'Column 2 Row 1': '第 2 列第 1 行',
    'Column 2 Row 2': '第 2 列第 2 行',
    'Column 2 Row 3': '第 2 列第 3 行',
    'Column 2 Row 4': '第 2 列第 4 行',
    'Column 3 Row 1': '第 3 列第 1 行',
    'Column 3 Row 2': '第 3 列第 2 行',
    'Column 3 Row 3': '第 3 列第 3 行',
    'Column 3 Row 4': '第 3 列第 4 行',
    'Column 4 Row 1': '第 4 列第 1 行',
    'Column 4 Row 2': '第 4 列第 2 行',
    'Column 4 Row 3': '第 4 列第 3 行',
    'Column 4 Row 4': '第 4 列第 4 行',
    'Component Count': '组件数量',
    'Component Index': '组件索引',
    Context: '上下文',
    Count: '数量',
    Determinant: '行列式',
    Direction: '方向',
    'Display Type': '显示类型',
    Edge0: '边界 0',
    Edge1: '边界 1',
    'Element Index': '元素索引',
    Epsilon: '容差',
    Euler: '欧拉角',
    Factor: '系数',
    False: '假',
    'Flow In': '流程输入',
    'Flow Out': '流程输出',
    Frame: '帧',
    'Frame End': '结束帧',
    'Frame Start': '起始帧',
    'From Max': '源最大值',
    'From Min': '源最小值',
    'Hide Render': '渲染时隐藏',
    'Hide Viewport': '视口中隐藏',
    Index: '索引',
    Invertible: '可逆',
    'Is Modifier': '是否为修改器',
    Location: '位置',
    Manual: '手动',
    Matrix: '矩阵',
    'Matrix A': '第一矩阵',
    'Matrix B': '第二矩阵',
    Max: '最大值',
    Min: '最小值',
    Mode: '模式',
    Name: '名称',
    Object: '物体',
    'Object Count': '物体数量',
    'Object Index': '物体索引',
    'Object List': '物体列表',
    'On False': '为假时',
    'On Pause': '暂停时',
    'On Play': '播放时',
    'On Scene Update End': '场景更新结束时',
    'On Scene Update Start': '场景更新开始时',
    'On True': '为真时',
    Output: '输出',
    'Parent Collections': '父集合',
    'Physics Bake Settings': '物理烘焙设置',
    Playing: '正在播放',
    Point: '点',
    Preview: '预览',
    'Primary Axis': '主轴',
    'Property Assignment': '属性赋值',
    'Property Assignment 1': '属性赋值 1',
    'Property Definition': '属性定义',
    'Property Package': '属性包',
    'Remove Collections': '移除集合',
    'Remove Objects': '移除物体',
    'Render Objects': '渲染物体',
    Report: '报告',
    Reset: '重置',
    Result: '结果',
    'Rotate By': '旋转依据',
    Rotation: '旋转',
    'Rotation Mode': '旋转模式',
    Scale: '缩放',
    'Scene Updating': '场景正在更新',
    'Secondary Axis': '次轴',
    Seconds: '秒',
    Seed: '种子',
    Set: '设置',
    'Settings 1': '设置 1',
    Shading: '着色方式',
    'Show Axis': '显示轴线',
    'Show In Edit Mode': '编辑模式中显示',
    'Show In Front': '显示在前',
    'Show Name': '显示名称',
    'Show Render': '渲染时显示',
    'Show Viewport': '视口中显示',
    State: '状态',
    Status: '状态',
    String: '字符串',
    Subflow: '子流程',
    Switch: '切换',
    'Task Handle': '任务句柄',
    'Task Objects': '任务物体',
    'Task Plan': '任务计划',
    'Task Plan 1': '任务计划 1',
    'Task Ref': '任务引用',
    'To Max': '目标最大值',
    'To Min': '目标最小值',
    Translation: '平移',
    Trigger: '触发',
    Triggered: '已触发',
    True: '真',
    Value: '值',
    Vector: '矢量',
    W: '标量分量',
    X: '横向分量',
    Y: '纵向分量',
    Z: '纵深分量',
  });
  let preparedCatalog = null;
  let retainedSourceValues = new Map();
  let allowlistReady = null;

  function languageFor(language) {
    return language || window.resourceArchiveI18n?.language || 'en';
  }

  function element(tag, { className = '', dataset, textContent, attributes } = {}, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (dataset) Object.assign(node.dataset, dataset);
    if (textContent !== undefined) node.textContent = textContent;
    if (attributes) Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    node.append(...children.filter(Boolean));
    return node;
  }

  function withProvenance(node) {
    return node;
  }

  function catalogProvenance(detail) {
    return detail.assets?.closeups?.find(asset =>
      asset.source_kind === 'isolated_gui_capture' && asset.source_ref === 'gui_capture');
  }

  function sourcePointer(kind, index, field, itemIndex = null) {
    const suffix = itemIndex === null ? field : `${field}/${itemIndex}`;
    return `data/plugin-details/automation-flow-catalog.json#/${kind}/${index}/${suffix}`;
  }

  function interfaceDisplay(value, language, pointer) {
    const original = String(value || '').trim();
    if (languageFor(language) !== 'zh') return original || '—';
    const translated = interfaceChinese[value] || interfaceChinese[original] || '未命名接口';
    return original && canRetainSourceText(original, pointer)
      ? `${translated}（${original}）`
      : translated;
  }

  function canRetainSourceText(value, pointer) {
    const permitted = retainedSourceValues.get(pointer);
    const runs = String(value || '').match(/[A-Za-z][A-Za-z0-9_./+!'’-]*(?:\s+[A-Za-z][A-Za-z0-9_./+!'’-]*)*/g) || [];
    return runs.length > 0 && runs.every(run => permitted?.has(run));
  }

  function prepareAllowlist() {
    if (window.resourceArchiveI18n.contentTable('translation-allowlist')) {
      const table = window.resourceArchiveI18n.contentTable('translation-allowlist');
      retainedSourceValues = new Map();
      for (const entry of table.entries || []) {
        if (!retainedSourceValues.has(entry.source)) retainedSourceValues.set(entry.source, new Set());
        retainedSourceValues.get(entry.source).add(entry.value);
      }
      return Promise.resolve(table);
    }
    if (allowlistReady) return allowlistReady;
    const pending = window.resourceArchiveI18n.loadContentTable('translation-allowlist').then(table => {
      retainedSourceValues = new Map();
      for (const entry of table.entries || []) {
        if (!retainedSourceValues.has(entry.source)) retainedSourceValues.set(entry.source, new Set());
        retainedSourceValues.get(entry.source).add(entry.value);
      }
      return table;
    }).catch(error => {
      if (allowlistReady === pending) allowlistReady = null;
      throw error;
    });
    allowlistReady = pending;
    return pending;
  }

  const englishName = node => node.runtime_english || node.official_english;
  const chineseName = node =>
    chineseNameOverrides[node.bl_idname] || node.runtime_chinese || node.official_chinese;
  const groupId = group => `automation-flow-group-${group.key}`;
  const catalogUrl = () => '/plugins.html?plugin=automation-flow';
  const menuPathLabel = (value, language) => {
    if (languageFor(language) !== 'zh') return value;
    return {
      'Automation Flow': '自动化流程',
      'Collection & Object': '集合与物体',
      'Context & Data': '上下文与数据',
      Flow: '流程',
      Inputs: '输入',
      Math: '数学',
      Matrix: '矩阵',
      Process: '处理',
      'Prop Pack Ops': '属性包操作',
      Property: '属性',
      Rotation: '旋转',
      Scene: '场景',
      'Scene Actions': '场景操作',
      Structures: '结构',
      Task: '任务',
      'Task Building': '任务构建',
      'Task Targets': '任务目标',
      Trigger: '触发器',
      Utilities: '工具',
      Vector: '矢量',
    }[value] || value;
  };

  function nodeUrl(id) {
    const url = new URL(catalogUrl(), window.location.origin);
    url.searchParams.set('node', id);
    return `${url.pathname}${url.search}`;
  }

  function sourceLanguage(node, value, language) {
    if (languageFor(language) === 'en' && /[\u3400-\u9fff]/.test(value || '')) node.lang = 'zh-CN';
    return node;
  }

  function summaryFor(node) {
    if (summaryMap[node.bl_idname]) return summaryMap[node.bl_idname];
    const name = chineseName(node);
    if (node.group === 'inputs') return `提供${name}类型的输入值，供其它节点连接使用。`;
    if (node.group === 'math_utilities_vector') return `对输入数据执行${name}处理，并输出对应结果。`;
    if (node.group === 'rotation') return `在旋转数据之间执行${name}转换或组合。`;
    if (node.group === 'matrix') return `对矩阵或变换数据执行${name}处理。`;
    return `用于处理${name}相关的数据与流程。`;
  }

  function assert(value, message) {
    if (!value) throw new Error(`Invalid Automation Flow catalog: ${message}`);
  }

  function validateCatalog(value) {
    assert(value && typeof value === 'object', 'root');
    assert(Number.isInteger(value.total_nodes) && value.total_nodes >= 0, 'total_nodes');
    assert(Array.isArray(value.groups) && value.groups.length > 0, 'groups');
    assert(value.groups.every(group => typeof group?.key === 'string' && group.key
      && Number.isInteger(group.count) && group.count >= 0), 'groups');
    assert(new Set(value.groups.map(group => group.key)).size === value.groups.length, 'group keys');
    assert(Array.isArray(value.nodes) && value.nodes.length === value.total_nodes, 'nodes');
    const ids = new Set();
    const counts = new Map();
    value.nodes.forEach((node, index) => {
      assert(node?.order === index + 1, `node order ${index + 1}`);
      assert(typeof node.bl_idname === 'string' && /^AFNode[A-Za-z0-9]+$/.test(node.bl_idname) && !ids.has(node.bl_idname), 'bl_idname');
      ids.add(node.bl_idname);
      assert(typeof node.official_english === 'string' && node.official_english.trim(), `${node.bl_idname} English name`);
      assert(typeof node.official_chinese === 'string' && node.official_chinese.trim(), `${node.bl_idname} Chinese name`);
      assert(Array.isArray(node.inputs) && Array.isArray(node.outputs), `${node.bl_idname} sockets`);
      assert(Array.isArray(node.menu_paths) && node.menu_paths.every(menu => Array.isArray(menu)
        && menu.every(item => typeof item === 'string' && item.trim())), `${node.bl_idname} menu paths`);
      assert(typeof node.image === 'string' && /^\/assets\/plugins\/automation-flow\/nodes\/[^/]+\.png$/.test(node.image), `${node.bl_idname} image`);
      counts.set(node.group, (counts.get(node.group) || 0) + 1);
    });
    assert(value.groups.every(group => counts.get(group.key) === group.count), 'node group counts');
    assert([...counts.keys()].every(key => value.groups.some(group => group.key === key)), 'node groups');
    return value;
  }

  function heading(detail, catalog, language) {
    const header = withProvenance(
      element('header', { className: 'automation-flow-header', dataset: { automationFlowHeader: '' } }),
      detail.identity,
    );
    const eyebrow = element('p', {
      className: 'eyebrow',
      dataset: { sourcePointer: AUTOMATION_FLOW_BRAND_SOURCE },
      textContent: languageFor(language) === 'zh' ? 'Automation Flow / 节点档案' : 'AUTOMATION FLOW / NODE ARCHIVE',
    });
    const title = element('h1', {
      dataset: { transitionPluginTitle: 'automation-flow', sourcePointer: AUTOMATION_FLOW_BRAND_SOURCE },
    });
    title.append(
      document.createTextNode('Automation Flow / '),
      element('span', { dataset: { automationFlowArchiveLabel: '' }, textContent: '节点档案' }),
    );
    title.style.setProperty('view-transition-name', 'plugin-title-automation-flow');
    sourceLanguage(title, title.textContent, language);
    const lede = element('p', {
      className: 'automation-flow-lede',
      dataset: { sourcePointer: AUTOMATION_FLOW_BRAND_SOURCE },
      textContent: languageFor(language) === 'zh'
        ? '按已确认分组编排的 Automation Flow 节点档案；每张原始节点图都保留完整纵向比例。'
        : 'The approved Automation Flow node archive, grouped for navigation while keeping every original node image intact.',
    });
    const provider = element('p', { className: 'automation-flow-provider' }, document.createTextNode(languageFor(language) === 'zh' ? '提供者：' : 'Provider: '));
    provider.append(sourceLanguage(element('span', {
      dataset: { pluginProvider: '', sourcePointer: AUTOMATION_FLOW_PROVIDER_SOURCE },
      textContent: detail.identity.provider,
    }), detail.identity.provider, language));
    const stats = element('dl', { className: 'automation-flow-stats', attributes: { 'aria-label': languageFor(language) === 'zh' ? '目录统计' : 'Catalog statistics' } });
    const imageCount = catalog.nodes.filter(node => node.image).length;
    const records = languageFor(language) === 'zh'
      ? [['节点', String(catalog.total_nodes)], ['分类', String(catalog.groups.length).padStart(2, '0')], ['图像', String(imageCount)]]
      : [['Nodes', String(catalog.total_nodes)], ['Groups', String(catalog.groups.length).padStart(2, '0')], ['Images', String(imageCount)]];
    records.forEach(([label, value]) => {
      const item = element('div');
      item.append(element('dt', { textContent: label }), element('dd', { dataset: { automationFlowStat: '' }, textContent: value }));
      stats.append(item);
    });
    header.append(eyebrow, title, lede, provider, stats);
    return header;
  }

  function categoryAnchor(group, kind, language, groupIndex, provenance) {
    const englishPointer = sourcePointer('groups', groupIndex, 'official_english');
    const showEnglish = languageFor(language) !== 'zh'
      || canRetainSourceText(group.official_english, englishPointer);
    const link = withProvenance(element('a', {
      className: `automation-flow-${kind}-category`,
      dataset: kind === 'overview'
        ? { automationFlowOverviewCategory: group.key, automationFlowCategoryAnchor: group.key }
        : { automationFlowAxisCategory: group.key, automationFlowCategoryAnchor: group.key },
      attributes: { href: `#${groupId(group)}` },
    }), provenance);
    if (kind === 'overview') {
      link.append(
        element('span', {
          className: 'automation-flow-category-name',
          dataset: { sourcePointer: englishPointer },
          textContent: showEnglish ? group.official_english : '',
          attributes: showEnglish ? undefined : { hidden: '' },
        }),
        sourceLanguage(element('span', { className: 'automation-flow-category-zh', textContent: group.official_chinese }), group.official_chinese, language),
        element('span', { className: 'automation-flow-category-count', textContent: `${String(group.count).padStart(2, '0')} ${languageFor(language) === 'zh' ? '个节点' : 'nodes'}` }),
      );
    } else {
      if (languageFor(language) === 'zh') {
        link.append(
          sourceLanguage(element('span', { textContent: group.official_chinese }), group.official_chinese, language),
          element('span', {
            dataset: { sourcePointer: englishPointer },
            textContent: showEnglish ? group.official_english : '',
            attributes: showEnglish ? undefined : { hidden: '' },
          }),
          element('span', { textContent: String(group.count).padStart(2, '0') }),
        );
      } else {
        link.append(
          element('span', { textContent: group.official_english }),
          element('span', { textContent: String(group.count).padStart(2, '0') }),
        );
      }
    }
    return link;
  }

  function nodeCard(node, language, provenance) {
    const nodeIndex = node.order - 1;
    const officialPointer = sourcePointer('nodes', nodeIndex, 'official_english');
    const runtimePointer = sourcePointer('nodes', nodeIndex, 'runtime_english');
    const chinese = languageFor(language) === 'zh';
    const retainedPointer = canRetainSourceText(englishName(node), runtimePointer)
      ? runtimePointer
      : canRetainSourceText(node.official_english, officialPointer) ? officialPointer : null;
    const visibleEnglish = chinese
      ? retainedPointer ? (retainedPointer === runtimePointer ? englishName(node) : node.official_english) : ''
      : englishName(node);
    const visibleEnglishPointer = chinese ? retainedPointer : runtimePointer;
    const card = withProvenance(element('a', {
      className: 'automation-flow-node-card',
      dataset: { automationFlowNodeTrigger: node.bl_idname, automationFlowNodeGroup: node.group },
      attributes: {
        href: nodeUrl(node.bl_idname),
        'aria-label': languageFor(language) === 'zh' ? `查看 ${chineseName(node)} 节点详情` : `View ${englishName(node)} node detail`,
      },
    }), provenance);
    const figure = element('figure', { className: 'automation-flow-node-art' });
    const image = element('img', {
      dataset: { automationFlowNodeImage: '' },
      attributes: { src: node.image, alt: `${englishName(node)}（${chineseName(node)}）节点图`, loading: 'lazy', decoding: 'async' },
    });
    figure.append(image);
    const copy = element('div', { className: 'automation-flow-node-copy' });
    copy.append(
      element('p', { className: 'automation-flow-node-number', dataset: { automationFlowNodeNumber: '' }, textContent: languageFor(language) === 'zh' ? `记录 ${String(node.order).padStart(3, '0')}` : `RECORD ${String(node.order).padStart(3, '0')}` }),
      element('strong', {
        className: 'automation-flow-node-name-en',
        dataset: { automationFlowNodeNameEn: '', sourcePointer: visibleEnglishPointer || officialPointer },
        textContent: visibleEnglish,
        attributes: visibleEnglish ? undefined : { hidden: '' },
      }),
      sourceLanguage(element('span', { className: 'automation-flow-node-name-zh', dataset: { automationFlowNodeNameZh: '' }, textContent: chineseName(node) }), chineseName(node), language),
      sourceLanguage(element('p', { className: 'automation-flow-node-summary', dataset: { automationFlowNodeSummary: '' }, textContent: summaryFor(node) }), summaryFor(node), language),
      element('code', {
        className: 'automation-flow-node-id',
        dataset: {
          automationFlowNodeId: '',
          sourcePointer: sourcePointer('nodes', nodeIndex, 'bl_idname'),
        },
        textContent: node.bl_idname,
      }),
    );
    card.append(figure, copy);
    return card;
  }

  function catalogView(detail, catalog, language) {
    const provenance = catalogProvenance(detail);
    const article = withProvenance(
      element('article', { className: 'plugin-detail plugin-detail-automation-flow', dataset: { automationFlowRoot: '' } }),
      provenance,
    );
    article.append(heading(detail, catalog, language));
    const overview = element('section', {
      className: 'automation-flow-overview',
      attributes: { 'aria-labelledby': 'automation-flow-overview-heading' },
    });
    const overviewHeading = element('div', { className: 'automation-flow-overview-heading' });
    const title = element('h2', { textContent: languageFor(language) === 'zh' ? `${catalog.groups.length} 个分类` : `${catalog.groups.length} categories` });
    title.id = 'automation-flow-overview-heading';
    overviewHeading.append(title, element('p', {
      textContent: languageFor(language) === 'zh'
        ? '从分类概览进入相应节点区；目录中的所有节点图均来自已批准的原始图像。'
        : 'Jump into a category from the overview; every catalog image is an approved original PNG.',
    }));
    const grid = element('div', { className: 'automation-flow-overview-grid' });
    catalog.groups.forEach((group, index) => grid.append(categoryAnchor(group, 'overview', language, index, provenance)));
    overview.append(overviewHeading, grid);
    const catalogLayout = element('section', { className: 'automation-flow-catalog', attributes: { 'aria-labelledby': 'automation-flow-catalog-heading' } });
    const rail = element('aside', { className: 'automation-flow-axis', attributes: { 'aria-label': languageFor(language) === 'zh' ? '分类轴线' : 'Category axis' } });
    const railTitle = element('h2', { textContent: languageFor(language) === 'zh' ? '节点目录' : 'Node catalog' });
    railTitle.id = 'automation-flow-catalog-heading';
    const axis = element('nav', { className: 'automation-flow-axis-index', attributes: { 'aria-label': languageFor(language) === 'zh' ? '节点分类' : 'Node categories' } });
    catalog.groups.forEach((group, index) => axis.append(categoryAnchor(group, 'axis', language, index, provenance)));
    rail.append(railTitle, axis, element('p', {
      className: 'automation-flow-axis-note',
      textContent: languageFor(language) === 'zh' ? `${catalog.total_nodes} 项已归档节点记录` : `${catalog.total_nodes} archived node records`,
    }));
    const sections = element('div', { className: 'automation-flow-groups' });
    catalog.groups.forEach((group, groupIndex) => {
      const section = withProvenance(element('section', {
        className: 'automation-flow-group',
        dataset: { automationFlowGroup: group.key },
        attributes: { id: groupId(group), 'aria-labelledby': `${groupId(group)}-heading` },
      }), provenance);
      const sectionHeader = element('header', { className: 'automation-flow-group-header' });
      const groupEnglishPointer = sourcePointer('groups', groupIndex, 'official_english');
      const showGroupEnglish = languageFor(language) !== 'zh'
        || canRetainSourceText(group.official_english, groupEnglishPointer);
      const groupTitle = element('h3');
      groupTitle.id = `${groupId(group)}-heading`;
      if (showGroupEnglish) {
        groupTitle.append(element('span', {
          dataset: { sourcePointer: groupEnglishPointer },
          textContent: group.official_english,
        }), document.createTextNode(' / '));
      }
      groupTitle.append(sourceLanguage(element('span', { textContent: group.official_chinese }), group.official_chinese, language));
      sectionHeader.append(groupTitle, element('p', { textContent: `${String(group.count).padStart(2, '0')} ${languageFor(language) === 'zh' ? '个节点' : 'nodes'}` }));
      const nodeGrid = element('div', { className: 'automation-flow-node-grid', dataset: { automationFlowNodeGrid: group.key } });
      catalog.nodes.filter(node => node.group === group.key).forEach(node => nodeGrid.append(nodeCard(node, language, provenance)));
      section.append(sectionHeader, nodeGrid);
      sections.append(section);
    });
    catalogLayout.append(rail, sections);
    article.append(overview, catalogLayout);
    return article;
  }

  function definition(label, value, data) {
    const record = element('div');
    const definitionValue = element('dd', { dataset: data });
    if (value instanceof Node) definitionValue.append(value);
    else definitionValue.textContent = value;
    record.append(element('dt', { textContent: label }), definitionValue);
    return record;
  }

  function interfaceValues(node, kind, language, provenance) {
    const values = node[kind] || [];
    if (!values.length) return document.createTextNode('—');
    const fragment = document.createDocumentFragment();
    values.forEach((value, index) => {
      if (index) fragment.append(document.createTextNode(' · '));
      const pointer = sourcePointer('nodes', node.order - 1, kind, index);
      fragment.append(withProvenance(element('span', {
        dataset: {
          automationFlowInterfaceSource: `${kind}:${index}`,
          sourcePointer: pointer,
        },
        textContent: interfaceDisplay(value, language, pointer),
      }), provenance));
    });
    return fragment;
  }

  function nodeDetail(detail, catalog, node, language) {
    const group = catalog.groups.find(item => item.key === node.group);
    const groupIndex = catalog.groups.indexOf(group);
    const provenance = catalogProvenance(detail);
    const nodeIndex = node.order - 1;
    const related = catalog.nodes.filter(candidate => candidate.group === node.group && candidate.bl_idname !== node.bl_idname).slice(0, 3);
    const article = withProvenance(
      element('article', { className: 'plugin-detail plugin-detail-automation-flow automation-flow-node-detail', dataset: { automationFlowNodeDetail: '' } }),
      provenance,
    );
    const back = element('a', {
      className: 'automation-flow-node-back',
      dataset: { automationFlowNodeBack: '', internalViewHistoryBack: '', internalViewFallbackReplace: '' },
      textContent: languageFor(language) === 'zh' ? '← 返回节点目录' : '← Back to node catalog',
      attributes: { href: catalogUrl() },
    });
    const header = element('header', { className: 'automation-flow-detail-header' });
    const eyebrow = element('p', { className: 'eyebrow', textContent: languageFor(language) === 'zh' ? '节点档案' : 'NODE RECORD / 节点档案' });
    const runtimePointer = sourcePointer('nodes', nodeIndex, 'runtime_english');
    const officialPointer = sourcePointer('nodes', nodeIndex, 'official_english');
    const retainedPointer = canRetainSourceText(englishName(node), runtimePointer)
      ? runtimePointer
      : canRetainSourceText(node.official_english, officialPointer) ? officialPointer : null;
    const titleEnglish = languageFor(language) === 'zh'
      ? retainedPointer ? (retainedPointer === runtimePointer ? englishName(node) : node.official_english) : ''
      : englishName(node);
    const title = element('h1', { dataset: { transitionPluginTitle: 'automation-flow' } });
    title.style.setProperty('view-transition-name', 'plugin-title-automation-flow');
    if (titleEnglish) {
      title.append(element('span', {
        dataset: { sourcePointer: languageFor(language) === 'zh' ? retainedPointer : runtimePointer },
        textContent: titleEnglish,
      }), document.createTextNode(' / '));
    }
    title.append(sourceLanguage(element('span', { textContent: chineseName(node) }), chineseName(node), language));
    header.append(eyebrow, title, element('code', {
      className: 'automation-flow-detail-id',
      dataset: { sourcePointer: sourcePointer('nodes', nodeIndex, 'bl_idname') },
      textContent: node.bl_idname,
    }));
    const body = element('div', { className: 'automation-flow-detail-layout' });
    const figure = withProvenance(element('figure', { className: 'automation-flow-detail-image' }), provenance);
    figure.append(element('img', {
      dataset: { automationFlowDetailImage: '' },
      attributes: { src: node.image, alt: `${englishName(node)}（${chineseName(node)}）节点图`, decoding: 'async' },
    }));
    const copy = element('div', { className: 'automation-flow-detail-copy' });
    copy.append(element('h2', { textContent: languageFor(language) === 'zh' ? '功能概述' : 'Summary' }));
    copy.append(sourceLanguage(element('p', { dataset: { automationFlowDetailSummary: '' }, textContent: summaryFor(node) }), summaryFor(node), language));
    const relatedLinks = element('span');
    if (related.length) related.forEach((candidate, index) => {
      if (index) relatedLinks.append(document.createTextNode(' · '));
      relatedLinks.append(element('a', {
        dataset: { automationFlowRelatedNode: candidate.bl_idname },
        textContent: chineseName(candidate),
        attributes: { href: nodeUrl(candidate.bl_idname) },
      }));
    });
    else relatedLinks.textContent = languageFor(language) === 'zh' ? '无' : 'None';
    const schema = element('dl', { className: 'automation-flow-detail-schema' });
    const groupEnglishPointer = sourcePointer('groups', groupIndex, 'official_english');
    const categoryValue = languageFor(language) === 'zh'
      ? canRetainSourceText(group.official_english, groupEnglishPointer)
        ? `${group.official_chinese}（${group.official_english}）`
        : group.official_chinese
      : group.official_english;
    const category = element('span', {
      dataset: { sourcePointer: groupEnglishPointer },
      textContent: categoryValue,
    });
    schema.append(
      definition(languageFor(language) === 'zh' ? '输入接口' : 'Inputs', interfaceValues(node, 'inputs', language, provenance), { automationFlowDetailInputs: '' }),
      definition(languageFor(language) === 'zh' ? '输出接口' : 'Outputs', interfaceValues(node, 'outputs', language, provenance), { automationFlowDetailOutputs: '' }),
      definition(languageFor(language) === 'zh' ? '节点分类' : 'Category', category, { automationFlowDetailCategory: '' }),
    );
    const relatedRecord = element('div');
    relatedRecord.append(element('dt', { textContent: languageFor(language) === 'zh' ? '相关节点' : 'Related nodes' }), element('dd', { dataset: { automationFlowDetailRelated: '' } }, relatedLinks));
    const menuPath = node.menu_paths.length
      ? node.menu_paths[0].map(value => menuPathLabel(value, language)).join(' / ')
      : (languageFor(language) === 'zh' ? '未记录' : 'Not recorded');
    schema.append(relatedRecord, definition(languageFor(language) === 'zh' ? '菜单路径' : 'Menu path', menuPath, { automationFlowDetailMenuPath: '' }));
    copy.append(schema);
    body.append(figure, copy);
    article.append(back, header, body);
    return article;
  }

  function render(detail, { language, route } = {}) {
    const catalog = preparedCatalog;
    if (!catalog) throw new Error('Automation Flow catalog has not been prepared');
    const node = route?.nodeId && catalog.nodes.find(item => item.bl_idname === route.nodeId);
    return node ? nodeDetail(detail, catalog, node, language) : catalogView(detail, catalog, language);
  }

  function setActiveCategory(root, key) {
    root.querySelectorAll('[data-automation-flow-category-anchor]').forEach(anchor => {
      anchor.toggleAttribute('aria-current', anchor.dataset.automationFlowCategoryAnchor === key);
    });
  }

  function failedImageFallback(image) {
    const chinese = languageFor() === 'zh';
    const label = image.alt || (chinese ? 'Automation Flow 节点图' : 'Automation Flow node image');
    return element('div', {
      className: 'automation-flow-image-fallback',
      dataset: { automationFlowImageFallback: '' },
      textContent: chinese ? '图像暂时无法加载' : 'Image unavailable',
      attributes: { role: 'img', 'aria-label': label },
    });
  }

  function hydrate(root) {
    let observer = null;
    const click = event => {
      const target = event.target instanceof Element ? event.target : null;
      const category = target?.closest('[data-automation-flow-category-anchor]');
      if (category && root.contains(category)) {
        setActiveCategory(root, category.dataset.automationFlowCategoryAnchor);
        if (!event.defaultPrevented && event.button === 0
          && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          const destination = new URL(category.href, window.location.href);
          const current = new URL(window.location.href);
          const section = document.getElementById(destination.hash.slice(1));
          if (destination.origin === current.origin
            && destination.pathname === current.pathname
            && destination.search === current.search
            && destination.hash && section && root.contains(section)) {
            event.preventDefault();
            history.replaceState(history.state, '', destination);
            section.scrollIntoView();
          }
        }
        return;
      }
      const node = target?.closest('[data-automation-flow-node-trigger]');
      if (node && root.contains(node)) {
        root.dataset.automationFlowLastTrigger = node.dataset.automationFlowNodeTrigger;
        return;
      }
      const back = target?.closest('[data-automation-flow-node-back]');
      if (back && root.contains(back)) {
        root.dataset.automationFlowLastBack = '';
        return;
      }
      const related = target?.closest('[data-automation-flow-related-node]');
      if (related && root.contains(related)) root.dataset.automationFlowLastRelated = related.dataset.automationFlowRelatedNode;
    };
    const replaceFailedImage = image => {
      if (!root.contains(image)
        || !image.matches('[data-automation-flow-node-image], [data-automation-flow-detail-image]')) return;
      image.replaceWith(failedImageFallback(image));
    };
    const error = event => {
      const image = event.target instanceof HTMLImageElement ? event.target : null;
      if (image) replaceFailedImage(image);
    };
    root.addEventListener('click', click, true);
    root.addEventListener('error', error, true);
    root.querySelectorAll('[data-automation-flow-node-image], [data-automation-flow-detail-image]').forEach(image => {
      if (image.complete && image.naturalWidth === 0) replaceFailedImage(image);
    });
    const sections = [...root.querySelectorAll('[data-automation-flow-group]')];
    if (sections.length && typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(entries => {
        const current = entries.filter(entry => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (current) setActiveCategory(root, current.target.dataset.automationFlowGroup);
      }, { rootMargin: '-22% 0px -68% 0px', threshold: 0 });
      sections.forEach(section => observer.observe(section));
    } else if (sections[0]) setActiveCategory(root, sections[0].dataset.automationFlowGroup);
    return () => {
      observer?.disconnect();
      root.removeEventListener('click', click, true);
      root.removeEventListener('error', error, true);
    };
  }

  function prepareCriticalAssets(detail, { loadJson, decodeImage, viewportWidth }) {
    if (detail?.id !== 'automation-flow') return Promise.reject(new Error('Invalid Automation Flow detail'));
    const catalogReady = loadJson(CATALOG_URL, validateCatalog).then(catalog => {
      preparedCatalog = catalog;
      const count = viewportWidth > 760 ? 4 : 2;
      return Promise.all(catalog.nodes.slice(0, count).map(node => decodeImage(node.image))).then(() => undefined);
    });
    const tableReady = prepareAllowlist();
    if (languageFor() === 'zh') return Promise.all([catalogReady, tableReady]).then(() => undefined);
    void tableReady.catch(() => undefined);
    return catalogReady;
  }

  function prepareLanguage(language) {
    return languageFor(language) === 'zh' ? prepareAllowlist() : Promise.resolve();
  }

  window.ResourceArchivePluginDetail.registerRenderer('automation-flow', {
    render,
    hydrate,
    prepareCriticalAssets,
    prepareLanguage,
  });
})();
