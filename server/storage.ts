import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db, getDb } from "./db";
import {
  tenants, campaigns, adSets, ads, performanceSnapshots,
  optimizationLogs, metaConnections, syncLogs,
  type Tenant, type Campaign, type AdSet, type Ad,
  type PerformanceSnapshot, type OptimizationLog, type MetaConnection,
  type InsertTenant, type InsertCampaign, type InsertAdSet, type InsertAd
} from "../shared/schema";

export interface IStorage {
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantByEmail(email: string): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;

  getCampaigns(accountId: string, limit?: number, offset?: number): Promise<Campaign[]>;
  getCampaign(campaignId: string): Promise<Campaign | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(campaignId: string, data: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(campaignId: string): Promise<boolean>;

  getAdSets(filters: { campaignId?: string; accountId?: string; status?: string }, limit?: number, offset?: number): Promise<AdSet[]>;
  getAdSet(adSetId: string): Promise<AdSet | undefined>;
  createAdSet(data: InsertAdSet): Promise<AdSet>;
  updateAdSet(adSetId: string, data: Partial<AdSet>): Promise<AdSet | undefined>;

  getAds(filters: { adSetId?: string; campaignId?: string; accountId?: string; status?: string }, limit?: number, offset?: number): Promise<Ad[]>;
  getAd(adId: string): Promise<Ad | undefined>;
  createAd(data: InsertAd): Promise<Ad>;
  updateAd(adId: string, data: Partial<Ad>): Promise<Ad | undefined>;
  bulkUpdateAdStatus(adIds: string[], status: string): Promise<number>;

  getPerformanceSnapshots(entityType: string, entityId: string, startDate: Date, endDate: Date): Promise<PerformanceSnapshot[]>;
  getDashboardMetrics(accountId: string, startDate: Date, endDate: Date): Promise<{ totalSpend: number; totalConversions: number; avgRoas: number; avgCtr: number }>;

  getOptimizationLogs(filters: { entityType?: string; entityId?: string }, limit?: number): Promise<OptimizationLog[]>;
  createOptimizationLog(data: Omit<OptimizationLog, 'id' | 'createdAt'>): Promise<OptimizationLog>;

  getMetaConnection(tenantId: number, adAccountId: string): Promise<MetaConnection | undefined>;
  getMetaConnections(tenantId: number): Promise<MetaConnection[]>;
  createMetaConnection(data: Omit<MetaConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<MetaConnection>;
  updateMetaConnection(id: number, data: Partial<MetaConnection>): Promise<MetaConnection | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getTenant(id: number): Promise<Tenant | undefined> {
    const database = getDb();
    const [tenant] = await database.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantByEmail(email: string): Promise<Tenant | undefined> {
    const database = getDb();
    const [tenant] = await database.select().from(tenants).where(eq(tenants.email, email));
    return tenant || undefined;
  }

  async createTenant(data: InsertTenant): Promise<Tenant> {
    const database = getDb();
    const [tenant] = await database.insert(tenants).values(data).returning();
    return tenant;
  }

  async getCampaigns(accountId: string, limit = 50, offset = 0): Promise<Campaign[]> {
    const database = getDb();
    return database.select().from(campaigns)
      .where(eq(campaigns.accountId, accountId))
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getCampaign(campaignId: string): Promise<Campaign | undefined> {
    const database = getDb();
    const [campaign] = await database.select().from(campaigns).where(eq(campaigns.campaignId, campaignId));
    return campaign || undefined;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const database = getDb();
    const [campaign] = await database.insert(campaigns).values(data).returning();
    return campaign;
  }

  async updateCampaign(campaignId: string, data: Partial<Campaign>): Promise<Campaign | undefined> {
    const database = getDb();
    const [campaign] = await database.update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.campaignId, campaignId))
      .returning();
    return campaign || undefined;
  }

  async deleteCampaign(campaignId: string): Promise<boolean> {
    const database = getDb();
    const result = await database.delete(campaigns).where(eq(campaigns.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  async getAdSets(filters: { campaignId?: string; accountId?: string; status?: string }, limit = 50, offset = 0): Promise<AdSet[]> {
    const database = getDb();
    const conditions = [];
    if (filters.campaignId) conditions.push(eq(adSets.campaignId, filters.campaignId));
    if (filters.accountId) conditions.push(eq(adSets.accountId, filters.accountId));
    if (filters.status) conditions.push(eq(adSets.status, filters.status));

    return database.select().from(adSets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adSets.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAdSet(adSetId: string): Promise<AdSet | undefined> {
    const database = getDb();
    const [adSet] = await database.select().from(adSets).where(eq(adSets.adSetId, adSetId));
    return adSet || undefined;
  }

  async createAdSet(data: InsertAdSet): Promise<AdSet> {
    const database = getDb();
    const [adSet] = await database.insert(adSets).values(data).returning();
    return adSet;
  }

  async updateAdSet(adSetId: string, data: Partial<AdSet>): Promise<AdSet | undefined> {
    const database = getDb();
    const [adSet] = await database.update(adSets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(adSets.adSetId, adSetId))
      .returning();
    return adSet || undefined;
  }

  async getAds(filters: { adSetId?: string; campaignId?: string; accountId?: string; status?: string }, limit = 50, offset = 0): Promise<Ad[]> {
    const database = getDb();
    const conditions = [];
    if (filters.adSetId) conditions.push(eq(ads.adSetId, filters.adSetId));
    if (filters.campaignId) conditions.push(eq(ads.campaignId, filters.campaignId));
    if (filters.accountId) conditions.push(eq(ads.accountId, filters.accountId));
    if (filters.status) conditions.push(eq(ads.status, filters.status));

    return database.select().from(ads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ads.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAd(adId: string): Promise<Ad | undefined> {
    const database = getDb();
    const [ad] = await database.select().from(ads).where(eq(ads.adId, adId));
    return ad || undefined;
  }

  async createAd(data: InsertAd): Promise<Ad> {
    const database = getDb();
    const [ad] = await database.insert(ads).values(data).returning();
    return ad;
  }

  async updateAd(adId: string, data: Partial<Ad>): Promise<Ad | undefined> {
    const database = getDb();
    const [ad] = await database.update(ads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ads.adId, adId))
      .returning();
    return ad || undefined;
  }

  async bulkUpdateAdStatus(adIds: string[], status: string): Promise<number> {
    const database = getDb();
    let updated = 0;
    for (const adId of adIds) {
      const result = await database.update(ads)
        .set({ status, updatedAt: new Date() })
        .where(eq(ads.adId, adId));
      if (result.rowCount) updated += result.rowCount;
    }
    return updated;
  }

  async getPerformanceSnapshots(entityType: string, entityId: string, startDate: Date, endDate: Date): Promise<PerformanceSnapshot[]> {
    const database = getDb();
    return database.select().from(performanceSnapshots)
      .where(and(
        eq(performanceSnapshots.entityType, entityType),
        eq(performanceSnapshots.entityId, entityId),
        gte(performanceSnapshots.date, startDate),
        lte(performanceSnapshots.date, endDate)
      ))
      .orderBy(performanceSnapshots.date);
  }

  async getDashboardMetrics(accountId: string, startDate: Date, endDate: Date): Promise<{ totalSpend: number; totalConversions: number; avgRoas: number; avgCtr: number }> {
    const database = getDb();
    const result = await database.select({
      totalSpend: sql<number>`COALESCE(SUM(${performanceSnapshots.spend}), 0)`,
      totalConversions: sql<number>`COALESCE(SUM(${performanceSnapshots.conversions}), 0)`,
      avgRoas: sql<number>`COALESCE(AVG(${performanceSnapshots.roas}), 0)`,
      avgCtr: sql<number>`COALESCE(AVG(${performanceSnapshots.ctr}), 0)`,
    }).from(performanceSnapshots)
      .where(and(
        eq(performanceSnapshots.accountId, accountId),
        gte(performanceSnapshots.date, startDate),
        lte(performanceSnapshots.date, endDate)
      ));

    return result[0] || { totalSpend: 0, totalConversions: 0, avgRoas: 0, avgCtr: 0 };
  }

  async getOptimizationLogs(filters: { entityType?: string; entityId?: string }, limit = 50): Promise<OptimizationLog[]> {
    const database = getDb();
    const conditions = [];
    if (filters.entityType) conditions.push(eq(optimizationLogs.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(optimizationLogs.entityId, filters.entityId));

    return database.select().from(optimizationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(optimizationLogs.performedAt))
      .limit(limit);
  }

  async createOptimizationLog(data: Omit<OptimizationLog, 'id' | 'createdAt'>): Promise<OptimizationLog> {
    const database = getDb();
    const [log] = await database.insert(optimizationLogs).values(data).returning();
    return log;
  }

  async getMetaConnection(tenantId: number, adAccountId: string): Promise<MetaConnection | undefined> {
    const database = getDb();
    const [connection] = await database.select().from(metaConnections)
      .where(and(
        eq(metaConnections.tenantId, tenantId),
        eq(metaConnections.adAccountId, adAccountId)
      ));
    return connection || undefined;
  }

  async getMetaConnectionByAccount(tenantId: number, adAccountId: string): Promise<MetaConnection | undefined> {
    return this.getMetaConnection(tenantId, adAccountId);
  }

  async getMetaConnections(tenantId: number): Promise<MetaConnection[]> {
    const database = getDb();
    return database.select().from(metaConnections)
      .where(eq(metaConnections.tenantId, tenantId))
      .orderBy(desc(metaConnections.createdAt));
  }

  async createMetaConnection(data: Omit<MetaConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<MetaConnection> {
    const database = getDb();
    const [connection] = await database.insert(metaConnections).values(data).returning();
    return connection;
  }

  async updateMetaConnection(id: number, data: Partial<MetaConnection>): Promise<MetaConnection | undefined> {
    const database = getDb();
    const [connection] = await database.update(metaConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(metaConnections.id, id))
      .returning();
    return connection || undefined;
  }
}

import { MongoStorage } from "./storage-mongo";

export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MongoStorage();
