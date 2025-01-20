// // src/handlers/tools/greptile.ts

// import { eventSystem } from "@/classes/events/manager";
// import { EventBusAdapter } from "@/types/events";
// import {
//     GreptileError,
//     GreptileResponse,
//     GreptileSearchRequest,
// } from "../../../types/tools/greptile";
// import { GreptileIntegration } from "../../../integrations/greptile/index";

// export async function startGreptileHandler(integration: GreptileIntegration) {
//     await setupSearchHandler(eventSystem.getEventBus(), integration);
// }
// async function setupSearchHandler(
//     bus: EventBusAdapter,
//     integration: GreptileIntegration,
// ) {
//     await bus.subscribe("greptile:search", async (event) => {
//         const request = event.data as GreptileSearchRequest;
//         await handleSearchRequest(bus, integration, request);
//     });
// }


// async function handleSearchRequest(
//     bus: EventBusAdapter,
//     integration: GreptileIntegration,
//     request: GreptileSearchRequest,
// ): Promise<void> {
//     try {
//         const startTime = Date.now();
//         const config = integration.getConfig();

//         // Make request to Greptile API
//         const response = await fetchWithAuth(
//             `${config.baseUrl || "https://api.greptile.com"}/search`,
//             {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                     "Authorization": `Bearer ${config.apiKey}`,
//                 },
//                 body: JSON.stringify({
//                     query: request.query,
//                     maxResults: request.options?.maxResults ||
//                         config.maxResults,
//                     options: {
//                         caseSensitive: request.options?.caseSensitive,
//                         useRegex: request.options?.useRegex,
//                         includeTests: request.options?.includeTests,
//                     },
//                 }),
//             },
//             {} as any
//         );

//         if (!response.ok) {
//             throw new Error(`Greptile API error: ${response.statusText}`);
//         }

//         const results = await response.json();

//         // Publish successful response
//         await bus.publish<GreptileResponse>(
//             "greptile:results",
//             {
//                 requestId: request.id,
//                 results: results,
//                 metadata: {
//                     totalResults: results.length,
//                     executionTime: Date.now() - startTime,
//                     query: request.query,
//                 },
//             },
//             "greptile-handler",
//         );
//     } catch (error) {
//         // Publish error response
//         await bus.publish<GreptileError>(
//             "greptile:error",
//             {
//                 requestId: request.id,
//                 error: {
//                     code: "SEARCH_FAILED",
//                     message: error instanceof Error
//                         ? error.message
//                         : "Search failed",
//                     details: error,
//                 },
//             },
//             "greptile-handler",
//         );
//     }
// }
