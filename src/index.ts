import { OAuth2Client, Credentials } from 'google-auth-library'
import fs from 'fs'
import path from 'path'

/**
 * Options to pass to `GoogleOfflineAccess`.
 *
 * @public
 */
export interface GoogleOfflineAccessOptions {
  /**
   * The scopes to request.
   */
  scopes: string[]

  /**
   * The path to the client secret file.
   *
   * Defaults to `.data/google_client_secret.json` or the value of the
   * `GOOGLE_CLIENT_SECRET_FILE` environment variable.
   */
  clientSecretFile?: string

  /**
   * The path to the auth state file.
   * This file contains a cached access token and a refresh token.
   *
   * Defaults to `.data/google_auth.json` or the value of the
   * `GOOGLE_ACCESS_TOKEN_FILE` environment variable.
   *
   * Set to `false` to disable caching.
   */
  authStateFile?: string | false

  /**
   * The default refresh token to use.
   *
   * Defaults to the value of the `GOOGLE_REFRESH_TOKEN` environment variable.
   */
  defaultRefreshToken?: string
  /**
   * A function to log messages.
   *
   * Defaults to `console.log`.
   */
  log?: (message: string) => void
}

/**
 * A helper to get offline access to Google APIs.
 *
 * @public
 */
export class GoogleOfflineAccess {
  /**
   * The scopes to request.
   */

  public scopes: string[]
  /**
   * The path to the client secret file.
   */
  public clientSecretFile: string

  /**
   * The path to the auth state file.
   */
  public authStateFile?: string | false

  /**
   * The default refresh token to use.
   */
  public defaultRefreshToken?: string

  /**
   * A function to log messages.
   */
  public log: (message: string) => void

  constructor(options: GoogleOfflineAccessOptions) {
    this.scopes = options.scopes
    this.clientSecretFile =
      options.clientSecretFile ??
      process.env.GOOGLE_CLIENT_SECRET_FILE ??
      '.data/google_client_secret.json'
    this.authStateFile =
      options.authStateFile ??
      process.env.GOOGLE_AUTH_STATE_FILE ??
      '.data/google_auth.json'
    this.defaultRefreshToken =
      options.defaultRefreshToken ?? process.env.GOOGLE_REFRESH_TOKEN
    this.log =
      options.log ?? ((text) => console.log('[GoogleOfflineAccess]', text))
  }

  /**
   * Returns an authenticated OAuth2 client.
   *
   * If the auth state file exists, the access token is read from it.
   * If that access token is expired, a new one is requested using the
   * refresh token. The new access token is then written to the auth
   * state file.
   *
   * If the access token file does not exist, a new access token is
   * requested using the refresh token.
   *
   * If no refresh token is provided, an error is thrown.
   */
  async getAuthenticatedAuthClient() {
    const authClient = this.createAuthClient()
    const credentials: Credentials = {}
    if (this.defaultRefreshToken) {
      credentials.refresh_token = this.defaultRefreshToken
    }
    if (this.authStateFile && fs.existsSync(this.authStateFile)) {
      const token = JSON.parse(fs.readFileSync(this.authStateFile, 'utf8'))
      credentials.access_token = token.access_token
      credentials.expiry_date = token.expiry_date
      credentials.refresh_token = token.refresh_token
    }
    if (
      !credentials.expiry_date ||
      Date.now() + 300e3 > credentials.expiry_date
    ) {
      this.log(
        credentials.expiry_date
          ? 'Token expired, renewing...'
          : 'No token found, getting new one...',
      )
      if (!credentials.refresh_token) {
        throw new Error(
          'No refresh token found. Please provide one via the GOOGLE_REFRESH_TOKEN environment variable.',
        )
      }
      authClient.setCredentials({ ...credentials })
      const response = await authClient.refreshAccessToken()
      const newCredentials: Credentials = {
        ...credentials,
        access_token: response.credentials.access_token,
        expiry_date: response.credentials.expiry_date,
      }
      if (this.authStateFile) {
        fs.writeFileSync(
          this.authStateFile,
          JSON.stringify(newCredentials, null, 2),
        )
      }
      authClient.setCredentials(newCredentials)
    } else {
      this.log(
        'Token is still valid for ' +
          Math.floor((credentials.expiry_date - Date.now()) / 60e3) +
          ' minutes',
      )
      authClient.setCredentials({ ...credentials })
    }
    return authClient
  }

  private createAuthClient() {
    const client = JSON.parse(fs.readFileSync(this.clientSecretFile, 'utf8'))
    const authClient = new OAuth2Client(
      client.web.client_id,
      client.web.client_secret,
      client.web.redirect_uris[0],
    )
    return authClient
  }

  /**
   * Returns the URL to the Google OAuth2 consent screen.
   */
  async getAuthUrl() {
    const authUrl = this.createAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
    })
    return authUrl
  }

  /**
   * Exchange the authorization code for an access token and also
   * save both the access token and the refresh token to the auth
   * state file.
   */
  async login(code: string) {
    const authClient = this.createAuthClient()
    const response = await authClient.getToken(code)
    const credentials = response.tokens
    if (this.authStateFile) {
      fs.mkdirSync(path.dirname(this.authStateFile), { recursive: true })
      fs.writeFileSync(this.authStateFile, JSON.stringify(credentials, null, 2))
    }
  }
}
