export const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "noreply@example.com",
    pass: process.env.SMTP_PASS || "password"
  }
};