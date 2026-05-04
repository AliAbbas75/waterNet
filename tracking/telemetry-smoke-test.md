# WaterNet - Telemetry Smoke Test and Quick Runbook

Purpose: Verify MQTT ingestion, analysis, alerts, and availability behavior end-to-end with minimal setup.

## Preconditions
- Backend is running with DB connected (startup fails fast if DB or broker is unreachable).
- Backend required env vars are set:
  - MONGODB_URI
  - JWT_SECRET
- MQTT broker is reachable and configured in backend env:
  - MQTT_BROKER_URL
  - MQTT_USERNAME / MQTT_PASSWORD (if needed)
  - MQTT_CA_CERT_PATH (if mqtts and custom CA)
  - MQTT_TLS_REJECT_UNAUTHORIZED (true/false)
  - MQTT_CONNECT_TIMEOUT_MS (optional; default 10000)
- A Plant exists and a Device exists with a known deviceId, assigned to the Plant, and disabled = false.
- ThresholdConfig exists for pH/turbidity/temperature/TDS (global or per-plant).

## EMQX Cloud Serverless identity binding (recommended)
EMQX Cloud Serverless typically does not expose a Certificates/CA page for configuring client-certificate (mTLS) auth. For MVP, bind device identity using username/password + EMQX Authorization rules.

Checklist:
- Keep TLS enabled (`mqtts://...:8883`).
- Authentication: create one MQTT user per device where `username == deviceId`.
- Authentication: create a separate MQTT user for the backend subscriber (e.g. `waternet-backend`).
- Authorization mode note (Serverless): the one-click Blacklist/Whitelist mode switch is not supported. To achieve whitelist behavior, add an **All Users** rule that denies Publish & Subscribe on `#` as the final fallback.
- Authorization rules:
  - For each device user, allow publish only to:
    - `waternet/v1/devices/${username}/telemetry`
    - `waternet/v1/devices/${username}/health`
    - `waternet/v1/devices/${username}/lwt`
  - For backend user, allow subscribe to:
    - `waternet/v1/devices/+/telemetry`
    - `waternet/v1/devices/+/health`
    - `waternet/v1/devices/+/lwt`
  - If backend publishes retained outputs, allow publish to:
    - `waternet/v1/devices/+/latest`
    - `waternet/v1/devices/+/status`

Fallback deny-all rule (required to emulate whitelist):
- Under **All Users** tab, add:
  - Topic: `#`
  - Action: Publish & Subscribe
  - Permission: Deny

Verification:
- Use QoS 1 when verifying authorization. QoS 0 is fire-and-forget and can look “successful” in clients/UI even if the broker drops/denies the publish.
- Using device creds for `test-device`, publishing to `waternet/v1/devices/test-device/telemetry` (QoS 1) should succeed.
- Using the same creds, publishing to `waternet/v1/devices/other-device/telemetry` (QoS 1) should be rejected by EMQX (no PUBACK / disconnect / not delivered).

## Minimal DB seed (no UI yet)

Because auth is Thirdweb-based, the quickest dev seed path is:
1) Insert an ADMIN user directly into MongoDB.
2) Mint a JWT for that user using `JWT_SECRET`.
3) Use admin-only REST endpoints to create Plant/Device/ThresholdConfig.

### Step 1 — Create an admin user in MongoDB
Using MongoDB Compass or `mongosh`:

- Connect using `MONGODB_URI`.
- Insert into `users`:
  - `wallet_address`: a lowercase wallet string you choose (e.g. `0xadmin...`)
  - `role`: `ADMIN`
  - `active`: `true`

Example `mongosh` (adjust DB name if your URI points elsewhere):
```js
use waternet
db.users.insertOne({ wallet_address: "0xadmin000000000000000000000000000000000000", role: "ADMIN", active: true })
```

