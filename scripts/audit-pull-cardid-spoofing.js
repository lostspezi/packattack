/**
 * MongoDB Audit Script: Find PackPull / CartItem / Order entries where the
 * cart's cardId does NOT match the originating PackPull's cardId.
 *
 * Hintergrund: Bis zum Hotfix in /api/pulls/decide hat der Endpoint die
 * cardId aus dem Request-Body in das CartItem geschrieben statt aus dem
 * PackPull-Dokument zu lesen. Damit konnten User eine billige Karte ziehen
 * und im claim-Step eine beliebige andere (z. B. eine 0,062%-Karte) als
 * CartItem reservieren — der Pull-Record selbst blieb dabei korrekt, nur
 * das CartItem (und damit Order/Fulfillment) wurde manipuliert.
 *
 * Run:
 *   mongosh "mongodb+srv://..." scripts/audit-pull-cardid-spoofing.js
 *
 * Output:
 *   - Anzahl betroffener CartItems pro Status
 *   - Top-User nach Anzahl manipulierter Items
 *   - Vollständige Liste mit pullId, claimedCardId, actualCardId, orderId
 *
 * Read-only: dieses Skript schreibt nichts, es identifiziert nur.
 */

print("=== Pull-CardId Spoofing Audit ===\n");

const mismatches = db.cartitems.aggregate([
  {
    $lookup: {
      from: "packpulls",
      localField: "pullId",
      foreignField: "_id",
      as: "p",
    },
  },
  { $unwind: "$p" },
  { $match: { $expr: { $ne: ["$cardId", "$p.cardId"] } } },
  {
    $project: {
      _id: 1,
      userId: 1,
      claimedCardId: "$cardId",
      actualCardId: "$p.cardId",
      claimedBoxId: "$boxId",
      actualBoxId: "$p.boxId",
      cartRarity: "$rarity",
      pullRarity: "$p.rarity",
      pullCoinValue: "$p.coinValue",
      cartStatus: "$status",
      orderId: 1,
      createdAt: 1,
    },
  },
  { $sort: { createdAt: 1 } },
]).toArray();

print("Gesamt-Treffer: " + mismatches.length + " manipulierte CartItems\n");

if (mismatches.length === 0) {
  print("Keine Mismatches gefunden. Exit.");
  quit(0);
}

// Aufschlüsselung nach Status
const byStatus = {};
for (const m of mismatches) {
  byStatus[m.cartStatus] = (byStatus[m.cartStatus] || 0) + 1;
}
print("--- Nach CartItem-Status ---");
for (const [status, count] of Object.entries(byStatus)) {
  print("  " + status + ": " + count);
}

// Top-User
const byUser = {};
for (const m of mismatches) {
  const k = m.userId.toString();
  byUser[k] = (byUser[k] || 0) + 1;
}
const topUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 20);
print("\n--- Top 20 User nach Anzahl manipulierter Items ---");
for (const [uid, count] of topUsers) {
  const u = db.users.findOne({ _id: ObjectId(uid) }, { username: 1, email: 1 });
  print(
    "  " + count + "x  " +
    (u ? (u.username || u.email || uid) : uid) +
    "  (" + uid + ")"
  );
}

// Konkrete Liste
print("\n--- Vollständige Trefferliste ---");
print(
  "createdAt | userId | cartItemId | claimed→actual cardId | rarity-mismatch | status | orderId"
);
for (const m of mismatches) {
  const rarityMismatch = m.cartRarity !== m.pullRarity ? "YES" : "no";
  print(
    m.createdAt.toISOString() + " | " +
    m.userId + " | " +
    m._id + " | " +
    m.claimedCardId + " → " + m.actualCardId + " | " +
    "rarity[" + m.cartRarity + "/" + m.pullRarity + "]=" + rarityMismatch + " | " +
    m.cartStatus + " | " +
    (m.orderId || "—")
  );
}

// Betroffene Orders
const orderIds = [...new Set(mismatches.filter((m) => m.orderId).map((m) => m.orderId.toString()))];
if (orderIds.length > 0) {
  print("\n--- Betroffene Orders (" + orderIds.length + ") ---");
  const orders = db.orders.find({
    _id: { $in: orderIds.map((id) => ObjectId(id)) },
  }, {
    orderNumber: 1, status: 1, paymentStatus: 1, createdAt: 1, userId: 1,
  }).toArray();
  for (const o of orders) {
    print(
      o.createdAt.toISOString() + " | " +
      o.orderNumber + " | status=" + o.status +
      " | payment=" + o.paymentStatus + " | user=" + o.userId
    );
  }
}

print("\n=== Audit abgeschlossen ===");
