import cv2
import numpy as np
import math
import argparse
import os

def process_video(video_path, output_path, num_frames=25, grid_width=None, key_color=[255, 0, 2], chroma_threshold=0.45, chroma_smoothness=0.1):
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at {video_path}")
        return

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Could not open video.")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video loaded: {total_frames} frames found.")

    # Frame indices to sample (evenly distributed)
    indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
    
    frames = []
    
    # Chroma key settings
    key_color_np = np.array(key_color) 
    
    print("Extracting and processing frames...")
    
    for i in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            print(f"Warning: Could not read frame {i}")
            continue

        # 1. Crop to square (center)
        h, w = frame.shape[:2]
        size = min(h, w)
        y_start = (h - size) // 2
        x_start = (w - size) // 2
        frame = frame[y_start:y_start+size, x_start:x_start+size]
        
        # 2. Resize (optional, to keep sprite sheet size manageable)
        # Target size: 300x300 seems good for the flower
        target_size = 300
        frame = cv2.resize(frame, (target_size, target_size), interpolation=cv2.INTER_AREA)
        
        # 3. Apply Chroma Key
        # Convert to float for accurate distance calculation
        frame_float = frame.astype(np.float32)
        
        # Calculate distance to key color
        # key_color is BGR
        diff = frame_float - key_color_np
        dist = np.sqrt(np.sum(diff**2, axis=2))
        
        thresh_val = chroma_threshold * 441.67 
        smooth_val = chroma_smoothness * 441.67
        
        alpha = np.clip((dist - thresh_val) / smooth_val, 0, 1)
        
        b, g, r = cv2.split(frame_float)
        max_rg = np.maximum(r, g)
        b_clamped = np.where(b > max_rg, max_rg, b)
        
        # Convert all to uint8
        b_out = b_clamped.astype(np.uint8)
        g_out = g.astype(np.uint8)
        r_out = r.astype(np.uint8)
        a_out = (alpha * 255).astype(np.uint8)
        
        frame_out = cv2.merge([b_out, g_out, r_out, a_out])
        
        frames.append(frame_out)

    cap.release()

    if not frames:
        print("No frames extracted.")
        return

    # 4. Stitch into Grid
    count = len(frames)
    if grid_width is None:
        grid_cols = math.ceil(math.sqrt(count))
    else:
        grid_cols = grid_width
        
    grid_rows = math.ceil(count / grid_cols)
    
    frame_h, frame_w = frames[0].shape[:2]
    
    sheet_w = grid_cols * frame_w
    sheet_h = grid_rows * frame_h
    
    sprite_sheet = np.zeros((sheet_h, sheet_w, 4), dtype=np.uint8)
    
    print(f"Creating sprite sheet: {sheet_w}x{sheet_h} ({grid_cols}x{grid_rows} grid)")
    
    for idx, frame in enumerate(frames):
        row = idx // grid_cols
        col = idx % grid_cols
        
        y = row * frame_h
        x = col * frame_w
        
        sprite_sheet[y:y+frame_h, x:x+frame_w] = frame

    # 5. Save
    print(f"Saving to {output_path}...")
    cv2.imwrite(output_path, sprite_sheet, [cv2.IMWRITE_WEBP_QUALITY, 90])
    print("Done!")

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# Path to the input video file
INPUT_VIDEO_PATH = './assets/daisy_flower.mp4'

# Path to the output sprite sheet
OUTPUT_SPRITE_PATH = './assets/flower_sprite.webp'

# Number of columns in the sprite sheet grid
GRID_COLS = 6

# Chroma key color (BGR format for OpenCV: [Blue, Green, Red])
# Default: [255, 0, 2] (Blue=255, Green=0, Red=2)
CHROMA_KEY_COLOR = [255, 0, 2]

# Chroma key threshold (0.0 - 1.0)
CHROMA_THRESHOLD = 0.45

# Chroma key smoothness (0.0 - 1.0)
CHROMA_SMOOTHNESS = 0.1

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    video_rel_path = INPUT_VIDEO_PATH
    if video_rel_path.startswith('./'):
        video_rel_path = video_rel_path[2:]
    video_path = os.path.join(base_dir, video_rel_path)
    
    output_rel_path = OUTPUT_SPRITE_PATH
    if output_rel_path.startswith('./'):
        output_rel_path = output_rel_path[2:]
    output_path = os.path.join(base_dir, output_rel_path)
    
    num_frames = GRID_COLS * GRID_COLS
    
    print(f"Configuration:")
    print(f"  Source Video: {video_path}")
    print(f"  Output: {output_path}")
    print(f"  Grid: {GRID_COLS}x{GRID_COLS}")
    print(f"  Total Frames: {num_frames}")
    print(f"  Chroma Key Color (BGR): {CHROMA_KEY_COLOR}")
    print(f"  Chroma Threshold: {CHROMA_THRESHOLD}")
    print(f"  Chroma Smoothness: {CHROMA_SMOOTHNESS}")
    
    process_video(video_path, output_path, num_frames=num_frames, grid_width=GRID_COLS, 
                  key_color=CHROMA_KEY_COLOR, chroma_threshold=CHROMA_THRESHOLD, chroma_smoothness=CHROMA_SMOOTHNESS)
