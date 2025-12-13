
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import puppeteer from 'puppeteer';
import { logger } from '../../utils/logger';


export interface SmartScrapedData {
    title: string;
    description: string;
    images: string[];
    text: string;
    url: string;
    brandColors: string[];
}

export async function smartScrapeUrl(url: string): Promise<SmartScrapedData> {
    let browser;
    try {
        logger.info('Starting smart scrape with Puppeteer', { url });

        // Launch headless browser
        browser = await puppeteer.launch({
            headless: true, // New 'headless: "new"' mode in newer versions, or true
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set viewport to desktop size to ensure responsive images load
        await page.setViewport({ width: 1920, height: 1080 });

        // Set user agent to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to page
        // Wait for networkidle0 (no network connections for 500ms) or max 20s
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }).catch(e => {
            logger.warn('Page load timeout or network not idle, continuing anyway of what loaded', { error: e.message });
        });

        // --- 1. Smart Scroller (Trigger Lazy Loading) ---
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    // Stop scrolling if we reached the bottom or after 3 seconds (to save time)
                    if (totalHeight >= scrollHeight || totalHeight > 5000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 50); // Fast scroll
            });
        });

        // Give a small buffer for images to actually render/load after scroll
        await new Promise(r => setTimeout(r, 1000));

        // --- 2. Live DOM Extraction ---
        const data = await page.evaluate(() => {
            // --- Helper: colors ---
            function getCommonColors() {
                const colorMap: Record<string, number> = {};
                const elements = document.querySelectorAll('*');

                // Sample a subset of elements for performance
                let count = 0;
                for (const el of elements) {
                    if (count++ > 500) break;

                    const style = window.getComputedStyle(el);
                    const bg = style.backgroundColor;
                    const fg = style.color;

                    [bg, fg].forEach(c => {
                        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' && c !== 'rgb(255, 255, 255)' && c !== 'rgb(0, 0, 0)') {
                            colorMap[c] = (colorMap[c] || 0) + 1;
                        }
                    });
                }

                // Sort by frequency
                return Object.entries(colorMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([c]) => c);
            }

            // --- Helper: Clean Text ---
            function getVisibleText() {
                // Primitive accessibility tree idea: only get visible text
                const body = document.body;
                return body.innerText || '';
            }

            // --- Extract Meta ---
            const title = document.title;
            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

            // --- Extract Images (Visual Filtering) ---
            const images: string[] = [];

            // 1. OG Image (High Priority)
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
            if (ogImage) images.push(ogImage);

            // 2. Img tags
            const imgElements = Array.from(document.querySelectorAll('img'));
            for (const img of imgElements) {
                if (images.length > 15) break;

                if (img.naturalWidth > 100 && img.naturalHeight > 100) { // Smart filter: only "real" typical content images
                    if (img.src && !img.src.startsWith('data:')) {
                        images.push(img.src);
                    }
                }
            }

            // 3. Background Images (Computed Style) - often used for Heroes
            if (images.length < 5) {
                const divs = Array.from(document.querySelectorAll('div, section, header'));
                for (const div of divs) {
                    const style = window.getComputedStyle(div);
                    const bgImage = style.backgroundImage;
                    if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
                        // Extract url from url("...")
                        const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
                        if (match && match[1]) {
                            if (match[1].startsWith('http')) images.push(match[1]);
                        }
                    }
                }
            }

            return {
                title,
                description: metaDesc,
                images: Array.from(new Set(images)), // Unique
                text: getVisibleText(),
                brandColors: getCommonColors()
            };
        });

        return {
            ...data,
            url,
            // Ensure colors are hex if possible (puppeteer returns rgb usually), 
            // but frontend can handle rgb usually. We'll leave as is for now or add a helper if needed.
            // Actually, let's map rgb to hex for consistency if we wanted, but the frontend supports RGB text.
        };

    } catch (error) {
        logger.error('Smart scrape failed', { error });
        throw new Error('Failed to smart scrape URL');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
