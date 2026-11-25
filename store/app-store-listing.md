# Typo Tyrant: App Store listing (v1.0.2)

Copy-paste text for App Store Connect. Character limits are Apple's; counts are checked.

---

## App Information

| Field | Value |
|---|---|
| Name (30) | Typo Tyrant |
| Subtitle (30) | Typing Game: Spell to Survive |
| Primary category | Games → Word |
| Secondary category | Games → Casual |
| Content rights | Does not contain third-party content |
| Privacy Policy URL | https://mike00zero.github.io/TypeSpeedy/privacy-policy.html |

## Version 1.0 page

| Field | Value |
|---|---|
| Support URL | https://mike00zero.github.io/TypeSpeedy/support.html |
| Marketing URL (optional) | https://mike00zero.github.io/TypeSpeedy/ |
| Copyright | 2026 Mike Pisanchik |
| Version | 1.0.2 |

### Promotional Text (170, can change any time without review)

Type each word before the clock runs out. Every round gets faster, and a boss waits at the end of each one. Can you climb 100 floors and dethrone the Typo Tyrant?

### Keywords (100, comma-separated, no spaces)

```
speed,wpm,keyboard,words,spelling,boss,tower,trainer,practice,fast,letters,daily,challenge,arcade
```

Words already in the name and subtitle (typo, tyrant, typing, game, spell, survive) are left out because Apple indexes those anyway.

### Description (4000)

Type fast. Spell right. Survive the Tyrant.

Typo Tyrant is a typing game with a royal twist. Each word has its own clock, and wrong letters cost lives. Rounds get faster as you go, and every round ends in a boss fight. Beat the boss to win power-ups, then keep climbing.

PICK YOUR QUEST
• Survival: the classic. Last as long as you can on Easy, Medium, Hard or Impossible.
• Daily Challenge: one attempt a day, the same words for everyone. Share your result.
• Sprint: 60 seconds, as many words as you can.
• Zen: no clock, no lives. Just type.
• Tower Climb: 100 floors, 2 lives, checkpoints along the way, and the Typo Tyrant waiting at the top.
• Marathon Mix: a new twist every round, like backwards words, vanishing letters, scrambled words and shrinking clocks.
• Boss Rush: nothing but bosses.
• Sudden Death: one life, double points.

POWER UP
Earn power-ups as you score, from Freeze and Shield to Slow-Mo and Skip. Defeat a boss to win a rare gold bonus.

EARN YOUR CROWN
• 72 achievements to chase
• Unlock new color themes and word packs by playing
• Unlock the Retro Court style, a pixel-castle look with its own chiptune soundtrack
• Detailed stats: best scores, fastest words, accuracy and more

BUILT FOR PHONE AND IPAD
Two original soundtracks, haptics, and a layout that works in portrait on iPhone and any orientation on iPad.

FAIR AND SIMPLE
No ads. No accounts. No tracking. Your progress stays on your device.

TYPO TYRANT PRO
Survival, Sprint, Zen, the Daily Challenge, achievements and stats are free. Try each Pro quest once a day for free. Typo Tyrant Pro is a one-time purchase that unlocks Tower Climb, Marathon Mix, Boss Rush and Sudden Death without limits, plus every color theme and word pack you earn. No subscription, ever.

### What's New in 1.0.2

Typo Tyrant Pro is here! One payment unlocks Tower Climb, Marathon Mix, Boss Rush and Sudden Death, plus every color theme and word pack you earn. Purchase messages are clearer too.

### What's New in 1.0.1 (first release)

Long live the Tyrant! The first release of Typo Tyrant.

---

## In-App Purchase: typotyrant.pro

| Field | Value |
|---|---|
| Reference name | Typo Tyrant Pro |
| Product ID | typotyrant.pro |
| Type | Non-Consumable |
| Price | $3.99 (Tier 4) |
| Display name (30) | Typo Tyrant Pro |
| Description (45) | Every quest, theme and word pack, forever. |
| Review screenshot | `store/review/pro-paywall.png` (the paywall: tap "Typo Tyrant Pro" at the bottom of the main menu) |

