# model.py

import numpy as np
import joblib
import os

# Optional TensorFlow
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except:
    TF_AVAILABLE = False

# ==============================
# ⚙️ CONFIG
# ==============================

MODEL_TYPE = "ml"   # "ml" or "tf"
MODEL_FILE = "crowd_model.pkl"

# ==============================
# 📊 TRAIN ML MODEL (Fallback)
# ==============================

def train_ml_model():
    X = np.array([
        [10, 2],
        [20, 5],
        [30, 7],
        [40, 10],
        [50, 12],
        [60, 15],
        [70, 18],
        [80, 20],
        [90, 25],
    ])

    y = np.array([12, 25, 35, 50, 60, 75, 85, 95, 100])

    from sklearn.linear_model import LinearRegression
    model = LinearRegression()
    model.fit(X, y)

    joblib.dump(model, MODEL_FILE)
    return model


# ==============================
# 📂 LOAD ML MODEL
# ==============================

def load_ml_model():
    if os.path.exists(MODEL_FILE):
        print("✅ ML Model Loaded")
        return joblib.load(MODEL_FILE)
    else:
        print("⚠️ Training ML Model...")
        return train_ml_model()


# ==============================
# 🧠 TENSORFLOW MODEL
# ==============================

def build_tf_model():
    if not TF_AVAILABLE:
        return None

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(8, activation='relu', input_shape=(2,)),
        tf.keras.layers.Dense(4, activation='relu'),
        tf.keras.layers.Dense(1)
    ])

    model.compile(optimizer='adam', loss='mse')

    # Dummy training
    X = np.array([
        [10,2],[20,5],[30,7],[40,10],[50,12],
        [60,15],[70,18],[80,20],[90,25]
    ])

    y = np.array([12,25,35,50,60,75,85,95,100])

    model.fit(X, y, epochs=100, verbose=0)

    print("✅ TensorFlow Model Ready")

    return model


# ==============================
# 🚀 INITIALIZE MODELS
# ==============================

ml_model = load_ml_model()
tf_model = build_tf_model() if TF_AVAILABLE else None


# ==============================
# 🔥 PREDICTION ENGINE
# ==============================

def predict_crowd(crowd, wait):

    try:
        crowd = int(crowd)
        wait = int(wait)
    except:
        crowd = 0
        wait = 0

    input_data = np.array([[crowd, wait]])

    # 🔁 Choose model dynamically
    if MODEL_TYPE == "tf" and tf_model is not None:
        future = tf_model.predict(input_data)[0][0]
    else:
        future = ml_model.predict(input_data)[0]

    # 🧹 Clean output
    future = int(max(0, min(100, future)))

    # ==============================
    # 🎯 SMART DECISION LOGIC
    # ==============================

    if future >= 85:
        return {
            "status": "OVERCROWDED",
            "futureCrowd": future,
            "message": "🚨 Will be overcrowded soon",
            "suggestion": "Avoid this gate"
        }

    elif future >= 70:
        return {
            "status": "HIGH",
            "futureCrowd": future,
            "message": "⚠️ High crowd expected",
            "suggestion": "Try nearby gate"
        }

    elif future >= 50:
        return {
            "status": "INCREASING",
            "futureCrowd": future,
            "message": "📈 Crowd increasing",
            "suggestion": "Monitor before entering"
        }

    elif future >= 30:
        return {
            "status": "MODERATE",
            "futureCrowd": future,
            "message": "🙂 Moderate crowd",
            "suggestion": "Safe to proceed"
        }

    else:
        return {
            "status": "SMOOTH",
            "futureCrowd": future,
            "message": "✅ Smooth entry",
            "suggestion": "Best gate"
        }


# ==============================
# 🔁 SWITCH MODEL (API USE)
# ==============================

def switch_model(model_type):
    global MODEL_TYPE

    if model_type not in ["ml", "tf"]:
        return {"error": "Invalid model type"}

    if model_type == "tf" and not TF_AVAILABLE:
        return {"error": "TensorFlow not installed"}

    MODEL_TYPE = model_type

    return {
        "message": f"Model switched to {MODEL_TYPE}"
    }