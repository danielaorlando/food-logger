import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danielaorlando.foodlogger',
  appName: 'Bite Balance',
  webDir: 'dist',
  ios: {
    backgroundColor: '#fbf8f4',
  },
  plugins: {
    FirebaseAuthentication: {
      // List the sign-in providers you actually use. The plugin only
      // initializes the native SDKs for providers in this list, so Google
      // sign-in silently no-ops if "google.com" isn't here.
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    SplashScreen: {
      // Stay on the splash until JS calls SplashScreen.hide() — normally
      // the moment Firebase Auth resolves in AuthContext. The backgroundColor
      // must match the mint used in LaunchScreen.storyboard so the padding
      // around the letterboxed splash image looks seamless.
      launchAutoHide: false,
      backgroundColor: '#BFECD8',
      launchFadeOutDuration: 300,
      showSpinner: false,
    },
  },
};

export default config;
