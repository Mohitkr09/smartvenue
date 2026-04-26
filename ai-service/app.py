from flask import Flask, request, jsonify
from model import predict_crowd, analyze_zones, switch_model
import time
import os
from flask_cors import CORS

app = Flask(__name__)

# ==============================
# 🌐 ENABLE CORS (IMPORTANT)
# ==============================
CORS(app)

# ==============================
# 🏠 HOME
# ==============================
@app.route("/")
def home():
    return jsonify({
        "message": "🤖 Smart Venue AI Service Running",
        "status": "OK",
        "version": "5.0",
        "env": "production"
    })


# ==============================
# ❤️ HEALTH CHECK
# ==============================
@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": int(time.time())
    })


# ==============================
# 🔁 SWITCH MODEL
# ==============================
@app.route("/switch-model", methods=["POST"])
def change_model():
    try:
        data = request.get_json()
        model_type = data.get("type", "ml")

        return jsonify({
            "success": True,
            "data": switch_model(model_type)
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==============================
# 🔮 SINGLE PREDICTION
# ==============================
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data"
            }), 400

        crowd = int(data.get("crowdLevel", 0))
        wait = int(data.get("waitTime", 1))
        gate = data.get("gate_id", "A")

        pred = predict_crowd(crowd, wait)

        return jsonify({
            "success": True,
            "data": {
                "gate_id": gate,
                "futureCrowd": pred["futureCrowd"],
                "status": pred["status"],
                "suggestion": pred["suggestion"]
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==============================
# 🚀 MULTI-GATE AI (MAIN)
# ==============================
@app.route("/predict-zones", methods=["POST"])
def predict_zones():
    try:
        start = time.time()

        data = request.get_json()

        if not data or "zones" not in data:
            return jsonify({
                "success": False,
                "error": "Missing zones"
            }), 400

        zones = data["zones"]

        print(f"📥 AI Request: {len(zones)} zones")

        result = analyze_zones(zones)

        # 🏆 mark best gate
        if isinstance(result, list) and result:
            best = min(result, key=lambda x: x.get("score", 999))

            for r in result:
                r["isBest"] = r["id"] == best["id"]

        duration = round((time.time() - start) * 1000, 2)

        print(f"🤖 AI Done in {duration} ms")

        return jsonify({
            "success": True,
            "data": result,
            "meta": {
                "latency_ms": duration
            }
        })

    except Exception as e:
        print("❌ AI Error:", e)

        return jsonify({
            "success": True,
            "data": data.get("zones", []),
            "fallback": True
        })


# ==============================
# 📦 BATCH
# ==============================
@app.route("/batch", methods=["POST"])
def batch():
    try:
        data = request.get_json()

        results = []

        for item in data.get("items", []):
            result = analyze_zones(item.get("zones", []))
            results.append(result)

        return jsonify({
            "success": True,
            "results": results
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==============================
# 🚀 START SERVER (RENDER FIX)
# ==============================
if __name__ == "__main__":
    print("🚀 Starting AI Service (Production)...")

    port = int(os.environ.get("PORT", 10000))  # Render uses dynamic port

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )