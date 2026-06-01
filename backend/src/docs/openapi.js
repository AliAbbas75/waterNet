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
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          _id: { type: "string" },
          email: { type: "string", nullable: true },
          display_name: { type: "string", nullable: true },
          wallet_address: { type: "string" },
          role: { type: "string", enum: ["SUPER_ADMIN", "ADMIN", "MAINTAINER", "PUBLIC"] },
          provider: { type: "string", nullable: true },
          provider_user_id: { type: "string", nullable: true },
          avatar_url: { type: "string", nullable: true },
          last_login_at: { type: "string", format: "date-time", nullable: true },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      Invite: {
        type: "object",
        properties: {
          _id: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["MAINTAINER", "ADMIN"] },
          expiresAt: { type: "string", format: "date-time" },
          usedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      ChainProof: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          address: { type: "string" },
          role: { type: "string", enum: ["SUPER_ADMIN", "ADMIN", "MAINTAINER", "PUBLIC"] },
          active: { type: "boolean" },
          contractAddress: { type: "string", nullable: true }
        }
      }
    }
  },
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Admin" },
    { name: "Public" },
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

    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a public user (custodial wallet + OTP)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                  displayName: { type: "string", nullable: true }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "Registered",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true }
                  }
                }
              }
            }
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          },
          409: {
            description: "Email already registered",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/send-otp": {
      post: {
        tags: ["Auth"],
        summary: "Send OTP to email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "OTP sent",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true }
                  }
                }
              }
            }
          },
          404: {
            description: "User not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP and return pre-auth token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "code"],
                properties: {
                  email: { type: "string", format: "email" },
                  code: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "OTP verified",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    preAuthToken: { type: "string" },
                    expiresAt: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          },
          400: {
            description: "Invalid or expired code",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          },
          429: {
            description: "Too many attempts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/challenge": {
      get: {
        tags: ["Auth"],
        summary: "Issue login challenge (requires pre-auth token)",
        parameters: [
          {
            name: "Authorization",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Bearer <preAuthToken>"
          }
        ],
        responses: {
          200: {
            description: "Challenge issued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    challengeId: { type: "string" },
                    nonce: { type: "string" },
                    expiresAt: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          },
          401: {
            description: "Pre-auth expired or missing",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/verify-challenge": {
      post: {
        tags: ["Auth"],
        summary: "Verify challenge and return JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["challengeId"],
                properties: {
                  challengeId: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Login success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    token: { type: "string" },
                    user: { $ref: "#/components/schemas/User" }
                  }
                }
              }
            }
          },
          400: {
            description: "Challenge expired",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          },
          401: {
            description: "Signature verification failed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          },
          403: {
            description: "Account disabled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/invites/{token}": {
      get: {
        tags: ["Auth"],
        summary: "Validate invite token",
        parameters: [
          { name: "token", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: {
            description: "Invite valid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["MAINTAINER", "ADMIN"] },
                    expiresAt: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          },
          404: {
            description: "Invite not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/accept-invite": {
      post: {
        tags: ["Auth"],
        summary: "Accept invite and upgrade role",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Role upgraded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    role: { type: "string", enum: ["MAINTAINER", "ADMIN"] },
                    wallet_address: { type: "string" },
                    txHash: { type: "string", nullable: true },
                    blockNumber: { type: "number", nullable: true }
                  }
                }
              }
            }
          },
          403: {
            description: "Invite email mismatch",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          },
          404: {
            description: "Invite not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user (backend JWT)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: { $ref: "#/components/schemas/User" }
                  }
                }
              }
            }
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (no-op for JWT; kept for API symmetry)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true }
                  }
                }
              }
            }
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
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

    "/api/admin/invites": {
      post: {
        tags: ["Admin"],
        summary: "Create role upgrade invite",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "role"],
                properties: {
                  email: { type: "string", format: "email" },
                  role: { type: "string", enum: ["MAINTAINER", "ADMIN"] }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "Invite created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    inviteId: { type: "string" },
                    expiresAt: { type: "string", format: "date-time" },
                    token: { type: "string" },
                    link: { type: "string", nullable: true }
                  }
                }
              }
            }
          },
          409: {
            description: "Invite already pending",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/public/chain-proof": {
      get: {
        tags: ["Public"],
        summary: "Verify on-chain role by wallet address",
        parameters: [
          { name: "address", in: "query", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: {
            description: "Chain proof",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChainProof" }
              }
            }
          },
          400: {
            description: "Invalid address",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
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
