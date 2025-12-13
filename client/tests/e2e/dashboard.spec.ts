import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Dashboard E2E', () => {

    test('should show empty state when no account is connected', async ({ page }) => {
        // Clear storage just in case
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());

        await page.goto('/dashboard');

        // Direct assertion for the empty state
        await expect(page.getByText('No Ad Account Connected')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Go to Boost' })).toBeVisible();
    });

    test('should load command center with valid account', async ({ page }) => {
        const dashboard = new DashboardPage(page);

        // Mock backend APIs
        await dashboard.mockApiResponses();

        // Use the POM to navigate and inject state
        await dashboard.goto(true);

        // Assert visual stability
        await dashboard.expectLoaded();

        // Validate critical business metrics are visible
        await dashboard.expectStatsVisible();

        // Validate AI feature availability
        await dashboard.expectAiInsight('ACTIVE');
    });

    test('should navigate to Boost creation from dashboard', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.mockApiResponses();
        await dashboard.goto(true);

        await dashboard.addBoostButton.click();

        // Verify navigation
        await expect(page).toHaveURL('/');
    });

});
