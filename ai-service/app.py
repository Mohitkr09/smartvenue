from flask import Flask, request, jsonify
from model import predict_crowd, analyze_zones, switch_model
import time
import os
from flask_cors import CORS


# ============================================================
# APP CONFIGURATION
# ============================================================

app = Flask(__name__)

# Enable CORS for React Native / Node.js / deployed frontend
CORS(app)


# ============================================================
# HOME
# ============================================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "🤖 Smart Venue AI Service Running",
        "status": "OK",
        "version": "5.0",
        "env": "production"
    })


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "SmartVenue AI",
        "timestamp": int(time.time())
    })


# ============================================================
# SWITCH MODEL
# ============================================================

@app.route("/switch-model", methods=["POST"])
def change_model():

    try:

        data = request.get_json(silent=True) or {}

        model_type = data.get("type", "ml")

        result = switch_model(model_type)

        return jsonify({
            "success": True,
            "data": result
        }), 200

    except Exception as e:

        print("❌ Model switch error:", str(e))

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================
# SINGLE CROWD PREDICTION
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.get_json(silent=True)

        if not data:

            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400


        # ----------------------------------------
        # Read input
        # ----------------------------------------

        try:
            crowd = float(data.get("crowdLevel", 0))
            wait = float(data.get("waitTime", 1))

        except (ValueError, TypeError):

            return jsonify({
                "success": False,
                "error": "crowdLevel and waitTime must be numbers"
            }), 400


        gate = data.get("gate_id", "A")


        # ----------------------------------------
        # Clamp values
        # ----------------------------------------

        crowd = max(0, min(100, crowd))
        wait = max(0, wait)


        # ----------------------------------------
        # AI prediction
        # ----------------------------------------

        prediction = predict_crowd(
            crowd,
            wait
        )


        return jsonify({

            "success": True,

            "data": {

                "gate_id": gate,

                "futureCrowd": prediction.get(
                    "futureCrowd",
                    crowd
                ),

                "status": prediction.get(
                    "status",
                    "Unknown"
                ),

                "suggestion": prediction.get(
                    "suggestion",
                    ""
                )
            }

        }), 200


    except Exception as e:

        print("❌ Prediction error:", str(e))

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================
# MULTI-GATE AI PREDICTION
# MAIN SMARTVENUE ENDPOINT
# ============================================================

@app.route("/predict-zones", methods=["POST"])
def predict_zones():

    # Keep data outside try so it is available during errors
    data = {}

    try:

        start = time.time()


        # ----------------------------------------
        # Read JSON
        # ----------------------------------------

        data = request.get_json(silent=True) or {}


        if not data:

            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400


        # ----------------------------------------
        # Validate zones
        # ----------------------------------------

        if "zones" not in data:

            return jsonify({
                "success": False,
                "error": "Missing zones"
            }), 400


        zones = data["zones"]


        if not isinstance(zones, list):

            return jsonify({
                "success": False,
                "error": "zones must be an array"
            }), 400


        if len(zones) == 0:

            return jsonify({
                "success": False,
                "error": "zones array is empty"
            }), 400


        print(
            f"📥 AI Request: {len(zones)} zones"
        )


        # ----------------------------------------
        # Print received zones
        # ----------------------------------------

        for zone in zones:

            print(
                f"   📍 {zone.get('id', 'Unknown')} "
                f"| Crowd: {zone.get('crowdLevel', 0)} "
                f"| Wait: {zone.get('waitTime', 0)}"
            )


        # ----------------------------------------
        # AI ANALYSIS
        # ----------------------------------------

        result = analyze_zones(zones)


        # ----------------------------------------
        # Validate AI result
        # ----------------------------------------

        if result is None:

            result = []


        if not isinstance(result, list):

            result = list(result)


        # ----------------------------------------
        # Find best gate
        # ----------------------------------------

        if result:

            best = min(
                result,
                key=lambda x: x.get("score", 999)
                if isinstance(x, dict)
                else 999
            )


            best_id = best.get("id")


            for item in result:

                if isinstance(item, dict):

                    item["isBest"] = (
                        item.get("id") == best_id
                    )


            print(
                f"🏆 Best Gate: {best_id}"
            )

            print(
                f"📊 Best Score: "
                f"{best.get('score', 'N/A')}"
            )


        # ----------------------------------------
        # Calculate latency
        # ----------------------------------------

        duration = round(
            (time.time() - start) * 1000,
            2
        )


        print(
            f"🤖 AI Done in {duration} ms"
        )


        # ----------------------------------------
        # Return AI result
        # ----------------------------------------

        return jsonify({

            "success": True,

            "data": result,

            "meta": {

                "latency_ms": duration,

                "zones_received": len(zones),

                "zones_processed": len(result)
            }

        }), 200


    except Exception as e:

        print(
            "❌ AI Error:",
            str(e)
        )


        # ----------------------------------------
        # FALLBACK
        # ----------------------------------------

        fallback_zones = data.get(
            "zones",
            []
        )


        return jsonify({

            "success": False,

            "data": fallback_zones,

            "fallback": True,

            "error": str(e)

        }), 500


# ============================================================
# BATCH PREDICTION
# ============================================================

@app.route("/batch", methods=["POST"])
def batch():

    try:

        data = request.get_json(
            silent=True
        ) or {}


        items = data.get(
            "items",
            []
        )


        if not isinstance(items, list):

            return jsonify({
                "success": False,
                "error": "items must be an array"
            }), 400


        results = []


        for item in items:

            zones = item.get(
                "zones",
                []
            )


            result = analyze_zones(
                zones
            )


            results.append(result)


        return jsonify({

            "success": True,

            "results": results,

            "count": len(results)

        }), 200


    except Exception as e:

        print(
            "❌ Batch error:",
            str(e)
        )

        return jsonify({

            "success": False,

            "error": str(e)

        }), 500


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print(
        "========================================"
    )

    print(
        "🚀 Starting SmartVenue AI Service"
    )

    print(
        "========================================"
    )


    # Render provides PORT automatically
    port = int(
        os.environ.get(
            "PORT",
            10000
        )
    )


    print(
        f"🌐 Port: {port}"
    )

    print(
        "🤖 AI endpoints ready"
    )


    app.run(

        host="0.0.0.0",

        port=port,

        debug=False

    )