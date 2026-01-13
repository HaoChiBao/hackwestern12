
import urllib.request
import urllib.error

try:
    print("Testing Basic HTTP connectivity...")
    url = 'http://localhost:5001/socket.io/?EIO=4&transport=polling'
    with urllib.request.urlopen(url) as response:
        print(f"Status Code: {response.getcode()}")
        print(f"Response: {response.read().decode('utf-8')[:200]}")
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} {e.reason}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
