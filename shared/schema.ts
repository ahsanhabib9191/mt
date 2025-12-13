import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const metaConnections = pgTable("meta_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id).notNull(),
  adAccountId: text("ad_account_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  status: text("status").default("ACTIVE").notNull(),
  permissions: jsonb("permissions").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("meta_connections_tenant_idx").on(table.tenantId),
  uniqueIndex("meta_connections_account_idx").on(table.tenantId, table.adAccountId),
]);

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  campaignId: text("campaign_id").notNull().unique(),
  accountId: text("account_id").notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  effectiveStatus: text("effective_status"),
  objective: text("objective"),
  buyingType: text("buying_type"),
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }),
  lifetimeBudget: decimal("lifetime_budget", { precision: 12, scale: 2 }),
  spendCap: decimal("spend_cap", { precision: 12, scale: 2 }),
  startTime: timestamp("start_time"),
  stopTime: timestamp("stop_time"),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  specialAdCategories: jsonb("special_ad_categories").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("campaigns_account_idx").on(table.accountId),
  index("campaigns_status_idx").on(table.status),
]);

export const adSets = pgTable("ad_sets", {
  id: serial("id").primaryKey(),
  adSetId: text("ad_set_id").notNull().unique(),
  campaignId: text("campaign_id").references(() => campaigns.campaignId).notNull(),
  accountId: text("account_id").notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  effectiveStatus: text("effective_status"),
  optimizationGoal: text("optimization_goal"),
  billingEvent: text("billing_event"),
  bidAmount: decimal("bid_amount", { precision: 12, scale: 2 }),
  bidStrategy: text("bid_strategy"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  dailyBudget: decimal("daily_budget", { precision: 12, scale: 2 }),
  lifetimeBudget: decimal("lifetime_budget", { precision: 12, scale: 2 }),
  learningPhaseStatus: text("learning_phase_status").default("LEARNING"),
  optimizationEventsCount: integer("optimization_events_count").default(0),
  ageDays: integer("age_days").default(0),
  targeting: jsonb("targeting"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ad_sets_campaign_idx").on(table.campaignId),
  index("ad_sets_account_idx").on(table.accountId),
  index("ad_sets_status_idx").on(table.status),
]);

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  adId: text("ad_id").notNull().unique(),
  adSetId: text("ad_set_id").references(() => adSets.adSetId).notNull(),
  campaignId: text("campaign_id").references(() => campaigns.campaignId).notNull(),
  accountId: text("account_id").notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  name: text("name").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  effectiveStatus: text("effective_status"),
  creativeId: text("creative_id"),
  creativeTitle: text("creative_title"),
  creativeBody: text("creative_body"),
  creativeThumbnailUrl: text("creative_thumbnail_url"),
  creativeCallToAction: text("creative_call_to_action"),
  trackingSpecs: jsonb("tracking_specs"),
  createdTime: timestamp("created_time"),
  updatedTime: timestamp("updated_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ads_ad_set_idx").on(table.adSetId),
  index("ads_campaign_idx").on(table.campaignId),
  index("ads_account_idx").on(table.accountId),
  index("ads_status_idx").on(table.status),
]);

export const performanceSnapshots = pgTable("performance_snapshots", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  accountId: text("account_id").notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  date: timestamp("date").notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  conversions: integer("conversions").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  reach: integer("reach").default(0),
  frequency: decimal("frequency", { precision: 8, scale: 4 }).default("0"),
  cpm: decimal("cpm", { precision: 12, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 12, scale: 4 }).default("0"),
  ctr: decimal("ctr", { precision: 8, scale: 4 }).default("0"),
  cpa: decimal("cpa", { precision: 12, scale: 4 }).default("0"),
  roas: decimal("roas", { precision: 8, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("perf_entity_idx").on(table.entityType, table.entityId),
  index("perf_date_idx").on(table.date),
  index("perf_account_idx").on(table.accountId),
  uniqueIndex("perf_unique_idx").on(table.entityType, table.entityId, table.date),
]);

export const optimizationLogs = pgTable("optimization_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  accountId: text("account_id"),
  tenantId: integer("tenant_id").references(() => tenants.id),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  performedBy: text("performed_by").default("system"),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("opt_log_entity_idx").on(table.entityType, table.entityId),
  index("opt_log_date_idx").on(table.performedAt),
]);

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  accountId: text("account_id").notNull(),
  tenantId: integer("tenant_id").references(() => tenants.id),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull(),
  entityCounts: jsonb("entity_counts"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sync_log_account_idx").on(table.accountId),
  index("sync_log_date_idx").on(table.startedAt),
]);

export const tenantsRelations = relations(tenants, ({ many }) => ({
  metaConnections: many(metaConnections),
  campaigns: many(campaigns),
  adSets: many(adSets),
  ads: many(ads),
}));

export const metaConnectionsRelations = relations(metaConnections, ({ one }) => ({
  tenant: one(tenants, {
    fields: [metaConnections.tenantId],
    references: [tenants.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  adSets: many(adSets),
  ads: many(ads),
}));

export const adSetsRelations = relations(adSets, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [adSets.campaignId],
    references: [campaigns.campaignId],
  }),
  tenant: one(tenants, {
    fields: [adSets.tenantId],
    references: [tenants.id],
  }),
  ads: many(ads),
}));

export const adsRelations = relations(ads, ({ one }) => ({
  adSet: one(adSets, {
    fields: [ads.adSetId],
    references: [adSets.adSetId],
  }),
  campaign: one(campaigns, {
    fields: [ads.campaignId],
    references: [campaigns.campaignId],
  }),
  tenant: one(tenants, {
    fields: [ads.tenantId],
    references: [tenants.id],
  }),
}));

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type AdSet = typeof adSets.$inferSelect;
export type InsertAdSet = typeof adSets.$inferInsert;
export type Ad = typeof ads.$inferSelect;
export type InsertAd = typeof ads.$inferInsert;
export type PerformanceSnapshot = typeof performanceSnapshots.$inferSelect;
export type OptimizationLog = typeof optimizationLogs.$inferSelect;
export type MetaConnection = typeof metaConnections.$inferSelect;
