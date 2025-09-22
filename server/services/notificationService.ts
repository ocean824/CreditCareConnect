export interface NotificationData {
  userId: string;
  type: "EMAIL" | "SMS";
  subject?: string;
  message: string;
}

export class NotificationService {
  private gmailApiKey: string;
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioPhone: string;

  constructor() {
    this.gmailApiKey = process.env.GMAIL_API_KEY || process.env.GMAIL_KEY || "";
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.twilioPhone = process.env.TWILIO_PHONE_NUMBER || "";
  }

  async sendEmail(
    to: string,
    subject: string,
    message: string,
    isHtml: boolean = false
  ): Promise<boolean> {
    try {
      // Simplified email sending - in production, use Gmail API or SMTP
      console.log(`Sending email to ${to}: ${subject}`);
      console.log(`Message: ${message}`);
      
      // Here you would implement actual email sending via:
      // - Gmail API
      // - SMTP with nodemailer
      // - SendGrid, Mailgun, etc.
      
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.twilioAccountSid || !this.twilioAuthToken || !this.twilioPhone) {
      console.warn("Twilio credentials not configured");
      return false;
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: this.twilioPhone,
            To: to,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`SMS sent successfully: ${result.sid}`);
      return true;
    } catch (error) {
      console.error("Error sending SMS:", error);
      return false;
    }
  }

  async sendDisputeReminder(
    userEmail: string,
    userPhone: string | null,
    bureau: string,
    responseDeadline: Date
  ): Promise<void> {
    const daysUntilDeadline = Math.ceil(
      (responseDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const subject = `Credit Dispute Update - ${bureau} Response Due Soon`;
    const message = `Your ${bureau} dispute response is due in ${daysUntilDeadline} days (${responseDeadline.toDateString()}). Check your mail and update your dispute status in Personal Credit Pros.`;

    // Send email
    await this.sendEmail(userEmail, subject, message);

    // Send SMS if phone number available
    if (userPhone) {
      await this.sendSMS(userPhone, message);
    }
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    const subject = "Welcome to Personal Credit Pros!";
    const message = `
    Hi ${userName},
    
    Welcome to Personal Credit Pros! We're excited to help you on your credit repair journey.
    
    Here's what you can do next:
    1. Upload your credit reports for AI analysis
    2. Review detected violations and generate dispute letters
    3. Download your letters and mail them to credit bureaus
    
    Need help? Our AI assistant is available 24/7 to guide you through the process.
    
    Best regards,
    Personal Credit Pros Team
    `;

    await this.sendEmail(userEmail, subject, message);
  }

  async sendUpgradeConfirmation(userEmail: string, userName: string): Promise<void> {
    const subject = "Done-For-You Plan Activated!";
    const message = `
    Hi ${userName},
    
    Congratulations! Your Done-For-You plan is now active.
    
    New features now available:
    ✓ Automated letter mailing via Click2Mail
    ✓ CRM integration and tracking
    ✓ SMS and email notifications
    ✓ Priority AI assistant support
    
    Your letters will now be automatically mailed with certified delivery tracking.
    
    Best regards,
    Personal Credit Pros Team
    `;

    await this.sendEmail(userEmail, subject, message);
  }
}

export const notificationService = new NotificationService();
