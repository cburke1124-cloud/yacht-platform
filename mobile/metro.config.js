const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub out native-only packages for web builds
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-keyboard-controller') {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'lib/stubs/keyboard-controller.js') };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
