import cv2
cap = cv2.VideoCapture("rtmp://192.168.2.90:1935/live/dji")
print("Opened:", cap.isOpened())
ret, frame = cap.read()
print("ret:", ret)
