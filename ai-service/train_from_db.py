import os
import pandas as pd
from pymongo import MongoClient
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
from dotenv import load_dotenv

# ==============================
# 🔌 LOAD ENV
# ==============================
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

print("🔗 Using MONGO_URI:", MONGO_URI)

if not MONGO_URI:
    raise ValueError("❌ MONGO_URI not set in .env")

# ==============================
# 🔌 CONNECT DB
# ==============================
client = MongoClient(MONGO_URI)

# Try default DB first
db = client.get_database("smartvenue")

print("\n📦 Available collections in smartvenue:")
collections = db.list_collection_names()
print(collections)

# ==============================
# 🔍 AUTO FIND COLLECTION
# ==============================

possible_collections = ["zonelogs", "ZoneLog", "zonelog"]

collection = None

for name in possible_collections:
    if name in collections:
        collection = db[name]
        print(f"✅ Using collection: {name}")
        break

if collection is None:
    print("⚠️ No known collection found, using 'zonelogs' by default")
    collection = db["zonelogs"]

# ==============================
# 📥 FETCH DATA
# ==============================

print("\n📥 Fetching data from MongoDB...")
data = list(collection.find())

print(f"📊 Records found: {len(data)}")

# ==============================
# ⚠️ HANDLE EMPTY DB
# ==============================

if len(data) == 0:
    raise ValueError("""
❌ No data found in MongoDB

👉 Fix:
1. Ensure backend is saving data
2. Ensure SAME MONGO_URI is used in backend + AI
3. Wait 1–2 minutes for data collection
""")

if len(data) < 10:
    print("⚠️ Low data (<10). Training anyway for testing...")

# ==============================
# 📊 DATAFRAME
# ==============================

df = pd.DataFrame(data)

# ==============================
# 🧹 CLEAN DATA
# ==============================

required_cols = ["crowdLevel", "waitTime", "hour", "day", "timestamp"]

missing_cols = [col for col in required_cols if col not in df.columns]

if missing_cols:
    raise ValueError(f"❌ Missing columns in DB: {missing_cols}")

df = df[required_cols]
df = df.dropna()

# Convert types safely
for col in ["crowdLevel", "waitTime", "hour", "day"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna()

# Sort by time
df = df.sort_values("timestamp")

# ==============================
# 🎯 CREATE LABEL
# ==============================

df["nextCrowd"] = df["crowdLevel"].shift(-1)
df = df.dropna()

if len(df) < 5:
    raise ValueError("❌ Not enough sequential data after cleaning")

# ==============================
# 📊 FEATURES
# ==============================

X = df[["crowdLevel", "waitTime", "hour", "day"]]
y = df["nextCrowd"]

# ==============================
# ✂️ SPLIT
# ==============================

test_size = 0.2 if len(df) > 20 else 0.1

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=test_size, shuffle=False
)

# ==============================
# 🚀 TRAIN MODEL
# ==============================

print("\n🚀 Training model...")

model = RandomForestRegressor(
    n_estimators=120,
    max_depth=8,
    random_state=42
)

model.fit(X_train, y_train)

# ==============================
# 📊 EVALUATE
# ==============================

if len(X_test) > 0:
    score = model.score(X_test, y_test)
    print(f"📊 Model R² score: {score:.3f}")
else:
    print("⚠️ Not enough test data")

# ==============================
# 💾 SAVE MODEL
# ==============================

os.makedirs("models", exist_ok=True)

model_path = "models/crowd_model.pkl"
joblib.dump(model, model_path)

print(f"\n✅ Model trained & saved → {model_path}")