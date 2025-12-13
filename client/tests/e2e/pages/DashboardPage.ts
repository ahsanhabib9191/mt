import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
    readonly page: Page;
    readonly heading: Locator;
    readonly addBoostButton: Locator;
    readonly statsGrid: Locator;
    readonly activityFeed: Locator;
    readonly aiInsight: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole('heading', { name: 'Command Center' });
        this.addBoostButton = page.getByRole('button', { name: 'New Boost' });
        this.statsGrid = page.locator('.grid.grid-cols-2.md\\:grid-cols-4');
        this.activityFeed = page.getByText('Activity Log', { exact: false });
        this.aiInsight = page.getByText('Optimization engine is', { exact: false });
    }

    /**
     * Navigate to the dashboard.
     * If injectState is true, it sets up the localStorage to simulate a logged-in user with a connected account.
     */
    async goto(injectState = false) {
        if (injectState) {
            await this.page.addInitScript(() => {
                window.localStorage.setItem('connected_account', JSON.stringify({
                    availableAccounts: [{
                        id: 'act_123456789',
                        name: 'Test Ad Account',
                        currency: 'USD'
                    }]
                }));
            });
        }
        await this.page.goto('/dashboard');
    }

    async mockApiResponses() {
        await this.page.route('/api/optimization/activity/**', async route => {
            await route.fulfill({ json: { success: true, logs: [] } });
        });

        await this.page.route('/api/performance/dashboard**', async route => {
            await route.fulfill({
                json: {
                    success: true,
                    data: {
                        metrics: { spend: 1000, impressions: 50000, clicks: 1200, roas: 3.5 }
                    }
                }
            });
        });

        await this.page.route('/api/performance/trends**', async route => {
            await route.fulfill({
                json: {
                    success: true,
                    data: [
                        { date: '2023-01-01', spend: 100, impressions: 1000, revenue: 300 },
                        { date: '2023-01-02', spend: 120, impressions: 1200, revenue: 400 }
                    ]
                }
            });
        });

        await this.page.route('/api/campaigns**', async route => {
            await route.fulfill({
                json: {
                    data: [
                        { campaignId: '1', name: 'Summer Sale', status: 'ACTIVE', objective: 'OUTCOME_SALES', budget: 100 }
                    ]
                }
            });
        });

        await this.page.route('/api/optimization/config', async route => {
            await route.fulfill({ json: { success: true, config: { mode: 'ACTIVE' } } });
        });
    }

    async expectLoaded() {
        await expect(this.heading).toBeVisible();
        await expect(this.addBoostButton).toBeVisible();
    }

    async expectStatsVisible() {
        await expect(this.statsGrid.getByText('Total Spend')).toBeVisible();
        await expect(this.statsGrid.getByText('Impressions')).toBeVisible();
        await expect(this.statsGrid.getByText('Clicks')).toBeVisible();
        await expect(this.statsGrid.getByText('ROAS')).toBeVisible();
    }

    async expectAiInsight(mode: string) {
        // The UI displays: "Optimization engine is [mode]. Monitoring for high ROAS opportunities."
        await expect(this.aiInsight).toBeVisible();
        await expect(this.aiInsight).toContainText(`Optimization engine is ${mode}`);
    }
}
