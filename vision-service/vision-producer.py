import cv2
import time
import json
import random
from kafka import KafkaProducer
from ultralytics import YOLO

# 🔥 Load YOLOv8 model
model = YOLO("yolov8n.pt")  # lightweight model

# 📡 Kafka setup
producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

TOPIC = "zone-updates"

# 🎥 Simulate multiple gates (multiple cameras)
CAMERAS = {
    "A": 0,   # webcam
    "B": 0,
    "C": 0,
    "D": 0
}

# 🚀 Open cameras
caps = {gate: cv2.VideoCapture(src) for gate, src in CAMERAS.items()}

def detect_people(frame):
    results = model(frame, verbose=False)
    count = 0

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            if cls == 0:  # person class
                count += 1

    return count


def compute_metrics(count):
    crowd = min(100, count * 5)  # scale crowd %
    wait = max(1, count // 3)    # wait time estimate
    return crowd, wait


print("🎥 Vision AI Started...")

while True:
    for gate, cap in caps.items():
        ret, frame = cap.read()

        if not ret:
            continue

        # 🧠 Detect people
        people_count = detect_people(frame)

        # 📊 Convert to crowd metrics
        crowd, wait = compute_metrics(people_count)

        # 🔥 Add slight randomness (simulate real fluctuation)
        crowd += random.randint(-5, 5)
        crowd = max(0, min(100, crowd))

        data = {
            "gate_id": gate,
            "crowdLevel": crowd,
            "waitTime": wait,
            "timestamp": time.time()
        }

        # 📡 Send to Kafka
        producer.send(TOPIC, data)

        print(f"📤 Gate {gate} → People: {people_count} | Crowd: {crowd}%")

        # (Optional) show camera
        cv2.imshow(f"Gate {gate}", frame)

    # Exit on ESC
    if cv2.waitKey(1) == 27:
        break

# 🔌 Cleanup
for cap in caps.values():
    cap.release()

cv2.destroyAllWindows()