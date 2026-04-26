import cv2
import numpy as np
import time

# ==============================
# ⚙️ CONFIG
# ==============================

CAMERA_INDEX = 0
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
SMOOTH_WINDOW = 5
DISPLAY = True

# ==============================
# 🧠 INIT DETECTOR
# ==============================

hog = cv2.HOGDescriptor()
hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

# ==============================
# 📊 SMOOTHING BUFFER
# ==============================

history = []

def smooth_count(count):
    history.append(count)
    if len(history) > SMOOTH_WINDOW:
        history.pop(0)
    return int(np.mean(history))


# ==============================
# 🚀 MAIN FUNCTION
# ==============================

def detect_people(camera_index=CAMERA_INDEX, return_stream=False):
    cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        print("❌ Camera not accessible")
        return 0

    print("🎥 Camera started... Press ESC to exit")

    last_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read frame")
            break

        # Resize (performance boost)
        frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

        # Detect people
        boxes, weights = hog.detectMultiScale(
            frame,
            winStride=(8, 8),
            padding=(8, 8),
            scale=1.05
        )

        raw_count = len(boxes)

        # Smooth count
        count = smooth_count(raw_count)
        last_count = count

        # Draw bounding boxes
        for (x, y, w, h) in boxes:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)

        # Display info
        cv2.putText(
            frame,
            f"People: {count}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

        # Optional: show FPS
        cv2.putText(
            frame,
            f"FPS: {int(1/(time.time()%1+0.001))}",
            (20, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2
        )

        # Show frame
        if DISPLAY:
            cv2.imshow("Smart Crowd Detection", frame)

        # If streaming mode (for Kafka integration)
        if return_stream:
            yield count

        # Exit on ESC
        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()

    return last_count


# ==============================
# ▶️ RUN DIRECTLY
# ==============================

if __name__ == "__main__":
    final_count = detect_people()
    print("👥 Final Count:", final_count)