require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const pk = process.env.TEST_PRIVATE_KEY;
  const message = process.argv.slice(2).join(" ");

  if (!pk) {
    console.error("Missing TEST_PRIVATE_KEY in backend .env");
    process.exit(1);
  }
  if (!message) {
    console.error("Usage: node scripts/signMessage.js <message-to-sign>");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(pk);
  const signature = await wallet.signMessage(message);

  console.log(JSON.stringify({
    wallet: wallet.address,
    signature
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
