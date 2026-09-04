#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "App.tsx"

text = APP.read_text(encoding="utf-8")

replacements = [
    (
        "Responda algumas perguntas rápidas para organizar o que deseja conversar.",
        "Veja os primeiros destaques do seu sorriso em poucos minutos — e chegue à conversa com mais clareza.",
    ),
    (
        "Simples, rápido e informativo.",
        "Veja seu sorriso. Entenda o que observar. Saiba o próximo passo.",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERRO: esperado exatamente 1 ocorrência de {old!r}; encontrado {count}."
        )
    text = text.replace(old, new, 1)
    print(f"OK: {old} -> {new}")

APP.write_text(text, encoding="utf-8")

print("\nCOPY DE CONVERSAO ATUALIZADA.")
print("- Vitrine: benefício antes do esforço.")
print("- Home: descoberta -> compreensão -> próximo passo.")
print("- Cards da seção Como funciona: preservados.")
print("Nenhum deploy foi executado.")
