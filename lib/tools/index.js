import { flightToolDefinitions, executeFlightTool } from './flightTools.js';
import { hotelToolDefinitions, executeHotelTool } from './hotelTools.js';
import { transportToolDefinitions, executeTransportTool } from './transportTools.js';
import { supportToolDefinitions, executeSupportTool } from './supportTools.js';

/**
 * All tool definitions combined for OpenAI function calling
 */
const allToolDefinitions = [
    ...flightToolDefinitions,
    ...hotelToolDefinitions,
    ...transportToolDefinitions,
    ...supportToolDefinitions
];

/**
 * Map of tool names to their respective executors
 */
const toolExecutorMap = {
    // Flight tools
    searchFlights: executeFlightTool,
    getFlightFareRules: executeFlightTool,
    bookFlight: executeFlightTool,
    getFlightBookingStatus: executeFlightTool,

    // Hotel tools
    searchHotels: executeHotelTool,
    getHotelDetails: executeHotelTool,
    bookHotel: executeHotelTool,
    getHotelBookingStatus: executeHotelTool,
    cancelHotelBooking: executeHotelTool,

    // Transport tools
    searchTransfers: executeTransportTool,
    searchCarRentals: executeTransportTool,
    bookTransport: executeTransportTool,
    getTransportBookingStatus: executeTransportTool,
    cancelTransportBooking: executeTransportTool,

    // Support tools
    createSupportTicket: executeSupportTool,
    getTicketStatus: executeSupportTool
};

/**
 * Universal tool executor — routes any tool call to the correct handler
 */
async function executeTool(functionName, args) {
    const executor = toolExecutorMap[functionName];

    if (!executor) {
        throw new Error(`Unknown tool: ${functionName}`);
    }

    return await executor(functionName, args);
}

export {
    allToolDefinitions,
    executeTool
};
