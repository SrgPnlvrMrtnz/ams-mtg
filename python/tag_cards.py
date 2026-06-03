"""
Rule-based multi-label tagger for MTG cards.
Reads cards from SQLite DB and assigns functional tags to each card.

Usage:
    python tag_cards.py [--db ../prisma/dev.db]
"""

import argparse
import json
import sqlite3


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='../prisma/dev.db', help='Path to SQLite DB')
    return parser.parse_args()


def get_tags(card) -> list[str]:
    oracle = (card['oracle_text'] or '').lower()
    type_line = (card['type_line'] or '').lower()
    keywords = json.loads(card['keywords'] or '[]')
    keywords_lower = [k.lower() for k in keywords]
    cmc = card['cmc'] or 0

    tags = []

    # --- Coste de maná ---
    if cmc <= 2:
        tags.append('bajo-coste')
    elif cmc <= 4:
        tags.append('coste-medio')
    else:
        tags.append('alto-coste')

    # --- Tipo de carta ---
    if 'creature' in type_line:
        tags.append('criatura')
    if 'instant' in type_line:
        tags.append('instantaneo')
    if 'sorcery' in type_line:
        tags.append('conjuro')
    if 'artifact' in type_line:
        tags.append('artefacto')
    if 'enchantment' in type_line:
        tags.append('encantamiento')
    if 'land' in type_line:
        tags.append('tierra')
    if 'planeswalker' in type_line:
        tags.append('planeswalker')

    # --- Remoción ---
    removal_phrases = [
        'destroy target', 'exile target creature', 'exile target permanent',
        'exile target artifact', 'exile target enchantment',
        'deals damage to target creature', 'deals damage to any target',
        '-x/-x', 'toughness becomes 0',
    ]
    if any(p in oracle for p in removal_phrases):
        tags.append('remocion')

    # --- Robo de cartas ---
    draw_phrases = ['draw a card', 'draw two cards', 'draw three cards', 'draw x cards', 'draw cards']
    if any(p in oracle for p in draw_phrases):
        tags.append('robo-cartas')

    # --- Ramp (aceleración de maná) ---
    if 'add {' in oracle or ('search your library for a' in oracle and 'land' in oracle):
        tags.append('ramp')

    # --- Contrahechizo ---
    if 'counter target spell' in oracle or 'counter target activated' in oracle or 'counter target triggered' in oracle:
        tags.append('contrahechizo')

    # --- Tokens ---
    if 'token' in oracle and ('create a' in oracle or 'create x' in oracle or 'put a' in oracle):
        tags.append('tokens')

    # --- Evasión ---
    evasion_keywords = {'flying', 'trample', 'menace', 'haste', 'first strike', 'double strike', 'shadow', 'fear', 'intimidate', 'unblockable'}
    if any(k in evasion_keywords for k in keywords_lower):
        tags.append('evasion')

    # --- Protección ---
    protection_phrases = ['hexproof', 'indestructible', 'protection from', 'shroud']
    if any(p in oracle for p in protection_phrases) or any(p in keywords_lower for p in protection_phrases):
        tags.append('proteccion')

    # --- Vida ---
    if ('gain' in oracle and 'life' in oracle) or 'lifelink' in keywords_lower:
        tags.append('vida')

    # --- Daño directo ---
    if ('deals' in oracle and 'damage to each opponent' in oracle) or \
       ('deals' in oracle and 'damage to any target' in oracle and 'instant' in type_line):
        tags.append('daño-directo')

    return tags


def tag_cards(db_path: str):
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute('SELECT id, oracle_text, type_line, keywords, cmc FROM "Card"')
    cards = cur.fetchall()
    print(f'Loaded {len(cards)} cards from {db_path}')

    updates = []
    tag_counts: dict[str, int] = {}

    for card in cards:
        tags = get_tags(card)
        for t in tags:
            tag_counts[t] = tag_counts.get(t, 0) + 1
        updates.append((json.dumps(tags), card['id']))

    cur.executemany('UPDATE "Card" SET tags = ? WHERE id = ?', updates)
    con.commit()
    con.close()

    print(f'Tagged {len(updates)} cards.\n')
    print('=== Tag Distribution ===')
    for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
        print(f'  {tag:<20} {count:>6} cards')


if __name__ == '__main__':
    args = parse_args()
    tag_cards(args.db)
