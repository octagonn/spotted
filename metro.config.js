const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Windows has no Watchman, so Metro falls back to its own recursive file
// watcher. That watcher crashes with `ENOENT: watch '.../@tybys/wasm-util/lib'`
// when the lockfile references an *optional* dev dependency whose folder npm
// skipped installing (@napi-rs/wasm-runtime → @tybys/wasm-util are optional and
// unused by this app). Excluding those paths stops the watcher from ever trying
// to watch a directory that doesn't exist.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /[\\/]node_modules[\\/]@tybys[\\/]/,
  /[\\/]node_modules[\\/]@napi-rs[\\/]/
];

module.exports = withNativeWind(config, { input: "./global.css" });
