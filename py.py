import sys
import json
import numpy as np
import io
from PIL import Image
from tensorflow.lite.python.interpreter import Interpreter

def load_model(modelpath):
    # Load TensorFlow Lite model into memory
    interpreter = Interpreter(model_path=modelpath)
    interpreter.allocate_tensors()
    
    # Get model details
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Check if the model expects floating point inputs
    float_input = (input_details[0]['dtype'] == np.float32)
    input_mean = 127.5
    input_std = 127.5
    
    return interpreter, input_details, output_details, float_input, input_mean, input_std

def detect_objects(interpreter, input_details, output_details, float_input, input_mean, input_std, labels, frame_data):
    try:
        # Convert the list of integers to a bytearray
        img_bytes = bytearray(frame_data)
        
        # Open the image from the bytearray and convert it to RGB
        frame = Image.open(io.BytesIO(img_bytes))
        frame = frame.convert('RGB')
        
        # Resize the image to the required input size of the model
        frame = frame.resize((320, 320))  # Adjust size as needed
        
        # Convert image to numpy array
        input_data = np.expand_dims(np.array(frame), axis=0)

        # Normalize pixel values if using a floating model (non-quantized)
        if float_input:
            input_data = (np.float32(input_data) - input_mean) / input_std

        # Set the tensor to the input data
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()

        # Retrieve detection results
        boxes = interpreter.get_tensor(output_details[1]['index'])[0]  # Bounding box coordinates of detected objects
        classes = interpreter.get_tensor(output_details[3]['index'])[0]  # Class index of detected objects
        scores = interpreter.get_tensor(output_details[0]['index'])[0]  # Confidence of detected objects

        detections = []

        imW, imH = frame.size  # Get image width and height

        # Loop over all detections and collect detection data if confidence is above minimum threshold
        for i in range(len(scores)):
            if ((scores[i] > 0.5) and (scores[i] <= 1.0)):  # Adjust minimum confidence threshold here
                ymin = int(max(1, (boxes[i][0] * imH)))
                xmin = int(max(1, (boxes[i][1] * imW)))
                ymax = int(min(imH, (boxes[i][2] * imH)))
                xmax = int(min(imW, (boxes[i][3] * imW)))

                object_name = labels[int(classes[i])]  # Look up object name from "labels" array using class index

                detections.append({
                    'object_name': object_name,
                    'confidence': float(scores[i]),
                    'xmin': xmin,
                    'ymin': ymin,
                    'xmax': xmax,
                    'ymax': ymax
                })

        # Return detections as JSON string
        return json.dumps(detections)

    except Exception as e:
        # Handle any exceptions or errors
        print(f"Error in object detection: {e}")
        return json.dumps({'error': str(e)})

# Example paths, replace with your actual paths
model_path = 'best.tflite'  # Replace with your model path
label_path = 'labelmap.txt'  # Replace with your label map path

# Load the model and necessary details
interpreter, input_details, output_details, float_input, input_mean, input_std = load_model(model_path)

# Load label map into memory
with open(label_path, 'r') as f:
    labels = [line.strip() for line in f.readlines()]

# Continuously read frame data from stdin and process it
while True:
    try:
        # Read line from stdin
        data_from_bun = sys.stdin.readline().strip()

        # Break if no data received
        if not data_from_bun:
            continue

        # Convert the input data to a list of integers
        received_array = list(map(int, data_from_bun.split(',')))

        # Perform object detection
        detections_json = detect_objects(interpreter, input_details, output_details, float_input, input_mean, input_std, labels, received_array)

        # Print the detections JSON string to stdout
        print(detections_json)
        sys.stdout.flush()  # Ensure the output is immediately flushed

    except EOFError:
        break
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.stderr.flush()  # Ensure stdout is flushed to send data immediately
