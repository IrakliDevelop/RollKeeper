/**
 * S3 Upload Utility
 * Handles avatar uploads to AWS S3
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

// Validate required environment variables before initializing S3 client
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const AWS_S3_REGION = getRequiredEnvVar('AWS_S3_REGION');
const AWS_ACCESS_KEY_ID = getRequiredEnvVar('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = getRequiredEnvVar('AWS_SECRET_ACCESS_KEY');
const BUCKET_NAME = getRequiredEnvVar('AWS_S3_BUCKET_NAME');

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
/**
 * Upload an avatar image to S3
 * @param file - The image file buffer
 * @param fileName - Unique filename for the image
 * @param contentType - MIME type of the image
 * @returns The public URL of the uploaded image
 */
export async function uploadAvatarToS3(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `avatars/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    // Note: Public access is handled by bucket policy, not ACLs
  });

  try {
    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload avatar to S3');
  }
}

/**
 * Delete an avatar from S3
 * @param fileUrl - The full URL of the file to delete
 */
export async function deleteAvatarFromS3(fileUrl: string): Promise<void> {
  try {
    // Extract the key from the URL
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length < 2) {
      throw new Error('Invalid S3 URL');
    }

    const key = urlParts[1];

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    // Don't throw - deletion failures shouldn't break the app
  }
}

/**
 * Upload a campaign banner image to S3
 * @param file - The image file buffer
 * @param fileName - Unique filename for the image
 * @param contentType - MIME type of the image
 * @returns The public URL of the uploaded image
 */
export async function uploadBannerToS3(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `campaign-banners/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading banner to S3:', error);
    throw new Error('Failed to upload banner to S3');
  }
}

/**
 * Generate a unique filename for an avatar
 * @param characterId - The character's unique ID
 * @param originalName - Original filename (for extension)
 * @returns A unique filename
 */
export function generateAvatarFileName(
  characterId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  let extension = originalName.split('.').pop() || '';
  extension = extension.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    extension = 'jpg';
  }
  return `${characterId}-${timestamp}.${extension}`;
}

/**
 * Generate a unique filename for a campaign banner
 * @param campaignCode - The campaign code
 * @param originalName - Original filename (for extension)
 * @returns A unique filename
 */
export function generateBannerFileName(
  campaignCode: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  let extension = originalName.split('.').pop() || '';
  extension = extension.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    extension = 'jpg';
  }
  return `${campaignCode}-${timestamp}.${extension}`;
}

/**
 * Upload an NPC portrait image to S3
 */
export async function uploadNpcPortraitToS3(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `npc-portraits/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    const url = `https://${BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading NPC portrait to S3:', error);
    throw new Error('Failed to upload NPC portrait to S3');
  }
}

/**
 * Generate a unique filename for an NPC portrait
 */
export function generateNpcPortraitFileName(
  npcId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  let extension = originalName.split('.').pop() || '';
  extension = extension.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    extension = 'jpg';
  }
  return `${npcId}-${timestamp}.${extension}`;
}
