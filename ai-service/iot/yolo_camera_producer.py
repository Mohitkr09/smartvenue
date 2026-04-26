from kafka import KafkaProducer
from ultralytics import YOLO
import cv2, json, time

BROKER = "localhost:9092"  # use your cloud broker in prod
TOPIC = "zone-updates"
GATE_ID = "Gate_A"

producer = KafkaProducer(
    bootstrap_servers=BROKER,
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)

model = YOLO("yolov8n.pt")  # you already have this

cap = cv2.VideoCapture(0)
last_sent = 0
INTERVAL = 2

def count_people(result):
    # class 0 = person
    return sum(1 for b in result.boxes if int(b.cls) == 0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, conf=0.4, verbose=False)[0]
    people = count_people(results)

    crowd = min(100, people * 5)
    wait = max(1, people // 2)

    # draw boxes
    for b in results.boxes:
        if int(b.cls) == 0:
            x1, y1, x2, y2 = map(int, b.xyxy[0])
            cv2.rectangle(frame, (x1,y1),(x2,y2),(0,255,0),2)

    cv2.putText(frame, f"People:{people} Crowd:{crowd}%", (10,30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,255), 2)

    now = time.time()
    if now - last_sent >= INTERVAL:
        payload = {
            "gate_id": GATE_ID,
            "crowdLevel": crowd,
            "waitTime": wait,
            "timestamp": int(now)
        }
        producer.send(TOPIC, payload)
        producer.flush()
        print("📡 YOLO → Kafka:", payload)
        last_sent = now

    cv2.imshow("YOLO Crowd", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()