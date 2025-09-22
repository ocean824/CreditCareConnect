interface Click2MailLetter {
  addressFrom: {
    name: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
  };
  addressTo: {
    name: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
  };
  document: string; // Base64 encoded PDF
}

export class Click2MailService {
  private apiKey: string;
  private baseUrl = "https://rest.click2mail.com/molpro/restservice.svc";

  constructor() {
    this.apiKey = process.env.CLICK2MAIL_API_KEY || process.env.CLICK2MAIL_KEY || "";
    if (!this.apiKey) {
      console.warn("Click2Mail API key not configured");
    }
  }

  async sendLetter(letter: Click2MailLetter): Promise<{
    jobId: string;
    trackingNumber: string;
    status: string;
  }> {
    if (!this.apiKey) {
      throw new Error("Click2Mail API key not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          ...letter,
          productionMode: process.env.NODE_ENV === "production",
          mailClass: "FIRST_CLASS",
          color: "FULL_COLOR",
          envelope: "WHITE_STANDARD",
          pages: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Click2Mail API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        jobId: result.jobId,
        trackingNumber: result.trackingNumber,
        status: result.status,
      };
    } catch (error: any) {
      console.error("Error sending letter via Click2Mail:", error);
      throw new Error("Failed to send letter: " + (error?.message || "Unknown error"));
    }
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    trackingNumber?: string;
    deliveryDate?: string;
  }> {
    if (!this.apiKey) {
      throw new Error("Click2Mail API key not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Click2Mail API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        status: result.status,
        trackingNumber: result.trackingNumber,
        deliveryDate: result.deliveryDate,
      };
    } catch (error: any) {
      console.error("Error getting job status from Click2Mail:", error);
      throw new Error("Failed to get job status: " + (error?.message || "Unknown error"));
    }
  }
}

export const click2mailService = new Click2MailService();
