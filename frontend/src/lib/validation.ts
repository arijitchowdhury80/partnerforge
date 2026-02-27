/**
 * Input Validation Utilities
 *
 * Security validation functions for user inputs.
 * Created as part of security remediation (MEDIUM-3, MEDIUM-11).
 */

// =============================================================================
// Domain Validation (MEDIUM-3)
// =============================================================================

/**
 * Strict domain validation regex
 * Allows: lowercase alphanumeric, hyphens (not at start/end), dots between labels
 * Min 2 labels (e.g., example.com), max 253 chars total
 */
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validate a domain name
 * @param domain - The domain to validate
 * @returns true if valid domain format
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > 253) return false;

  // Normalize and test
  const normalized = domain.toLowerCase().trim();
  return DOMAIN_REGEX.test(normalized);
}

/**
 * Sanitize a domain name
 * - Removes protocol (http://, https://)
 * - Removes www. prefix
 * - Removes trailing slashes and paths
 * - Lowercases
 * - Trims whitespace
 *
 * @param domain - Raw domain input
 * @returns Sanitized domain
 */
export function sanitizeDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') return '';

  return domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?/, '')  // Remove protocol
    .replace(/^www\./, '')            // Remove www.
    .replace(/\/.*$/, '')             // Remove path
    .replace(/[?#].*$/, '');          // Remove query/hash
}

/**
 * Validate and sanitize a domain
 * @param domain - Raw domain input
 * @returns Sanitized domain if valid, null otherwise
 */
export function validateAndSanitizeDomain(domain: string): string | null {
  const sanitized = sanitizeDomain(domain);
  return isValidDomain(sanitized) ? sanitized : null;
}

// =============================================================================
// URL Validation (MEDIUM-11)
// =============================================================================

/**
 * Dangerous URL schemes that should never be rendered
 */
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:'];

/**
 * Check if a URL is safe to render as a link
 * Blocks javascript:, data:, file:, vbscript: schemes
 *
 * @param url - The URL to validate
 * @returns true if safe to render
 */
export function isValidExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Double-check for dangerous schemes (in case of parsing tricks)
    const lower = url.toLowerCase().trim();
    if (DANGEROUS_SCHEMES.some(scheme => lower.startsWith(scheme))) {
      return false;
    }

    return true;
  } catch {
    // Invalid URL format - check if it's a relative URL or bare domain
    // Bare domains like "example.com" are OK (we'll prepend https://)
    if (isValidDomain(url)) {
      return true;
    }
    // Relative URLs starting with / are OK within the same site
    if (url.startsWith('/') && !url.startsWith('//')) {
      return true;
    }
    return false;
  }
}

/**
 * Sanitize a URL for safe rendering
 * - Returns null for dangerous schemes
 * - Adds https:// to bare domains
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL or null if unsafe
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Check for dangerous schemes
  const lower = trimmed.toLowerCase();
  if (DANGEROUS_SCHEMES.some(scheme => lower.startsWith(scheme))) {
    return null;
  }

  // If it's a bare domain, prepend https://
  if (isValidDomain(trimmed)) {
    return `https://${trimmed}`;
  }

  // Validate as URL
  if (isValidExternalUrl(trimmed)) {
    return trimmed;
  }

  return null;
}

// =============================================================================
// Text Validation
// =============================================================================

/**
 * Sanitize text input for display
 * - Removes leading/trailing whitespace
 * - Limits length
 * - Does NOT strip HTML (use proper escaping in React)
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized text
 */
export function sanitizeText(text: string, maxLength = 10000): string {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, maxLength);
}

/**
 * Check if a string looks like a potential injection attempt
 * (SQL, XSS, command injection patterns)
 * Used for logging/alerting, not blocking
 *
 * @param input - The input to check
 * @returns true if suspicious patterns found
 */
export function hasSuspiciousPatterns(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const suspiciousPatterns = [
    /<script/i,                  // XSS
    /javascript:/i,              // XSS
    /on\w+\s*=/i,               // XSS event handlers
    /['";]\s*(OR|AND)\s*['";]/i, // SQL injection
    /--\s*$/,                    // SQL comment
    /;\s*(DROP|DELETE|UPDATE|INSERT)/i, // SQL injection
    /\$\{.*\}/,                  // Template injection
    /\{\{.*\}\}/,                // Template injection
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}
