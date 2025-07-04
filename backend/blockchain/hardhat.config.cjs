require("dotenv").config();

// console.log("FUJI_RPC_URL:", process.env.FUJI_RPC_URL);
// console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY);

require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    fuji: {
      url: process.env.FUJI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};