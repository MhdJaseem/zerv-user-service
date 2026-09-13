import { customAlphabet } from 'nanoid';
import * as crypto from 'crypto';

/**
 * Creates a custom nanoid generator with alphanumeric characters
 * @returns A function that generates a 10-character unique ID
 */
export const generateNanoid =
    customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 16);

/**
 * Generates a unique ID using nanoid
 * @returns A 10-character unique ID
 */
export const generateUniqueId = (): string => {
    return generateNanoid();
};

export const generateOtp = (length = 6): string => {
    return Math.floor(Math.random() * Math.pow(10, length))
        .toString()
        .padStart(length, '0');
}


export const generateSecretHash = (
    username: string,
    clientId: string,
    clientSecret: string,
): string => {
    return crypto
        .createHmac('sha256', clientSecret)
        .update(username + clientId)
        .digest('base64');
}