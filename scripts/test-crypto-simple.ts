import dotenv from 'dotenv';
import { encrypt, decrypt } from '../lib/utils/crypto';

dotenv.config();

const testToken = 'EAAIst1o3BZBABQG2ZBs6hIcSi0s1sVILJRBVAA8PsKfh1LCuWwNkevSVbmgun4YziX5q1qnpT2cbwrT8WZBopaAwzqYu7jqisU3RgHfGFXBU9qTIoGOuD2mTR9DMpiXpYHnBKt3sTZCRowEb4dhsZBQ8yDZAv4YOqZAkRSKDv5h59ZBqcRUQXYk7zI9xTm662xU5q4WKUvB3mg7dYfUgIpABL1DhkhyWhQuTNO9I';

console.log('Testing encryption/decryption...');
console.log('Original token length:', testToken.length);
console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY);
console.log('ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY?.length);

try {
    const encrypted = encrypt(testToken);
    console.log('✅ Encryption successful');
    console.log('Encrypted:', encrypted.substring(0, 50) + '...');

    const decrypted = decrypt(encrypted);
    console.log('✅ Decryption successful');
    console.log('Match:', decrypted === testToken);
} catch (error) {
    console.error('❌ Error:', error);
}
