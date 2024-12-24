class DomainService {
  async saveDomain(domain) {
    try {
      domain.markModified("integrations.hubspot.accounts");
      await domain.save();
      return true;
    } catch (error) {
      console.error("Failed to save domain:", error);
      throw error;
    }
  }
}

module.exports = new DomainService();
