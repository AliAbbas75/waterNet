import { createThirdwebClient } from "thirdweb";
import { inAppWallet } from "thirdweb/wallets";

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

export const thirdwebClient = clientId ? createThirdwebClient({ clientId }) : null;

export const thirdwebWallets = thirdwebClient
  ? [
      inAppWallet({
        auth: {
          options: ["email", "google", "apple", "facebook"]
        }
      })
    ]
  : [];

export const thirdwebClientId = clientId;
