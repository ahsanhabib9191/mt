import { test, expect } from '@playwright/test';

test.describe('Launch Flow E2E', () => {

    test('should complete One-Click Launch successfully', async ({ page }) => {
        // 1. Inject Authentication State
        await page.addInitScript(() => {
            window.localStorage.setItem('connected_account', JSON.stringify({
                availableAccounts: [{
                    id: 'act_123456789',
                    name: 'Test Ad Account',
                    currency: 'USD'
                }]
            }));
        });

        // 2. Mock Analysis Endpoint
        await page.route('/api/boost/analyze', async route => {
            await route.fulfill({
                json: {
                    url: 'https://example.com',
                    title: 'Example Brand',
                    description: 'The best example brand.',
                    usp: 'Unbeatable Quality',
                    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/640px-Image_created_with_a_mobile_phone.png'],
                    brandColors: ['#FF0000', '#00FF00'],
                    pageSpeed: { score: 'fast', loadTime: 500 },
                    pixel: { detected: true, pixelId: '12345' },
                    creativeIntent: { previewEffect: 'hover_glow', suggestedFormat: 'static' },
                    adCopy: [
                        { headline: 'Verified Headline', primaryText: 'Verified Body', angle: 'direct_benefit' }
                    ],
                    targetAudience: {
                        interests: ['Technology'],
                        ageRange: { min: 18, max: 65 },
                        gender: 'all'
                    },
                    smartDefaults: {
                        objective: 'OUTCOME_TRAFFIC',
                        suggestedBudget: 20
                    }
                }
            });
        });

        // 3. Mock Launch Endpoint
        await page.route('/api/launch', async route => {
            await route.fulfill({
                json: {
                    success: true,
                    campaignId: '12345'
                }
            });
        });

        // 4. Start Flow
        await page.goto('/');

        // 5. Input URL and Analyze
        await page.getByPlaceholder('https://www.yourwebsite.com/').fill('https://example.com');
        await page.getByRole('button', { name: 'Analyze' }).click();

        // 6. Results Step
        // Button: "Continue to Ad Creative"
        await expect(page.getByRole('button', { name: 'Continue to Ad Creative' })).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: 'Continue to Ad Creative' }).click();

        // 7. Creative Step
        await expect(page.getByText('Pick Your Ad Creative')).toBeVisible();
        await page.getByRole('button', { name: 'Continue to Targeting' }).click();

        // 8. Targeting Step
        await expect(page.getByText('Target Your Audience')).toBeVisible();
        await page.getByRole('button', { name: 'Continue to Budget' }).click();

        // 9. Budget Step
        await expect(page.getByText('Set Your Budget')).toBeVisible();
        await page.getByRole('button', { name: 'Preview Ad' }).click();

        // 10. Preview Step
        await expect(page.getByText('Preview Your Ad')).toBeVisible();
        await page.getByRole('button', { name: 'Ready to Launch' }).click();

        // 11. Launch Step
        await expect(page.getByRole('heading', { name: 'Ready for Liftoff' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Launch Campaign Now' })).toBeVisible();

        // 12. Trigger Launch (Mocked)
        await page.getByRole('button', { name: 'Launch Campaign Now' }).click();

        // 13. Verify Success
        await expect(page.getByText('Campaign Launched! 🚀')).toBeVisible({ timeout: 20000 });
    });

});
