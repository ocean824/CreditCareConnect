import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "./db";
import { adminCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PgSession = ConnectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    adminUsername?: string;
  }
}

export function getAdminSession() {
  return session({
    name: "admin_session",
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET || "admin-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  });
}

const adminAuthRouter = Router();

adminAuthRouter.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const [admin] = await db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.username, username));

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Internal server error" });
        }

        res.json({ 
          success: true,
          username: admin.username
        });
      });
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

adminAuthRouter.post("/api/admin/logout", (req, res) => {
  req.session.adminId = undefined;
  req.session.adminUsername = undefined;
  
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

adminAuthRouter.get("/api/admin/check", (req, res) => {
  if (req.session.adminId) {
    res.json({ 
      authenticated: true,
      username: req.session.adminUsername
    });
  } else {
    res.json({ authenticated: false });
  }
});

export function requireAdminAuth(req: any, res: any, next: any) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: "Admin authentication required" });
  }
  next();
}

export default adminAuthRouter;
