const { z } = require("zod");

function validateBody(schema) {
  if (!schema || typeof schema.safeParse !== "function") {
    throw new Error("validateBody requires a zod schema");
  }

  return function validateBodyMiddleware(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid request body",
        details: result.error.flatten(),
        requestId: req.requestId
      });
    }

    req.body = result.data;
    return next();
  };
}

module.exports = { z, validateBody };
