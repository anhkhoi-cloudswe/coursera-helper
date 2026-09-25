from PIL import Image, ImageDraw
import os

def draw_perfect_shield(size):
    # 8x Supersampling for ultra crisp anti-aliased rendering
    scale = 8
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background squircle (#6366f1)
    radius = int(S * 0.22)
    draw.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill="#6366f1")

    # Helper coordinate mapper (0..24 grid) -> (0..S pixels)
    def p(x, y):
        return (x * S / 24.0, y * S / 24.0)

    # 2. Outer Shield Solid Polygon (Seamless, 0% Gap)
    outer_pts = []
    N = 35

    # Top Peak to Right Corner: (12, 2.8) -> (19.5, 5.8)
    for i in range(N):
        t = i / N
        outer_pts.append(p(12 + 7.5 * t, 2.8 + 3.0 * t))

    # Right Corner to Bottom Tip: (19.5, 5.8) -> (19.5, 13.5) -> (12, 21.2)
    P0, P1, P2, P3 = (19.5, 5.8), (19.5, 13.5), (15.5, 19.5), (12.0, 21.2)
    for i in range(N):
        t = i / N
        x = (1-t)**3 * P0[0] + 3*(1-t)**2 * t * P1[0] + 3*(1-t) * t**2 * P2[0] + t**3 * P3[0]
        y = (1-t)**3 * P0[1] + 3*(1-t)**2 * t * P1[1] + 3*(1-t) * t**2 * P2[1] + t**3 * P3[1]
        outer_pts.append(p(x, y))

    # Bottom Tip to Left Corner: (12, 21.2) -> (4.5, 5.8)
    P0, P1, P2, P3 = (12.0, 21.2), (8.5, 19.5), (4.5, 13.5), (4.5, 5.8)
    for i in range(N):
        t = i / N
        x = (1-t)**3 * P0[0] + 3*(1-t)**2 * t * P1[0] + 3*(1-t) * t**2 * P2[0] + t**3 * P3[0]
        y = (1-t)**3 * P0[1] + 3*(1-t)**2 * t * P1[1] + 3*(1-t) * t**2 * P2[1] + t**3 * P3[1]
        outer_pts.append(p(x, y))

    # Left Corner back to Top Peak: (4.5, 5.8) -> (12, 2.8)
    for i in range(N):
        t = i / N
        outer_pts.append(p(4.5 + 7.5 * t, 5.8 - 3.0 * t))

    # Draw Outer Solid White Shield
    draw.polygon(outer_pts, fill="#ffffff")

    # 3. Inner Shield Hole Cutout (#6366f1)
    inner_pts = []
    # Peak: (12, 5.2) -> Right Corner: (17.5, 7.6)
    for i in range(N):
        t = i / N
        inner_pts.append(p(12 + 5.5 * t, 5.2 + 2.4 * t))

    P0, P1, P2, P3 = (17.5, 7.6), (17.5, 13.0), (14.5, 17.2), (12.0, 18.5)
    for i in range(N):
        t = i / N
        x = (1-t)**3 * P0[0] + 3*(1-t)**2 * t * P1[0] + 3*(1-t) * t**2 * P2[0] + t**3 * P3[0]
        y = (1-t)**3 * P0[1] + 3*(1-t)**2 * t * P1[1] + 3*(1-t) * t**2 * P2[1] + t**3 * P3[1]
        inner_pts.append(p(x, y))

    P0, P1, P2, P3 = (12.0, 18.5), (9.5, 17.2), (6.5, 13.0), (6.5, 7.6)
    for i in range(N):
        t = i / N
        x = (1-t)**3 * P0[0] + 3*(1-t)**2 * t * P1[0] + 3*(1-t) * t**2 * P2[0] + t**3 * P3[0]
        y = (1-t)**3 * P0[1] + 3*(1-t)**2 * t * P1[1] + 3*(1-t) * t**2 * P2[1] + t**3 * P3[1]
        inner_pts.append(p(x, y))

    for i in range(N):
        t = i / N
        inner_pts.append(p(6.5 + 5.5 * t, 7.6 - 2.4 * t))

    # Cutout Inner Area
    draw.polygon(inner_pts, fill="#6366f1")

    # 4. Single Crisp Checkmark (No extra caps/V-lines)
    stroke_w = int(S * 0.088)
    chk_pts = [p(9.0, 12.0), p(11.2, 14.2), p(15.2, 9.8)]
    draw.line(chk_pts, fill="#ffffff", width=stroke_w, joint="round")

    # Round caps on checkmark ends
    r_cap = stroke_w / 2.0
    for pt in [chk_pts[0], chk_pts[-1]]:
        draw.ellipse([pt[0]-r_cap, pt[1]-r_cap, pt[0]+r_cap, pt[1]+r_cap], fill="#ffffff")

    return img.resize((size, size), Image.Resampling.LANCZOS)

out_dir = r"c:\AK\HOCKI8\ITE302c\Script\extension\icons"
os.makedirs(out_dir, exist_ok=True)

sizes = [16, 48, 128, 300]
for sz in sizes:
    icon_img = draw_perfect_shield(sz)
    icon_img.save(os.path.join(out_dir, f"icon{sz}.png"), "PNG")
    print(f"Generated 100% solid, gap-free icon{sz}.png successfully.")
