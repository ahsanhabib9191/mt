import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { decrypt } from '../lib/utils/crypto';

dotenv.config();

async function main() {
    try {
        await connectDB();

        const connection = await MetaConnectionModel.findOne({ adAccountId: 'act_177712960' }).exec();

        if (!connection) {
            console.log('❌ No connection found');
            return;
        }

        console.log('✅ Connection found');
        console.log('ID:', connection._id);
        console.log('Ad Account:', connection.adAccountId);
        console.log('Status:', connection.status);
        console.log('Encrypted token (first 50 chars):', connection.accessToken.substring(0, 50));
        console.log('Encrypted token length:', connection.accessToken.length);

        try {
            const decrypted = decrypt(connection.accessToken);
            console.log('✅ Decryption successful');
            console.log('Decrypted token (first 50 chars):', decrypted.substring(0, 50));
        } catch (error) {
            console.error('❌ Decryption failed:', error);
        }

        try {
            const methodResult = connection.getAccessToken();
            console.log('✅ Method call successful');
            console.log('Method result (first 50 chars):', methodResult.substring(0, 50));
        } catch (error) {
            console.error('❌ Method call failed:', error);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await disconnectDB();
    }
}

main();
