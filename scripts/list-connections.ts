
import 'dotenv/config';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';

async function main() {
    try {
        await connectDB();
        const connections = await MetaConnectionModel.find({});
        console.log(`Found ${connections.length} connections.`);
        connections.forEach(c => {
            console.log(`- ID: ${c._id}, Account: ${c.adAccountId}, Status: '${c.status}', Tenant: ${c.tenantId}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await disconnectDB();
    }
}
main();
