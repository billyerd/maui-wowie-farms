# Receipt verification

Real-money purchases in Maui Wowie Farms are granted only after your server says the receipt is paid. Test mode (`PAYMENTS_CONFIG.mode = 'test'`, the default) never calls the server and never moves money.

Set the endpoint before `js/payments.js` loads, or assign it on the same object afterward:

```html
<script>
  window.PAYMENTS_CONFIG = {
    mode: 'test', // 'auto' | 'test' | 'stripe' | 'appstore' | 'play'
    verifyEndpoint: 'https://[YOUR_API_HOST]/verify'
  };
</script>
```

Leave `verifyEndpoint` empty until the server exists. Stripe, App Store, and Play purchases then fail with "Receipt verification is not configured" and grant nothing.

## Request

`POST {verifyEndpoint}`

`Content-Type: application/json`

```json
{
  "kind": "apple",
  "token": "<receipt or transaction id>",
  "productId": "gems_s"
}
```

`kind` is `apple` (StoreKit receipt or transaction id), `google` (Play purchase token), or `stripe` (Checkout Session id from the success URL).

`productId` is the id in `js/products.js` (`gems_s`, `starter`, `pass2x`, `vip`, `theme_neon`, `piggy`, `strain_menehune-mint`, and the rest).

## Response

HTTP 200 and:

```json
{ "paid": true, "productId": "gems_s", "txId": "server-transaction-id" }
```

The client grants the product only when `paid` is exactly `true` and `productId` matches the product the player bought. Any other body, a non-200 status, or a network failure grants nothing.

`txId` is optional. When you send one, the client uses it as the idempotency key, so the same receipt cannot grant twice. When you omit it, the client keys off the store transaction id or purchase token.

On failure you may return `{ "paid": false, "error": "short reason" }`. The `error` string is shown in the game.

## What the server must do

Do this on a machine you control. The game bundle cannot hold a store secret.

1. **Apple.** Send the receipt to the App Store Server API (or verify a StoreKit 2 JWS). Confirm the product id, that the transaction is for your bundle id, and that it has not been revoked. Consumables (`gems_*`, `starter`, `piggy`, strain seed packs) may grant once per transaction id. Non-consumables (`pass2x`, `vip`, `theme_*`, cosmetics, `mgr_slot`) may also be restored.
2. **Google Play.** Call the Play Developer API with the purchase token. Acknowledge the purchase. Check `purchaseState` is purchased and the product id matches.
3. **Stripe (web build only).** Handle `checkout.session.completed` (or retrieve the Checkout Session by the id in `token`). Confirm `payment_status` is `paid` and the session's product matches `productId`. Do not enable Stripe inside the iOS or Android app. Digital goods there have to use Apple and Google billing.

Compare the store product id to `productId` yourself. Do not trust the client's claim without that check.

Store the store transaction id and refuse a second grant of the same id, even if `txId` is reused.

## Restore

Apple requires a Restore purchases button. Settings already has one. The native plugin should resolve `NativeIAP.restore()` to an array of `{ productId, token }` for non-consumables. The client verifies each token and grants only on success. String-only ids are ignored outside test mode, because they cannot be checked.

## Native plugin shape

```js
NativeIAP.purchase(productId) // Apple: { transactionId, receipt }  Google: { purchaseToken }
NativeIAP.finish(transactionId) // Apple, after a successful grant
NativeIAP.finish(purchaseToken, consumable) // Google, after a successful grant
NativeIAP.restore() // [{ productId, token }]
```

Finish is called only after verification succeeds, so a rejected receipt can be retried.

## Placeholders

Replace `[YOUR_API_HOST]` with the host you own. Do not ship a guess.
