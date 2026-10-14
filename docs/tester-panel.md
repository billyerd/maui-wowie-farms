# Tester panel

The hidden tester panel adds cash, gems, level, an unlock-all, seeds, growth speed, and a time skip. It exists so the website and local test builds can reach every feature. It is off unless that tab was opened with `?dev=1`.

App Store, Google Play, and production-store builds cannot turn it on.

## How a store build disables it

Set one flag in `js/config.js` before shipping:

```js
window.GAME_CONFIG = {
  // ...
  allowDevTools: false,
};
```

`allowDevTools` must be exactly `true` for the panel to be reachable. `false`, or leaving the property out, is the off switch. The website and local test builds keep `true`.

When the flag is not `true`:

- `?dev=1` is ignored. The game does not write the `mwf_dev` session flag.
- A leftover `mwf_dev` value is deleted.
- `window.DEV_MODE` stays `false`. The panel is not created, and Settings does not mention tester tools.
- Tester actions do not run: level, unlock, seeds, growth speed, and time skip.
- Purchasable currency is not granted. `addCash(..., 'dev')` and `addGems(..., 'Dev')` return without changing the balance. The panel's cash and gem buttons, and unlock-all's cash and gem top-up, use those sources, so they cannot mint cash or gems. Gameplay grants (sales, level-ups, ads, goals) use other sources and are unchanged.
- The lock sticks for that page load. Setting `allowDevTools` back to `true`, or setting `DEV_MODE` in the console, does not re-enable grants.

`?dev=0` still clears the session flag on builds where the panel is allowed. The save key stays `mwfarms_save_v1`.

## Store payment modes

Native store billing forces the same lock even if `allowDevTools` was left `true`. `js/payments.js` applies it as soon as the payments mode is known, before `js/devpanel.js` runs.

The lock turns on when `PAYMENTS_CONFIG.mode` is:

- `'appstore'` or `'play'`, or
- `'auto'` while the page is running in an iOS or Android app (Capacitor).

Test mode (`mode: 'test'`, the shipped default) does not trip this lock. A production-store build still sets `allowDevTools` to `false` so the panel stays off even if payments are left in test mode by mistake.

## Tester jump menu (`?test=1`)

The same lock covers the Beginning / Middle / End jump menu. `applyTesterLock()` forces `TEST_MODE` false, deletes the `mwf_test` session flag, and deletes `mwf_test_slot` and `mwf_test_init` from localStorage. If the page had already switched the save key to a `mwfarms_test_` slot, the key is put back to `mwfarms_save_v1` before the farm loads. Settings renders no Test entry while `storeDisablesTester()` is true, and the menu's preset buttons do not run. Website and local test builds (`allowDevTools: true` and payments mode `test`) still open the menu with `?test=1`.
