import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'

let s3ClientInstance: S3Client | null = null

export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_ENDPOINT_URL_S3) {
      throw new Error('Neon Object Storage credentials are not configured in environment.')
    }

    s3ClientInstance = new S3Client({
      forcePathStyle: true, // required: Neon uses path-style addressing
      region: env.AWS_REGION,
      endpoint: env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }

  return s3ClientInstance
}

export function buildStorageKey(companyId: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `documents/${companyId}/${timestamp}-${randomSuffix}-${sanitized}`
}

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string = 'application/octet-stream',
  bucketName: string = env.NEON_STORAGE_BUCKET
) {
  const client = getS3Client()
  return client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: typeof body === 'string' ? Buffer.from(body) : body,
      ContentType: contentType,
    })
  )
}

export async function getObject(key: string, bucketName: string = env.NEON_STORAGE_BUCKET) {
  const client = getS3Client()
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  )

  const bytes = await res.Body?.transformToByteArray()
  return {
    bytes,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  }
}

export async function deleteObject(key: string, bucketName: string = env.NEON_STORAGE_BUCKET) {
  const client = getS3Client()
  return client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  )
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600,
  bucketName: string = env.NEON_STORAGE_BUCKET
) {
  const client = getS3Client()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  )
}
