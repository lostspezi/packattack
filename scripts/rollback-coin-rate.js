/**
 * MongoDB Rollback Script: Revert Coin Rate Change (1 Coin = 0,50€ → 1 Coin = 1€)
 *
 * Run directly with mongosh:
 *   mongosh "mongodb+srv://..." scripts/rollback-coin-rate.js
 *
 * What this script does (reverses migrate-coin-rate.js):
 * 1. Halves all user coin balances
 * 2. Halves card internalPrice values
 * 3. Halves box priceInCoins
 * 4. Halves shipping tier costCoins
 * 5. Halves coin package baseCoins + bonusCoins
 * 6. Halves pending/reserved packpull coinValue + conversionValue
 * 7. Halves reserved cart item conversionValue
 * 8. Removes the migration record so the migration can be re-applied later
 *
 * Safe to run only once — checks that the migration was actually applied.
 */

const MIGRATION_ID = "coin-rate-1-to-0.50_2026-03-29";

// Check that the migration was applied
const existing = db.migrations.findOne({ _id: MIGRATION_ID });
if (!existing) {
  print("Migration was never applied — nothing to roll back. Exiting.");
  quit(0);
}

// 1. Halve user coin balances
print("--- Step 1: Halve user coin balances ---");
let result = db.users.updateMany(
  { coins: { $gt: 0 } },
  [{ $set: { coins: { $divide: ["$coins", 2] } } }]
);
print("  Updated " + result.modifiedCount + " user(s).");

// 2. Halve card internalPrice
print("\n--- Step 2: Halve card internalPrice ---");
result = db.cards.updateMany(
  { internalPrice: { $ne: null, $gt: 0 } },
  [{ $set: { internalPrice: { $divide: ["$internalPrice", 2] } } }]
);
print("  Updated " + result.modifiedCount + " card(s).");

// 3. Halve box priceInCoins
print("\n--- Step 3: Halve box priceInCoins ---");
result = db.boxes.updateMany(
  { priceInCoins: { $gt: 0 } },
  [{ $set: { priceInCoins: { $divide: ["$priceInCoins", 2] } } }]
);
print("  Updated " + result.modifiedCount + " box(es).");

// 4. Halve shipping tier costCoins
print("\n--- Step 4: Halve shipping tier costCoins ---");
result = db.shippingtiers.updateMany(
  { costCoins: { $gt: 0 } },
  [{ $set: { costCoins: { $divide: ["$costCoins", 2] } } }]
);
print("  Updated " + result.modifiedCount + " shipping tier(s).");

// 5. Halve coin package baseCoins + bonusCoins
print("\n--- Step 5: Halve coin package coin amounts ---");
result = db.coinpackages.updateMany(
  {},
  [{
    $set: {
      baseCoins: { $divide: ["$baseCoins", 2] },
      bonusCoins: { $divide: ["$bonusCoins", 2] },
    },
  }]
);
print("  Updated " + result.modifiedCount + " coin package(s).");

// 6. Halve pending/reserved pack pull values
print("\n--- Step 6: Halve pending/reserved pack pull values ---");
result = db.packpulls.updateMany(
  { status: { $in: ["pending", "reserved"] } },
  [{
    $set: {
      coinValue: { $divide: ["$coinValue", 2] },
      conversionValue: { $divide: ["$conversionValue", 2] },
    },
  }]
);
print("  Updated " + result.modifiedCount + " pack pull(s).");

// 7. Halve reserved cart item conversionValue
print("\n--- Step 7: Halve reserved cart item conversionValue ---");
result = db.cartitems.updateMany(
  { status: "reserved" },
  [{ $set: { conversionValue: { $divide: ["$conversionValue", 2] } } }]
);
print("  Updated " + result.modifiedCount + " cart item(s).");

// 8. Remove migration record
db.migrations.deleteOne({ _id: MIGRATION_ID });

print("\nRollback complete!");
print("  - All coin values have been halved");
print("  - 1 Coin = 1,00 EUR is now in effect");
print("  - Migration record removed — migration can be re-applied later");
