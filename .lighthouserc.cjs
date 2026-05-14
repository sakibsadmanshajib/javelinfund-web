// .lighthouserc.cjs
module.exports = {
  ci: {
    collect: { staticDistDir: 'dist', url: ['http://localhost/index.html', 'http://localhost/donate/index.html'] },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:performance':    ['error', { minScore: 0.9 }],
        'categories:accessibility':  ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo':            ['error', { minScore: 0.95 }],
      },
    },
  },
};
