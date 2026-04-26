# ai-service/model.py

import numpy as np
import joblib
import os

# ==============================
# ⚙️ CONFIG
# ==============================

MODEL_PATH = "models/crowd_model.pkl"

CROWD_WEIGHT = 0.7
DIST_WEIGHT = 0.3

# ==============================
# 📂 LOAD TRAINED MODEL
# ==============================

def load_model():
    if os.path.exists(MODEL_PATH):
        print("✅ Real ML Model Loaded")
        return joblib.load(MODEL_PATH)
    else:
        print("❌ No trained model found. Run train_from_db.py")
        return None

model = load_model()

# ==============================
# 🔮 PREDICT FUTURE CROWD (REAL)
# ==============================

def predict_future_crowd(crowd, wait, hour, day):
    try:
        crowd = int(crowd)
        wait = int(wait)
        hour = int(hour)
        day = int(day)
    except:
        crowd, wait, hour, day = 0, 0, 0, 0

    if model is None:
        return crowd  # fallback

    input_data = np.array([[crowd, wait, hour, day]])

    future = model.predict(input_data)[0]

    return int(max(0, min(100, future)))

# ==============================
# 🎯 STATUS LOGIC
# ==============================

def get_status(future):
    if future >= 85:
        return "OVERCROWDED", "🚨 Avoid this gate"
    elif future >= 70:
        return "HIGH", "⚠️ Try another gate"
    elif future >= 50:
        return "INCREASING", "📈 Crowd increasing"
    elif future >= 30:
        return "MODERATE", "🙂 Safe to proceed"
    else:
        return "SMOOTH", "✅ Best gate"

# ==============================
# 📊 NORMALIZATION
# ==============================

def normalize(value, max_val):
    return value / max_val if max_val else 0

# ==============================
# 🚀 MAIN AI ENGINE (UPDATED)
# ==============================

def analyze_zones(zones):
    if not zones:
        return {
            "bestGate": None,
            "zones": [],
            "alerts": []
        }

    max_crowd = max([z.get("crowdLevel", 0) for z in zones] or [1])
    max_dist = max([z.get("distance", 0) for z in zones] or [1])

    results = []
    alerts = []

    for z in zones:
        gate_id = z.get("id")
        crowd = z.get("crowdLevel", 0)
        distance = z.get("distance", 0)
        wait = z.get("waitTime", 0)

        # 🔥 NEW FEATURES
        hour = z.get("hour", 0)
        day = z.get("day", 0)

        # 🔮 REAL AI prediction
        future = predict_future_crowd(crowd, wait, hour, day)

        # 🧠 normalize
        nc = normalize(crowd, max_crowd)
        nd = normalize(distance, max_dist)

        # 🎯 smart scoring
        score = (1 - nc) * CROWD_WEIGHT + (1 - nd) * DIST_WEIGHT

        status, suggestion = get_status(future)

        result = {
            "id": gate_id,
            "score": round(score, 3),
            "crowdLevel": crowd,
            "distance": distance,
            "futureCrowd": future,
            "status": status,
            "suggestion": suggestion
        }

        results.append(result)

        # 🚨 alerts
        if future >= 85:
            alerts.append({
                "id": gate_id,
                "type": "HIGH_CONGESTION"
            })

    # 🔥 sort best gate
    results.sort(key=lambda x: x["score"], reverse=True)

    best_gate = results[0]["id"]

    return {
        "bestGate": best_gate,
        "zones": results,
        "alerts": alerts
    }

# ==============================
# 🔁 MODEL SWITCH (OPTIONAL)
# ==============================

def switch_model(model_type):
    return {
        "message": "Only ML model supported (real data)"
    }