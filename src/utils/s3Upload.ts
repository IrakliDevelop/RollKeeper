/**
 * S3 Upload Utility
 * Handles avatar uploads to AWS S3
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

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
    
    // Construct the public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
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
 * Generate a unique filename for an avatar
 * @param characterId - The character's unique ID
 * @param originalName - Original filename (for extension)
 * @returns A unique filename
 */
export function generateAvatarFileName(characterId: string, originalName: string): string {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop() || 'jpg';
  return `${characterId}-${timestamp}.${extension}`;
}

