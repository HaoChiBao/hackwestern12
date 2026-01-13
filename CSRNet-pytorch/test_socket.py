
import socketio
import time
import sys

# Standard Python Socket.IO Client
sio = socketio.Client(logger=True, engineio_logger=True)

@sio.event
def connect():
    print('[TEST] Connected to server!')

@sio.event
def connect_error(data):
    print(f'[TEST] Connection failed: {data}')

@sio.event
def disconnect():
    print('[TEST] Disconnected from server')

@sio.on('analytics:update')
def on_message(data):
    print(f'[TEST] Received analytics: {data.keys()}')

if __name__ == '__main__':
    try:
        print('[TEST] Attempting to connect to http://localhost:5001...')
        sio.connect('http://localhost:5001') # Removed forced websocket
        
        # Test Emit (if applicable) or just wait
        time.sleep(2)
        print('[TEST] Waiting for events...')
        time.sleep(3)
        
        sio.disconnect()
        print('[TEST] Test Finished Successfully')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'[TEST] Exception: {e}')
        sys.exit(1)
