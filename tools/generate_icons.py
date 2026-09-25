from PIL import Image, ImageDraw
import os

def draw_smooth_icon(size):
    # 8x Supersampling for ultra-crisp anti-aliasing
    scale = 8
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Apple Squircle background (#6366f1)
    radius = int(S * 0.24)
    draw.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill="#6366f1")

    # Helper coordinate mapper (0..24) -> (0..S)
    def p(x, y):
        return (x * S / 24.0, y * S / 24.0)

    # 2. Perfect Smooth Shield Bezier Curve
    # Path: M12 3.2 L20 6.2 v5.8 c0 5.25 -4.5 9.55 -7 10.5 c-2.5 -.95 -7 -5.25 -7 -10.5 V6.2 Z
    stroke_w = int(S * 0.088)

    # Generate dense points along smooth bezier shield
    points = []
    
    # Top Peak to Right Shoulder: (12, 3.2) -> (19.2, 6.2)
    steps = 20
    for i in range(steps + 1):
        t = i / steps
        points.append(p(12 + 7.2 * t, 3.2 + 3.0 * t))

    # Right Shoulder down to Bottom Tip: (19.2, 6.2) -> (19.2, 12.0) -> (12, 21.0)
    # Cubic Bezier: P0=(19.2, 6.2), P1=(19.2, 17.0), P2=(15.0, 20.2), P3=(12, 21.0)
    P0 = (19.2, 6.2)
    P1 = (19.2, 17.0)
    P2 = (14.5, 20.2)
    P3 = (12.0, 21.0)
    for i in range(1, steps + 1):
        t = i / steps
        x = (1-t)**3 * P0[0] + 3*(1-t)**2 * t * P1[0] + 3*(1-t) * t**2 * P2[0] + t**3 * P3[0]
        y = (1-t)**3 * P0[1] + 3*(1-t)**2 * t * P1[1] + 3*(1-t) * t**2 * P2[1] + t**3 * P3[1]
        points.append(p(x, y))

    # Bottom Tip up to Left Shoulder: (12, 21.0) -> (4.8, 6.2)
    P0 = (12.0, 21.0)
    P1 = (9.5, 20.2)
    P2 = (4.8, 17.0)
    P3 = (4.8, 6.2)
    for i in range(1, steps + 1):
        t = i / steps
        x = (1-t)**3 * P0[0] + 3*(1-t)**2 * t * P1[0] + 3*(1-t) * t**2 * P2[0] + t**3 * P3[0]
        y = (1-t)**3 * P0[1] + 3*(1-t)**2 * t * P1[1] + 3*(1-t) * t**2 * P2[1] + t**3 * P3[1]
        points.append(p(x, y))

    # Left Shoulder back to Top Peak: (4.8, 6.2) -> (12, 3.2)
    for i in range(1, steps + 1):
        t = i / steps
        points.append(p(4.8 + 7.2 * t, 6.2 - 3.0 * t))

    # Draw smooth stroke outline
    draw.line(points, fill="#ffffff", width=stroke_w, joint="curve")

    # 3. Checkmark: (8.8, 12.0) -> (11.2, 14.4) -> (15.6, 9.6)
    chk_pts = [p(8.8, 12.0), p(11.2, 14.4), p(15.6, 9.6)]
    draw.line(chk_pts, fill="#ffffff", width=int(stroke_w * 1.05), joint="round")

    # Draw rounded cap circles at checkmark ends for perfect round caps
    cap_r = stroke_w * 0.52
    for cp in [chk_pts[0], chk_pts[-1]]:
        draw.ellipse([cp[0]-cap_r, cp[1]-cap_r, cp[0]+cap_r, cp[1]+cap_r], fill="#ffffff")

    # Downsample with Lanczos anti-aliasing
    return img.resize((size, size), Image.Resampling.LANCZOS)

out_dir = r"c:\AK\HOCKI8\ITE302c\Script\extension\icons"
os.makedirs(out_dir, exist_ok=True)

sizes = [16, 48, 128, 300]
for sz in sizes:
    icon_img = draw_smooth_icon(sz)
    icon_img.save(os.path.join(out_dir, f"icon{sz}.png"), "PNG")
    print(f"Generated ultra-smooth icon{sz}.png successfully.")
