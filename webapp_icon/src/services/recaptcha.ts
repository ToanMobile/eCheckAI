/**
 * Google reCAPTCHA v3 service
 * Loads the script dynamically and provides token generation
 */

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

let loadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

/**
 * Load the reCAPTCHA v3 script (once)
 */
function loadScript(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Get a reCAPTCHA v3 token for the given action
 * @param action - Action name (e.g. 'ocr_extract', 'ocr_bulk')
 * @returns token string to send in x-recaptcha-token header
 */
export async function getRecaptchaToken(action: string): Promise<string> {
  if (!SITE_KEY) {
    console.warn('VITE_RECAPTCHA_SITE_KEY not configured, skipping reCAPTCHA');
    return '';
  }

  await loadScript();

  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(SITE_KEY, { action })
        .then(resolve)
        .catch(reject);
    });
  });
}
