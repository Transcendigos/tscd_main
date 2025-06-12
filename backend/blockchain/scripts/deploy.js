const hre = require("hardhat");

async function main() {
  const ScoreStorage = await hre.ethers.getContractFactory("ScoreStorage");
  const scoreStorage = await ScoreStorage.deploy();

  await scoreStorage.waitForDeployment();
  console.log(`ScoreStorage deployed at: ${await scoreStorage.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});