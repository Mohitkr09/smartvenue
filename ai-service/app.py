from flask import Flask, request, jsonify
from model import predict_crowd, analyze_zones, switch_model
import time

app = Flask(__name__)

# ==============================
# 🏠 HOME
# ==============================
@app.route("/")
def home():
    return jsonify({
        "message": "🤖 Smart Venue AI Service Running",
        "status": "OK",
        "version": "4.0",
        "features": [
            "Single Gate Prediction",
            "Multi Gate AI Ranking",
            "Best Gate Recommendation",
            "Alert Detection",
            "ML + TensorFlow Support"
        ]
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
# 🔥 SINGLE GATE
# ==============================
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        crowd = data.get("crowdLevel") or data.get("crowd") or 0
        wait = data.get("waitTime") or data.get("wait") or 0
        gate = data.get("gate_id") or data.get("gate") or "A"

        try:
            crowd = int(crowd)
            wait = int(wait)
        except:
            return jsonify({
                "success": False,
                "error": "crowd and wait must be numbers"
            }), 400

        prediction = predict_crowd(crowd, wait)

        return jsonify({
            "success": True,
            "data": {
                "gate_id": gate,
                "crowd": crowd,
                "waitTime": wait,
                "status": prediction.get("status"),
                "futureCrowd": prediction.get("futureCrowd"),
                "message": prediction.get("message"),
                "suggestion": prediction.get("suggestion")
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==============================
# 🚀 MULTI-GATE AI (CORE)
# ==============================
@app.route("/predict-zones", methods=["POST"])
def predict_zones():
    try:
        start = time.time()

        data = request.get_json()

        if not data or "zones" not in data:
            return jsonify({
                "success": False,
                "error": "Missing zones array"
            }), 400

        zones = data["zones"]

        if not isinstance(zones, list) or len(zones) == 0:
            return jsonify({
                "success": False,
                "error": "zones must be non-empty list"
            }), 400

        print(f"📥 AI Request: {len(zones)} zones")

        # ==============================
        # 🧠 AI ANALYSIS
        # ==============================
        result = analyze_zones(zones)

        # ==============================
        # 🏆 MARK BEST GATE
        # ==============================
        if isinstance(result, list) and len(result) > 0:
            best = min(result, key=lambda x: x.get("futureCrowd", 100))

            for r in result:
                r["isBest"] = r["id"] == best["id"]

        duration = round((time.time() - start) * 1000, 2)

        print(f"🤖 AI Done in {duration}ms")

        return jsonify({
            "success": True,
            "data": result,
            "meta": {
                "latency_ms": duration,
                "zones_processed": len(zones)
            }
        })

    except Exception as e:
        print("❌ AI Error:", e)

        # 🔁 FALLBACK (no crash)
        return jsonify({
            "success": True,
            "data": data.get("zones", []),
            "fallback": True
        })


# ==============================
# 📦 BATCH MODE
# ==============================
@app.route("/batch", methods=["POST"])
def batch():
    try:
        data = request.get_json()

        if not data or "items" not in data:
            return jsonify({
                "success": False,
                "error": "Missing items"
            }), 400

        results = []

        for item in data["items"]:
            zones = item.get("zones", [])
            result = analyze_zones(zones)
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
# 🚀 RUN SERVER
# ==============================
if __name__ == "__main__":
    print("🚀 Starting AI Service...")
    app.run(host="0.0.0.0", port=7000, debug=True)