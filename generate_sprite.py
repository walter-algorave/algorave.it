import os
from PIL import Image

def generate_sprite_sheet():
    assets_dir = 'assets'
    output_file = os.path.join(assets_dir, 'flower_sprite.webp')
    
    files = [f for f in os.listdir(assets_dir) if f.startswith('flower_') and f.endswith('.png')]
    files.sort(key=lambda x: int(x.split('_')[1].split('.')[0]))
    
    if not files:
        print("No flower frames found.")
        return

    print(f"Found {len(files)} frames: {files}")

    images = [Image.open(os.path.join(assets_dir, f)) for f in files]
    
    target_width, target_height = images[0].size
    print(f"Target frame size: {target_width}x{target_height}")

    resized_images = []
    for i, img in enumerate(images):
        if img.size != (target_width, target_height):
            print(f"Resizing frame {i} from {img.size} to ({target_width}, {target_height})")
            img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        resized_images.append(img)
    
    total_width = target_width * len(resized_images)
    
    sprite_sheet = Image.new('RGBA', (total_width, target_height))
    
    for i, img in enumerate(resized_images):
        sprite_sheet.paste(img, (i * target_width, 0))
    
    sprite_sheet.save(output_file, 'WEBP', quality=90)
    print(f"Sprite sheet saved to {output_file}")
    print(f"Dimensions: {total_width}x{target_height}")

if __name__ == "__main__":
    generate_sprite_sheet()
