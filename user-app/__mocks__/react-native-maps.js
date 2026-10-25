/**
 * Manual mock for react-native-maps — a real native module not linked into
 * the Jest environment (and, as of this build, not yet linked into the dev
 * client either; see src/features/tracking/maps-config.ts). Jest uses this
 * file automatically for every `require('react-native-maps')` because it's a
 * node_modules package with a mock in the root-adjacent __mocks__ folder —
 * no jest.mock() call needed anywhere. Stubbed with plain Views so any test
 * that reaches LiveTrackingMap renders instead of crashing; tests assert on
 * the stub's props (e.g. testID) rather than real map behaviour.
 */
const React = require('react');
const { View } = require('react-native');

const MapView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
  return React.createElement(View, { ...props, testID: props.testID ?? 'mock-map-view' });
});
const Marker = (props) => React.createElement(View, { ...props, testID: props.testID ?? 'mock-map-marker' });
const Polyline = (props) => React.createElement(View, { ...props, testID: props.testID ?? 'mock-map-polyline' });

module.exports = { __esModule: true, default: MapView, Marker, Polyline, PROVIDER_GOOGLE: 'google' };
