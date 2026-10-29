from pathlib import Path
from PIL import Image, ImageDraw
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build" / "icon.ico"
S = 4
N = 256 * S
im = Image.new("RGBA", (N, N), (255, 255, 255, 0))
d = ImageDraw.Draw(im)

def scale(v): return int(round(v * S))
def rounded(box, radius, fill, outline=None, width=1):
    d.rounded_rectangle(tuple(scale(v) for v in box), radius=scale(radius), fill=fill,
                        outline=outline, width=scale(width) if outline else 1)

def vertical_gradient(box, top, bottom, radius=0):
    x0,y0,x1,y1 = [scale(v) for v in box]
    h=max(1,y1-y0)
    grad=Image.new("RGBA",(x1-x0,h))
    px=grad.load()
    for y in range(h):
        t=y/(h-1) if h>1 else 0
        color=tuple(round(top[i]*(1-t)+bottom[i]*t) for i in range(4))
        for x in range(x1-x0): px[x,y]=color
    mask=Image.new("L",grad.size,0)
    md=ImageDraw.Draw(mask)
    if radius: md.rounded_rectangle((0,0,grad.width-1,grad.height-1),radius=scale(radius),fill=255)
    else: md.rectangle((0,0,grad.width-1,grad.height-1),fill=255)
    im.alpha_composite(Image.composite(grad,Image.new("RGBA",grad.size,(0,0,0,0)),mask),(x0,y0))

# Soft lavender rounded-square tile and subtle monitor shadow.
rounded((12,12,244,244),54,(239,232,255,255))
rounded((43,54,213,184),19,(199,183,245,255))
rounded((46,55,210,181),17,(137,111,218,255))
rounded((53,62,203,170),10,(255,255,255,255))
vertical_gradient((54,63,202,169),(255,255,255,255),(241,235,255,255),9)
# Dreamy layered hills on the screen.
d.polygon([(scale(54),scale(131)),(scale(70),scale(113)),(scale(88),scale(106)),(scale(108),scale(124)),(scale(126),scale(137)),(scale(147),scale(139)),(scale(169),scale(122)),(scale(187),scale(119)),(scale(202),scale(130)),(scale(202),scale(169)),(scale(54),scale(169))],fill=(226,216,250,255))
d.polygon([(scale(54),scale(147)),(scale(77),scale(132)),(scale(98),scale(142)),(scale(121),scale(151)),(scale(143),scale(148)),(scale(166),scale(137)),(scale(187),scale(140)),(scale(202),scale(145)),(scale(202),scale(169)),(scale(54),scale(169))],fill=(202,185,244,255))
# Sparkles.
def star(cx,cy,r,color):
    pts=[]
    for i in range(8):
        a=-math.pi/2+i*math.pi/4
        rr=r if i%2==0 else r*0.32
        pts.append((scale(cx+math.cos(a)*rr),scale(cy+math.sin(a)*rr)))
    d.polygon(pts,fill=color)
star(160,86,10,(164,139,233,255))
star(181,102,6,(191,171,243,255))
# White lower bezel, indicator, stand.
d.rectangle((scale(46),scale(157),scale(210),scale(164)),fill=(255,255,255,255))
rounded((46,157,210,181),15,(255,255,255,255))
d.ellipse((scale(123),scale(166),scale(133),scale(176)),fill=(146,119,220,255))
d.polygon([(scale(105),scale(181)),(scale(151),scale(181)),(scale(158),scale(201)),(scale(98),scale(201))],fill=(160,139,229,255))
rounded((84,199,172,212),7,(137,111,218,255))
# Supersample down to smooth edges and generate a multi-resolution Windows icon.
im=im.resize((256,256),Image.Resampling.LANCZOS)
OUT.parent.mkdir(parents=True,exist_ok=True)
im.save(OUT,format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(f"Generated Windows icon: {OUT}")
