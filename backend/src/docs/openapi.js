const pkg = require("../../package.json");

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "WaterNet API",
    version: pkg.version || "0.0.0",
    description: "Swagger UI for quickly testing WaterNet backend endpoints."
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local dev"
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Admin" },
    { name: "Plants" },
    { name: "Devices" },
    { name: "Analysis" },
    { name: "Alerts" },
    { name: "Inventory" },
    { name: "Maintenance" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "OK"
          }
        }
      }
    },

    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Exchange Thirdweb token for backend JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "walletAddress"],
                properties: {
                  token: { type: "string", description: "Thirdweb auth token" },
                  walletAddress: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Login success" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user (backend JWT)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "OK" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (no-op for JWT; kept for API symmetry)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "OK" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/admin/bootstrap": {
      get: {
        tags: ["Admin"],
        summary: "Admin bootstrap (ADMIN/SUPER_ADMIN)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "OK" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" }
        }
      }
    },

    "/api/plants": {
      get: {
        tags: ["Plants"],
        summary: "List plants (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } }
        ],
        responses: {
          200: { description: "OK" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" }
        }
      },
      post: {
        tags: ["Plants"],
        summary: "Create plant (ADMIN)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "address", "geo"],
                properties: {
                  name: { type: "string" },
                  address: { type: "string" },
                  geo: {
                    type: "object",
                    required: ["lat", "lng"],
                    properties: {
                      lat: { type: "number" },
                      lng: { type: "number" }
                    }
                  },
                  operationalStatus: { type: "string" },
                  operatingHours: { type: "string", nullable: true }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Created" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" }
        }
      }
    },

    "/api/plants/{id}": {
      get: {
        tags: ["Plants"],
        summary: "Get plant (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK" },
          404: { description: "Not found" }
        }
      },
      put: {
        tags: ["Plants"],
        summary: "Update plant (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      },
      delete: {
        tags: ["Plants"],
        summary: "Delete plant (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      }
    },

    "/api/devices": {
      get: {
        tags: ["Devices"],
        summary: "List devices (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "plantId", in: "query", schema: { type: "string" } },
          { name: "disabled", in: "query", schema: { type: "boolean" } }
        ],
        responses: { 200: { description: "OK" } }
      },
      post: {
        tags: ["Devices"],
        summary: "Create device (ADMIN)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["deviceId"],
                properties: {
                  deviceId: { type: "string" },
                  plantId: { type: "string", nullable: true },
                  firmwareVersion: { type: "string", nullable: true }
                }
              }
            }
          }
        },
        responses: { 201: { description: "Created" } }
      }
    },

    "/api/devices/{id}": {
      get: {
        tags: ["Devices"],
        summary: "Get device (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      },
      put: {
        tags: ["Devices"],
        summary: "Update device (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      },
      delete: {
        tags: ["Devices"],
        summary: "Delete device (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      }
    },

    "/api/devices/{id}/install": {
      patch: {
        tags: ["Devices"],
        summary: "Install device to plant (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["plantId"],
                properties: { plantId: { type: "string" } }
              }
            }
          }
        },
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      }
    },

    "/api/devices/{id}/uninstall": {
      patch: {
        tags: ["Devices"],
        summary: "Uninstall device (ADMIN)",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      }
    },

    "/api/analysis/plants/{id}/state": {
      get: {
        tags: ["Analysis"],
        summary: "Get plant water-quality state (public read)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } }
      }
    }
  }
};

module.exports = { openapi };
