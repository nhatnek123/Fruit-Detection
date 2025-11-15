import torch
from torchvision.models.detection import fasterrcnn_resnet50_fpn
from PIL import Image
import torchvision.transforms as T
import io
import base64
from flask import Flask, render_template, request, jsonify
from PIL import ImageDraw, ImageFont

app = Flask(__name__)

# Load model
model = fasterrcnn_resnet50_fpn(weights=None, num_classes=9)
checkpoint_path = "fasterrcnn_model_best.pth"
checkpoint = torch.load(checkpoint_path, map_location="cpu")
model.load_state_dict(checkpoint)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()

class_names = [
    "banana-Rotten-Apple-banana--rsSP",
    "bad apple",
    "bad banana",
    "good apple",
    "good apple 1",
    "good banana",
    "good banana 1",
    "unripe apple",
    "unripe banana"
]

def detect_objects(image, threshold=0.5):
    """Run detection on image and return annotated image"""
    transform = T.Compose([T.ToTensor()])
    img_tensor = transform(image).to(device)
    
    with torch.no_grad():
        preds = model([img_tensor])
    
    preds = preds[0]
    
    # Draw on image
    draw = ImageDraw.Draw(image)
    
    # Try to use a better font, fallback to default if not available
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()
    
    detections = []
    for box, label, score in zip(preds["boxes"], preds["labels"], preds["scores"]):
        if score >= threshold:
            x1, y1, x2, y2 = box.cpu().numpy()
            label_name = class_names[label.item()]
            score_val = score.item()
            
            # Draw rectangle
            draw.rectangle([x1, y1, x2, y2], outline="lime", width=3)
            
            # Draw label background
            text = f"{label_name} ({score_val:.2f})"
            bbox = draw.textbbox((x1, y1 - 25), text, font=font)
            draw.rectangle(bbox, fill="lime")
            draw.text((x1, y1 - 25), text, fill="black", font=font)
            
            detections.append({
                "class": label_name,
                "confidence": float(score_val),
                "bbox": [float(x1), float(y1), float(x2), float(y2)]
            })
    
    return image, detections

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/detect', methods=['POST'])
def detect():
    try:
        data = request.get_json()
        image_data = data['image']
        threshold = float(data.get('threshold', 0.5))
        
        # Decode base64 image
        image_data = image_data.split(',')[1]  # Remove data:image/jpeg;base64, prefix
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Run detection
        result_image, detections = detect_objects(image, threshold)
        
        # Convert result image back to base64
        buffered = io.BytesIO()
        result_image.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'image': f'data:image/jpeg;base64,{img_str}',
            'detections': detections
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
