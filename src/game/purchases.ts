/**
 * Buying and restoring Typo Tyrant Pro, through RevenueCat and the App Store.
 *
 * - In a development or store build on iPhone/iPad: real App Store purchases (sandbox purchases
 *   when you're signed into a sandbox tester, so testing is free).
 * - In Expo Go, the browser, or Android (not set up yet): no store. Development builds then
 *   unlock Pro for free ("test mode") so the paywall can still be tried; release builds refuse.
 *
 * RevenueCat setup: product `typotyrant.pro` (non-consumable) is in the Lifetime package of the
 * current offering and grants the `typo_tyrant_pro` entitlement.
 */
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import Purchases, { LOG_LEVEL, PACKAGE_TYPE, type CustomerInfo } from "react-native-purchases";

/** RevenueCat's public iOS key. Public by design: it's safe to ship inside the app. */
const REVENUECAT_IOS_KEY = "appl_WsvoFjThpadKfarQWyzwcGAAjWy";
/** The RevenueCat entitlement that Pro unlocks. */
const ENTITLEMENT = "typo_tyrant_pro";

export type PurchaseResult = { ok: true } | { ok: false; reason: string; cancelled?: boolean };

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
/** A real store is available (Apple only for now; Android comes later). */
export const STORE_AVAILABLE = Platform.OS === "ios" && !isExpoGo;

/** No store here, so development builds unlock Pro for free instead of charging. */
export const PURCHASES_TEST_MODE = __DEV__ && !STORE_AVAILABLE;

let configured = false;
function store(): typeof Purchases | null {
  if (!STORE_AVAILABLE) return null;
  if (!configured) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      // RevenueCat reports App Store hiccups (common in sandbox) as console errors, which Expo
      // shows as a full red screen. Send them to the console as warnings instead; the app already
      // handles each failure itself.
      Purchases.setLogHandler((level, message) => {
        if (level === LOG_LEVEL.ERROR || level === LOG_LEVEL.WARN) console.warn(`[RevenueCat] ${message}`);
        else console.log(`[RevenueCat] ${message}`);
      });
    }
    Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
    configured = true;
  }
  return Purchases;
}

const ownsPro = (info: CustomerInfo) => typeof info.entitlements.active[ENTITLEMENT] !== "undefined";

/** The Lifetime package of the current offering (holds `typotyrant.pro`). */
async function proPackage() {
  const p = store();
  if (!p) return null;
  const offerings = await p.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return current.lifetime ?? current.availablePackages.find(pkg => pkg.packageType === PACKAGE_TYPE.LIFETIME) ?? null;
}

/** The store's localized price for Pro, e.g. "$3.99", or null if unknown. */
export async function getProPrice(): Promise<string | null> {
  try {
    return (await proPackage())?.product.priceString ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether this Apple account owns Pro, asked quietly on launch (no sign-in prompts).
 * Returns null when there's no store or it can't be reached, so the saved status is kept.
 */
export async function checkProOwned(): Promise<boolean | null> {
  const p = store();
  if (!p) return null;
  try {
    return ownsPro(await p.getCustomerInfo());
  } catch {
    return null;
  }
}

export async function buyPro(): Promise<PurchaseResult> {
  const p = store();
  if (!p) {
    if (PURCHASES_TEST_MODE) return { ok: true };
    return { ok: false, reason: "Purchases aren’t available on this device yet." };
  }
  try {
    const pkg = await proPackage();
    if (!pkg) return { ok: false, reason: "Couldn’t load Pro from the App Store. Check your connection and try again." };
    const { customerInfo } = await p.purchasePackage(pkg);
    return ownsPro(customerInfo) ? { ok: true } : { ok: false, reason: "The purchase didn’t go through. You haven’t been charged." };
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return { ok: false, reason: "", cancelled: true };
    return { ok: false, reason: "The purchase didn’t go through. Please try again." };
  }
}

/** Asks the App Store whether this account already owns Pro (new phone or reinstall). Only from a button tap. */
export async function restorePro(): Promise<PurchaseResult> {
  const p = store();
  if (!p) return { ok: false, reason: "No previous Pro purchase was found on this device." };
  try {
    const info = await p.restorePurchases();
    return ownsPro(info) ? { ok: true } : { ok: false, reason: "No Pro purchase was found for this Apple account." };
  } catch {
    return { ok: false, reason: "Couldn’t reach the App Store. Check your connection and try again." };
  }
}
