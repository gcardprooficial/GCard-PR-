#!/usr/bin/env python3
"""
Substitui os QR codes genéricos de um PDF (exportado do Affinity, layout de
rolo pronto pra gráfica) pelos QR codes reais gerados no painel do GCard,
um por célula, na ordem de leitura (linha por linha, esquerda -> direita).

Cada célula do rolo costuma ter várias imagens (ícones, QR, etc.) -- como a
célula inteira é duplicada N vezes, TODAS as imagens se repetem N vezes, não
só o QR. Por isso o script filtra por formato: só imagens QUADRADAS (o QR
sempre é quadrado, ícones geralmente não são) contam como candidatas.

Uso:
    # 1) Primeiro rode SEM --xref pra listar os candidatos:
    python substituir_qr_rolo.py arte_rolo.pdf pasta_com_qrcodes/ saida.pdf --listar

    # 2) Confirme qual xref é o QR (geralmente só sobra 1 candidato quadrado)
    #    e rode de verdade:
    python substituir_qr_rolo.py arte_rolo.pdf pasta_com_qrcodes/ saida.pdf --xref 28

Requisitos:
    pip install pymupdf
"""

import argparse
from collections import defaultdict
from pathlib import Path

import fitz  # PyMuPDF


def is_square(bbox: fitz.Rect, tol: float = 0.03) -> bool:
    w, h = bbox.width, bbox.height
    if w == 0 or h == 0:
        return False
    return abs(w / h - 1) <= tol


def main() -> None:
    ap = argparse.ArgumentParser(description="Substitui QR genérico por QR real num PDF de rolo.")
    ap.add_argument("pdf_original")
    ap.add_argument("pasta_qrcodes")
    ap.add_argument("pdf_saida", nargs="?", default=None)
    ap.add_argument("--xref", type=int, default=None, help="xref da imagem do QR (confirme com --listar antes).")
    ap.add_argument("--listar", action="store_true", help="Só lista candidatos quadrados, não gera nada.")
    args = ap.parse_args()

    qr_files = sorted(Path(args.pasta_qrcodes).glob("*.png"))
    if not qr_files and not args.listar:
        print(f"Nenhum .png encontrado em {args.pasta_qrcodes}")
        return
    if qr_files:
        print(f"{len(qr_files)} QR codes encontrados em {args.pasta_qrcodes}.")

    doc = fitz.open(args.pdf_original)
    total_placed = 0

    for page_num, page in enumerate(doc, start=1):
        images = page.get_image_info(xrefs=True)
        if not images:
            continue

        by_xref: dict[int, list] = defaultdict(list)
        for im in images:
            by_xref[im["xref"]].append(im)

        square_groups = {
            xref: items for xref, items in by_xref.items() if is_square(fitz.Rect(items[0]["bbox"]))
        }

        if args.listar or args.xref is None:
            print(f"\n--- Página {page_num}: candidatos quadrados (possível QR) ---")
            if not square_groups:
                print("Nenhuma imagem quadrada encontrada nessa página.")
            for xref, items in sorted(square_groups.items(), key=lambda kv: -len(kv[1])):
                b = fitz.Rect(items[0]["bbox"])
                print(f"  xref {xref}: aparece {len(items)}x, tamanho {b.width:.0f}x{b.height:.0f}pt")
            if args.listar:
                continue
            if args.xref is None:
                print("\nRode de novo passando --xref <numero> com o xref certo (o do QR).")
                return

        target = args.xref if args.xref is not None else next(iter(square_groups), None)
        if target is None or target not in by_xref:
            print(f"Página {page_num}: xref {target} não encontrado, pulando.")
            continue

        placeholders = by_xref[target]
        placeholders.sort(key=lambda im: (round(im["bbox"][1], 1), round(im["bbox"][0], 1)))
        print(f"Página {page_num}: substituindo {len(placeholders)} posições (xref {target}).")

        for info in placeholders:
            if total_placed >= len(qr_files):
                break
            bbox = fitz.Rect(info["bbox"])
            page.insert_image(bbox, filename=str(qr_files[total_placed]))
            total_placed += 1

    if args.listar:
        return

    if total_placed < len(qr_files):
        print(
            f"Aviso: só coube {total_placed} de {len(qr_files)} QR codes "
            "(tinha menos posições no PDF do que arquivos)."
        )
    elif total_placed == 0:
        print("Nenhuma posição foi preenchida. Confere o --xref.")

    doc.save(args.pdf_saida)
    print(f"Pronto: {total_placed} QR codes colocados. Salvo em {args.pdf_saida}")


if __name__ == "__main__":
    main()
