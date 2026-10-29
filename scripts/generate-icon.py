from pathlib import Path
import io
import cairosvg
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "build" / "icon.svg"
target = root / "build" / "icon.ico"
target.parent.mkdir(parents=True, exist_ok=True)
png = cairosvg.svg2png(url=str(source), output_width=256, output_height=256)
image = Image.open(io.BytesIO(png)).convert("RGBA")
image.save(target, format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(f"Generated Windows icon: {target}")
