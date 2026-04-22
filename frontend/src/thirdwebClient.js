import { createThirdwebClient } from "thirdweb";
import { inAppWallet } from "thirdweb/wallets";

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

export const client = clientId ? createThirdwebClient({ clientId }) : null;

export const wallets = client
  ? [
      inAppWallet({
        auth: {
          options: ["email", "google", "apple", "facebook"]
        }
      })
    ]
  : [];
