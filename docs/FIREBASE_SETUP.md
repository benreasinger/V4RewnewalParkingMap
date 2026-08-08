# Firebase setup for Renewal Parking 4.0

Version 4.0 uses one Firebase project (`renewalparking`) for Authentication, vehicles, wrapping bags, deliveries, analytics, permissions, and connection monitoring.

## 1. Enable Google sign-in

1. Open Firebase Console → **Authentication** → **Sign-in method**.
2. Enable **Google** and choose the project support email.
3. Under Authentication → **Settings** → **Authorized domains**, add every domain that hosts the app (for example `benreasinger.github.io`).

The old numeric administrator password is gone. It was visible in the browser source and could not securely protect the admin page.

## 2. Publish the database rules

Install the Firebase CLI, sign in, then deploy from the repository root:

```bash
firebase use renewalparking
firebase deploy --only database
```

The included `database.rules.json` requires Google authentication and checks each user's assigned roles.

## 3. Bootstrap the first administrator

The first administrator must be added once in Firebase Console:

1. Sign into the V4 app with your Google account. The app creates `users/{your-uid}` and shows that access is pending.
2. In Firebase Console → Realtime Database, find your record under `users`.
3. Add this child value beneath your user:

```text
roles
  admin: true
```

4. Reload and sign into the Administrator role.

After that, use the **User Access** panel on the Administrator dashboard. Every Google account appears there after its first sign-in, and an administrator can check or uncheck Parking Management, Shopper, Wrapper, Reindeer, and Administrator access.

## 4. First event and fresh starts

If `config/activeEventId` is missing, the app uses `christmas-store-2026`. An administrator can click **Start Fresh Event** to create a blank event and switch every connected device to it. Older event data remains archived under its previous event ID instead of being deleted.

## 5. Parking lot map

Save the provided map PNG as:

```text
assets/parking-lot-map.png
```

The Map screen already references that location. Until the PNG exists, it shows a labeled placeholder.

## Database layout

```text
config/activeEventId
users/{uid}/roles
events/{eventId}/vehicles
events/{eventId}/bags
events/{eventId}/deliveries
events/{eventId}/removed
events/{eventId}/statusHistory
events/{eventId}/activity
presence/{eventId}/{uid}/{browserSession}
```

The old root-level `parkingSlots`, `removedCars`, and separate wrapping Firebase project are intentionally not used by V4.
