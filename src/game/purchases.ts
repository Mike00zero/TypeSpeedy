/**
 * Buying and restoring Pro.
 *
 * Real purchases aren't connected yet: they need an Apple/Google developer account, a "Pro"
 * in-app product in each store, and RevenueCat (react-native-purchases), which only runs in a
 * development or store build, not Expo Go. Until then:
 *   - development builds (__DEV__) unlock Pro for free, so the paywall can be tested;
 *   - release builds refuse, so nobody gets Pro for free by accident.
 * When the stores are set up, replace the three functions below with RevenueCat calls
 * (Purchases.configure, getCustomerInfo, purchasePackage, restorePurchases).
 */

export type PurchaseResult = { ok: true } | { ok: false; reason: string; cancelled?: boolean };

/** Purchases are in test mode: buying unlocks Pro without charging anyone. */
export const PURCHASES_TEST_MODE = __DEV__;

/** The store's price for Pro, e.g. "$3.99", or null if unknown. */
export async function getProPrice(): Promise<string | null> {
  return null;
}

export async function buyPro(): Promise<PurchaseResult> {
  if (PURCHASES_TEST_MODE) return { ok: true };
  return { ok: false, reason: "Purchases aren’t available yet. Check back soon!" };
}

/** Asks the store whether this account already owns Pro (for a new phone or a reinstall). */
export async function restorePro(): Promise<PurchaseResult> {
  return { ok: false, reason: "No previous Pro purchase was found on this account." };
}
