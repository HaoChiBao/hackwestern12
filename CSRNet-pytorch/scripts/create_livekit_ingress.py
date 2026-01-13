
import asyncio
import argparse
import sys
import os

# Add parent dir to sys.path so we can import services
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from services.livekit import create_ingress

async def main():
    parser = argparse.ArgumentParser(description="Create LiveKit RTMP Ingress")
    parser.add_argument("--room", default="default-room", help="Room name to connect to")
    parser.add_argument("--identity", default="drone", help="Participant identity")
    parser.add_argument("--name", default="Drone", help="Participant display name")
    
    args = parser.parse_args()
    
    print(f"Creating Ingress for Room: {args.room} (Identity: {args.identity})")
    
    try:
        info = await create_ingress(args.room, args.identity, args.name)
        
        print("\n--- INGRESS CREATED SUCCESSFULLY ---")
        print(f"Ingress ID:  {info.ingress_id}")
        print(f"RTMP URL:    {info.url}")
        print(f"Stream Key:  {info.stream_key}")
        print("-" * 40)
        print(f"FULL PUBLISH URL (Put this in .env):")
        print(f"{info.url}/{info.stream_key}")
        print("-" * 40)
        
    except Exception as e:
        print(f"\nError creating ingress: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
