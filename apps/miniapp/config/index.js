const config = {
  projectName: 'palm-persona-ai',
  date: '2026-05-03',
  designWidth: 750,
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  mini: {
    webpackChain(chain) {
      // 修复 pnpm monorepo 下 @tarojs/shared 别名解析为对象的问题
      const alias = chain.resolve.alias;
      const entries = alias.entries();
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== 'string' && !Array.isArray(value)) {
          alias.delete(key);
        }
      }
    },
    postcss: {
      pxtransform: { enable: true, config: {} },
    },
    copy: {
      patterns: [{ from: 'project.config.json', to: 'project.config.json' }],
    },
  },
};

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
};
