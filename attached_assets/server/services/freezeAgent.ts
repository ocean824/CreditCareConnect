import puppeteer from "puppeteer";

/**
 * Information needed to complete online credit freeze / opt‑out forms.
 * Only include the minimum necessary fields. Sensitive values (SSN/DOB) should
 * never be logged or persisted. The caller should supply them at runtime.
 */
export interface FreezeUserInfo {
  /** Given name of the consumer */
  firstName: string;
  /** Family name of the consumer */
  lastName: string;
  /** Primary residential street address */
  address: string;
  /** City portion of the address */
  city: string;
  /** Two‑letter state code */
  state: string;
  /** Five‑digit ZIP code */
  zip: string;
  /** Full nine‑digit SSN if requested (###‑##‑####) */
  ssn?: string;
  /** Date of birth in YYYY‑MM‑DD format */
  dob?: string;
  /** Contact phone number */
  phone?: string;
  /** Contact email address */
  email?: string;
}

/**
 * Launch a headless browser using Puppeteer. A shared helper to ensure the
 * browser closes when done. If your Replit environment requires specific
 * Chromium flags (e.g. to run in a container), adjust the launch options
 * accordingly. You may also configure `args` via env vars if needed.
 */
async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

/**
 * Freeze your LexisNexis consumer file via the online portal. The form
 * requires identifying information (name, address, SSN, date of birth). If
 * additional verification steps or CAPTCHAs are encountered, this helper will
 * throw and the caller should handle the error and possibly prompt the
 * consumer to complete the process manually. Selectors are based on the page
 * structure as of October 2025; they may change and should be updated
 * accordingly.
 */
export async function freezeLexisNexis(info: FreezeUserInfo): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('https://consumer.risk.lexisnexis.com/freeze#/freeze-self', { waitUntil: 'domcontentloaded' });
    // Example: fill out basic identity details. Adjust selectors as needed.
    await page.type('input[name="firstName"]', info.firstName);
    await page.type('input[name="lastName"]', info.lastName);
    await page.type('input[name="address1"]', info.address);
    await page.type('input[name="city"]', info.city);
    await page.select('select[name="state"]', info.state);
    await page.type('input[name="zip"]', info.zip);
    if (info.ssn) {
      // Assume form splits SSN into parts; adapt if necessary.
      const ssnDigits = info.ssn.replace(/\D/g, '');
      await page.type('input[name="ssn"]', ssnDigits);
    }
    if (info.dob) {
      await page.type('input[name="dob"]', info.dob);
    }
    if (info.phone) {
      await page.type('input[name="phone"]', info.phone);
    }
    if (info.email) {
      await page.type('input[name="email"]', info.email);
    }
    // Submit the form. Many freeze pages use a button with text like
    // "Continue" or "Submit"; adjust the selector accordingly.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await browser.close();
  }
}

/**
 * Request a copy of your LexisNexis consumer report. This opt‑out flow is
 * separate from the freeze. Basic identity information is required.
 */
export async function requestLexisNexisReport(info: FreezeUserInfo): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('https://consumer.risk.lexisnexis.com/request', { waitUntil: 'domcontentloaded' });
    // Fill out the form similarly to freeze
    await page.type('input[name="firstName"]', info.firstName);
    await page.type('input[name="lastName"]', info.lastName);
    await page.type('input[name="address1"]', info.address);
    await page.type('input[name="city"]', info.city);
    await page.select('select[name="state"]', info.state);
    await page.type('input[name="zip"]', info.zip);
    if (info.ssn) {
      const ssnDigits = info.ssn.replace(/\D/g, '');
      await page.type('input[name="ssn"]', ssnDigits);
    }
    if (info.dob) {
      await page.type('input[name="dob"]', info.dob);
    }
    if (info.phone) {
      await page.type('input[name="phone"]', info.phone);
    }
    if (info.email) {
      await page.type('input[name="email"]', info.email);
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await browser.close();
  }
}

/**
 * Submit an opt‑out request to Cotality for your consumer data. Cotality
 * (formerly iovation/SageStream) provides a privacy form under their privacy
 * policy. This helper navigates to the page and populates the required
 * fields. If the page URL changes, update the goto URL accordingly.
 */
