import 'dotenv/config';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { decrypt } from '../lib/utils/crypto';

async function main() {
    try {
        await connectDB();

        console.log('Checking connections...');
        const connections = await MetaConnectionModel.find({});

        if (connections.length === 0) {
            console.log('No connections found.');
            return;
        }

        for (const conn of connections) {
            console.log(`\nConnection ID: ${conn._id}`);
            console.log(`Tenant: ${conn.tenantId}`);
            console.log(`Ad Account: ${conn.adAccountId}`);
            console.log(`Encrypted Token Prefix: ${conn.accessToken.substring(0, 10)}...`);

            try {
                const decrypted = decrypt(conn.accessToken);
                console.log(`Decrypted Token: ${decrypted.substring(0, 15)}... (Length: ${decrypted.length})`);
                if (decrypted.includes('mock_')) {
                    console.log('✅ Token correctly identifies as MOCK');
                } else {
                    console.log('❌ Token DOES NOT look like a mock token');
                }
            } catch (e: any) {
                console.log('❌ Failed to decrypt token:', e.message);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        await disconnectDB();
    }
}

main();
