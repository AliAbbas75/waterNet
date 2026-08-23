#!/bin/bash
# Starts Besu with a validator identity supplied as a secret rather than a file
# in the repository.
#
# data/key is the QBFT validator private key, and its address is fixed inside
# genesis.json's extraData — lose it and the node can never seal a block again.
# It used to be committed so a `git clean` could not destroy it, which protected
# it from the wrong threat: every clone of the repo then held the authority to
# sign blocks on this chain.
#
# Now it arrives as CHAIN_VALIDATOR_KEY and is written here at boot.
set -euo pipefail

KEY_FILE=/data/key

if [ -s "$KEY_FILE" ]; then
  # Never overwrite a key that is already on disk. If the volume holds a chain,
  # its blocks were sealed by that key; swapping it would leave a node that
  # cannot extend its own history.
  echo "besu-bootstrap: using the validator key already on the volume"
elif [ -n "${CHAIN_VALIDATOR_KEY:-}" ]; then
  mkdir -p /data
  # Tolerate the key being supplied with or without the 0x prefix, and strip any
  # trailing newline a secret store may have added.
  printf '%s' "${CHAIN_VALIDATOR_KEY}" | tr -d '[:space:]' > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  echo "besu-bootstrap: wrote the validator key from CHAIN_VALIDATOR_KEY"
else
  echo "besu-bootstrap: no key on the volume and CHAIN_VALIDATOR_KEY is unset." >&2
  echo "besu-bootstrap: Besu would generate a new identity, which genesis.json's" >&2
  echo "besu-bootstrap: extraData does not name — the node would never seal a block." >&2
  exit 1
fi

exec /opt/besu/bin/besu "$@"
