/**
 * Frontend XSS Sanitization Utility
 * Uses DOMPurify for client-side protection
 */

import DOMPurify from 'dompurify';

/**
 * Decode HTML entities
 * @param {string} text - Text that may contain HTML entities
 * @returns {string} - Text with decoded entities
 */
const decodeHtmlEntities = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

/**
 * Sanitize text content - removes all HTML and returns plain text
 * Also decodes HTML entities to display them properly
 * @param {string} text - Raw text that may contain HTML
 * @returns {string} - Plain text with HTML stripped and entities decoded
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // First decode any HTML entities (like &#x27; or &amp;)
  const decoded = decodeHtmlEntities(text);
  
  // Then configure DOMPurify to strip all HTML tags (plaintext mode)
  const clean = DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep the text content
  });
  
  return clean.trim();
};

/**
 * Sanitize username - stricter filtering
 * @param {string} username - Raw username
 * @returns {string} - Sanitized username
 */
export const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return '';
  }
  
  // First sanitize as text
  let clean = sanitizeText(username);
  
  // Only allow alphanumeric, spaces, hyphens, underscores, and accented characters
  clean = clean.replace(/[^a-zA-Z0-9\s\-_àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g, '');
  
  // Collapse multiple spaces
  clean = clean.replace(/\s+/g, ' ');
  
  return clean.trim();
};

/**
 * Sanitize for safe display in React components
 * Use this when you need to display user content in JSX
 * @param {string} text - User-generated content
 * @returns {string} - Sanitized text safe for display
 */
export const sanitizeForDisplay = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Decode HTML entities first
  const decoded = decodeHtmlEntities(text);
  
  // Remove all HTML tags and dangerous content
  const clean = DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS: [], // Plaintext only
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  return clean;
};

/**
 * Sanitize an array of strings
 * @param {Array<string>} items - Array of strings to sanitize
 * @returns {Array<string>} - Array of sanitized strings
 */
export const sanitizeArray = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.map(item => sanitizeText(item));
};

/**
 * Sanitize an object with multiple text fields
 * @param {Object} obj - Object with text fields
 * @param {Array<string>} fields - Array of field names to sanitize
 * @returns {Object} - Object with sanitized fields
 */
export const sanitizeObject = (obj, fields) => {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  
  const sanitized = { ...obj };
  
  fields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  });
  
  return sanitized;
};

/**
 * Escape HTML entities for safe rendering
 * Alternative approach when you can't use DOMPurify
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * React component wrapper for safe text rendering
 * Returns a sanitized string that's safe to render in JSX
 * @param {string} text - Text to render
 * @returns {string} - Sanitized text
 */
export const SafeText = (text) => {
  return sanitizeForDisplay(text);
};

export default {
  sanitizeText,
  sanitizeUsername,
  sanitizeForDisplay,
  sanitizeArray,
  sanitizeObject,
  escapeHtml,
  SafeText
};
