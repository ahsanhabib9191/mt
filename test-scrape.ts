// Standalone test script
// instead I'll create a standalone script that duplicates the logic to test it.

const url = "https://demo.vercel.store/product/acme-drawstring-bag";

async function testScrape() {
    try {
        const response = await fetch(url);
        const html = await response.text();

        console.log("HTML length:", html.length);

        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        const images: string[] = [];
        if (ogImageMatch) {
            console.log("Found OG Image:", ogImageMatch[1]);
            images.push(ogImageMatch[1]);
        }

        // Improved regex to capture src attributes better
        const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
        for (const match of imgMatches) {
            let imgUrl = match[1];
            console.log("Found raw img src:", imgUrl);

            if (imgUrl.startsWith('//')) {
                imgUrl = 'https:' + imgUrl;
            } else if (imgUrl.startsWith('/')) {
                const urlObj = new URL(url);
                imgUrl = urlObj.origin + imgUrl;
            } else if (!imgUrl.startsWith('http')) {
                // Handle relative paths
                const urlObj = new URL(url);
                // distinct handling might be needed but for now let's assume base
                imgUrl = new URL(imgUrl, url).toString();
            }

            if (!images.includes(imgUrl) && !imgUrl.includes('data:') && !imgUrl.includes('icon') && !imgUrl.includes('logo')) {
                images.push(imgUrl);
            }
        }

        console.log("Final Images:", images);

    } catch (e) {
        console.error(e);
    }
}

testScrape();
