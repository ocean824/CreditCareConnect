import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerStripeWebhook } from "./stripeWebhook";
import { registerClick2MailWebhook } from "./click2mailWebhook";
import "./scheduler";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimit } from "./middleware/rateLimit";
import { registerObservability } from "./observability";
import { registerOpenApi } from "./openapi";

const app = express();

// Set environment and trust proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("env", "production");
  app.set("trust proxy", 1);
} else {
  app.set("env", "development");
}

// Security headers (CSP removed to ensure React app loads properly in all environments)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// Webhooks MUST be registered BEFORE express.json() 
// so they can receive raw body for signature verification
registerStripeWebhook(app);
registerClick2MailWebhook(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Attach requestId early
app.use(requestId);

const FILES_DIR = process.env.FILES_DIR || path.join(process.cwd(), "files");
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
app.use("/files", express.static(FILES_DIR));

// Simple rate limit for AI/chat endpoints
app.use("/api/chat", rateLimit({ windowMs: 60_000, max: 30 }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Docs & Observability
  registerOpenApi(app);
  registerObservability(app);

  // Admin bootstrap: promote users in ADMIN_EMAILS to admin role
  if (process.env.ADMIN_EMAILS) {
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const adminEmails = process.env.ADMIN_EMAILS.split(',').map(e => e.trim());
    for (const email of adminEmails) {
      try {
        await db.update(users)
          .set({ role: 'admin' })
          .where(eq(users.email, email));
        log(`Promoted ${email} to admin`);
      } catch (e) {
        // User might not exist yet, will be promoted on login
      }
    }
  }

  // Error handler must be last
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

export { app };
