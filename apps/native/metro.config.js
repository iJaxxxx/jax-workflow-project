// Expo SDK 52+ 的 getDefaultConfig 会自动识别 pnpm monorepo：
// watchFolders 包含仓库根目录，nodeModulesPaths 包含本包和根目录的 node_modules，
// 所以 workspace 包 @jax-workflow-project/github-users（package.json exports 指向 src/*.ts）可以直接解析。
// 文档：https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");

// biome-ignore lint/correctness/noGlobalDirnameFilename: Metro 配置是 CommonJS，__dirname 是正确写法
module.exports = getDefaultConfig(__dirname);
