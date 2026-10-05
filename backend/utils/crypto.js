const crypto = require('crypto');

// Derive a 32-byte (256-bit) encryption key from JWT_SECRET or fallback
const getEncryptionKey = () => {
    const secret = process.env.JWT_SECRET || 'crm_default_secure_vault_key_2026_x';
    return crypto.createHash('sha256').update(secret).digest();
};

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt plain text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string in format: iv:authTag:encryptedHex
 */
const encrypt = (text) => {
    if (!text) return '';
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(12); // 12 bytes recommended for GCM
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err) {
        console.error('[CRYPTO] Encryption error:', err.message);
        throw new Error('Failed to encrypt sensitive data');
    }
};

/**
 * Decrypt cipher text using AES-256-GCM
 * @param {string} cipherText - Encrypted string in format: iv:authTag:encryptedHex
 * @returns {string} - Decrypted plain text
 */
const decrypt = (cipherText) => {
    if (!cipherText) return '';
    
    // Fallback: If legacy unencrypted plain text exists in DB, return as is
    if (!cipherText.includes(':')) {
        return cipherText;
    }

    try {
        const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
        if (!ivHex || !authTagHex || !encryptedHex) {
            return cipherText;
        }

        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.warn('[CRYPTO] Decryption warning (may be plain text legacy):', err.message);
        return cipherText;
    }
};

module.exports = {
    encrypt,
    decrypt
};
