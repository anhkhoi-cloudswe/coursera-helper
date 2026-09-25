from PIL import Image, ImageDraw, ImagePath
import math
import os

def create_shield_icon(size):
    # Supersampling 4x for crisp anti-aliasing
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Indigo rounded box background
    radius = int(s * 0.22)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill="#6366f1")

    # Helper function for normalized coordinates (0..24) to target pixels
    def p(x, y):
        return (x * s / 24.0, y * s / 24.0)

    # Shield polygon outline (SVG: M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z)
    stroke_w = max(2, int(s * 0.085))

    # Points along shield curve
    points = []
    # Top tip (12, 2) to Right corner (20, 5)
    steps = 10
    for i in range(steps + 1):
        t = i / steps
        # Linear top edge from (12,2) to (20,5)
        x = 12 + 8 * t
        y = 2 + 3 * t
        points.append(p(x, y))

    # Right side down to bottom tip (20, 5) -> (20, 12) -> (12, 22)
    for i in range(1, steps + 1):
        t = i / steps
        # Bezier curve s8-4 8-10: control point (20, 15)
        x = (1-t)**2 * 20 + 2*(1-t)*t * 20 + t**2 * 12
        y = (1-t)**2 * 5 + 2*(1-t)*t * 15 + t**2 * 22
        points.append(p(x, y))

    # Bottom tip up to Left corner (12, 22) -> (4, 12) -> (4, 5)
    for i in range(1, steps + 1):
        t = i / steps
        x = (1-t)**2 * 12 + 2*(1-t)*t * 4 + t**2 * 4
        y = (1-t)**2 * 22 + 2*(1-t)*t * 15 + t**2 * 5
        points.append(p(x, y))

    # Left corner back to Top tip (4, 5) -> (12, 2)
    for i in range(1, steps + 1):
        t = i / steps
        x = 4 + 8 * t
        y = 5 - 3 * t
        points.append(p(x, y))

    draw.line(points, fill="#ffffff", width=stroke_w, joint="curve")

    # Checkmark path (m9 12 2 2 4-4 -> points (9,12), (11,14), (15,10))
    check_pts = [p(9, 12), p(11.2, 14.2), p(15.5, 9.5)]
    draw.line(check_pts, fill="#ffffff", width=stroke_w, joint="round")

    # Downsample using high-quality Lanczos filter
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

out_dir = r"c:\AK\HOCKI8\ITE302c\Script\extension\icons"
os.makedirs(out_dir, exist_ok=True)

sizes = [16, 48, 128, 300]
for sz in sizes:
    icon_img = create_shield_icon(sz)
    icon_img.save(os.path.join(out_dir, f"icon{sz}.png"), "PNG")
    print(f"Generated icon{sz}.png successfully.")
