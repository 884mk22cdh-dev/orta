# Скриншоты для App Store в стиле карточек: цветной фон, заголовок на казахском,
# подзаголовок на русском, телефон с экраном приложения. Исходники — store/screenshots/NN.png.
# Запуск: python3 store/make-screenshots.py   (нужен Pillow; шрифт Inter из mobile/node_modules)

import sys, os
from PIL import Image, ImageDraw, ImageFont
SRC = '/Users/oscaraltynbekov/новый проект/store/screenshots'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/Users/oscaraltynbekov/новый проект/store/screenshots-kk-ru'
FONT = sys.argv[2] if len(sys.argv) > 2 else '/Users/oscaraltynbekov/новый проект/mobile/node_modules/@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'
FONT2 = FONT.replace('800ExtraBold', '600SemiBold').replace('Inter_800ExtraBold', 'Inter_600SemiBold')
os.makedirs(OUT, exist_ok=True)
SHOTS = [
  ('01', '#6C4FE0', 'Сабақ кестесі\nәрқашан қасыңда', 'Расписание всегда под рукой'),
  ('02', '#F4564E', 'Сессияға дейін\nкері санақ', 'Обратный отсчёт до сессии'),
  ('03', '#3DB96B', 'Университет\nоқиғалары бір жерде', 'Афиша университета в одном месте'),
  ('04', '#3E9BF0', 'ЖИ-көмекші\nкестеңді біледі', 'ИИ-помощник знает твоё расписание'),
  ('05', '#22B8A6', 'Топ, староста\nжәне O-COIN', 'Группа, староста и монеты'),
]
def darken(hexc, k=0.55):
    r,g,b = int(hexc[1:3],16), int(hexc[3:5],16), int(hexc[5:7],16)
    return (int(r*k), int(g*k), int(b*k))
def rounded_mask(size, r):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle([0,0,size[0]-1,size[1]-1], r, fill=255); return m
def build(name, color, kk, ru, W, H):
    canvas = Image.new('RGB', (W, H), (0,0,0))
    d = ImageDraw.Draw(canvas)
    m = int(W*0.045)
    top = int(H*0.10)
    d.rounded_rectangle([m, top, W-m, H-m], radius=int(W*0.075), fill=color)
    # Текст не должен упираться в края карточки: ужимаем шрифт, пока самая
    # длинная строка не влезет в ширину карточки минус отступы.
    limit = W - 2*m - 2*int(W*0.06)
    def fit(path, size, lines):
        f = ImageFont.truetype(path, size)
        while size > 20 and max(d.textlength(l, font=f) for l in lines) > limit:
            size -= 2; f = ImageFont.truetype(path, size)
        return f, size
    fkk, skk = fit(FONT, int(W*0.085), kk.split('\n'))
    fru, sru = fit(FONT2, int(W*0.046), [ru])
    y = top + int(H*0.035)
    for line in kk.split('\n'):
        w = d.textlength(line, font=fkk); d.text(((W-w)/2, y), line, font=fkk, fill='white'); y += int(skk*1.18)
    y += int(W*0.015)
    w = d.textlength(ru, font=fru); d.text(((W-w)/2, y), ru, font=fru, fill=(255,255,255,235)); y += int(sru*1.6)
    # телефон
    shot = Image.open(f'{SRC}/{name}.png').convert('RGB')
    pw = int(W*0.74); ph = int(pw*shot.height/shot.width)
    shot = shot.resize((pw, ph), Image.LANCZOS)
    border = int(W*0.018); rad = int(W*0.11)
    frame = Image.new('RGB', (pw+2*border, ph+2*border), darken(color))
    fmask = rounded_mask(frame.size, rad+border)
    smask = rounded_mask(shot.size, rad)
    frame.paste(shot, (border, border), smask)
    px = (W-frame.width)//2; py = y + int(H*0.02)
    # телефон уходит за нижний край карточки, как в примере: обрезаем по карточке
    card_bottom = H-m
    region = frame.crop((0, 0, frame.width, min(frame.height, card_bottom-py)))
    canvas.paste(region, (px, py), fmask.crop((0,0,region.width,region.height)))
    return canvas
for size_tag, W, H in [('6.5', 1284, 2778), ('6.7', 1290, 2796)]:
    for name, color, kk, ru in SHOTS:
        img = build(name, color, kk, ru, W, H)
        img.save(f'{OUT}/{size_tag}-{name}.png', optimize=True)
        print('ok', size_tag, name)
