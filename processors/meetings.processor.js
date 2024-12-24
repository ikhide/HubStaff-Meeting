const { retryOperation } = require("../utils");
const { chunk } = require("lodash");
const config = require("../config/hubspot.config");
const { generateLastModifiedDateFilter } = require("../utils");
const domainService = require("../services/domain.service");

class MeetingProcessor {
  constructor(hubspotClient, queue) {
    this.client = hubspotClient;
    this.queue = queue;
    this.emailCache = new Map();
    this.batchSize = config.batchSize || 100;
  }

  async processMeetings(domain, hubId) {
    try {
      console.log("Starting meeting processing...");

      const account = domain.integrations.hubspot.accounts.find(
        (a) => a.hubId === hubId
      );
      const lastPulledDate = new Date("2020-01-01");
      const now = new Date();

      let processed = 0;
      let hasMore = true;
      let after = undefined;

      while (hasMore) {
        const searchObject = {
          filterGroups: [generateLastModifiedDateFilter(lastPulledDate, now)],
          sorts: [
            { propertyName: "hs_lastmodifieddate", direction: "ASCENDING" },
          ],
          properties: [
            "hs_meeting_title",
            "hs_meeting_start_time",
            "hs_meeting_end_time",
            "hs_meeting_outcome",
            "hubspot_owner_id",
            "hs_lastmodifieddate",
            "createdate",
          ],
          limit: this.batchSize,
          after,
        };

        const searchResult = await retryOperation(() =>
          this.client.crm.objects.meetings.searchApi.doSearch(searchObject)
        );

        if (!searchResult?.results?.length) break;

        const chunks = chunk(searchResult.results, 20);
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(async (meeting) => {
              const attendees = await this.getMeetingAttendees(meeting.id);
              if (attendees.length) {
                await this.processMeetingAction(meeting, attendees);
                processed++;
              }
            })
          );
        }

        after = searchResult?.paging?.next?.after;
        hasMore = !!after;
      }

      account.lastPulledDates.meetings = now;
      await domainService.saveDomain(domain);

      return processed;
    } catch (error) {
      console.error("Error processing meetings:", error);
      throw error;
    }
  }

  async getMeetingAttendees(meetingId) {
    if (!meetingId) return [];

    try {
      const meetingResponse = await retryOperation(() =>
        this.client.apiRequest({
          method: "GET",
          path: `/engagements/v1/engagements/${meetingId}`,
        })
      );

      const meetingData = await meetingResponse.json();
      const contactIds = meetingData?.associations?.contactIds || [];

      if (!contactIds.length) return [];

      const uncachedIds = contactIds.filter((id) => !this.emailCache.has(id));
      if (uncachedIds.length) {
        const batches = chunk(uncachedIds, 100);

        for (const batch of batches) {
          const batchResponse = await retryOperation(() =>
            this.client.crm.contacts.batchApi.read({
              properties: ["email"],
              inputs: batch.map((id) => ({ id: id.toString() })),
            })
          );

          batchResponse?.results?.forEach((contact) => {
            if (contact?.properties?.email) {
              this.emailCache.set(contact.id, contact.properties.email);
            }
          });
        }
      }

      return contactIds
        .map((id) => this.emailCache.get(id.toString()))
        .filter(Boolean);
    } catch (error) {
      console.error(`Error getting attendees for meeting ${meetingId}:`, error);
      return [];
    }
  }

  async processMeetingAction(meeting, attendees) {
    const isNew =
      meeting.properties.createdate === meeting.properties.hs_lastmodifieddate;

    for (const attendeeEmail of attendees) {
      this.queue.push({
        actionName: isNew ? "Meeting Created" : "Meeting Updated",
        actionDate: new Date(meeting.properties.hs_lastmodifieddate),
        includeInAnalytics: 0,
        identity: attendeeEmail,
        properties: {
          meetingId: meeting.id,
          title: meeting.properties.hs_meeting_title || "",
          startTime: meeting.properties.hs_meeting_start_time,
          endTime: meeting.properties.hs_meeting_end_time,
          outcome: meeting.properties.hs_meeting_outcome,
          ownerId: meeting.properties.hubspot_owner_id,
        },
      });
    }
  }
}

module.exports = MeetingProcessor;