### Step 2 — Mint a JWT for that admin user
From `backend/` (loads `.env` via dotenv):
```powershell
node -e "require('dotenv').config(); const jwt=require('jsonwebtoken'); const userId='<PASTE_USER_OBJECTID>'; const wallet='0xadmin000000000000000000000000000000000000'; console.log(jwt.sign({userId, wallet_address: wallet}, process.env.JWT_SECRET, {expiresIn: '7d'}));"
```
Save the printed token as `ADMIN_JWT`.

### Step 3 — Create Plant + Device + ThresholdConfig via API
Set a convenience variable (PowerShell):
```powershell
$ADMIN_JWT = "<PASTE_TOKEN>"
```

Create a Plant (ADMIN-only):
```powershell
curl -s -X POST "http://localhost:4000/api/plants" `
  -H "Authorization: Bearer $ADMIN_JWT" `
  -H "Content-Type: application/json" `
  -d "{\"name\":\"Demo Plant\",\"address\":\"Demo Address\",\"geo\":{\"lat\":24.8607,\"lng\":67.0011}}"
```
Copy the returned `plant._id`.

Create a Device (deviceId must match your device certificate CN):
```powershell
curl -s -X POST "http://localhost:4000/api/devices" `
  -H "Authorization: Bearer $ADMIN_JWT" `
  -H "Content-Type: application/json" `
  -d "{\"deviceId\":\"test-device\",\"plantId\":\"<PASTE_PLANT_ID>\",\"status\":\"INSTALLED\",\"disabled\":false}"
```

Create global default thresholds (repeat for pH/turbidity/temperature/TDS):
```powershell
curl -s -X POST "http://localhost:4000/api/analysis/thresholds" `
  -H "Authorization: Bearer $ADMIN_JWT" `
  -H "Content-Type: application/json" `
  -d "{\"plantId\":null,\"parameter\":\"turbidity\",\"safeMin\":0,\"safeMax\":5,\"warnMin\":0,\"warnMax\":10,\"unsafeMax\":10}"
```
Note: pick numbers that make it easy to trigger SAFE vs UNSAFE in the next steps.

## Optional: mTLS CN binding + verification (only if your EMQX plan supports it)

If your EMQX Cloud plan exposes client-certificate settings, you can additionally enforce identity via certificate CN.
The backend cannot read a client certificate CN from MQTT messages; CN enforcement must be done by the broker.

### Create a test CA + device cert (local)
Use OpenSSL (run anywhere you have it installed):
```bash
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -subj "/CN=waternet-dev-ca" -out ca.crt

openssl genrsa -out test-device.key 2048
openssl req -new -key test-device.key -subj "/CN=test-device" -out test-device.csr
openssl x509 -req -in test-device.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out test-device.crt -days 365 -sha256
```

### EMQX configuration (what to set)
- Listener: TLS enabled; require client certificate; verify against your CA (`ca.crt`).
- Authorization: add a rule/policy that binds CN to topic:
  - allow publish/subscribe only to `waternet/v1/devices/${cert_cn}/#`

### Verify (expected allow/deny)
Replace host/port with your EMQX endpoint (TLS is typically port 8883).

1) Should CONNECT and PUBLISH (CN matches topic deviceId):
```bash
mosquitto_pub -h <EMQX_HOST> -p 8883 --cafile ca.crt --cert test-device.crt --key test-device.key \
  -t "waternet/v1/devices/test-device/telemetry" -q 1 \
  -m '{"schemaVersion":"1.0","timestamp":"2026-05-02T12:01:00Z","readings":{"pH":7.2,"turbidity":1.0,"temperature":25,"TDS":150}}'
```

2) Should be REJECTED (same cert tries to publish to a different deviceId):
```bash
mosquitto_pub -h <EMQX_HOST> -p 8883 --cafile ca.crt --cert test-device.crt --key test-device.key \
  -t "waternet/v1/devices/other-device/telemetry" -q 1 \
  -m '{"schemaVersion":"1.0","timestamp":"2026-05-02T12:01:00Z","readings":{"turbidity":1}}'
```

