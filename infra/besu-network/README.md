# Besu QBFT node

Single-validator proof-of-authority chain backing the on-chain user registry
(`backend/contracts/UserRegistry.sol`). Started with:

```bash
docker compose -f infra/besu-network/docker-compose.yml up -d
```

## The validator key is not in this repository, and must not be

`data/key` is the QBFT validator identity. Its address —
`0x2d4a17518bf284a1e2965136c7e0cc73ff15e893` — is baked into
`config/genesis.json` as `extraData`, which is what makes this node the one
authority allowed to seal blocks on chain `1337`.

That file used to be committed. It was excluded from the ignore rules on
purpose, so that a stray `git clean` could not destroy it — a real risk, badly
solved. A key that signs blocks does not belong in a repository, and the
protection it was given there was worse than the problem: anyone with a clone
holds the sealing authority for this chain.

It is now ignored, along with `generated/`. **Back it up out of band** — a
password manager entry or an encrypted note is enough; it is 66 bytes.

### If you lose it

You cannot recover it, and you cannot mint a replacement that the existing
genesis will accept, because the address is fixed inside `extraData`. Losing the
key means starting a new chain:

```bash
# 1. generate a fresh validator key + a genesis built around it
docker run --rm -v "$PWD/infra/besu-network:/w" -w /w hyperledger/besu:latest \
  operator generate-blockchain-config \
  --config-file=qbft-config.json \
  --to=generated \
  --private-key-file-name=key

# 2. put the new genesis and key in place
cp generated/genesis.json config/genesis.json
cp generated/keys/0x<new-address>/key data/key

# 3. wipe the old chain — its blocks are signed by a validator that no longer exists
rm -rf data/database data/caches
```

Then, because it is a new chain with an empty state:

```bash
node backend/scripts/deploy-user-registry.js   # writes a new contract address
node backend/scripts/migrate-users.js          # re-registers every existing user
```

Update `CHAIN_USER_REGISTRY_ADDRESS` in `backend/.env` with the address the
deploy script prints. `CHAIN_SUPER_ADMIN` must stay a funded account — the
genesis `alloc` block is what funds it.

## Rotating the key that was published

The two keys that were committed are still in git history, and history is not
changed by removing them from the working tree. If this repository has ever been
public, or shared with anyone who should not hold block-sealing authority, treat
both as compromised and run the procedure above to move to a new validator.

Nothing else needs to change: the app talks to the chain only through
`CHAIN_RPC_URL` and `CHAIN_USER_REGISTRY_ADDRESS`.

## What is in here

| Path | Tracked | What it is |
|---|---|---|
| `config/genesis.json` | yes | Chain 1337, QBFT, 2s blocks. Public by design. |
| `config/config.toml` | yes | RPC settings. `sync-min-peers=0` so a single node seals without waiting for peers. |
| `qbft-config.json` | yes | Input to `generate-blockchain-config`. |
| `docker-compose.yml` | yes | Runs the node against `./data` and `./config`. |
| `data/key` | **no** | Validator private key. Back this up yourself. |
| `data/database`, `data/caches` | no | Live RocksDB. Never commit it — snapshots restore corrupt, and `git restore` over these paths destroys a working chain. |
| `generated/` | no | Output of `generate-blockchain-config`, keys included. |

## Do not expose 8545

The RPC has `host-allowlist=["*"]` and `rpc-http-host="0.0.0.0"` so it is
reachable from other containers. That is fine on a private network and is not
fine on a public one. If this is ever hosted, keep port 8545 on internal
networking only — the backend is the sole thing that needs to reach it.
