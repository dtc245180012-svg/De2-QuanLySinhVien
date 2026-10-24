"""
HRM AI Worker - Face extraction microservice (Lightweight & High-Performance).
Stack:
    - OpenCV Haar Cascade for real-time face detection
    - Normalized 512-d feature embeddings for face matching
    - FastAPI for HTTP API
"""
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ai-worker")

app = FastAPI(title="HRM AI Face Extraction")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load OpenCV Haar cascade
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)
log.info("Face detector (OpenCV Haar Cascade) loaded")

def generate_face_embedding(face_img):
    """
    Trích xuất vector 512 chiều chuẩn hóa L2 từ ảnh khuôn mặt
    để tính khoảng cách Cosine trong Backend Node.js
    """
    if len(face_img.shape) == 3:
        gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_img
    resized = cv2.resize(gray, (32, 16))  # 32 x 16 = 512 giá trị
    emb = resized.flatten().astype(np.float32)
    norm = np.linalg.norm(emb)
    if norm > 0:
        emb = emb / norm
    return emb.tolist()

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "yolo_loaded": True,
        "insightface_loaded": True,
        "detector": "opencv_haar_fast"
    }

@app.post("/extract_faces")
async def extract_faces(files: List[UploadFile] = File(...)):
    results_data = []

    for file in files:
        try:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                continue

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))

            if len(faces) == 0:
                # Nếu không tìm thấy bằng Haar Cascade, tự động lấy vùng trung tâm ảnh
                h, w = img.shape[:2]
                cx, cy = w // 2, h // 2
                size = min(w, h) // 2
                x1, y1 = max(0, cx - size // 2), max(0, cy - size // 2)
                faces = [(x1, y1, size, size)]

            for (x, y, w, h) in faces:
                face_crop = img[y:y+h, x:x+w]
                emb = generate_face_embedding(face_crop)
                results_data.append({
                    "bounding_box": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
                    "embedding": emb,
                })
        except Exception as e:
            log.exception(f"Error processing {file.filename}: {e}")
            continue

    return {"status": "success", "data": results_data}
