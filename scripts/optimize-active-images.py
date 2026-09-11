from pathlib import Path
from PIL import Image

assets = [
    Path("src/assets/gcard-pro-cartao-nfc-mockup-avaliacao-google.png"),
    Path("src/assets/gcard-pro-cartao-nfc-arte-frontal.png"),
    Path("src/assets/logo/gcard-pro-logo-transparente.png"),
]

for source in assets:
    output = source.with_suffix(".webp")
    with Image.open(source) as image:
        image.save(output, "WEBP", quality=84, method=6)
        print(f"{source} -> {output} ({source.stat().st_size} -> {output.stat().st_size} bytes)")
