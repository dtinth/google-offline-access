import { OAuth2Client, Credentials } from 'google-auth-library'
import fs from 'fs'

export interface GoogleOfflineAccessOptions {
  scopes: string[]
  clientSecretFile?: string
  accessTokenFile?: string
  defaultRefreshToken?: string
  log?: (message: string) => void
}

export class GoogleOfflineAccess {
  public scopes: string[]
  public clientSecretFile: string
  public authStateFile: string
  public defaultRefreshToken?: string
  public log: (message: string) => void

  constructor(options: GoogleOfflineAccessOptions) {
    this.scopes = options.scopes
    this.clientSecretFile =
      options.clientSecretFile ||
      process.env.GOOGLE_CLIENT_SECRET_FILE ||
      '.data/google_client_secret.json'
    this.authStateFile =
      options.accessTokenFile ||
      process.env.GOOGLE_ACCESS_TOKEN_FILE ||
      '.data/google_access_token.json'
    this.defaultRefreshToken =
      options.defaultRefreshToken || process.env.GOOGLE_REFRESH_TOKEN
    this.log =
      options.log || ((text) => console.log('[GoogleOfflineAccess]', text))
  }

  async getAuthenticatedAuthClient() {
    const authClient = this.createAuthClient()
    const credentials: Credentials = {}
    if (this.defaultRefreshToken) {
      credentials.refresh_token = this.defaultRefreshToken
    }
    if (fs.existsSync(this.authStateFile)) {
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
      fs.writeFileSync(
        this.authStateFile,
        JSON.stringify(newCredentials, null, 2),
      )
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

  async getAuthUrl() {
    const authUrl = this.createAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
    })
    return authUrl
  }
}
