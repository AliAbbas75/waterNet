function httpLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const requestId = req.requestId || "-";
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;

    // Keep logs simple and parseable.
    console.log(
      JSON.stringify({
        level: "info",
        msg: "http_request",
        requestId,
        method,
        url,
        status,
        durationMs: Math.round(durationMs)
      })
    );
  });

  next();
}

module.exports = { httpLogger };
