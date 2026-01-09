import cv2

# ----------------------
# RTMP Video Source
# ----------------------
RTMP_URL = "rtmp://192.168.2.90:1935/live/dji"   # same URL as before
print(f"Opening RTMP stream: {RTMP_URL}")

cap = cv2.VideoCapture(RTMP_URL)

# Try to minimize internal buffering (not all backends respect this, but worth it)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("❌ ERROR: Could not open RTMP livestream. Start the drone stream first.")
    exit(1)

print("✅ RTMP stream opened successfully")
print("🎥 Showing raw RTMP video… Press Q to quit.")

while True:
    ret, frame = cap.read()

    if not ret or frame is None:
        print("⚠ No RTMP frame yet…")
        continue  # no sleep here – keep trying to stay as “live” as possible

    cv2.imshow("RAW RTMP Preview", frame)

    # Quit if Q pressed
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
