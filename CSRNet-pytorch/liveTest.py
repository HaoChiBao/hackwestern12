import cv2

URL = "rtmp://192.168.2.90:1935/live/dji"

cap = cv2.VideoCapture(URL)

if not cap.isOpened():
    print("❌ Could not open RTMP stream. Start drone livestream first.")
    exit()

print("✅ Stream opened. Press Q to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("⚠ No frame yet... retrying...")
        continue
    
    cv2.imshow("DJI Livestream", frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
