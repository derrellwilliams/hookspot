export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    '@react-native-community/datetimepicker',
    [
      '@rnmapbox/maps',
      {
        // Secret token (sk.…) required only at prebuild time to download the iOS SDK.
        // Set RNMAPBOX_MAPS_DOWNLOAD_TOKEN in the shell before running expo prebuild.
        RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
    identifyUrl: process.env.EXPO_PUBLIC_IDENTIFY_URL,
  },
})
