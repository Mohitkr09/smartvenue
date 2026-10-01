# ai-service/model.py

import joblib
import os
import numpy as np


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "models",
    "crowd_model.pkl"
)


# ==========================================================
# LOAD ML MODEL
# ============================================================

if os.path.exists(MODEL_PATH):

    try:

        model = joblib.load(MODEL_PATH)

        print("✅ Improved ML Model Loaded")
        print(f"📦 Model: {MODEL_PATH}")

    except Exception as e:

        print("❌ Failed to load ML model:", e)

        model = None

else:

    print("⚠️ Model not found, using fallback")

    model = None


# ============================================================
# MEMORY STORE
# ============================================================
#
# Stores recent crowd values separately for each gate.
#
# Example:
#
# {
#     "Gate A": [20, 25, 30],
#     "Gate B": [10, 15, 12]
# }
#
# This allows the model to use recent crowd trends.
# ============================================================

history_store = {}


# ============================================================
# CONSTANTS
# ============================================================

MAX_HISTORY = 5

MIN_CROWD = 0
MAX_CROWD = 100

MIN_WAIT = 0


# ============================================================
# SAFE NUMBER HELPERS
# ============================================================

def safe_float(value, default=0.0):

    try:

        number = float(value)

        if not np.isfinite(number):
            return float(default)

        return number

    except (TypeError, ValueError):

        return float(default)


def safe_int(value, default=0):

    try:

        return int(float(value))

    except (TypeError, ValueError):

        return int(default)


def clamp(value, minimum, maximum):

    return max(
        minimum,
        min(maximum, value)
    )


# ============================================================
# STATUS LOGIC
# ============================================================

def get_status(value):

    value = clamp(
        safe_float(value),
        MIN_CROWD,
        MAX_CROWD
    )

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


# ============================================================
# SUGGESTION LOGIC
# ============================================================

def get_suggestion(value):

    value = clamp(
        safe_float(value),
        MIN_CROWD,
        MAX_CROWD
    )

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


# ============================================================
# HISTORY MANAGEMENT
# ============================================================

def get_gate_history(gate_id):

    if not gate_id:

        gate_id = "A"

    gate_id = str(gate_id)

    return history_store.get(
        gate_id,
        []
    )


def update_gate_history(gate_id, crowd):

    if not gate_id:

        gate_id = "A"

    gate_id = str(gate_id)

    history = history_store.get(
        gate_id,
        []
    )

    history.append(
        crowd
    )

    if len(history) > MAX_HISTORY:

        history = history[-MAX_HISTORY:]


    history_store[gate_id] = history


# ============================================================
# CROWD PREDICTION
# ============================================================

def predict_crowd(
    crowd,
    wait,
    hour=12,
    day=0,
    gate_id="A"
):

    try:

        # ----------------------------------------------------
        # CLEAN INPUT
        # ----------------------------------------------------

        crowd = clamp(
            safe_float(crowd),
            MIN_CROWD,
            MAX_CROWD
        )

        wait = max(
            MIN_WAIT,
            safe_float(wait)
        )

        hour = clamp(
            safe_int(hour, 12),
            0,
            23
        )

        day = clamp(
            safe_int(day, 0),
            0,
            6
        )


        # ----------------------------------------------------
        # GET HISTORY
        # ----------------------------------------------------

        history = get_gate_history(
            gate_id
        )


        # Previous crowd values

        prev1 = (
            history[-1]
            if len(history) >= 1
            else crowd
        )

        prev2 = (
            history[-2]
            if len(history) >= 2
            else crowd
        )


        # ----------------------------------------------------
        # ROLLING CROWD
        # ----------------------------------------------------

        rolling = (
            crowd +
            prev1 +
            prev2
        ) / 3.0


        # ----------------------------------------------------
        # MODEL PREDICTION
        # ----------------------------------------------------

        if model is not None:

            # IMPORTANT:
            #
            # The trained model must expect
            # these 7 features in this order:
            #
            # 1. crowd
            # 2. wait
            # 3. hour
            # 4. day
            # 5. prev1
            # 6. prev2
            # 7. rolling

            X = np.array([
                [
                    crowd,
                    wait,
                    hour,
                    day,
                    prev1,
                    prev2,
                    rolling
                ]
            ], dtype=float)


            prediction = model.predict(
                X
            )[0]

            pred = safe_float(
                prediction,
                crowd
            )

        else:

            # ------------------------------------------------
            # FALLBACK PREDICTION
            # ------------------------------------------------
            #
            # Use recent trend instead of simply
            # adding a fixed value.
            # ------------------------------------------------

            trend = crowd - prev1

            pred = crowd + (
                trend * 0.5
            )


        # ----------------------------------------------------
        # CLEAN PREDICTION
        # ----------------------------------------------------

        pred = clamp(
            pred,
            MIN_CROWD,
            MAX_CROWD
        )

        pred = int(
            round(pred)
        )


        # ----------------------------------------------------
        # UPDATE HISTORY
        # ----------------------------------------------------

        update_gate_history(
            gate_id,
            crowd
        )


        # ----------------------------------------------------
        # RETURN
        # ----------------------------------------------------

        return {

            "futureCrowd": pred,

            "status": get_status(
                pred
            ),

            "suggestion": get_suggestion(
                pred
            )

        }


    except Exception as e:

        print(
            f"❌ Prediction error for {gate_id}:",
            str(e)
        )


        # Safe fallback

        crowd = clamp(
            safe_float(crowd),
            MIN_CROWD,
            MAX_CROWD
        )

        return {

            "futureCrowd": int(
                round(crowd)
            ),

            "status": get_status(
                crowd
            ),

            "suggestion": "Prediction unavailable"

        }


