import boto3
from botocore.config import Config

from app.core.config import settings


def get_s3_client():
    """Build boto3 S3 client configured for Neon Object Storage with path-style addressing."""
    return boto3.client(
        "s3",
        endpoint_url=settings.aws_endpoint_url_s3 or None,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        region_name=settings.aws_region,
        config=Config(s3={"addressing_style": "path"}),
    )


def download_object(storage_key: str, bucket_name: str | None = None) -> bytes:
    """Download raw document bytes from Neon Object Storage."""
    target_bucket = bucket_name or settings.neon_storage_bucket
    client = get_s3_client()
    response = client.get_object(Bucket=target_bucket, Key=storage_key)
    return response["Body"].read()
