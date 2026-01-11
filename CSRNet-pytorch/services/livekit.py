import os
import logging
from livekit import api
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
LIVEKIT_URL = os.getenv('LIVEKIT_URL')

def get_livekit_config():
    return {
        'url': LIVEKIT_URL,
        'api_key': LIVEKIT_API_KEY
    }

def generate_token(room_name, participant_identity, participant_name=None, is_publisher=False):
    """
    Generate an Access Token for a participant to join a LiveKit room.
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        logger.error("LiveKit API Key/Secret missing")
        raise ValueError("LiveKit credentials not configured")

    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    
    # Set video grants
    video_grant = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=is_publisher,
        can_subscribe=True,
    )
    
    token.with_grants(video_grant)
    token.with_identity(participant_identity)
    
    if participant_name:
        token.with_name(participant_name)
    
    # Defaults to 6 hours or similar
    jwt_token = token.to_jwt()
    logger.info(f"Generated LiveKit token for {participant_identity} in {room_name}")
    
    return jwt_token
