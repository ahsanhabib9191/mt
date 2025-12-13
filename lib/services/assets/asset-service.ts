import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { CreativeAssetModel } from '../../db/models/creative-asset';
import { MetaConnectionModel } from '../../db/models/MetaConnection';
import { getAccessToken } from '../meta-oauth/oauth-service';
import { logger } from '../../utils/logger';

/**
 * The "Asset Ingestor" Service.
 * Implements the "Giant Tech" pipeline:
 * 1. Check if asset exists.
 * 2. If not, download (stream).
 * 3. Upload to Meta.
 * 4. Save hash.
 */

export class AssetService {

    /**
     * Ensures an image URL is ready for use in an Ad.
     * If it's new, it downloads and uploads it to Meta.
     * If it's cached, it returns the existing hash.
     */
    static async prepareImageAsset(accountId: string, imageUrl: string): Promise<string> {
        try {
            // 1. Check Cache (DB)
            const existingAsset = await CreativeAssetModel.findOne({
                accountId,
                originalUrl: imageUrl,
                status: 'READY'
            });

            if (existingAsset && existingAsset.metaImageHash) {
                logger.info('Asset cache hit', { accountId, imageUrl });
                return existingAsset.metaImageHash;
            }

            logger.info('Asset cache miss. Starting ingestion...', { accountId, imageUrl });

            // 2. Create "Processing" Record
            // Determine if we are upgrading a failed/discovered one or creating new
            const assetId = uuidv4();
            await CreativeAssetModel.findOneAndUpdate(
                { accountId, originalUrl: imageUrl },
                {
                    assetId, // Only sets on insert
                    accountId,
                    originalUrl: imageUrl,
                    type: 'IMAGE',
                    status: 'PROCESSING',
                    'metadata.source': 'SCRAPED'
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // 3. Get Credentials
            const connection = await MetaConnectionModel.findOne({ adAccountId: accountId });
            if (!connection) throw new Error('Meta connection not found');

            const accessToken = await getAccessToken(connection.tenantId || 'default', accountId);

            // 4. MOCK MODE INTERCEPTION
            if (accessToken.includes('mock_')) {
                logger.warn('MOCK MODE: Simulating image upload');
                const mockHash = `mock_hash_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

                await CreativeAssetModel.findOneAndUpdate(
                    { accountId, originalUrl: imageUrl },
                    {
                        status: 'READY',
                        metaImageHash: mockHash,
                        metaAdImageId: mockHash,
                        'specs.width': 1080,
                        'specs.height': 1080
                    }
                );
                return mockHash;
            }

            // 5. Download Image Stream
            // "The Harvester" step - we fetch the bytes
            const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });

            // 5. Upload to Meta
            // "The Pre-Loader" step - push to Meta's AdImage endpoint
            const formData = new FormData();
            formData.append('access_token', accessToken);
            formData.append('filename', imageUrl.split('/').pop() || 'image.jpg');
            formData.append('file', imageResponse.data);

            // Meta API: POST /act_{id}/adimages
            const uploadUrl = `https://graph.facebook.com/v18.0/${accountId}/adimages`;

            const metaResponse = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            if (metaResponse.data && metaResponse.data.images) {
                // success response format: { images: { "filename": { hash: "...", url: "..." } } }
                // We need to extract the hash. The key is the filename or original name.
                const imagesObj = metaResponse.data.images;
                const firstKey = Object.keys(imagesObj)[0]; // Usually the filename we sent
                const imageData = imagesObj[firstKey];
                const hash = imageData.hash;

                if (!hash) throw new Error('No hash returned from Meta upload');

                // 6. Update Record to READY
                await CreativeAssetModel.findOneAndUpdate(
                    { accountId, originalUrl: imageUrl },
                    {
                        status: 'READY',
                        metaImageHash: hash,
                        metaAdImageId: hash, // For images, hash is often used as ID too, but let's store it
                        'specs.width': imageData.width, // Optional if returned
                        'specs.height': imageData.height
                    }
                );

                logger.info('Asset ingestion complete', { accountId, hash });
                return hash;
            } else {
                throw new Error('Invalid response structure from Meta AdImages API');
            }

        } catch (error: any) {
            logger.error('Asset ingestion failed', { error: error.message, imageUrl });

            // Mark as FAILED so we don't retry unnecessarily immediately (or we can retry later)
            await CreativeAssetModel.findOneAndUpdate(
                { accountId, originalUrl: imageUrl },
                { status: 'FAILED' }
            );

            throw error;
        }
    }
}
