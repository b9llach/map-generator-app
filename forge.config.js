import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

export const packagerConfig = {
  asar: true,
  icon: 'build/icon',
  executableName: 'MapGenerator',
}

export const rebuildConfig = {}

export const makers = [
  {
    name: '@electron-forge/maker-squirrel',
    config: {
      name: 'MapGenerator',
      setupIcon: 'build/icon.ico',
      loadingGif: 'build/icon_installer.gif',
    },
  },
  {
    name: '@electron-forge/maker-zip',
    platforms: ['darwin'],
    config: {
      name: 'MapGenerator',
    },
  },
  {
    name: '@electron-forge/maker-deb',
    config: {
      options: {
        bin: 'MapGenerator',
        productName: 'MapGenerator',
        icon: 'build/icon.png',
      },
    },
  },
  {
    name: '@electron-forge/maker-rpm',
    config: {
      options: {
        bin: 'MapGenerator',
        productName: 'MapGenerator',
        icon: 'build/icon.png',
      },
    },
  },
]

export const publishers = [
  {
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'b9llach',
        name: 'map-generator-app',
      },
      prerelease: false,
      draft: false,
    },
  },
]

export const plugins = [
  {
    name: '@electron-forge/plugin-vite',
    config: {
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    },
  },
  // Fuses are used to enable/disable various Electron functionality
  // at package time, before code signing the application
  new FusesPlugin({
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  }),
]
