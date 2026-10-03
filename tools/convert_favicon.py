# Usage: /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 tools/convert_favicon.py

from PIL import Image

# 開啟上傳的圖片檔
img = Image.open("public/images/mylogo_1x1_notext.png")

# 調整尺寸為 32x32，使用 Resampling.LANCZOS 保持邊緣清晰
resized_img = img.resize((32, 32), Image.Resampling.LANCZOS)

# 儲存為 PNG
resized_img.save("logo_32x32.png", "PNG")