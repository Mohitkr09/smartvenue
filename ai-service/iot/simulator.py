# iot/simulator.py

import time
import random
import requests
import threading

# ==============================
# ⚙️ CONFIG
# ==============================

API_URL = "http://localhost:5000/iot-data"
SEND_INTERVAL = 2  # seconds
GATES = ["A", "B", "C", "D"]

DEVICE_ID = "iot-simulator-1"

# simulate peak hours
PEAK_HOURS = [18, 19, 20]  # evening rush


# ==============================
# 🧠 REALISTIC CROWD GENERATOR
# ==============================

def generate_crowd(gate):
    hour = time.localtime().tm_hour

    # peak time logic
    if hour in PEAK_HOURS:
        base = random.randint(60, 100)
    else:
        base = random.randint(10, 60)

    # gate variation
    variation = {
        "A": random.randint(-10, 10),
        "B": random.randint(-5, 15),
        "C": random.randint(-15, 5),
        "D": random.randint(-20, 10),
    }

    crowd = max(0, min(100, base + variation.get(gate, 0)))

    wait = max(1, int(crowd * 0.2))

    return crowd, wait


# ==============================
# 📡 SEND DATA
# ==============================

def send_data(payload):
    try:
        res = requests.post(API_URL, json=payload, timeout=5)

        if res.status_code == 200:
            print(f"✅ Sent: {payload}")
        else:
            print(f"⚠️ Server error {res.status_code}")

    except requests.exceptions.RequestException as e:
        print("❌ Network error:", e)


# ==============================
# 🚀 SINGLE GATE LOOP
# ==============================

def run_gate(gate):
    while True:
        crowd, wait = generate_crowd(gate)

        payload = {
            "device_id": DEVICE_ID,
            "gate_id": gate,
            "crowdLevel": crowd,
            "waitTime": wait,
            "timestamp": int(time.time())
        }

        send_data(payload)

        time.sleep(SEND_INTERVAL)


# ==============================
# 🚀 START ALL GATES (MULTI-THREAD)
# ==============================

def start_simulation():
    print("🚀 Starting IoT Simulator...")

    for gate in GATES:
        thread = threading.Thread(target=run_gate, args=(gate,))
        thread.daemon = True
        thread.start()

    while True:
        time.sleep(1)


# ==============================
# ▶️ RUN
# ==============================

if __name__ == "__main__":
    start_simulation()