-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mana_cost" TEXT,
    "cmc" REAL NOT NULL,
    "type_line" TEXT NOT NULL,
    "oracle_text" TEXT,
    "power" TEXT,
    "toughness" TEXT,
    "loyalty" TEXT,
    "colors" TEXT NOT NULL,
    "color_identity" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "set_code" TEXT,
    "rarity" TEXT,
    "cluster_id" INTEGER
);
