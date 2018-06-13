const path = require('path');

module.exports = {
  entry: './doc/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'doc')
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    dns: 'empty'
    }
};
