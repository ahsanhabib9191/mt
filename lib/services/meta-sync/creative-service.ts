
import { postGraphEdge } from './graph-client';
import logger from '../../utils/logger';

// Types
export interface VideoUploadResult {
    id: string; // The Video ID
    success: boolean;
}

export interface ImageUploadResult {
    hash: string;
    success: boolean;
}

export class CreativeService {

    /**
     * Uploads an Image from a public URL to Meta Ad Library
     */
    static async uploadImage(accessToken: string, adAccountId: string, imageUrl: string): Promise<ImageUploadResult> {
        try {
            logger.info('CreativeService: Uploading Image', { adAccountId, imageUrl: imageUrl.slice(0, 50) });

            const result = await postGraphEdge<{ images: Record<string, { hash: string }> }>(
                accessToken,
                adAccountId,
                'adimages',
                {
                    url: imageUrl
                }
            );

            // Meta returns map of { filename: { hash: ... } }
            // Since we upload by URL, the key is usually the URL or filename derived.
            // But we can usually grab the first value.
            const imageData = Object.values(result.images || {})[0];

            if (!imageData || !imageData.hash) {
                throw new Error('No image hash returned from Meta');
            }

            return { hash: imageData.hash, success: true };

        } catch (error: any) {
            logger.error('CreativeService: Image Upload Failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Uploads a Video from a public URL to Meta Ad Library
     * Uses the 'file_url' parameter for efficient server-to-server transfer
     */
    static async uploadVideo(accessToken: string, adAccountId: string, videoUrl: string): Promise<VideoUploadResult> {
        try {
            logger.info('CreativeService: Uploading Video', { adAccountId, videoUrl: videoUrl.slice(0, 50) });

            // Using the 'advideos' edge with 'file_url'
            const result = await postGraphEdge<{ id: string }>(
                accessToken,
                adAccountId,
                'advideos',
                {
                    file_url: videoUrl,
                    description: 'Uploaded via Shothik AI',
                    // Optional: thumbnail_url if available
                }
            );

            if (!result.id) {
                throw new Error('No video ID returned from Meta');
            }

            logger.info('CreativeService: Video Upload Initiated', { videoId: result.id });

            // Note: Video is not immediately ready. It goes into processing.
            // For creating ads, we can usually use the ID immediately, but valid status checks are better.
            // Giant Tech approach: We return the ID. The 'Ad Creation' step might need to retry if video is processing.

            return { id: result.id, success: true };

        } catch (error: any) {
            logger.error('CreativeService: Video Upload Failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Creates the actual Ad Creative Object on Meta (Links Image/Video + Text)
     */
    static async createAdCreativeObject(
        accessToken: string,
        adAccountId: string,
        data: {
            name: string;
            pageId: string;
            linkUrl: string;
            message?: string; // Primary Text
            headline?: string;
            description?: string;
            callToAction?: string;
            imageHash?: string;
            videoId?: string;
        }
    ): Promise<string> {
        try {
            const creativePayload: any = {
                name: data.name,
                object_story_spec: {
                    page_id: data.pageId,
                    link_data: { // Default to link_data (Image)
                        call_to_action: {
                            type: data.callToAction || 'LEARN_MORE',
                            value: { link: data.linkUrl }
                        },
                        link: data.linkUrl,
                        message: data.message, // Primary Text
                        name: data.headline,
                        description: data.description, // Link Description
                        // image_hash set below
                        // object_type set below
                    },
                    // video_data set below if video
                },
                degrees_of_freedom_spec: {
                    creative_features_spec: {
                        standard_enhancements: {
                            enroll_status: 'OPT_IN' // MAGE requirement: Allow standard enhancements
                        }
                    }
                }
            };

            if (data.videoId) {
                // VIDEO AD FORMAT
                delete creativePayload.object_story_spec.link_data;
                creativePayload.object_story_spec.video_data = {
                    call_to_action: {
                        type: data.callToAction || 'LEARN_MORE',
                        value: { link: data.linkUrl }
                    },
                    video_id: data.videoId,
                    message: data.message,
                    title: data.headline,
                    link_description: data.description,
                    image_url: `https://graph.facebook.com/${data.videoId}/picture` // Thumbnail
                };
            } else if (data.imageHash) {
                // IMAGE AD FORMAT
                creativePayload.object_story_spec.link_data.image_hash = data.imageHash;
            } else {
                throw new Error('Creative requires either imageHash or videoId');
            }

            logger.info('CreativeService: Creating Ad Creative', {
                name: data.name,
                type: data.videoId ? 'VIDEO' : 'IMAGE'
            });

            const result = await postGraphEdge<{ id: string }>(
                accessToken,
                adAccountId,
                'adcreatives',
                creativePayload
            );

            if (!result.id) throw new Error('No Creative ID returned');

            return result.id;

        } catch (error: any) {
            logger.error('CreativeService: Create Object Failed', { error: error.message });
            throw error;
        }
    }
}