3) Should be REJECTED (no client cert):
```bash
mosquitto_pub -h <EMQX_HOST> -p 8883 --cafile ca.crt \
  -t "waternet/v1/devices/test-device/telemetry" -q 1 -m '{"schemaVersion":"1.0","timestamp":"2026-05-02T12:01:00Z","readings":{"turbidity":1}}'
```

## EMQX Serverless verification commands (username/password)
Use these when you are enforcing topic binding via Authorization rules:

```bash
# Should succeed (username == deviceId)
mosquitto_pub -h <EMQX_HOST> -p 8883 -u test-device -P <PASSWORD> \
  -t "waternet/v1/devices/test-device/telemetry" -q 1 \
  -m '{"schemaVersion":"1.0","timestamp":"2026-05-02T12:01:00Z","readings":{"turbidity":1}}'

# Should be rejected (same creds publish to different device)
mosquitto_pub -h <EMQX_HOST> -p 8883 -u test-device -P <PASSWORD> \
  -t "waternet/v1/devices/other-device/telemetry" -q 1 \
  -m '{"schemaVersion":"1.0","timestamp":"2026-05-02T12:01:00Z","readings":{"turbidity":1}}'
```

## Quick runbook (happy path)
1) Publish health heartbeat (marks device online).
   - Example:
     mosquitto_pub -h localhost -t "waternet/v1/devices/test-device/health" -m "{\"schemaVersion\":\"1.0\",\"timestamp\":\"2026-05-02T12:00:00Z\",\"health\":{\"uptime\":3600,\"connectivityStatus\":\"good\"}}"
   - Expected:
     - Device availability becomes AVAILABLE.
     - lastSeenAt updates.

2) Publish safe telemetry.
   - Example:
     mosquitto_pub -h localhost -t "waternet/v1/devices/test-device/telemetry" -m "{\"schemaVersion\":\"1.0\",\"timestamp\":\"2026-05-02T12:01:00Z\",\"readings\":{\"pH\":7.2,\"turbidity\":1.0,\"temperature\":25,\"TDS\":150}}"
   - Expected:
     - TelemetryReading stored.
     - WaterQualityState updated for plant/device (category SAFE or WARNING depending on thresholds).
     - Retained latest metrics published to waternet/v1/devices/test-device/latest.

3) Publish unsafe telemetry to trigger alert.
   - Example (high turbidity):
     mosquitto_pub -h localhost -t "waternet/v1/devices/test-device/telemetry" -m "{\"schemaVersion\":\"1.0\",\"timestamp\":\"2026-05-02T12:02:00Z\",\"readings\":{\"pH\":7.2,\"turbidity\":50.0,\"temperature\":25,\"TDS\":150}}"
   - Expected:
     - WaterQualityState category UNSAFE.
     - Alert created: type QUALITY_UNSAFE, severity CRITICAL.

4) Simulate offline behavior.
   - Option A: Publish LWT payload "offline" to /lwt topic.
     - Example:
       mosquitto_pub -h localhost -t "waternet/v1/devices/test-device/lwt" -m "offline"
   - Option B: Stop heartbeats and wait 6+ minutes for cron to mark offline.
   - Expected:
     - Device availability becomes UNAVAILABLE.
     - Alert created: type DEVICE_OFFLINE, severity WARN.

## Minimal verification checklist
- [ ] Health heartbeat updates Device.lastSeenAt and availability = AVAILABLE.
- [ ] Telemetry record saved with readings.
- [ ] WaterQualityState updated after telemetry.
- [ ] QUALITY_UNSAFE alert created on unsafe telemetry.
- [ ] DEVICE_OFFLINE alert created on LWT or missed heartbeats.

## Quick troubleshooting
- If no telemetry is saved: confirm topic path and deviceId exist and device is not disabled.
- If state is not updating: verify ThresholdConfig exists and deviceId types match in queries.
- If alerts do not appear: check alert routes RBAC and confirm state category UNSAFE.
- If mqtts fails: verify MQTT_CA_CERT_PATH and MQTT_TLS_REJECT_UNAUTHORIZED.
