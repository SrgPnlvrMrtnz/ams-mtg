"""
K-Means clustering for MTG cards.
Reads cards from the SQLite DB, clusters them, and writes cluster_id back.

Usage:
    python cluster_cards.py [--k 10] [--db ../prisma/dev.db]
"""

import argparse
import json
import sqlite3
import re

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--k', type=int, default=10, help='Number of clusters')
    parser.add_argument('--db', default='../prisma/dev.db', help='Path to SQLite DB')
    return parser.parse_args()


def load_cards(db_path: str) -> pd.DataFrame:
    con = sqlite3.connect(db_path)
    df = pd.read_sql_query(
        'SELECT id, cmc, power, toughness, loyalty, colors, color_identity, type_line FROM "Card"',
        con
    )
    con.close()
    print(f'Loaded {len(df)} cards from {db_path}')
    return df


def parse_numeric(val):
    if val is None or val == '':
        return None
    if isinstance(val, (int, float)):
        return float(val)
    # Replace * and similar with None
    cleaned = re.sub(r'[^0-9.\-]', '', str(val))
    return float(cleaned) if cleaned else None


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Numeric stats
    df['power_n'] = df['power'].apply(parse_numeric)
    df['toughness_n'] = df['toughness'].apply(parse_numeric)
    df['loyalty_n'] = df['loyalty'].apply(parse_numeric)

    # Fill nulls with column mean
    for col in ['power_n', 'toughness_n', 'loyalty_n']:
        df[col] = df[col].fillna(df[col].mean())

    # One-hot colors
    all_colors = ['W', 'U', 'B', 'R', 'G']
    for c in all_colors:
        df[f'color_{c}'] = df['color_identity'].apply(
            lambda x: 1 if f'"{c}"' in x else 0
        )

    # Type flags
    types = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Planeswalker']
    for t in types:
        df[f'type_{t.lower()}'] = df['type_line'].str.contains(t, na=False).astype(int)

    return df


def run_clustering(df: pd.DataFrame, k: int):
    feature_cols = (
        ['cmc', 'power_n', 'toughness_n', 'loyalty_n']
        + [f'color_{c}' for c in ['W', 'U', 'B', 'R', 'G']]
        + [f'type_{t}' for t in ['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'land', 'planeswalker']]
    )

    X = df[feature_cols].fillna(0).values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f'Running K-Means with k={k}...')
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)
    return labels


def write_clusters(db_path: str, ids: list, labels):
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    data = [(int(label), card_id) for card_id, label in zip(ids, labels)]
    cur.executemany('UPDATE "Card" SET cluster_id = ? WHERE id = ?', data)
    con.commit()
    con.close()
    print(f'Updated {len(data)} cards with cluster_id.')


def print_summary(df: pd.DataFrame, labels, k: int):
    df = df.copy()
    df['cluster_id'] = labels
    print('\n=== Cluster Summary ===')
    for i in range(k):
        cluster = df[df['cluster_id'] == i]
        types = ['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'land', 'planeswalker']
        dominant = [t for t in types if cluster[f'type_{t}'].mean() > 0.3]
        colors = ['W', 'U', 'B', 'R', 'G']
        dominant_colors = [c for c in colors if cluster[f'color_{c}'].mean() > 0.2]
        avg_cmc = cluster['cmc'].mean()
        print(
            f'  Cluster {i:2d}: {len(cluster):5d} cards | '
            f'avg cmc={avg_cmc:.1f} | '
            f'types={dominant or ["mixed"]} | '
            f'colors={dominant_colors or ["colorless/mixed"]}'
        )


def main():
    args = parse_args()
    df = load_cards(args.db)
    df = engineer_features(df)
    labels = run_clustering(df, args.k)
    write_clusters(args.db, df['id'].tolist(), labels)
    print_summary(df, labels, args.k)
    print('\nClustering complete.')


if __name__ == '__main__':
    main()
