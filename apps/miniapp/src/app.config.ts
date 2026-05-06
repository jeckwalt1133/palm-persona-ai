export default defineAppConfig({
  pages: ['pages/index/index', 'pages/capture/index'],
  subpackages: [
    { root: 'pages/report', pages: ['index'] },
    { root: 'pages/share-landing', pages: ['index'] },
    { root: 'pages/points-marking', pages: ['index'] },
  ],
  preloadRule: {
    'pages/capture/index': {
      network: 'all',
      packages: ['pages/report'],
    },
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1B1035',
    navigationBarTitleText: '掌心人格局',
    navigationBarTextStyle: 'white',
  },
});