# ============================================================
# MULTI-GATE AI ANALYSIS
# ============================================================

def analyze_zones(zones):

    results = []


    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not isinstance(zones, list):

        print(
            "⚠️ analyze_zones received non-list input"
        )

        return []


    # --------------------------------------------------------
    # Process each gate
    # --------------------------------------------------------

    for index, zone in enumerate(zones):

        try:

            if not isinstance(zone, dict):

                continue


            # ------------------------------------------------
            # Gate ID
            # ------------------------------------------------

            gate_id = zone.get(
                "id",
                zone.get(
                    "name",
                    f"Gate {index + 1}"
                )
            )

            if gate_id is None:

                gate_id = f"Gate {index + 1}"


            gate_id = str(
                gate_id
            )


            # ------------------------------------------------
            # Current values
            # ------------------------------------------------

            crowd = clamp(
                safe_float(
                    zone.get(
                        "crowdLevel",
                        0
                    )
                ),
                MIN_CROWD,
                MAX_CROWD
            )


            wait = max(
                MIN_WAIT,
                safe_float(
                    zone.get(
                        "waitTime",
                        1
                    )
                )
            )


            hour = clamp(
                safe_int(
                    zone.get(
                        "hour",
                        12
                    ),
                    12
                ),
                0,
                23
            )


            day = clamp(
                safe_int(
                    zone.get(
                        "day",
                        0
                    ),
                    0
                ),
                0,
                6
            )


            # ------------------------------------------------
            # ML PREDICTION
            # ------------------------------------------------

            prediction = predict_crowd(

                crowd=crowd,

                wait=wait,

                hour=hour,

                day=day,

                gate_id=gate_id

            )


            future_crowd = prediction[
                "futureCrowd"
            ]


            # ------------------------------------------------
            # SMART GATE SCORE
            # ------------------------------------------------
            #
            # Lower score = better gate.
            #
            # Current weighting:
            #
            # Future crowd : 60%
            # Wait time    : 20%
            # Current crowd: 20%
            #
            # Wait is normalized to prevent very large
            # wait values from dominating the score.
            # ------------------------------------------------

            wait_score = min(
                wait * 2,
                100
            )


            score = (

                future_crowd * 0.60

                +

                wait_score * 0.20

                +

                crowd * 0.20

            )


            score = round(
                score,
                2
            )


            # ------------------------------------------------
            # RESULT
            # ------------------------------------------------

            result = {

                "id": gate_id,

                "crowdLevel": int(
                    round(crowd)
                ),

                "waitTime": round(
                    wait,
                    2
                ),

                "futureCrowd": int(
                    future_crowd
                ),

                "status": prediction[
                    "status"
                ],

                "suggestion": prediction[
                    "suggestion"
                ],

                "score": score,

                "isBest": False

            }


            # ------------------------------------------------
            # Preserve optional information
            # ------------------------------------------------

            if "lat" in zone:

                result["lat"] = zone[
                    "lat"
                ]


            if "lng" in zone:

                result["lng"] = zone[
                    "lng"
                ]


            if "riskScore" in zone:

                result["riskScore"] = zone[
                    "riskScore"
                ]


            if "riskLevel" in zone:

                result["riskLevel"] = zone[
                    "riskLevel"
                ]


            if "riskReason" in zone:

                result["riskReason"] = zone[
                    "riskReason"
                ]


            results.append(
                result
            )


        except Exception as e:

            print(
                f"❌ Zone analysis error "
                f"for zone {index}:",
                str(e)
            )

            continue


    # ========================================================
    # SORT BY SCORE
    # ========================================================

    results.sort(
        key=lambda x: x.get(
            "score",
            999999
        )
    )


    # ========================================================
    # MARK BEST GATE
    # ========================================================

    if results:

        results[0][
            "isBest"
        ] = True


        print(
            f"🏆 Recommended Gate: "
            f"{results[0]['id']}"
        )

        print(
            f"📊 Score: "
            f"{results[0]['score']}"
        )


    return results


# ============================================================
# SWITCH MODEL
# ============================================================

def switch_model(model_type):

    model_type = str(
        model_type or "ml"
    ).lower()


    supported_models = [
        "ml",
        "fallback"
    ]


    if model_type not in supported_models:

        return {

            "success": False,

            "message": (
                f"Unsupported model type: "
                f"{model_type}"
            ),

            "available": supported_models

        }


    return {

        "success": True,

        "message": (
            f"Model switched to "
            f"{model_type}"
        )

    }