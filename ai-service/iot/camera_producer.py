# iot/camera_producer.py

from kafka import KafkaProducer
import json
import time
import cv2
import numpy as np

# ==============================
# ⚙️ CONFIG
# ==============================

KAFKA_BROKER = "localhost:9092"
TOPIC = "zone-updates"
GATE_ID = "Gate_A"

SEND_INTERVAL = 2   # seconds
SMOOTH_WINDOW = 5   # smoothing buffer

# ==============================
# 📡 KAFKA PRODUCER
# ==============================

def create_producer():
    return KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        retries=5
    )

producer = create_producer()

# ==============================
# 🎥 CAMERA SETUP
# ==============================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Camera not found")
    exit()

# ==============================
# 🧠 HUMAN DETECTOR (HOG)
# ==============================

hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

# ==============================
# 📊 SMOOTHING BUFFER
# ==============================

history = []

def smooth_count(count):
    history.append(count)
    if len(history) > SMOOTH_WINDOW:
        history.pop(0)
    return int(np.mean(history))

# ==============================
# 📤 SEND DATA
# ==============================

def send_to_kafka(data):
    try:
        producer.send(TOPIC, data)
        producer.flush()
        print("📡 Sent:", data)
    except Exception as e:
        print("❌ Kafka error:", e)

# ==============================
# 🚀 MAIN LOOP
# ==============================

last_sent = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ Frame read failed")
        break

    # Resize for speed
    frame = cv2.resize(frame, (640, 480))

    # Detect people
    boxes, weights = hog.detectMultiScale(frame, winStride=(8, 8))

    people_count = len(boxes)

    # Smooth count
    smooth_people = smooth_count(people_count)

    # Convert to crowd %
    crowd_level = min(100, smooth_people * 5)

    wait_time = max(1, smooth_people // 2)

    # Draw boxes
    for (x, y, w, h) in boxes:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)

    # Display info
    cv2.putText(frame, f"People: {smooth_people}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.putText(frame, f"Crowd: {crowd_level}%", (10, 70),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

    # ==============================
    # 📡 SEND DATA (INTERVAL BASED)
    # ==============================

    now = time.time()

    if now - last_sent >= SEND_INTERVAL:
        payload = {
            "gate_id": GATE_ID,
            "crowdLevel": int(crowd_level),
            "waitTime": int(wait_time),
            "timestamp": int(now)
        }

        send_to_kafka(payload)
        last_sent = now

    # Show window
    cv2.imshow("Smart Venue Camera", frame)

    # ESC to exit
    if cv2.waitKey(1) & 0xFF == 27:
        break

# ==============================
# 🔌 CLEANUP
# ==============================

cap.release()
cv2.destroyAllWindows()

try:
    producer.close()
except:
    pass

print("🔌 Camera stopped")