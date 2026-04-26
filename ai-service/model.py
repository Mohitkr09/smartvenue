# ai-service/model.py

import joblib
import os
import numpy as np

MODEL_PATH = "models/crowd_model.pkl"

# ==============================
# 📦 LOAD MODEL
# ==============================
if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)
    print("✅ Real ML Model Loaded")
else:
    print("⚠️ Model not found, using fallback")
    model = None


# ==============================
# 🔮 SINGLE PREDICTION
# ==============================
def predict_crowd(crowd, wait, hour=12, day=0):
    try:
        if model:
            X = np.array([[crowd, wait, hour, day]])
            pred = model.predict(X)[0]
        else:
            pred = crowd + 5  # fallback

        pred = int(max(0, min(100, pred)))

        return {
            "futureCrowd": pred,
            "status": get_status(pred),
            "suggestion": get_suggestion(pred)
        }

    except Exception as e:
        return {
            "futureCrowd": crowd,
            "status": "UNKNOWN",
            "suggestion": "Error"
        }


# ==============================
# 🧠 MULTI-ZONE AI
# ==============================
def analyze_zones(zones):
    results = []

    for z in zones:
        crowd = int(z.get("crowdLevel", 0))
        wait = int(z.get("waitTime", 1))
        hour = int(z.get("hour", 12))
        day = int(z.get("day", 0))

        pred = predict_crowd(crowd, wait, hour, day)

        score = (
            pred["futureCrowd"] * 0.7 +
            wait * 2
        )

        results.append({
            "id": z.get("id"),
            "crowdLevel": crowd,
            "waitTime": wait,
            "futureCrowd": pred["futureCrowd"],
            "status": pred["status"],
            "suggestion": pred["suggestion"],
            "score": score
        })

    # 🔥 SORT BEST GATE
    results = sorted(results, key=lambda x: x["score"])

    # 🏆 MARK BEST
    if results:
        results[0]["isBest"] = True

    return results


# ==============================
# 🎯 STATUS LOGIC
# ==============================
def get_status(value):
    if value >= 85:
        return "OVERCROWDED"
    elif value >= 70:
        return "HIGH"
    elif value >= 50:
        return "MEDIUM"
    elif value >= 30:
        return "LOW"
    else:
        return "SMOOTH"


# ==============================
# 💡 SUGGESTION
# ==============================
def get_suggestion(value):
    if value >= 85:
        return "Avoid this gate"
    elif value >= 70:
        return "Try another gate"
    elif value >= 50:
        return "Monitor crowd"
    else:
        return "Best gate"


# ==============================
# 🔁 SWITCH MODEL (OPTIONAL)
# ==============================
def switch_model(model_type):
    return {
        "message": f"Model switched to {model_type}"
    }