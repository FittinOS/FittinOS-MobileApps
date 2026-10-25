const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
// The monorepo's shared contract types are consumed straight from source —
// no build step, so the app can never run against a stale compiled copy.
const sharedTypesSrc = path.resolve(projectRoot, '../../packages/shared-types/src');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), sharedTypesSrc];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@fittin/shared-types': sharedTypesSrc,
};

module.exports = withNativeWind(config, { input: './global.css' });
