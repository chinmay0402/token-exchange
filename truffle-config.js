require('babel-polyfill');
require('babel-register');
require('dotenv').config();

module.exports = {

  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    }
  },
  contracts_directory: './src/contracts',
  contracts_build_directory: './src/abis',
  
  compilers: {
    solc: {
      version: "^0.8.0", // A version or constraint - Ex. "^0.5.0"
                         // Can be set to "native" to use a native solc or
                         // "pragma" which attempts to autodetect compiler versions
      optimizer: {
         enabled: false,
         runs: 200
       }
    }
  }
};
