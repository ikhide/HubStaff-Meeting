const hubspot = require("@hubspot/api-client");
const QueueService = require("./services/queue.service");
const Domain = require("./Domain");
const AuthService = require("./services/auth.service");
const MeetingProcessor = require("./processors/meetings.processor");
const ContactProcessor = require("./processors/contacts.processor");
const CompanyProcessor = require("./processors/companies.processor");

async function worker() {
  try {
    const domain = await Domain.findOne({});
    if (!domain?.integrations?.hubspot?.accounts?.length) {
      throw new Error("No HubSpot accounts configured");
    }

    const hubspotClient = new hubspot.Client({ accessToken: "" });
    const authService = new AuthService(hubspotClient);
    const queueService = new QueueService(domain);

    for (const account of domain.integrations.hubspot.accounts) {
      const actions = [];
      const q = queueService.createQueue(domain, actions);

      try {
        const accessToken = await authService.refreshToken(
          domain,
          account.hubId
        );
        hubspotClient.setAccessToken(accessToken);

        const contactProcessor = new ContactProcessor(hubspotClient, q);
        const companyProcessor = new CompanyProcessor(hubspotClient, q);
        const meetingProcessor = new MeetingProcessor(hubspotClient, q);

        await contactProcessor.processContacts(domain, account.hubId);
        await companyProcessor.processCompanies(domain, account.hubId);
        await meetingProcessor.processMeetings(domain, account.hubId);
      } catch (error) {
        console.error(`Processing failed for account ${account.hubId}:`, error);
      }
    }

    await queueService.drain();
  } catch (error) {
    console.error("Worker execution failed:", error);
    throw error;
  }
}
module.exports = worker;