**Review notes for the purchase:**

Typo Tyrant Pro is a one-time, non-consumable unlock. It removes the one-try-per-day limit on four game modes (Tower Climb, Marathon Mix, Boss Rush, Sudden Death) and lets players use the color themes and word packs they earn. To see the paywall, open Settings from the main menu and tap "Unlock" under Typo Tyrant Pro, or start a Pro quest after using its free daily try. "Restore purchases" is in Settings and on the paywall.

### Getting the purchase ready (do this before submitting)

Apple reviews your first in-app purchase together with the app, so it has to be attached to the version. (1.0.1 went out without it, so Pro ships with 1.0.2.)

1. **App Store Connect → your app → Monetization → In-App Purchases → Typo Tyrant Pro.**
2. Check **Price Schedule** is set ($3.99) and **Availability** includes your countries.
3. Under **App Store Localization** (English (U.S.)), set the display name and description above.
4. Under **Review Information**, upload `store/review/pro-paywall.png` and paste the review notes above.
5. Save. The status should change from "Missing Metadata" to **"Ready to Submit"**.
6. Once a build is uploaded, open the **iOS App 1.0.2** version page, scroll to **In-App Purchases and Subscriptions**, click **Select In-App Purchases** and tick **Typo Tyrant Pro**. (If the section isn't there yet, add your build to the version first, then look again.)
7. In **RevenueCat**, confirm the current offering's Lifetime package still holds `typotyrant.pro`, and that the App Store connection shows no errors.

---

## App Review Information

| Field | Value |
|---|---|
| Sign-in required | No |
| Contact | Mike Pisanchik, your phone number, mpisanchik@gmail.com |

**Notes for the reviewer:**

Thanks for reviewing Typo Tyrant!

- No account or sign-in is needed. Tap a quest tile and the gold button to start.
- A hardware or on-screen keyboard is used to type. Tap the word area if the keyboard is hidden.
- The in-app purchase "Typo Tyrant Pro" (typotyrant.pro) is a one-time non-consumable unlock. On the main menu, open Settings (gear icon, top right) and tap "Unlock" under Typo Tyrant Pro to see the paywall. "Restore purchases" is in Settings and on the paywall.
- Free players can try each Pro mode once per day, so the first Pro game works without buying.
- Daily reminders are optional local notifications. The app asks for notification permission only when the player turns reminders on in Settings. There are no push notifications and no tracking.
- The app collects no personal data. Purchases are verified with RevenueCat.

---

## Age Rating answers

Answer **None** / **No** to everything: no violence (bosses are word-based, nothing graphic), no mature themes, no gambling, no contests, no unrestricted web access, no user-generated content, no messaging. Expected rating: **4+**.

## App Privacy ("nutrition label") answers

**Do you or your third-party partners collect data from this app?** Yes. RevenueCat handles purchases.

Declare only these two data types:

| Data type | Used for | Linked to user? | Used for tracking? |
|---|---|---|---|
| Purchases → Purchase History | App Functionality | No | No |
| Identifiers → User ID | App Functionality | No | No |

Notes:
- The User ID is RevenueCat's anonymous app user ID. It isn't tied to a name, email or account.
- Scores, settings and progress never leave the device, so they aren't "collected".
- The reminder is a local notification: nothing is sent to a server.
- Check RevenueCat's App Privacy guide (docs.revenuecat.com, "Apple App Privacy") before you submit, in case their SDK's declarations have changed.

---

## Screenshots

Files are in `store/screenshots/`:

| Folder | Size | App Store Connect slot |
|---|---|---|
| `iphone-6.9/` | 1320 × 2868 | iPhone 6.9" Display |
| `ipad-13/` | 2064 × 2752 | iPad 13" Display |

Apple scales these down for smaller devices, so these two sizes are all you need.
