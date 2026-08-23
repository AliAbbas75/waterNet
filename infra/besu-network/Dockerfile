# Besu packaged with its genesis and bootstrap, so a platform that builds from a
# repository (Railway, Fly, Cloud Run) has something to build. Locally the
# compose file mounts ./config instead and this image is unused.
FROM hyperledger/besu:latest

USER root

# The Besu image ships no HTTP client at all — no curl, wget, nc or python — so
# a healthcheck cannot ask the node anything without this. Without it the
# container is permanently "unhealthy" and anything waiting on service_healthy
# waits forever.
RUN apt-get update     && apt-get install -y --no-install-recommends curl     && rm -rf /var/lib/apt/lists/*

COPY config/ /config/
RUN chmod +x /config/bootstrap.sh

# The chain lives on a mounted volume. Nothing here is persisted in the image:
# the genesis is configuration, and the validator key arrives at boot from
# CHAIN_VALIDATOR_KEY. See config/bootstrap.sh.
VOLUME ["/data"]

EXPOSE 8545 8546

ENTRYPOINT ["/bin/bash", "/config/bootstrap.sh"]
CMD ["--genesis-file=/config/genesis.json", \
     "--config-file=/config/config.toml", \
     "--data-path=/data", \
     "--rpc-http-cors-origins=*", \
     "--host-allowlist=*", \
     "--min-gas-price=0"]
