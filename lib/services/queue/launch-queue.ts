
import { redis } from '../../db/redis';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface LaunchJobData {
    // Session Data
    sessionId: string;

    // Auth Data
    tenantId: string;
    adAccountId: string;
    accessToken: string; // Encrypted? Or pass raw in memory? Better to re-fetch in worker for security.
    // Actually, pass IDs and let worker fetch tokens.
    // Campaign Data
    pageId: string;
    name: string;
    headline: string;
    primaryText: string;
    description?: string;
    cta: string;
    linkUrl: string;

    // Targeting & Budget
    dailyBudget: number;
    duration: number;
    targeting: {
        geoLocations?: { countries?: string[] };
        ageMin?: number;
        ageMax?: number;
        genders?: number[];
        interests?: string[];
        [key: string]: unknown;
    };

    // Creative Data
    videoUrl?: string; // If video ad
    imageUrl?: string; // If image ad
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface LaunchJobResult {
    campaignId?: string;
    adSetId?: string;
    adId?: string;
    success: boolean;
    message?: string;
}

export interface LaunchJob {
    id: string;
    data: LaunchJobData;
    status: JobStatus;
    result?: LaunchJobResult;
    error?: string;
    createdAt: number;
    updatedAt: number;
}

const QUEUE_KEY = 'queue:launch:pending';
const JOB_PREFIX = 'job:launch:';
const JOB_TTL = 60 * 60 * 24; // Keep jobs for 24 hours

export class LaunchQueue {

    /**
     * Enqueue a new launch job
     */
    static async addJob(data: LaunchJobData): Promise<string> {
        const jobId = uuidv4();
        const job: LaunchJob = {
            id: jobId,
            data,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // 1. Save Job Data
        await redis.setex(`${JOB_PREFIX}${jobId}`, JOB_TTL, JSON.stringify(job));

        // 2. Add to Pending Queue
        await redis.lpush(QUEUE_KEY, jobId);

        logger.info(`Job enqueued: ${jobId}`, { tenantId: data.tenantId, type: data.videoUrl ? 'video' : 'image' });

        return jobId;
    }

    /**
     * Get Job Status
     */
    static async getJob(jobId: string): Promise<LaunchJob | null> {
        const data = await redis.get(`${JOB_PREFIX}${jobId}`);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Update Job Status (Internal)
     */
    static async updateJob(jobId: string, updates: Partial<LaunchJob>) {
        const job = await this.getJob(jobId);
        if (!job) return;

        const updatedJob = { ...job, ...updates, updatedAt: Date.now() };
        await redis.setex(`${JOB_PREFIX}${jobId}`, JOB_TTL, JSON.stringify(updatedJob));
        return updatedJob;
    }

    /**
     * Worker Function (To be called by the Worker Process)
     * Reads one job, processes it using the processor function, and loops.
     */
    static async processNextJob(processor: (job: LaunchJob) => Promise<any>): Promise<boolean> {
        // Block for 2 seconds waiting for a job
        // Note: checking existing redis client if it supports blocking pop correctly.
        // ioredis supports 'brpop'.

        // Use RPOP (Right Pop) because we did LPUSH (Left Push) -> FIFO Queue
        // For non-blocking test:
        const jobId = await redis.rpop(QUEUE_KEY);

        if (!jobId) return false; // No jobs

        logger.info(`Worker picked up job: ${jobId}`);

        try {
            await this.updateJob(jobId, { status: 'processing' });

            // Get full job data
            const job = await this.getJob(jobId);
            if (!job) throw new Error('Job data missing');

            // RUN PROCESSOR
            const result = await processor(job);

            await this.updateJob(jobId, {
                status: 'completed',
                result
            });
            logger.info(`Job completed: ${jobId}`);

        } catch (error: any) {
            logger.error(`Job failed: ${jobId}`, { error });
            await this.updateJob(jobId, {
                status: 'failed',
                error: error.message
            });
        }

        return true;
    }
}
