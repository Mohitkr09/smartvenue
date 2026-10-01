from kafka import KafkaProducer
from ultralytics import YOLO
import cv2
import json
import time

# ==============================
# CONFIG
# ==============================

BROKER = "localhost:9092"
TOPIC = "zone-updates"

# IMPORTANT:
# Backend recognizes this as Gate A
GATE_ID = "A"

INTERVAL = 2


# ==============================
# KAFKA PRODUCER
# ==============================

producer = KafkaProducer(
    bootstrap_servers=BROKER,
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)


# ==============================
# YOLO MODEL
# ==============================

model = YOLO("yolov8n.pt")


# ==============================
# CAMERA
# ==============================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Could not open camera")
    exit()


last_sent = 0


# ==============================
# COUNT PEOPLE
# ==============================

def count_people(result):
    count = 0

    if result.boxes is None:
        return 0

    for b in result.boxes:
        if int(b.cls) == 0:
            count += 1

    return count


# ==============================
# MAIN LOOP
# ==============================

try:

    while True:

        ret, frame = cap.read()

        if not ret:
            print("❌ Failed to read camera frame")
            break


        # ------------------------------
        # YOLO DETECTION
        # ------------------------------

        results = model(
            frame,
            conf=0.4,
            verbose=False
        )[0]


        people = count_people(results)


        # ------------------------------
        # CROWD CALCULATION
        # ------------------------------

        crowd = min(100, people * 5)

        wait = max(1, people // 2)


        # ------------------------------
        # DRAW PERSON BOXES
        # ------------------------------

        if results.boxes is not None:

            for b in results.boxes:

                if int(b.cls) == 0:

                    x1, y1, x2, y2 = map(
                        int,
                        b.xyxy[0]
                    )

                    cv2.rectangle(
                        frame,
                        (x1, y1),
                        (x2, y2),
                        (0, 255, 0),
                        2
                    )


        # ------------------------------
        # DISPLAY INFORMATION
        # ------------------------------

        cv2.putText(
            frame,
            f"Gate: {GATE_ID}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"People: {people}",
            (10, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Crowd: {crowd}%",
            (10, 90),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2
        )

        cv2.putText(
            frame,
            f"Wait: {wait} min",
            (10, 120),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2
        )


        # ------------------------------
        # SEND TO KAFKA
        # ------------------------------

        now = time.time()

        if now - last_sent >= INTERVAL:

            payload = {
                "gate_id": GATE_ID,
                "crowdLevel": crowd,
                "waitTime": wait,
                "device_id": "yolo-camera-01",
                "timestamp": int(now)
            }


            try:

                producer.send(
                    TOPIC,
                    payload
                )

                producer.flush()

                print(
                    "📡 YOLO → Kafka:",
                    payload
                )

                last_sent = now

            except Exception as e:

                print(
                    "❌ Kafka error:",
                    e
                )


        # ------------------------------
        # SHOW CAMERA
        # ------------------------------

        cv2.imshow(
            "SmartVenue - YOLO Crowd Detection",
            frame
        )


        # ESC TO EXIT

        if cv2.waitKey(1) & 0xFF == 27:
            break


finally:

    cap.release()

    cv2.destroyAllWindows()

    producer.close()

    print("🛑 YOLO camera producer stopped")