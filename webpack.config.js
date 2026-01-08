module.exports = {
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer/")
    }
  },
  experiments: {
    asyncWebAssembly: true
  },
  output: {
    webassemblyModuleFilename: '[modulehash].wasm'
  },
  // Configurar target para suportar async/await
  target: ['web', 'es2022']
};

