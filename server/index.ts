import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";

// Create app and server FIRST - before any other imports that might block
const app = express();
const server = createServer(app);

// CRITICAL: Register health checks FIRST before any other middleware
// This ensures deployment health checks respond immediately
let dbReady = false;
let appReady = false;

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/readyz", (_req, res) => {
  if (dbReady && appReady) {
    res.status(200).send("ready");
  } else if (appReady) {
    res.status(200).send("warming");
  } else {
    // App not fully initialized yet but server is listening
    res.status(200).send("starting");
  }
});

// Start listening IMMEDIATELY so health checks can respond
const port = parseInt(process.env.PORT || '5000', 10);
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  console.log(`[express] Health check server listening on port ${port}`);
  
  // Now initialize the rest of the app asynchronously
  initializeApp().catch(err => {
    console.error("Fatal error during app initialization:", err);
    process.exit(1);
  });
});

async function initializeApp() {
  // Dynamic imports to avoid blocking startup
  const { registerRoutes } = await import("./routes");
  const { registerStripeWebhook } = await import("./stripeWebhook");
  const { registerClick2MailWebhook } = await import("./click2mailWebhook");
  await import("./scheduler");
  const { setupVite, serveStatic, log } = await import("./vite");
  const { requestId } = await import("./middleware/requestId");
  const { errorHandler } = await import("./middleware/errorHandler");
  const { rateLimit } = await import("./middleware/rateLimit");
  const { registerOpenApi } = await import("./openapi");

  // Force production mode if dist/public exists (built files are present)
  const distPublicPath = path.resolve(import.meta.dirname, "public");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distPublicPath);

  if (isProduction) {
    app.set("env", "production");
    app.set("trust proxy", 1);
  } else {
    app.set("env", "development");
  }

  // Security headers
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
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
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

  // Register routes (returns the existing server, doesn't create new one)
  await registerRoutes(app, server);

  // Docs only - health checks registered at top of file
  registerOpenApi(app);

  // Error handler must be last
  app.use(errorHandler);

  // Setup vite in development or serve static in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  log(`serving on port ${port}`);
  appReady = true;

  // Run DB checks and admin bootstrap
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    
    // Verify DB connectivity
    await db.execute(sql`select 1`);
    dbReady = true;
    log("Database connection verified");
    
    // Admin bootstrap: promote users in ADMIN_EMAILS to admin role
    if (process.env.ADMIN_EMAILS) {
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
  } catch (e) {
    log(`Database initialization error: ${e}`);
  }
}

export { app };
