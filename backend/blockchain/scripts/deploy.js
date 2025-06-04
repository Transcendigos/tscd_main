const hre = require("hardhat");

async function main() {
  const TournamentScore = await hre.ethers.getContractFactory("TournamentScore");
  const contract = await TournamentScore.deploy();

  console.log(`✅ TournamentScore deployed to: ${contract.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});