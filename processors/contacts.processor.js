const domainService = require("../services/domain.service");
const { retryOperation } = require("../utils");
const { generateLastModifiedDateFilter } = require("../utils");

class ContactProcessor {
  constructor(hubspotClient, queueService) {
    this.client = hubspotClient;
    this.queue = queueService;
  }

  async processContacts(domain, hubId) {
    console.log("fetch contacts batch");
    const account = domain.integrations.hubspot.accounts.find(
      (account) => account.hubId === hubId
    );
    const lastPulledDate = new Date("2020-03-03");
    const now = new Date();

    let hasMore = true;
    const offsetObject = {};
    const limit = 100;

    while (hasMore) {
      const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
      const searchObject = {
        filterGroups: [
          generateLastModifiedDateFilter(
            lastModifiedDate,
            now,
            "lastmodifieddate"
          ),
        ],
        sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
        properties: [
          "firstname",
          "lastname",
          "jobtitle",
          "email",
          "hubspotscore",
          "hs_lead_status",
          "hs_analytics_source",
          "hs_latest_source",
        ],
        limit,
        after: offsetObject.after,
      };

      const searchResult = await retryOperation(() =>
        this.client.crm.contacts.searchApi.doSearch(searchObject)
      );

      const data = searchResult.results || [];
      const contactIds = data.map((contact) => contact.id);

      const companyAssociations = await this.getCompanyAssociations(contactIds);

      for (const contact of data) {
        if (!contact.properties?.email) continue;
        await this.processContactAction(
          contact,
          companyAssociations,
          lastPulledDate
        );
      }

      offsetObject.after = parseInt(searchResult.paging?.next?.after);

      if (!offsetObject?.after) {
        hasMore = false;
      } else if (offsetObject?.after >= 9900) {
        offsetObject.after = 0;
        offsetObject.lastModifiedDate = new Date(
          data[data.length - 1].updatedAt
        ).valueOf();
      }
    }

    account.lastPulledDates.contacts = now;
    await domainService.saveDomain(domain);
    console.log("process contacts complete");
    return true;
  }

  async getCompanyAssociations(contactIds) {
    const associationsResults = await this.client.apiRequest({
      method: "post",
      path: "/crm/v3/associations/CONTACTS/COMPANIES/batch/read",
      body: {
        inputs: contactIds.map((contactId) => ({ id: contactId })),
      },
    });

    const results = (await associationsResults.json())?.results || [];
    return Object.fromEntries(
      results.map((a) => a.from && [a.from.id, a.to[0].id]).filter(Boolean)
    );
  }

  async processContactAction(contact, companyAssociations, lastPulledDate) {
    const isCreated = new Date(contact.createdAt) > lastPulledDate;
    const userProperties = {
      company_id: companyAssociations[contact.id],
      contact_name: `${contact.properties.firstname || ""} ${
        contact.properties.lastname || ""
      }`.trim(),
      contact_title: contact.properties.jobtitle,
      contact_source: contact.properties.hs_analytics_source,
      contact_status: contact.properties.hs_lead_status,
      contact_score: parseInt(contact.properties.hubspotscore) || 0,
    };

    this.queue.push({
      actionName: isCreated ? "Contact Created" : "Contact Updated",
      actionDate: new Date(isCreated ? contact.createdAt : contact.updatedAt),
      includeInAnalytics: 0,
      identity: contact.properties.email,
      userProperties: Object.fromEntries(
        Object.entries(userProperties).filter(([_, v]) => v != null)
      ),
    });
  }
}

module.exports = ContactProcessor;
