import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Staywell',
  slug: 'str-management',
  plugins: [
    'expo-router',
    'expo-asset',
    ...(config.plugins ?? []),
    ['expo-image-picker', { cameraPermission: 'Photograph receipts for your property expense records.', photosPermission: 'Choose receipt photos for your expense records.', microphonePermission: false }],
    'expo-sharing',
    ['expo-location', {
      locationWhenInUsePermission: 'Use your location to fill trip locations and record mileage when you tap Start.',
      locationAlwaysAndWhenInUsePermission: 'Record your property trip while the screen is locked, until you tap Stop.',
      isIosBackgroundLocationEnabled: true,
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    }],
    ['react-native-maps', {
      androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '',
      iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY ?? '',
    }],
  ],
  extra: {
    ...config.extra,
    googleMapsAndroidConfigured: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY,
    googleMapsIosConfigured: !!process.env.GOOGLE_MAPS_IOS_API_KEY,
  },
});
