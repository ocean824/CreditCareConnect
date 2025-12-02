import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "./db";
import { userCredentials, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PgSession = ConnectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
  }
}

export function getUserSession() {
  const isProduction = process.env.NODE_ENV === "production";
  
  // Log session configuration for debugging
  console.log(`📝 Session config: NODE_ENV=${process.env.NODE_ENV}, isProduction=${isProduction}`);
  
  return session({
    name: "connect.sid",
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: true, // Auto-create table if missing
    }),
    secret: process.env.SESSION_SECRET || "user-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // Requires HTTPS in production
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: isProduction ? "none" : "lax", // 'none' allows cross-site requests with secure cookies
      path: "/",
    },
    proxy: true, // Always trust proxy for proper HTTPS detection behind load balancers
  });
}

const userAuthRouter = Router();

userAuthRouter.post("/api/user/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, plan } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let subscriptionStatus = "inactive";
    let userPlan = plan || "DIY";
    let userRole = "user";

    if (email.toLowerCase() === "jarred@anunlimitedllc.com") {
      subscriptionStatus = "active";
      userPlan = "ENTERPRISE";
      userRole = "admin";
    }

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        plan: userPlan,
        role: userRole,
        subscriptionStatus,
        subscriptionExpiresAt: subscriptionStatus === "active" ? null : null,
      })
      .returning();

    await db.insert(userCredentials).values({
      userId: newUser.id,
      passwordHash: hashedPassword,
    });

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({ message: "Registration successful but login failed" });
      }

      req.session.userId = newUser.id;
      req.session.userEmail = newUser.email;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Registration successful but login failed" });
        }

        res.json({
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            plan: newUser.plan,
            subscriptionStatus: newUser.subscriptionStatus,
          },
        });
      });
    });
  } catch (error) {
    console.error("User registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

userAuthRouter.post("/api/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const [credentials] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, user.id));

    if (!credentials) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, credentials.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({ message: "Login failed" });
      }

      req.session.userId = user.id;
      req.session.userEmail = user.email;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            plan: user.plan,
            subscriptionStatus: user.subscriptionStatus,
            role: user.role,
          },
        });
      });
    });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

userAuthRouter.post("/api/user/logout", (req, res) => {
  req.session.userId = undefined;
  req.session.userEmail = undefined;

  req.session.save((err) => {
    if (err) {
      console.error("Session save error on logout:", err);
      return res.status(500).json({ message: "Logout failed" });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error on logout:", err);
      }
      res.json({ success: true });
    });
  });
});

userAuthRouter.get("/api/user/check", (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      userEmail: req.session.userEmail,
    });
  } else {
    res.json({ authenticated: false });
  }
});

export function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ 
      code: "AUTH_ERROR",
      message: "Not authenticated" 
    });
  }
  next();
}

export async function requireActiveSubscription(req: any, res: any, next: any) {
  console.log(`🔐 [requireActiveSubscription] Request to ${req.method} ${req.path}`);
  console.log(`   Session userId: ${req.session?.userId || 'NONE'}`);
  
  // Validate that the user is logged in
  if (!req.session?.userId) {
    console.log(`   ❌ Not authenticated - no session userId`);
    return res.status(401).json({
      code: "AUTH_ERROR",
      message: "Not authenticated",
    });
  }

  // Always fetch the latest user record from the database rather than trusting the session
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.session.userId));

  if (!user) {
    return res.status(401).json({
      code: "AUTH_ERROR",
      message: "User not found",
    });
  }

  // Parse the admin email whitelist from the environment
  const adminEmailWhitelistEnv = process.env.ADMIN_EMAILS || "";
  const adminEmailWhitelist = adminEmailWhitelistEnv
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  const requestEmail = (user.email || "").toLowerCase();
  const isWhitelistedAdminEmail =
    adminEmailWhitelist.includes(requestEmail) ||
    requestEmail === "jarred@anunlimitedllc.com";

  // If the user is an admin or their email is whitelisted, bypass subscription checks entirely
  console.log(`   User role: ${user.role}, isWhitelisted: ${isWhitelistedAdminEmail}`);
  if (user.role === "admin" || isWhitelistedAdminEmail) {
    console.log(`   ✅ Admin/whitelisted user - bypassing subscription check`);
    // Ensure their plan and subscriptionStatus fields reflect full enterprise access
    if (user.plan !== "ENTERPRISE" || user.subscriptionStatus !== "active") {
      try {
        await db
          .update(users)
          .set({
            plan: "ENTERPRISE",
            subscriptionStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        console.log(`   ✅ Auto-upgraded admin user ${user.email} to ENTERPRISE plan`);
      } catch (err) {
        console.error("   Failed to enforce admin ENTERPRISE plan:", err);
        // Even if updating fails, still allow the request through
      }
    }

    // Mark the request for debugging/testing purposes (optional)
    (req as any).isAdminBypass = true;
    return next();
  }

  // For non-admin users, require an active subscription (case-insensitive check)
  const status = (user.subscriptionStatus || "").toLowerCase();
  if (status !== "active") {
    console.warn("Blocking request due to inactive subscription:", {
      userId: user.id,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus,
    });
    return res.status(403).json({
      code: "SUBSCRIPTION_REQUIRED",
      message: "Active subscription required",
    });
  }

  // If checks pass, continue to the next middleware or route handler
  next();
}

export default userAuthRouter;
