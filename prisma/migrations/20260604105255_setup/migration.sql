/*
  Warnings:

  - You are about to drop the column `cluster_id` on the `Card` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Card" (
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
    "tags" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_Card" ("cmc", "color_identity", "colors", "id", "keywords", "loyalty", "mana_cost", "name", "oracle_text", "power", "rarity", "set_code", "toughness", "type_line") SELECT "cmc", "color_identity", "colors", "id", "keywords", "loyalty", "mana_cost", "name", "oracle_text", "power", "rarity", "set_code", "toughness", "type_line" FROM "Card";
DROP TABLE "Card";
ALTER TABLE "new_Card" RENAME TO "Card";
CREATE TABLE "new_Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "cards" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "colorIdentity" TEXT NOT NULL DEFAULT '[]',
    "commander" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Deck" ("cards", "createdAt", "format", "id", "name", "updatedAt", "userId") SELECT "cards", "createdAt", "format", "id", "name", "updatedAt", "userId" FROM "Deck";
DROP TABLE "Deck";
ALTER TABLE "new_Deck" RENAME TO "Deck";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
