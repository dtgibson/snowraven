# Your Android signing key: one-time setup

**Status: created 2026-10-04; backed up by the user 2026-10-06 (key and properties file, off this Mac).** At the user's direction the Orchestrator generated the key exactly as step 4 below describes (`~/.tauri/snowraven-android.p12`, alias `snowraven`, PKCS12, 4096-bit RSA, 10,000 days) and wrote the properties file beside it, both mode 0600; certificate SHA-256 `42:A3:57:6E:44:5B:DA:4A:99:47:93:F2:FF:A0:56:66:31:13:27:5C:98:05:EB:2F:6C:FF:DC:25:23:75:99:6A`. Steps 1 to 13 are therefore done. The steps stay below as the record of how the key was made and as the recipe if it ever has to be made again for a new app id.

**For:** the user, on the release Mac (Hephaestus), in your own terminal. **Why:** the APK attached to each GitHub release is signed with your own key, and every later APK must be signed with the same key or it will not install over the earlier one. No agent creates, copies or backs up this key (release skill, Android section). Relay one step at a time; each step is one line to run or one thing to do.

**Never paste the password into chat, a commit or a file inside the repository.** The release scripts read it only from the properties file below and hand it to `keytool` and `apksigner` by file, never on a command line.

## Before you start

1. Choose a strong password and store it in your password manager first, so it exists somewhere before the key does.
2. Open a terminal on Hephaestus (a second ssh session is fine).
3. Put Java 17 first on that terminal's `PATH` (the login shell's `/usr/bin/keytool` is macOS's stub and answers "Unable to locate a Java Runtime"):

   ```sh
   export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
   ```

## Create the key (once)

4. Run this, exactly, and enter the password twice when asked (a PKCS12 key store has one password, so there is no separate key password prompt):

   ```sh
   keytool -genkeypair -v -storetype PKCS12 -keystore ~/.tauri/snowraven-android.p12 -alias snowraven -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SnowRaven, O=Dave Gibson"
   ```

   It prints a line about generating a 4,096 bit RSA key pair for `CN=SnowRaven, O=Dave Gibson` and `[Storing /Users/developer/.tauri/snowraven-android.p12]`.

## Write the properties file (once)

5. Open the file in an editor:

   ```sh
   nano ~/.tauri/snowraven-android-keystore.properties
   ```

6. Type these four lines, putting your password after the two `=` signs (the same password twice):

   ```properties
   storeFile=/Users/developer/.tauri/snowraven-android.p12
   storePassword=<your password>
   keyAlias=snowraven
   keyPassword=<your password>
   ```

7. Save and close (in nano: Control-O, Return, Control-X).

## Lock both files down

8. Run:

   ```sh
   chmod 600 ~/.tauri/snowraven-android.p12 ~/.tauri/snowraven-android-keystore.properties
   ```

9. Check it took (both lines must start with `-rw-------`):

   ```sh
   ls -l ~/.tauri/snowraven-android.p12 ~/.tauri/snowraven-android-keystore.properties
   ```

## Check the key opens

10. Run this and enter the password; it should list one entry, `snowraven, ... PrivateKeyEntry`, and a `SHA256:` fingerprint:

   ```sh
   keytool -list -v -storetype PKCS12 -keystore ~/.tauri/snowraven-android.p12 -alias snowraven | grep -E 'Alias name|Entry type|SHA256'
   ```

11. Tell us "keystore in place". You do not need to send the fingerprint; the signing script reads it from the key itself and prints it for the ship record.

## Back it up (yours, and load-bearing)

12. Copy `~/.tauri/snowraven-android.p12` to a backup of your own that is not this Mac and not the repository (for example an encrypted USB drive, or an attachment on the password manager entry from step 1).
13. Make sure the password is in the same password manager entry.

If the key or its password is ever lost, no later GitHub APK can be installed over an earlier one, for everyone who installed it: they would have to uninstall, which deletes the files and keys stored in the app. F-Droid's own build is unaffected, because F-Droid signs with its own key.

## Where things live

| What | Path | Read by |
|---|---|---|
| The key store (PKCS12) | `~/.tauri/snowraven-android.p12` | `SNOWRAVEN_ANDROID_KEYSTORE` (default: the properties file's `storeFile`) |
| Its properties (mode 0600) | `~/.tauri/snowraven-android-keystore.properties` | `SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES` (default: this path) |

Both sit beside the Apple and updater signing files in `~/.tauri/`, outside the repository; `scripts/android/preflight.sh`, `sign.sh` and `attach.sh` refuse a key or properties file inside the repository, a properties file not at mode 0600, and (from the first release on) a signer whose certificate differs from this key's own.