export async function optOutCotality(info: FreezeUserInfo): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('https://www.cotality.com/legal/privacy-policy', { waitUntil: 'domcontentloaded' });
    // This page often contains a link or form for opt‑out. You may need to
    // click through to the request form. Replace selectors accordingly.
    // Example: click a link labelled "Submit a privacy request"
    const link = await page.$x("//a[contains(text(), 'privacy request')]");
    if (link.length > 0) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        link[0].click(),
      ]);
    }
    // Once on the form page, populate fields.
    await page.type('input[name="firstName"]', info.firstName);
    await page.type('input[name="lastName"]', info.lastName);
    await page.type('input[name="addressLine1"]', info.address);
    await page.type('input[name="city"]', info.city);
    await page.select('select[name="state"]', info.state);
    await page.type('input[name="zip"]', info.zip);
    if (info.email) {
      await page.type('input[name="email"]', info.email);
    }
    // Some forms require you to check an opt‑out reason; check the first
    // available checkbox or radio button.
    const checkbox = await page.$('input[type="checkbox"]');
    if (checkbox) {
      await checkbox.click();
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await browser.close();
  }
}

/**
 * Opt out of Innovis marketing and information sharing. The Innovis site
 * provides a simple opt‑out form for consumers. Supply the required
 * identity fields and submit.
 */
export async function optOutInnovis(info: FreezeUserInfo): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('https://www.innovis.com/personal/optOutOptIn', { waitUntil: 'domcontentloaded' });
    await page.type('input[name="firstName"]', info.firstName);
    await page.type('input[name="lastName"]', info.lastName);
    await page.type('input[name="street"]', info.address);
    await page.type('input[name="city"]', info.city);
    await page.select('select[name="state"]', info.state);
    await page.type('input[name="zip"]', info.zip);
    if (info.phone) {
      await page.type('input[name="phone"]', info.phone);
    }
    if (info.email) {
      await page.type('input[name="email"]', info.email);
    }
    // Select opt‑out radio button; adjust if site uses checkboxes
    const optOutRadio = await page.$('input[type="radio"][value="optout"]');
    if (optOutRadio) {
      await optOutRadio.click();
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await browser.close();
  }
}

/**
 * Opt out of prescreened credit and insurance offers at OptOutPrescreen.com.
 * This form requires basic identity details and allows either electronic or
 * mail confirmation. Here we select the electronic (online) opt‑out. A
 * confirmation email may be sent to finalize the request, so ensure a valid
 * email is provided.
 */
export async function optOutPrescreen(info: FreezeUserInfo): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('https://www.optoutprescreen.com/selection', { waitUntil: 'domcontentloaded' });
    // Choose the electronic opt out option
    const onlineRadio = await page.$('input[type="radio"][value="ELECTRONIC"]');
    if (onlineRadio) {
      await onlineRadio.click();
    }
    await page.click('button[type="submit"]');
    // Wait for personal info form
    await page.waitForSelector('input[name="firstName"]');
    await page.type('input[name="firstName"]', info.firstName);
    await page.type('input[name="lastName"]', info.lastName);
    await page.type('input[name="address"]', info.address);
    await page.type('input[name="city"]', info.city);
    await page.select('select[name="state"]', info.state);
    await page.type('input[name="zip"]', info.zip);
    if (info.ssn) {
      const ssnDigits = info.ssn.replace(/\D/g, '');
      await page.type('input[name="ssn"]', ssnDigits);
    }
    if (info.dob) {
      await page.type('input[name="dob"]', info.dob);
    }
    if (info.email) {
      await page.type('input[name="email"]', info.email);
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await browser.close();
  }
}

/**
 * Opt out of SageStream (now part of LexisNexis). The opt out page is
 * hosted at sagestreamllc.com. Provide the consumer information and
 * submit the form. As with other providers, there may be CAPTCHAs or
 * additional verification steps which cannot be bypassed programmatically.
 */
export async function optOutSageStream(info: FreezeUserInfo): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto('https://www.sagestreamllc.com/opt-out-opt-in/index.html', { waitUntil: 'domcontentloaded' });
    await page.type('input[name="firstName"]', info.firstName);
    await page.type('input[name="lastName"]', info.lastName);
    await page.type('input[name="address"]', info.address);
    await page.type('input[name="city"]', info.city);
    await page.select('select[name="state"]', info.state);
    await page.type('input[name="zip"]', info.zip);
    if (info.email) {
      await page.type('input[name="email"]', info.email);
    }
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await browser.close();
  }
}

/**
 * The master helper that orchestrates all freezes and opt‑outs for a given
 * consumer. It runs each provider flow sequentially. If any step throws
 * an error (for example due to a CAPTCHA), the error is propagated so the
 * caller can log it and possibly inform the consumer to complete that
 * provider manually. To run individual providers, call their helpers
 * directly.
 */
export async function runAllFreezes(info: FreezeUserInfo): Promise<void> {
  await freezeLexisNexis(info);
  await requestLexisNexisReport(info);
  await optOutCotality(info);
  await optOutInnovis(info);
  await optOutPrescreen(info);
  await optOutSageStream(info);
}