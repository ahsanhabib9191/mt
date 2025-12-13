
import 'dotenv/config';
import { connectDB } from '../lib/db/client';
import { connectRedis } from '../lib/db/redis';
import { LaunchQueue, LaunchJobData } from '../lib/services/queue/launch-queue';
import { v4 as uuidv4 } from 'uuid';
import logger from '../lib/utils/logger';

async function verifyUnifiedLaunch() {
    console.log('🧪 Starting Unified Launch Test...');

    // 1. Connect
    try {
        await connectDB();
        await connectRedis();
    } catch (e) {
        console.error('❌ Infra Down: Cannot connect to Mongo/Redis. Is Docker running?');
        process.exit(1);
    }

    // 2. Mock Frontend Data (As sent by Boost.tsx)
    const mockSessionId = uuidv4();
    const jobData: LaunchJobData = {
        sessionId: mockSessionId,
        tenantId: 'test_tenant_123',
        adAccountId: 'act_123456789', // Replace with Real ID if testing live
        accessToken: 'dummy_token',    // Replace with Real Token if testing live
        pageId: '123456789',
        name: 'Unified Pipeline Test',
        headline: 'Test Headline',
        primaryText: 'Test Primary Text',
        description: 'Test Description',
        cta: 'LEARN_MORE',
        linkUrl: 'https://example.com',
        dailyBudget: 20, // $20
        duration: 7,
        targeting: { geo_locations: { countries: ['US'] } },
        imageUrl: 'https://placeholder.com/image.jpg'
    };

    // 3. Enqueue Job
    console.log(`📤 Enqueuing Job: ${mockSessionId}`);
    const jobId = await LaunchQueue.addJob(jobData);
    console.log(`✅ Job ID: ${jobId}`);

    // 4. Poll for Completion (Mimicking Polling Shim)
    console.log('⏳ Waiting for Worker to pickup...');

    const start = Date.now();
    while (Date.now() - start < 60000) { // 60s timeout
        const job = await LaunchQueue.getJob(jobId);
        if (!job) {
            console.log('... Job vanished?');
            break;
        }

        // Visualize Status
        process.stdout.write(`Status: ${job.status}\r`);

        if (job.status === 'completed') {
            console.log(`\n✅ JOB COMPLETED!`);
            console.log('Result:', job.result);
            process.exit(0);
        }

        if (job.status === 'failed') {
            console.log(`\n❌ JOB FAILED`);
            console.error('Error:', job.error);
            process.exit(1);
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n❌ Timeout waiting for job');
    process.exit(1);
}

verifyUnifiedLaunch();
