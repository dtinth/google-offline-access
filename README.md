# google-offline-access

An opinionated way to handle offline access for Google APIs in Node.js.

## Conventions

This library assumes the following:

- You have a JSON file that contains the `client_id`, `client_secret`, and `redirect_uris` for your application in `.data/google_client_secret.json`. You can get this file from the Google Cloud console.

- The access token will be cached to `.data/google_auth.json`.

- On a CI, you will have a `GOOGLE_REFRESH_TOKEN` environment variable set, so that access tokens can be requested without the `.data/google_auth.json` file.

## Obtain a refresh token

You can do this in a Node.js REPL:

```js
// Import the library
const { GoogleOfflineAccess } = require('google-offline-access')

// Create a GoogleOfflineAccess instance with the required scopes.
const googleOfflineAccess = new GoogleOfflineAccess({
  scopes: [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ],
})

// Get a URL to visit to obtain an authorization code.
console.log(await googleOfflineAccess.getAuthUrl())

// Once you have an authorization code, you can get a refresh token.
// This will create a .data/google_auth.json file with the refresh token.
await googleOfflineAccess.login('AUTHORIZATION_CODE')

// --- The below can now be run in a separate process ---

// Now you can obtain an authenticated AuthClient instance.
const authClient = await googleOfflineAccess.getAuthenticatedAuthClient()

// Configure googleapis to use this AuthClient instance.
const { google } = require('googleapis')
google.options({ auth: authClient })

// Try calling an API.
const youtube = google.youtube('v3')
await youtube.channels.list({ part: 'snippet', mine: true })
```
