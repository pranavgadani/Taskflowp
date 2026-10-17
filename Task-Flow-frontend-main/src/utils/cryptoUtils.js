/**
 * Simple Encryption Utility for the Digital HUD
 * Uses a basic XOR + Base64 approach for demonstration purposes in the HUD environment.
 * In a production environment, use Web Crypto API (SubtleCrypto) for AES-GCM.
 */

const SECRET_KEY = "ANTIGRAVITY_ENCRYPTION_KEY_2026";

/**
 * Encrypts a string using a simple XOR + Base64 transformation
 * @param {string} text - The raw content to encrypt
 * @returns {string} - The encrypted string
 */
export const encryptContent = (text) => {
    if (!text) return "";
    try {
        let result = "";
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
        }
        return btoa(unescape(encodeURIComponent(result)));
    } catch (e) {
        console.error("Encryption failed:", e);
        return text;
    }
};

/**
 * Decrypts a string previously encrypted by encryptContent
 * @param {string} encoded - The encrypted string
 * @returns {string} - The decrypted raw content
 */
export const decryptContent = (encoded) => {
    if (!encoded) return "";
    try {
        // Check if it's actually encrypted (heuristic: check if it looks like base64 and fails simple text check)
        const text = decodeURIComponent(escape(atob(encoded)));
        let result = "";
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
        }
        return result;
    } catch (e) {
        // If decryption fails, it might be raw text (backwards compatibility)
        return encoded;
    }
};

/**
 * Helper to process the entire document content (array of pages or single string)
 */
export const encryptDocument = (content) => {
    if (Array.isArray(content)) {
        return content.map(p => ({ ...p, content: encryptContent(p.content) }));
    }
    return encryptContent(content);
};

export const decryptDocument = (content) => {
    if (Array.isArray(content)) {
        return content.map(p => ({ ...p, content: decryptContent(p.content) }));
    }
    return decryptContent(content);
};
