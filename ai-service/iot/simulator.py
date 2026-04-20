# iot/simulator.py (MOVE THIS OUTSIDE ai-service)

import time
import random
import requests

GATES = ["A", "B", "C", "D"]

while True:
    data = {
        "gate_id": random.choice(GATES),
        "crowdLevel": random.randint(10, 100),
        "waitTime": random.randint(1, 20)
    }

    requests.post("http://localhost:5000/iot-data", json=data)
    print("📡 Sent:", data)

    time.sleep(2)