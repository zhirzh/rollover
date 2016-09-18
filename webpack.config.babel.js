import path from 'path';

const SRC_DIR = path.resolve(__dirname, 'src');
const DIST_DIR = path.resolve(__dirname, 'dist');

export default {
  entry: path.resolve(SRC_DIR, 'index.js'),

  output: {
    path: DIST_DIR,
    filename: 'roll-over.js',
    library: 'RollOver',
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },

  module: {
    loaders: [
      {
        test: /\.js$/,
        include: /src/,
        loader: 'babel',
      },
    ],
  },
};
