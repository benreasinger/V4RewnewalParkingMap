# Renewal Parking — GitHub Pages Update

This folder contains the updated files from the supplied code. Keep your existing `assets/` folder and your existing `stylesheet/styles.css`; the new `stylesheet/update.css` is additive.

## What changed

- Google authentication uses popup sign-in only. This avoids Firebase's `missing initial state` redirect error in mobile Safari and partitioned browser sessions.
- Parking Management receives one grouped notification 10 seconds after the first ticket moves to `Fetch-to-shop`. Every spot moved during that window appears in the same notification.
- Volunteer check-in, shift settings, and shopper roster requirements have been removed. Shoppers can move `Awaiting Shopper` tickets directly into `Shopping`.
- Administrator content is split into Live Operations, Statistics & Analytics, and Administrative Tools.
- Presence is stored once per user instead of once per browser session. The display also collapses old session-shaped records so duplicate users disappear immediately.

## Deploy to GitHub Pages

1. Replace the matching files in your repository with this bundle.
2. Keep/copy your existing `assets/` directory and `stylesheet/styles.css` into the same locations.
3. Commit and push to the branch GitHub Pages publishes.
4. In Firebase Console, open **Authentication → Settings → Authorized domains** and add your exact GitHub Pages host, for example `yourname.github.io` (host only; no `https://` or repository path).
5. Publish `database.rules.json` to Firebase Realtime Database Rules. Hosting remains on GitHub Pages; only the database rules are deployed to Firebase.
6. In Firebase Authentication, Google must remain enabled. Anonymous authentication is no longer needed by this code and can be disabled if nothing else uses it.

If your GitHub Pages repository is a project site such as `https://yourname.github.io/renewal-parking/`, add only `yourname.github.io` as the authorized domain. The relative links in these files support the repository subfolder.
