import requests
import json

# Test /set_source endpoint
print("Testing /set_source endpoint...")
try:
    response = requests.post(
        'http://localhost:5000/set_source',
        json={'source': 'drone'},
        headers={'Content-Type': 'application/json'}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "="*50 + "\n")

# Test /set_source with webcam
print("Testing /set_source (webcam) endpoint...")
try:
    response = requests.post(
        'http://localhost:5000/set_source',
        json={'source': 'webcam'},
        headers={'Content-Type': 'application/json'}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "="*50 + "\n")

# Test OPTIONS for /set_source
print("Testing OPTIONS for /set_source...")
try:
    response = requests.options('http://localhost:5000/set_source')
    print(f"Status: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
except Exception as e:
    print(f"Error: {e}")
