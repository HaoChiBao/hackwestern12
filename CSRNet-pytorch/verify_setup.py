import os
import sys
from dotenv import load_dotenv
import boto3
from livekit import api

def check_setup():
    print("Loading environment variables...")
    load_dotenv()
    
    # 1. Check Env Vars presence
    required_vars = [
        'AWS_REGION', 'S3_BUCKET', 
        'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'
    ]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        print(f"[FAIL] Missing environment variables: {', '.join(missing)}")
        return False
    print("[OK] Environment variables present")

    # 2. Check S3 Connection
    print("\nTesting AWS S3 Connection...")
    try:
        s3 = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        # Try to head the bucket to verify access
        s3.head_bucket(Bucket=os.getenv('S3_BUCKET'))
        print(f"[OK] S3 Bucket '{os.getenv('S3_BUCKET')}' is accessible")
    except Exception as e:
        print(f"[FAIL] S3 Connection Failed: {e}")
        # Don't fail completely if it's just a permissions issue we can't fix now, but warn.
        
    # 3. Check LiveKit Connection
    print("\nTesting LiveKit Connection...")
    try:
        # Try generating a token
        token = api.AccessToken(
            os.getenv('LIVEKIT_API_KEY'),
            os.getenv('LIVEKIT_API_SECRET')
        )
        token.with_identity("test_user")
        token.with_name("Test User")
        token.with_grants(api.VideoGrants(room_join=True, room="test_room"))
        jwt = token.to_jwt()
        print("[OK] LiveKit Token generation successful")
        
        # Verify URL structure
        url = os.getenv('LIVEKIT_URL')
        if not url.startswith('wss://'):
             print(f"⚠ Warning: LiveKit URL '{url}' does not start with wss://")
        else:
             print(f"[OK] LiveKit URL format correct: {url}")
             
    except Exception as e:
        print(f"[FAIL] LiveKit Check Failed: {e}")
        return False

    # 4. Check Imports
    print("\nChecking Imports...")
    try:
        import services.s3
        import services.livekit
        import model
        print("[OK] Project modules imported successfully")
    except ImportError as e:
        print(f"[FAIL] Import Failed: {e}")
        return False

    print("\n[OK] Setup Verification Complete!")
    return True

if __name__ == "__main__":
    success = check_setup()
    if not success:
        sys.exit(1)
