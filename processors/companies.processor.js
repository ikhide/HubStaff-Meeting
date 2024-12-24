const domainService = require("../services/domain.service");
const { generateLastModifiedDateFilter } = require("../utils");

class CompanyProcessor {
  constructor(hubspotClient, queueService) {
    this.client = hubspotClient;
    this.queue = queueService;
  }

  async processCompanies(domain, hubId) {
    console.log("fetch company batch");
    const account = domain.integrations.hubspot.accounts.find(
      (account) => account.hubId === hubId
    );
    const lastPulledDate = new Date(account.lastPulledDates.companies);
    const now = new Date();

    let hasMore = true;
    const offsetObject = {};
    const limit = 100;

    while (hasMore) {
      const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
      const lastModifiedDateFilter = generateLastModifiedDateFilter(
        lastModifiedDate,
        now
      );

      const searchObject = {
        filterGroups: [lastModifiedDateFilter],
        sorts: [
          { propertyName: "hs_lastmodifieddate", direction: "ASCENDING" },
        ],
        properties: [
          "name",
          "domain",
          "country",
          "industry",
          "description",
          "annualrevenue",
          "numberofemployees",
          "hs_lead_status",
        ],
        limit,
        after: offsetObject.after,
      };

      const searchResult = await this.fetchCompanies(searchObject);
      const data = searchResult?.results || [];
      offsetObject.after = parseInt(searchResult?.paging?.next?.after);

      for (const company of data) {
        if (!company.properties) continue;
        await this.processCompanyAction(company, lastPulledDate);
      }

      if (!offsetObject?.after) {
        hasMore = false;
      } else if (offsetObject?.after >= 9900) {
        offsetObject.after = 0;
        offsetObject.lastModifiedDate = new Date(
          data[data.length - 1].updatedAt
        ).valueOf();
      }
    }

    account.lastPulledDates.companies = now;
    await domainService.saveDomain(domain);

    console.log("process companies complete");

    return true;
  }

  async fetchCompanies(searchObject) {
    let tryCount = 0;
    while (tryCount <= 4) {
      try {
        return await this.client.crm.companies.searchApi.doSearch(searchObject);
      } catch (err) {
        tryCount++;
        await new Promise((resolve) =>
          setTimeout(resolve, 5000 * Math.pow(2, tryCount))
        );
      }
    }
    throw new Error("Failed to fetch companies after 4 retries");
  }

  async processCompanyAction(company, lastPulledDate) {
    const actionTemplate = {
      includeInAnalytics: 0,
      companyProperties: {
        company_id: company.id,
        company_domain: company.properties.domain,
        company_industry: company.properties.industry,
      },
    };

    const isCreated =
      !lastPulledDate || new Date(company.createdAt) > lastPulledDate;

    this.queue.push({
      actionName: isCreated ? "Company Created" : "Company Updated",
      actionDate:
        new Date(isCreated ? company.createdAt : company.updatedAt) - 2000,
      ...actionTemplate,
    });
  }
}

module.exports = CompanyProcessor;
