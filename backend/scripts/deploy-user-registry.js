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

/**
 * Compiles and deploys UserRegistry, returning the address it landed at.
 *
 * Exported so ensure-chain can call it as a step rather than shelling out to a
 * second node process, which would lose the error and re-read the environment.
 */
async function deployRegistry({ rpcUrl, privateKey, superAdmin }) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const { abi, bytecode } = compileContract();
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(superAdmin, { gasLimit: 3_000_000 });
  await contract.waitForDeployment();

  return contract.getAddress();
}

async function main() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const privateKey = requireEnv("CHAIN_ADMIN_PRIVATE_KEY");
  const superAdmin = process.env.CHAIN_SUPER_ADMIN || ethers.ZeroAddress;

  console.log('deploy-user-registry: rpcUrl=', rpcUrl);
  console.log('deploy-user-registry: using superAdmin=', superAdmin);
  console.log('deploy-user-registry: signer address=', new ethers.Wallet(privateKey).address);

  const address = await deployRegistry({ rpcUrl, privateKey, superAdmin });
  console.log(`UserRegistry deployed at: ${address}`);
}

module.exports = { deployRegistry, compileContract };

// Only run as a CLI when invoked directly, so requiring this from ensure-chain
// does not kick off a second deployment as a side effect of the import.
if (require.main === module) {
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
}
