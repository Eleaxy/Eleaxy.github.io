((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResourceArchiveNodeTaxonomy = api;
})(typeof globalThis === 'object' ? globalThis : window, () => {
  const CATEGORY_LABELS = Object.freeze({
    cat_1783389786751: ['Utility', '工具'],
    mesh: ['Mesh', '网格'],
    math: ['Math', '数学'],
    generation: ['Generation', '生成'],
    curve: ['Curve', '曲线'],
    shader_shape: ['Shape', '形状'],
    shader: ['Shader', '着色器'],
    shader_tiling_textures: ['Tiling Textures', '平铺纹理'],
    shader_utility: ['Utility', '工具'],
    shader_fractal: ['Fractal', '分形'],
    shader_texture: ['Texture', '纹理'],
    shader_image: ['Image', '图像'],
    shader_tiling_tools: ['Tiling Tools', '平铺工具'],
    comp_palette: ['Palette', '调色板'],
    comp_effect: ['Effect', '特效'],
    comp_utilities: ['Utilities', '工具'],
    comp: ['Compositor', '合成器'],
    rigging: ['Rigging System', '绑定系统'],
    particle: ['Particle System', '粒子系统'],
    pcg: ['PCG', '程序化内容生成'],
    stylized_2d: ['Stylized NPR', '风格化 NPR'],
    effect: ['Effect', '效果'],
    mfs: ['Material Functions', '材质函数'],
    mfs_functions: ['Functions', '函数'],
    mfs_cmath: ['Complex Math', '复数数学'],
    mfs_coordinates: ['Coordinates', '坐标'],
    mfs_parallax: ['Parallax', '视差'],
    particle_force: ['Force', '力场'],
    particle_system_core: ['Particle System', '粒子系统'],
    particle_info: ['Info', '信息'],
    particle_mask: ['Mask', '遮罩'],
    effect_flipbook: ['Flipbook', '翻页效果'],
    shader_tiling: ['Tiling', '平铺'],
  });

  const SYSTEMS = Object.freeze([
    {
      slug: 'geometry',
      labels: ['Geometry Nodes', '几何节点'],
      categories: ['generation', 'mesh', 'curve', 'math', 'cat_1783389786751'],
      subcategories: [
        { id: 'generation', labels: ['Generation', '生成'] },
        { id: 'mesh', labels: ['Mesh', '网格'] },
        { id: 'curve', labels: ['Curve', '曲线'] },
        { id: 'math', labels: ['Math', '数学'] },
        { id: 'cat_1783389786751', labels: ['Utility', '工具'] },
      ],
    },
    {
      slug: 'shader',
      labels: ['Shader', '着色器'],
      categories: ['shader', 'shader_fractal', 'shader_image', 'shader_shape', 'shader_texture', 'shader_utility', 'shader_tiling_tools', 'shader_tiling_textures'],
      subcategories: [
        { id: 'shader_fractal', labels: ['Fractal', '分形'] },
        { id: 'shader_image', labels: ['Image', '图像'] },
        { id: 'shader_shape', labels: ['Shape', '形状'] },
        { id: 'shader_texture', labels: ['Texture', '纹理'] },
        { id: 'shader_utility', labels: ['Utility', '工具'] },
        {
          id: 'shader_tiling',
          labels: ['Tiling', '平铺'],
          children: [
            { id: 'shader_tiling_tools', labels: ['Tools', '工具'] },
            { id: 'shader_tiling_textures', labels: ['Tiling Textures', '平铺纹理'] },
          ],
        },
      ],
    },
    {
      slug: 'compositor',
      labels: ['Compositor', '合成器'],
      categories: ['comp', 'comp_effect', 'comp_palette', 'comp_utilities'],
      subcategories: [
        { id: 'comp_effect', labels: ['Effect', '特效'] },
        { id: 'comp_palette', labels: ['Palette', '调色板'] },
        { id: 'comp_utilities', labels: ['Utilities', '工具'] },
      ],
    },
    { slug: 'rigging', labels: ['Rigging System', '绑定系统'], categories: ['rigging'], subcategories: [] },
    {
      slug: 'particles',
      labels: ['Particle System', '粒子系统'],
      categories: ['particle_force', 'particle_info', 'particle_mask', 'particle_system_core'],
      subcategories: [
        { id: 'particle_force', labels: ['Force', '力场'] },
        { id: 'particle_info', labels: ['Info', '信息'] },
        { id: 'particle_mask', labels: ['Mask', '遮罩'] },
        { id: 'particle_system_core', labels: ['Particle System', '粒子系统'] },
      ],
    },
    { slug: 'pcg', labels: ['PCG', '程序化内容生成'], categories: ['pcg'], subcategories: [] },
    { slug: 'stylized', labels: ['Stylized NPR', '风格化 NPR'], categories: ['stylized_2d'], subcategories: [] },
    {
      slug: 'effect',
      labels: ['Effect', '效果'],
      categories: ['effect_flipbook'],
      subcategories: [{ id: 'effect_flipbook', labels: ['Flipbook', '翻页效果'] }],
    },
    {
      slug: 'material-functions',
      labels: ['Material Functions', '材质函数'],
      categories: ['mfs_cmath', 'mfs_coordinates', 'mfs_functions', 'mfs_parallax'],
      subcategories: [
        { id: 'mfs_cmath', labels: ['Complex Math', '复数数学'] },
        { id: 'mfs_coordinates', labels: ['Coordinates', '坐标'] },
        { id: 'mfs_functions', labels: ['Functions', '函数'] },
        { id: 'mfs_parallax', labels: ['Parallax', '视差'] },
      ],
    },
  ]);

  const bySlug = new Map(SYSTEMS.map(system => [system.slug, system]));
  const byCategory = new Map(SYSTEMS.flatMap(system => system.categories.map(category => [category, system])));
  const languageIndex = language => String(language).toLowerCase().startsWith('zh') ? 1 : 0;
  const getSystem = slug => bySlug.get(slug) || null;
  const systemForCategory = category => byCategory.get(category) || null;
  const categoryLabel = (category, language = 'en') => CATEGORY_LABELS[category]?.[languageIndex(language)] || category;
  const systemLabel = (system, language = 'en') => system.labels[languageIndex(language)];
  const recordsForSystem = (records, slug) => {
    const system = getSystem(slug);
    return system ? records.filter(record => system.categories.includes(record.category_id)) : [...records];
  };
  const summarizeSystems = records => SYSTEMS.map(system => ({
    ...system,
    label: systemLabel(system),
    count: recordsForSystem(records, system.slug).length,
  }));
  const subtypeGroups = (records, slug) => {
    const categories = getSystem(slug)?.categories || SYSTEMS.flatMap(system => system.categories);
    return categories.map(category => ({
      id: category,
      label: categoryLabel(category),
      records: records.filter(record => record.category_id === category),
    })).filter(group => group.records.length);
  };

  return Object.freeze({
    SYSTEMS,
    systems: SYSTEMS,
    CATEGORY_LABELS,
    getSystem,
    systemForCategory,
    systemLabel,
    categoryLabel,
    recordsForSystem,
    summarizeSystems,
    subtypeGroups,
  });
});
