import cv2
import numpy as np
import math
import argparse
import os

def process_video(video_path, output_path, num_frames=25, grid_width=None):
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
    
    # Chroma key settings (matching the shader/config)
    # Config: [2/255, 0.0, 1.0] -> B=255, G=0, R=2 (OpenCV uses BGR)
    key_color = np.array([255, 0, 2]) 
    threshold = 0.60 * 441.67 # 441.67 is max distance in 3D RGB space (sqrt(255^2 * 3)). 
    # Actually shader uses normalized 0-1. 
    # Shader: dist = length(color - key) (normalized).
    # Let's work in 0-255 space. Max dist is sqrt(255^2 + 255^2 + 255^2) = 441.67
    # Threshold 0.60 * 441.67 = 265
    
    # Let's refine the keying to be robust.
    # The user wants "sfondi gia tagliati".
    
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
        diff = frame_float - key_color
        dist = np.sqrt(np.sum(diff**2, axis=2))
        
        # Thresholding
        # Shader: smoothstep(threshold, threshold + smoothness, dist)
        # We want alpha 0 if close to key, 1 if far.
        # Wait, shader logic:
        # float dist = length(color.rgb - keyColor);
        # float alpha = smoothstep(threshold, threshold + smoothness, dist);
        # So if dist < threshold, alpha is 0 (transparent).
        
        thresh_val = 0.45 * 441.67 # Lowered slightly to be safe, adjust if needed
        smooth_val = 0.1 * 441.67
        
        alpha = np.clip((dist - thresh_val) / smooth_val, 0, 1)
        
        # Spill suppression (Blue channel clamping)
        # if (color.b > max(color.r, color.g)) color.b = max(color.r, color.g)
        b, g, r = cv2.split(frame_float)
        max_rg = np.maximum(r, g)
        b_clamped = np.where(b > max_rg, max_rg, b)
        
        # Recombine
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

import re

def load_config(config_path):
    """Parses js/config.js to extract FLOWER_FRAME_COUNT and FLOWER_GRID_COLS."""
    config = {}
    if not os.path.exists(config_path):
        print(f"Warning: Config file not found at {config_path}")
        return config
        
    with open(config_path, 'r') as f:
        content = f.read()
        
    # Regex to find exported constants
    source_video_match = re.search(r'export const FLOWER_SOURCE_VIDEO = "(.*?)";', content)
    if source_video_match:
        config['source_video'] = source_video_match.group(1)

    grid_cols_match = re.search(r'export const FLOWER_GRID_COLS = (\d+);', content)
    if grid_cols_match:
        config['grid_width'] = int(grid_cols_match.group(1))
        
    return config

if __name__ == "__main__":
    # Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = os.path.join(base_dir, 'js', 'config.js')
    
    # Load defaults from config.js
    config = load_config(config_path)
    
    # Determine video path: Config > Default
    video_rel_path = config.get('source_video', './assets/daisy_flower.mp4')
    # Clean up path if it starts with ./
    if video_rel_path.startswith('./'):
        video_rel_path = video_rel_path[2:]
    video_path = os.path.join(base_dir, video_rel_path)
    
    output_path = os.path.join(base_dir, 'assets', 'flower_sprite.webp')
    
    default_grid = config.get('grid_width', 5)
    default_frames = default_grid * default_grid
    
    parser = argparse.ArgumentParser(description='Generate flower sprite sheet.')
    parser.add_argument('--grid', type=int, default=default_grid, help=f'Number of columns in grid (default: {default_grid} from config.js)')
    args = parser.parse_args()
    
    num_frames = args.grid * args.grid
    
    print(f"Configuration loaded from {config_path}")
    print(f"  Source Video: {video_path}")
    print(f"  Grid: {args.grid}x{args.grid}")
    print(f"  Total Frames: {num_frames}")
    
    process_video(video_path, output_path, num_frames=num_frames, grid_width=args.grid)
