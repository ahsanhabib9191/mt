import { IStorage } from "./storage";
import {
    Tenant, Campaign, AdSet, Ad, PerformanceSnapshot, OptimizationLog, MetaConnection,
    InsertTenant, InsertCampaign, InsertAdSet, InsertAd
} from "../shared/schema";
import { TenantModel, ITenant } from "../lib/db/models/Tenant";
import { CampaignModel, ICampaign } from "../lib/db/models/campaign";
import { AdSetModel, IAdSet } from "../lib/db/models/ad-set";
import { AdModel, IAd } from "../lib/db/models/ad";
import { PerformanceSnapshotModel } from "../lib/db/models/performance-snapshot";
import { OptimizationLogModel } from "../lib/db/models/optimization-log";
import { MetaConnectionModel } from "../lib/db/models/MetaConnection";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

// Helper to convert Mongoose document to shared Schema interface
function mapTenant(doc: any): Tenant {
    return {
        id: 0, // Placeholder, Mongo uses _id
        // @ts-ignore
        _id: doc._id?.toString(),
        name: doc.name,
        email: doc.primaryDomain || doc.tenantId, // Using primaryDomain/tenantId as fallback for email
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

function mapCampaign(doc: any): Campaign {
    return {
        id: 0,
        campaignId: doc.campaignId,
        accountId: doc.accountId,
        tenantId: doc.tenantId ? parseInt(doc.tenantId) || 0 : 0,
        name: doc.name,
        status: doc.status,
        effectiveStatus: doc.status,
        objective: doc.objective,
        buyingType: 'AUCTION',
        dailyBudget: doc.budget ? String(doc.budget) : null,
        lifetimeBudget: null,
        spendCap: null,
        startTime: doc.startDate,
        stopTime: doc.endDate,
        createdTime: doc.createdAt,
        updatedTime: doc.updatedAt,
        specialAdCategories: [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

function mapAdSet(doc: any): AdSet {
    return {
        id: 0,
        adSetId: doc.adSetId,
        campaignId: doc.campaignId?.campaignId || 'unknown', // Populated or raw
        accountId: doc.accountId,
        tenantId: doc.tenantId ? parseInt(doc.tenantId) || 0 : 0,
        name: doc.name,
        status: doc.status,
        effectiveStatus: doc.status,
        optimizationGoal: doc.optimizationGoal,
        billingEvent: 'IMPRESSIONS',
        bidAmount: null,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        budget: String(doc.budget),
        dailyBudget: String(doc.budget),
        lifetimeBudget: null,
        learningPhaseStatus: doc.learningPhaseStatus,
        optimizationEventsCount: doc.optimizationEventsCount || 0,
        ageDays: doc.ageDays || 0,
        targeting: doc.targeting,
        startTime: doc.startDate,
        endTime: doc.endDate,
        createdTime: doc.createdAt,
        updatedTime: doc.updatedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

function mapAd(doc: any): Ad {
    // Handle populated or raw references
    const campaignId = doc.campaignId?.campaignId || 'unknown';
    const adSetId = doc.adSetId?.adSetId || 'unknown';

    return {
        id: 0,
        adId: doc.adId,
        adSetId: adSetId,
        campaignId: campaignId,
        accountId: doc.accountId,
        tenantId: doc.tenantId ? parseInt(doc.tenantId) || 0 : 0,
        name: doc.name,
        status: doc.status,
        effectiveStatus: doc.effectiveStatus,
        creativeId: doc.creative?.creativeId,
        creativeTitle: doc.creative?.headline,
        creativeBody: doc.creative?.body,
        creativeThumbnailUrl: doc.creative?.metadata?.thumbnailUrl || null,
        creativeCallToAction: doc.creative?.callToAction,
        trackingSpecs: null,
        createdTime: doc.createdAt,
        updatedTime: doc.updatedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

function mapMetaConnection(doc: any): MetaConnection {
    return {
        id: 0,
        // @ts-ignore
        _id: doc._id?.toString(),
        tenantId: parseInt(doc.tenantId) || 0,
        adAccountId: doc.adAccountId,
        accessToken: doc.accessToken,
        refreshToken: doc.refreshToken || null,
        tokenExpiresAt: doc.tokenExpiresAt || null,
        permissions: doc.permissions,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

export class MongoStorage implements IStorage {
    async getTenant(id: number): Promise<Tenant | undefined> {
        // Attempt to look up by numeric ID if stored as tenantId string
        const tenant = await TenantModel.findOne({ tenantId: String(id) });
        return tenant ? mapTenant(tenant) : undefined;
    }

    async getTenantByEmail(email: string): Promise<Tenant | undefined> {
        // TenantModel stores primaryDomain, we can treat email as such for this adapter
        const tenant = await TenantModel.findOne({
            $or: [{ primaryDomain: email }, { tenantId: email }]
        });
        return tenant ? mapTenant(tenant) : undefined;
    }

    async createTenant(data: InsertTenant): Promise<Tenant> {
        const tenantId = data.email; // Use email as ID for simplicity
        const tenant = await TenantModel.create({
            tenantId: tenantId,
            name: data.name,
            plan: 'FREE',
            primaryDomain: data.email
        });
        return mapTenant(tenant);
    }

    async getCampaigns(accountId: string, limit = 50, offset = 0): Promise<Campaign[]> {
        const campaigns = await CampaignModel.find({ accountId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);
        return campaigns.map(mapCampaign);
    }

    async getCampaign(campaignId: string): Promise<Campaign | undefined> {
        const campaign = await CampaignModel.findOne({ campaignId });
        return campaign ? mapCampaign(campaign) : undefined;
    }

    async createCampaign(data: InsertCampaign): Promise<Campaign> {
        const campaign = await CampaignModel.create({
            campaignId: data.campaignId,
            accountId: data.accountId,
            tenantId: String(data.tenantId || '0'),
            name: data.name,
            objective: data.objective || 'OUTCOME_TRAFFIC',
            status: data.status || 'ACTIVE',
            budget: Number(data.dailyBudget || 0),
            startDate: data.startTime || new Date(),
            endDate: data.stopTime
        });
        return mapCampaign(campaign);
    }

    async updateCampaign(campaignId: string, data: Partial<Campaign>): Promise<Campaign | undefined> {
        // Map partial Drizzle Campaign back to Mongoose update
        const update: any = {};
        if (data.name) update.name = data.name;
        if (data.status) update.status = data.status;

        const campaign = await CampaignModel.findOneAndUpdate(
            { campaignId },
            update,
            { new: true }
        );
        return campaign ? mapCampaign(campaign) : undefined;
    }

    async deleteCampaign(campaignId: string): Promise<boolean> {
        const res = await CampaignModel.deleteOne({ campaignId });
        return res.deletedCount > 0;
    }

    async getAdSets(filters: { campaignId?: string; accountId?: string; status?: string }, limit = 50, offset = 0): Promise<AdSet[]> {
        const query: any = {};
        if (filters.accountId) query.accountId = filters.accountId;
        if (filters.status) query.status = filters.status;

        // If filtering by campaignId string, we need to first find the campaign ObjectId or store campaignId in AdSet
        // Mongoose AdSet schema refers to Campaign via ObjectId. 
        // However, our refactor assumes we might want to query by string ID.
        // For now, let's assume we populated campaignId or it matches.
        // A better approach for this adapter:
        if (filters.campaignId) {
            const campaign = await CampaignModel.findOne({ campaignId: filters.campaignId });
            if (campaign) {
                query.campaignId = campaign._id;
            } else {
                return [];
            }
        }

        const adSets = await AdSetModel.find(query)
            .populate('campaignId')
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

        return adSets.map(mapAdSet);
    }

    async getAdSet(adSetId: string): Promise<AdSet | undefined> {
        const adSet = await AdSetModel.findOne({ adSetId }).populate('campaignId');
        return adSet ? mapAdSet(adSet) : undefined;
    }

    async createAdSet(data: InsertAdSet): Promise<AdSet> {
        // Find campaign ObjectId
        const campaign = await CampaignModel.findOne({ campaignId: data.campaignId });
        if (!campaign) throw new Error(`Campaign ${data.campaignId} not found`);

        const adSet = await AdSetModel.create({
            adSetId: data.adSetId,
            campaignId: campaign._id,
            accountId: data.accountId,
            tenantId: String(data.tenantId || '0'),
            name: data.name,
            status: data.status,
            budget: Number(data.dailyBudget || 1000),
            targeting: data.targeting,
            learningPhaseStatus: 'LEARNING',
            optimizationGoal: data.optimizationGoal || 'IMPRESSIONS',
            startDate: data.startTime,
            endDate: data.endTime
        });

        // Populate for return
        await adSet.populate('campaignId');
        return mapAdSet(adSet);
    }

    async updateAdSet(adSetId: string, data: Partial<AdSet>): Promise<AdSet | undefined> {
        const update: any = {};
        if (data.name) update.name = data.name;
        if (data.status) update.status = data.status;
        if (data.budget) update.budget = Number(data.budget);

        const adSet = await AdSetModel.findOneAndUpdate(
            { adSetId },
            update,
            { new: true }
        ).populate('campaignId');

        return adSet ? mapAdSet(adSet) : undefined;
    }

    async getAds(filters: { adSetId?: string; campaignId?: string; accountId?: string; status?: string }, limit = 50, offset = 0): Promise<Ad[]> {
        const query: any = {};
        if (filters.accountId) query.accountId = filters.accountId;
        if (filters.status) query.status = filters.status;

        if (filters.adSetId) {
            const adSet = await AdSetModel.findOne({ adSetId: filters.adSetId });
            if (adSet) query.adSetId = adSet._id;
            else return [];
        }

        if (filters.campaignId) {
            const campaign = await CampaignModel.findOne({ campaignId: filters.campaignId });
            if (campaign) query.campaignId = campaign._id;
            else return [];
        }

        const ads = await AdModel.find(query)
            .populate('adSetId')
            .populate('campaignId')
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

        return ads.map(mapAd);
    }

    async getAd(adId: string): Promise<Ad | undefined> {
        const ad = await AdModel.findOne({ adId })
            .populate('adSetId')
            .populate('campaignId');
        return ad ? mapAd(ad) : undefined;
    }

    async createAd(data: InsertAd): Promise<Ad> {
        const campaign = await CampaignModel.findOne({ campaignId: data.campaignId });
        if (!campaign) throw new Error(`Campaign ${data.campaignId} not found`);

        const adSet = await AdSetModel.findOne({ adSetId: data.adSetId });
        if (!adSet) throw new Error(`AdSet ${data.adSetId} not found`);

        const ad = await AdModel.create({
            adId: data.adId,
            adSetId: adSet._id,
            campaignId: campaign._id,
            accountId: data.accountId,
            tenantId: String(data.tenantId || '0'),
            name: data.name,
            status: data.status,
            creative: {
                creativeId: data.creativeId || uuidv4(),
                type: 'IMAGE', // Default
                headline: data.creativeTitle,
                body: data.creativeBody,
                callToAction: data.creativeCallToAction,
                metadata: { thumbnailUrl: data.creativeThumbnailUrl }
            },
            effectiveStatus: data.status,
            issues: []
        });

        await ad.populate(['adSetId', 'campaignId']);
        return mapAd(ad);
    }

    async updateAd(adId: string, data: Partial<Ad>): Promise<Ad | undefined> {
        const update: any = {};
        if (data.name) update.name = data.name;
        if (data.status) update.status = data.status;

        const ad = await AdModel.findOneAndUpdate(
            { adId },
            update,
            { new: true }
        ).populate(['adSetId', 'campaignId']);
        return ad ? mapAd(ad) : undefined;
    }

    async bulkUpdateAdStatus(adIds: string[], status: string): Promise<number> {
        const res = await AdModel.updateMany(
            { adId: { $in: adIds } },
            { status }
        );
        return res.modifiedCount;
    }

    async getPerformanceSnapshots(entityType: string, entityId: string, startDate: Date, endDate: Date): Promise<PerformanceSnapshot[]> {
        const snapshots = await PerformanceSnapshotModel.find({
            entityType,
            entityId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        return snapshots.map(s => ({
            id: 0,
            // @ts-ignore
            _id: s._id?.toString(),
            entityType: s.entityType,
            entityId: s.entityId,
            accountId: s.accountId,
            tenantId: 0,
            date: s.date,
            impressions: s.impressions,
            clicks: s.clicks,
            spend: String(s.spend),
            conversions: s.conversions,
            revenue: String(s.revenue),
            reach: s.reach,
            frequency: String(s.frequency),
            cpm: String(s.cpm),
            cpc: String(s.cpc),
            ctr: String(s.ctr),
            cpa: String(s.cpa),
            roas: String(s.roas),
            createdAt: s.createdAt
        }));
    }

    async getDashboardMetrics(accountId: string, startDate: Date, endDate: Date): Promise<{ totalSpend: number; totalConversions: number; avgRoas: number; avgCtr: number }> {
        const agg = await PerformanceSnapshotModel.aggregate([
            {
                $match: {
                    accountId: accountId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSpend: { $sum: "$spend" },
                    totalConversions: { $sum: "$conversions" },
                    avgRoas: { $avg: "$roas" },
                    avgCtr: { $avg: "$ctr" }
                }
            }
        ]);

        if (agg.length === 0) return { totalSpend: 0, totalConversions: 0, avgRoas: 0, avgCtr: 0 };
        return {
            totalSpend: agg[0].totalSpend,
            totalConversions: agg[0].totalConversions,
            avgRoas: agg[0].avgRoas,
            avgCtr: agg[0].avgCtr
        };
    }

    async getOptimizationLogs(filters: { entityType?: string; entityId?: string }, limit = 50): Promise<OptimizationLog[]> {
        const query: any = {};
        if (filters.entityType) query.entityType = filters.entityType;
        if (filters.entityId) query.entityId = filters.entityId;

        const logs = await OptimizationLogModel.find(query)
            .sort({ performedAt: -1 })
            .limit(limit);

        return logs.map(l => ({
            id: 0,
            // @ts-ignore
            _id: l._id?.toString(),
            entityType: l.entityType,
            entityId: l.entityId,
            accountId: l.accountId,
            tenantId: 0,
            action: l.action,
            reason: l.reason,
            previousValue: l.previousValue,
            newValue: l.newValue,
            performedBy: l.performedBy,
            performedAt: l.performedAt,
            createdAt: l.createdAt
        }));
    }

    async createOptimizationLog(data: Omit<OptimizationLog, 'id' | 'createdAt'>): Promise<OptimizationLog> {
        const log = await OptimizationLogModel.create({
            ...data,
            performedAt: data.performedAt || new Date()
        });

        return {
            id: 0,
            // @ts-ignore
            _id: log._id?.toString(),
            entityType: log.entityType,
            entityId: log.entityId,
            accountId: log.accountId,
            tenantId: 0,
            action: log.action,
            reason: log.reason,
            previousValue: log.previousValue,
            newValue: log.newValue,
            performedBy: log.performedBy,
            performedAt: log.performedAt,
            createdAt: log.createdAt
        };
    }

    async getMetaConnection(tenantId: number, adAccountId: string): Promise<MetaConnection | undefined> {
        const conn = await MetaConnectionModel.findOne({ tenantId: String(tenantId), adAccountId });
        return conn ? mapMetaConnection(conn) : undefined;
    }

    async getMetaConnections(tenantId: number): Promise<MetaConnection[]> {
        const conns = await MetaConnectionModel.find({ tenantId: String(tenantId) }).sort({ createdAt: -1 });
        return conns.map(mapMetaConnection);
    }

    async createMetaConnection(data: Omit<MetaConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<MetaConnection> {
        const conn = await MetaConnectionModel.create({
            tenantId: String(data.tenantId),
            adAccountId: data.adAccountId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            status: data.status,
            permissions: data.permissions,
            tokenExpiresAt: data.tokenExpiresAt
        });
        return mapMetaConnection(conn);
    }

    async updateMetaConnection(id: number, data: Partial<MetaConnection>): Promise<MetaConnection | undefined> {
        // Note: IStorage uses numeric ID for update, but we have _id object or tenantId string.
        // This part is tricky if ID is purely internal.
        // We'll assume the numeric ID passed in is getting ignored or handled if we can map it.
        // However, if we don't have the Mongo ID, we can't update by ID easily unless we stored numeric ID.
        // For this adapter, we might need to rely on tenantId+adAccountId or accept that ID updates are hard.

        // Fallback: If 'id' is small, it's fake. If it's 0, we can't use it.
        // Ideally we update via tenantId/adAccount.
        // But let's see if we can just fail gracefully or mock it.
        // Actually, createMetaConnection returns id=0. So updateMetaConnection(0, ...) is ambiguous.
        // We'll implement it as "not supported by ID" or try to find by other means if passed.
        return undefined;
        // Typically in Mongoose apps we pass string _id. The Drizzle schema uses number serial. 
        // We bridged this by returning 0. 
        // The auth route uses `findByIdAndUpdate(req.params.id)` which sends a STRING _id.
        // So if the caller sends a string ID cast to number, might be NaN. 
    }
}
