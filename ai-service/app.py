# ai-service/app.py

from flask import Flask, request, jsonify
from model import predict_crowd, switch_model
import time

app = Flask(__name__)

# ==============================
# 🏠 HOME ROUTE
# ==============================

@app.route("/")
def home():
    return jsonify({
        "message": "🤖 AI Service Running",
        "status": "OK",
        "service": "AI Crowd Prediction",
        "version": "2.0"
    })


# ==============================
# ❤️ HEALTH CHECK
# ==============================

@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": time.time()
    })


# ==============================
# 🔁 SWITCH MODEL (ML ↔ TF)
# ==============================

@app.route("/switch-model", methods=["POST"])
def change_model():
    try:
        data = request.get_json()
        model_type = data.get("type", "ml")

        result = switch_model(model_type)

        return jsonify({
            "success": True,
            "data": result
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==============================
# 🔥 PREDICTION API
# ==============================

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        # ❌ No data
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # ✅ Flexible input support
        crowd = data.get("crowdLevel") or data.get("crowd") or 0
        wait = data.get("waitTime") or data.get("wait") or 0
        gate = data.get("gate_id") or data.get("gate") or "A"

        # ✅ Type safety
        try:
            crowd = int(crowd)
            wait = int(wait)
        except:
            return jsonify({
                "success": False,
                "error": "crowd and wait must be numbers"
            }), 400

        # 🧠 AI Prediction
        prediction = predict_crowd(crowd, wait)

        # 📦 Final structured response
        response = {
            "success": True,
            "data": {
                "gate_id": gate,
                "crowd": crowd,
                "waitTime": wait,
                "status": prediction.get("status"),
                "message": prediction.get("message"),
                "futureCrowd": prediction.get("futureCrowd", crowd),
                "suggestion": prediction.get("suggestion")
            }
        }

        return jsonify(response), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==============================
# 🚀 RUN SERVER
# ==============================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7000, debug=True)