/**
 * Transport search and booking tool definitions and executors
 * Handles airport transfers, car rentals, and local transport
 */

const TRANSPORT_API_BASE = process.env.TRANSPORT_API_BASE || process.env.MAIN_ENDPOINT;

/**
 * Tool definitions for OpenAI function calling
 */
const transportToolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'searchTransfers',
            description: 'Search for airport transfers, private cars, or shuttle services between two locations. Use this when the user needs transportation to/from airport or between locations.',
            parameters: {
                type: 'object',
                properties: {
                    pickupLocation: {
                        type: 'string',
                        description: 'Pickup location (e.g., DXB Airport, Hotel Hilton Dubai, Dubai Marina)'
                    },
                    dropoffLocation: {
                        type: 'string',
                        description: 'Dropoff location (e.g., Hotel address, Airport code, area name)'
                    },
                    pickupDate: {
                        type: 'string',
                        description: 'Pickup date in YYYY-MM-DD format'
                    },
                    pickupTime: {
                        type: 'string',
                        description: 'Pickup time in HH:MM format (24-hour)'
                    },
                    passengers: {
                        type: 'integer',
                        description: 'Number of passengers (default 1)',
                        default: 1
                    },
                    vehicleType: {
                        type: 'string',
                        enum: ['sedan', 'suv', 'van', 'luxury', 'bus'],
                        description: 'Preferred vehicle type'
                    },
                    transferType: {
                        type: 'string',
                        enum: ['airport_pickup', 'airport_dropoff', 'point_to_point', 'hourly'],
                        description: 'Type of transfer service'
                    }
                },
                required: ['pickupLocation', 'dropoffLocation', 'pickupDate', 'pickupTime']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'searchCarRentals',
            description: 'Search for car rental options. Use this when the user wants to rent a car for self-driving.',
            parameters: {
                type: 'object',
                properties: {
                    pickupLocation: {
                        type: 'string',
                        description: 'Car pickup location (city, airport code, or address)'
                    },
                    dropoffLocation: {
                        type: 'string',
                        description: 'Car return location (same as pickup if not specified)'
                    },
                    pickupDate: {
                        type: 'string',
                        description: 'Pickup date in YYYY-MM-DD format'
                    },
                    pickupTime: {
                        type: 'string',
                        description: 'Pickup time in HH:MM format'
                    },
                    dropoffDate: {
                        type: 'string',
                        description: 'Return date in YYYY-MM-DD format'
                    },
                    dropoffTime: {
                        type: 'string',
                        description: 'Return time in HH:MM format'
                    },
                    carType: {
                        type: 'string',
                        enum: ['economy', 'compact', 'midsize', 'fullsize', 'suv', 'luxury', 'van'],
                        description: 'Preferred car category'
                    }
                },
                required: ['pickupLocation', 'pickupDate', 'pickupTime', 'dropoffDate', 'dropoffTime']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'bookTransport',
            description: 'Book a transport service (transfer or car rental). Use this when the user confirms they want to book a specific transport option.',
            parameters: {
                type: 'object',
                properties: {
                    transportId: {
                        type: 'string',
                        description: 'The transport option ID from search results'
                    },
                    serviceType: {
                        type: 'string',
                        enum: ['transfer', 'car_rental'],
                        description: 'Type of transport service being booked'
                    },
                    passengerName: {
                        type: 'string',
                        description: 'Lead passenger/driver full name'
                    },
                    contactEmail: {
                        type: 'string',
                        description: 'Contact email for booking confirmation'
                    },
                    contactPhone: {
                        type: 'string',
                        description: 'Contact phone number'
                    },
                    flightNumber: {
                        type: 'string',
                        description: 'Flight number (for airport transfers, so driver can track arrival)'
                    },
                    specialRequests: {
                        type: 'string',
                        description: 'Special requests (e.g., child seat, extra luggage space)'
                    }
                },
                required: ['transportId', 'serviceType', 'passengerName', 'contactEmail']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getTransportBookingStatus',
            description: 'Check the status of a transport booking. Use this when the user wants to check their transfer or car rental reservation.',
            parameters: {
                type: 'object',
                properties: {
                    bookingReferenceId: {
                        type: 'string',
                        description: 'The transport booking reference ID'
                    }
                },
                required: ['bookingReferenceId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'cancelTransportBooking',
            description: 'Cancel an existing transport booking. Use this only when the user explicitly asks to cancel their transport reservation.',
            parameters: {
                type: 'object',
                properties: {
                    bookingReferenceId: {
                        type: 'string',
                        description: 'The transport booking reference ID to cancel'
                    },
                    reason: {
                        type: 'string',
                        description: 'Reason for cancellation'
                    }
                },
                required: ['bookingReferenceId']
            }
        }
    }
];

/**
 * Execute transport tools
 */
async function executeTransportTool(functionName, args) {
    switch (functionName) {
        case 'searchTransfers':
            return await searchTransfers(args);
        case 'searchCarRentals':
            return await searchCarRentals(args);
        case 'bookTransport':
            return await bookTransport(args);
        case 'getTransportBookingStatus':
            return await getTransportBookingStatus(args);
        case 'cancelTransportBooking':
            return await cancelTransportBooking(args);
        default:
            throw new Error(`Unknown transport tool: ${functionName}`);
    }
}

async function searchTransfers(params) {
    try {
        const response = await fetch(`${TRANSPORT_API_BASE}/transferSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                pickupLocation: params.pickupLocation,
                dropoffLocation: params.dropoffLocation,
                pickupDate: params.pickupDate,
                pickupTime: params.pickupTime,
                passengers: params.passengers || 1,
                vehicleType: params.vehicleType || null,
                transferType: params.transferType || 'point_to_point'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to search transfers', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Transfer search failed:", error);
        return { error: `Transfer search failed: ${error.message}` };
    }
}

async function searchCarRentals(params) {
    try {
        const response = await fetch(`${TRANSPORT_API_BASE}/carRentalSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                pickupLocation: params.pickupLocation,
                dropoffLocation: params.dropoffLocation || params.pickupLocation,
                pickupDate: params.pickupDate,
                pickupTime: params.pickupTime,
                dropoffDate: params.dropoffDate,
                dropoffTime: params.dropoffTime,
                carType: params.carType || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to search car rentals', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Car rental search failed:", error);
        return { error: `Car rental search failed: ${error.message}` };
    }
}

async function bookTransport(params) {
    try {
        const response = await fetch(`${TRANSPORT_API_BASE}/transportBooking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                transportId: params.transportId,
                serviceType: params.serviceType,
                passengerName: params.passengerName,
                contactEmail: params.contactEmail,
                contactPhone: params.contactPhone || '',
                flightNumber: params.flightNumber || '',
                specialRequests: params.specialRequests || ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to book transport', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Transport booking failed:", error);
        return { error: `Transport booking failed: ${error.message}` };
    }
}

async function getTransportBookingStatus(params) {
    try {
        const response = await fetch(`${TRANSPORT_API_BASE}/transportBookingStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                bookingReferenceId: params.bookingReferenceId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to get transport booking status', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Transport booking status failed:", error);
        return { error: `Transport booking status failed: ${error.message}` };
    }
}

async function cancelTransportBooking(params) {
    try {
        const response = await fetch(`${TRANSPORT_API_BASE}/transportBookingCancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                bookingReferenceId: params.bookingReferenceId,
                reason: params.reason || ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to cancel transport booking', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Transport cancellation failed:", error);
        return { error: `Transport cancellation failed: ${error.message}` };
    }
}

export {
    transportToolDefinitions,
    executeTransportTool
};
