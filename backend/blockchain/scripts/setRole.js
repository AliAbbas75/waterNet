require("dotenv").config();
const hre = require("hardhat");

function must(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function main() {
  const contractAddress = must("CONTRACT_ADDRESS");
  const targetWallet = must("TARGET_WALLET");
  const role = Number(must("ROLE"));

  const [admin] = await hre.ethers.getSigners();
  console.log("Admin wallet:", admin.address);

  const contract = await hre.ethers.getContractAt(
    "WaterNetAccessRegistry",
    contractAddress,
    admin
  );

  console.log("Setting role for:", targetWallet, "to:", role);
  const tx = await contract.setRole(targetWallet, role);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
