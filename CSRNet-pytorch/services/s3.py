import boto3
from botocore.exceptions import ClientError
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize S3 Client
# Initialize without explicit credentials first to allow IAM role auto-discovery
# Only use env vars if explicit credentials needed (e.g. local dev without AWS CLI config)
kwargs = {
    'region_name': os.getenv('AWS_REGION', 'us-east-1')
}
if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
    kwargs['aws_access_key_id'] = os.getenv('AWS_ACCESS_KEY_ID')
    kwargs['aws_secret_access_key'] = os.getenv('AWS_SECRET_ACCESS_KEY')

s3_client = boto3.client('s3', **kwargs)

BUCKET_NAME = os.getenv('S3_BUCKET')

def upload_file_to_s3(file_obj, object_name, content_type=None):
    """
    Upload a file-like object to S3.
    """
    if not BUCKET_NAME:
        logger.error("S3_BUCKET env var not set")
        raise ValueError("S3_BUCKET environment variable is not set")

    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type

    try:
        print(f"[DEBUG] Uploading {object_name} to bucket {BUCKET_NAME}")
        s3_client.upload_fileobj(file_obj, BUCKET_NAME, object_name, ExtraArgs=extra_args)
        s3_uri = f"s3://{BUCKET_NAME}/{object_name}"
        logger.info(f"Successfully uploaded to {s3_uri}")
        return s3_uri
    except ClientError as e:
        logger.error(f"Failed to upload to S3: {e}")
        raise

def create_presigned_get_url(object_name, expiration=3600):
    """
    Generate a presigned URL to share an S3 object.
    Parameter `expiration` in seconds.
    """
    if not BUCKET_NAME:
        raise ValueError("S3_BUCKET environment variable is not set")

    try:
        response = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': object_name},
            ExpiresIn=expiration
        )
        return response
    except ClientError as e:
        logger.error(f"Failed to generate presigned URL: {e}")
        return None

def download_s3_to_local(object_name, local_path):
    """
    Download a file from S3 to a local path.
    """
    if not BUCKET_NAME:
        raise ValueError("S3_BUCKET environment variable is not set")

    try:
        s3_client.download_file(BUCKET_NAME, object_name, local_path)
        logger.info(f"Downloaded {object_name} to {local_path}")
        return True
    except ClientError as e:
        logger.error(f"Failed to download from S3: {e}")
        raise
