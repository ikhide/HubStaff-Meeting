const { retryOperation } = require("../utils");

class AuthService {
  constructor(hubspotClient) {
    this.client = hubspotClient;
    this.expirationDate = null;
  }

  async refreshToken(domain, hubId) {
    const { HUBSPOT_CID, HUBSPOT_CS } = process.env;
    const account = this.getAccount(domain, hubId);

    try {
      const result = await retryOperation(() =>
        this.client.oauth.tokensApi.createToken(
          "refresh_token",
          undefined,
          undefined,
          HUBSPOT_CID,
          HUBSPOT_CS,
          account.refreshToken
        )
      );

      const { accessToken, expiresIn } = result.body || result;
      this.expirationDate = new Date(expiresIn * 1000 + Date.now());

      if (accessToken !== account.accessToken) {
        account.accessToken = accessToken;
        await domain.save();
      }

      return accessToken;
    } catch (error) {
      console.error(`Token refresh failed for hubId: ${hubId}`, error);
      throw error;
    }
  }

  getAccount(domain, hubId) {
    const account = domain.integrations.hubspot.accounts.find(
      (account) => account.hubId === hubId
    );
    if (!account) {
      throw new Error(`No account found for hubId: ${hubId}`);
    }
    return account;
  }

  isTokenExpired() {
    return !this.expirationDate || Date.now() > this.expirationDate;
  }
}

module.exports = AuthService;
