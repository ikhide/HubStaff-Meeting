# Debrief

## Walkthrough Video <https://vimeo.com/1041865662/d797e188f4?share=copy>

## Project Structure

```
├── config/
│ └── hubspot.config.js
│
├── processors/
│ ├── companies.processor.js
│ ├── contacts.processor.js
│ └── meetings.processor.js
├── services/
│ ├── auth.service.js
│ ├── domain.service.js
│ └── queue.service.js
├── utils

```

## Optimizations made

### Code Structure

- ✅ Modular processor architecture: Each processor is responsible for fetching and processing data for a specific entity.
- ✅ Service-based design pattern: Services are used to handle authentication, domain-specific logic, and queue management.
- ✅ Centralized configuration: Configuration (hubspot.config.js) is stored in a single file for easy access and modification.
- ✅ Utility functions: Shared utility functions have been moved to the utils file.

### Performance

- ✅ Contact email caching for faster lookups: Contact emails are cached to avoid redundant API calls.
- ✅ Batch fetch of data: Data is fetched in batches to reduce the number of API calls.
- ✅ Pagination handling: Pagination is handled efficiently.

## Improvements that can still be made

### On Code Quality and Readability

- TypeScript for type safety
- Winston for logging
- Write unit tests for coverage

### On Architecture

- Implement proper dependency injection
- Create monitoring and metrics service

### On Performance

- Similar to the meeting processor, the company and contact processors can be optimized to fetch data in batches.
- Worker threads can be implemented for parallel processing
- The database is updated for every processor (3 times). This can be optimized by updating the database once after all the processors have completed.
