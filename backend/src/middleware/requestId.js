const crypto = require("crypto");

function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.trim()
    ? incoming.trim()
    : crypto.randomUUID();

  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

module.exports = { requestId };
