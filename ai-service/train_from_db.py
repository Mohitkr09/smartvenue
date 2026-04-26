# ai-service/train_from_db.py

import os
import pandas as pd
from pymongo import MongoClient
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
from dotenv import load_dotenv

# ==============================
# 🔌 ENV
# ==============================
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["smartvenue"]
collection = db["zonelogs"]

print("📥 Fetching data...")
data = list(collection.find())

if len(data) < 30:
    raise ValueError("❌ Need at least 30 records")

df = pd.DataFrame(data)

# ==============================
# 🧹 CLEAN
# ==============================
df = df[["crowdLevel", "waitTime", "hour", "day", "timestamp"]]
df = df.dropna()
df = df.sort_values("timestamp")

# ==============================
# 🧠 FEATURE ENGINEERING
# ==============================

# Previous values
df["prev1"] = df["crowdLevel"].shift(1)
df["prev2"] = df["crowdLevel"].shift(2)

# Rolling average (trend)
df["rolling3"] = df["crowdLevel"].rolling(3).mean()

# Future smoothing (target)
df["future"] = (
    df["crowdLevel"].shift(-1) +
    df["crowdLevel"].shift(-2) +
    df["crowdLevel"].shift(-3)
) / 3

df = df.dropna()

# ==============================
# 📊 FEATURES
# ==============================
X = df[[
    "crowdLevel",
    "waitTime",
    "hour",
    "day",
    "prev1",
    "prev2",
    "rolling3"
]]

y = df["future"]

# ==============================
# ✂️ SPLIT
# ==============================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, shuffle=False
)

# ==============================
# 🚀 MODEL
# ==============================
model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    random_state=42
)

model.fit(X_train, y_train)

score = model.score(X_test, y_test)
print(f"📊 New R² score: {score:.3f}")

# ==============================
# 💾 SAVE
# ==============================
os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/crowd_model.pkl")

print("✅ Improved model saved")