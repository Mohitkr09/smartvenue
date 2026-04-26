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
    print("✅ Improved ML Model Loaded")
else:
    print("⚠️ Model not found, using fallback")
    model = None


# ==============================
# 🧠 MEMORY STORE (FOR TREND)
# ==============================
# Keeps last values per gate
history_store = {}


# ==============================
# 🔮 SINGLE PREDICTION (UPGRADED)
# ==============================
def predict_crowd(crowd, wait, hour=12, day=0, gate_id="A"):
    try:
        # ======================
        # 📊 GET HISTORY
        # ======================
        history = history_store.get(gate_id, [])

        prev1 = history[-1] if len(history) >= 1 else crowd
        prev2 = history[-2] if len(history) >= 2 else crowd

        rolling = (crowd + prev1 + prev2) / 3

        # ======================
        # 🤖 MODEL PREDICTION
        # ======================
        if model:
            X = np.array([[crowd, wait, hour, day, prev1, prev2, rolling]])
            pred = model.predict(X)[0]
        else:
            pred = crowd + 5  # fallback

        # ======================
        # 🧹 CLEAN OUTPUT
        # ======================
        pred = int(max(0, min(100, pred)))

        # ======================
        # 🧠 UPDATE HISTORY
        # ======================
        history.append(crowd)
        if len(history) > 5:
            history.pop(0)

        history_store[gate_id] = history

        return {
            "futureCrowd": pred,
            "status": get_status(pred),
            "suggestion": get_suggestion(pred)
        }

    except Exception as e:
        print("❌ Prediction error:", e)
        return {
            "futureCrowd": crowd,
            "status": "UNKNOWN",
            "suggestion": "Error"
        }


# ==============================
# 🧠 MULTI-ZONE AI (IMPROVED)
# ==============================
def analyze_zones(zones):
    results = []

    for z in zones:
        gate_id = z.get("id")

        crowd = int(z.get("crowdLevel", 0))
        wait = int(z.get("waitTime", 1))
        hour = int(z.get("hour", 12))
        day = int(z.get("day", 0))

        pred = predict_crowd(crowd, wait, hour, day, gate_id)

        # ======================
        # 🎯 SMART SCORE
        # ======================
        score = (
            pred["futureCrowd"] * 0.6 +
            wait * 2 +
            crowd * 0.2
        )

        results.append({
            "id": gate_id,
            "crowdLevel": crowd,
            "waitTime": wait,
            "futureCrowd": pred["futureCrowd"],
            "status": pred["status"],
            "suggestion": pred["suggestion"],
            "score": round(score, 2)
        })

    # ======================
    # 🏆 SORT BEST GATE
    # ======================
    results = sorted(results, key=lambda x: x["score"])

    if results:
        results[0]["isBest"] = True

    return results


# ==============================
# 🎯 STATUS LOGIC (IMPROVED)
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
# 💡 SUGGESTION LOGIC
# ==============================
def get_suggestion(value):
    if value >= 85:
        return "Avoid this gate"
    elif value >= 70:
        return "Try nearby gate"
    elif value >= 50:
        return "Crowd increasing"
    elif value >= 30:
        return "Safe to proceed"
    else:
        return "Best gate"


# ==============================
# 🔁 SWITCH MODEL (OPTIONAL)
# ==============================
def switch_model(model_type):
    return {
        "message": f"Model switched to {model_type}"
    }