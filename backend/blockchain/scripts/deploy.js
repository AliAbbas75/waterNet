const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with:", deployer.address);
  console.log("Network:", hre.network.name);

  const Factory = await hre.ethers.getContractFactory("WaterNetAccessRegistry");
  const contract = await Factory.deploy(deployer.address);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("WaterNetAccessRegistry deployed to:", address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
