from kafka import KafkaProducer
import json
import time
import cv2

producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

cap = cv2.VideoCapture(0)

hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

GATE_ID = "Gate A"

while True:
    ret, frame = cap.read()
    if not ret:
        break

    boxes, _ = hog.detectMultiScale(frame)
    count = len(boxes)

    data = {
        "gate_id": GATE_ID,
        "crowdLevel": min(100, count * 5),
        "waitTime": max(1, count // 2)
    }

    print("📡 Sending:", data)

    producer.send("zone-updates", data)

    cv2.imshow("Camera", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

    time.sleep(2)

cap.release()
cv2.destroyAllWindows()