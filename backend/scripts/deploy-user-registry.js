require("dotenv").config();
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function compileContract() {
  const contractPath = path.join(__dirname, "..", "contracts", "UserRegistry.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "UserRegistry.sol": { content: source }
    },
    settings: {
      evmVersion: "london",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  }

  const contract = output.contracts["UserRegistry.sol"].UserRegistry;
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object };
}

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const privateKey = requireEnv("CHAIN_ADMIN_PRIVATE_KEY");
  const superAdmin = process.env.CHAIN_SUPER_ADMIN || ethers.ZeroAddress;
  console.log('deploy-user-registry: rpcUrl=', rpcUrl);
  console.log('deploy-user-registry: using superAdmin=', superAdmin);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  console.log('deploy-user-registry: provider created');
  const signer = new ethers.Wallet(privateKey, provider);
  console.log('deploy-user-registry: signer address=', await signer.getAddress());

  const { abi, bytecode } = compileContract();
  console.log('deploy-user-registry: contract compiled, bytecode length=', bytecode.length);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log('deploy-user-registry: deploying contract...');
  const contract = await factory.deploy(superAdmin, { gasLimit: 3_000_000 });
  console.log('deploy-user-registry: txHash=', contract.deploymentTransaction?.hash || contract.hash || 'unknown');
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`UserRegistry deployed at: ${address}`);
}

console.log('deploy-user-registry: start');
main()
  .then(() => {
    console.log('deploy-user-registry: completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('deploy-user-registry: ERROR', err && err.stack ? err.stack : err);
    process.exit(1);
  });
