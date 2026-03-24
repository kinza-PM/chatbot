/**
 * Flight search and booking tool definitions and executors
 * Calls the existing flight-search microservice APIs
 */

const FLIGHT_API_BASE = process.env.FLIGHT_API_BASE || process.env.MAIN_ENDPOINT;

/**
 * Tool definitions for OpenAI function calling
 */
const flightToolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'searchFlights',
            description: 'Search for available flights between two cities/airports. Use this when the user wants to find flights, check availability, or compare flight options.',
            parameters: {
                type: 'object',
                properties: {
                    origin: {
                        type: 'string',
                        description: 'Departure airport IATA code (e.g., DXB for Dubai, LHR for London Heathrow)'
                    },
                    destination: {
                        type: 'string',
                        description: 'Arrival airport IATA code (e.g., LHR for London Heathrow, JFK for New York)'
                    },
                    departureDate: {
                        type: 'string',
                        description: 'Departure date in YYYY-MM-DD format'
                    },
                    returnDate: {
                        type: 'string',
                        description: 'Return date in YYYY-MM-DD format (optional, for round trips)'
                    },
                    adults: {
                        type: 'integer',
                        description: 'Number of adult passengers (default 1)',
                        default: 1
                    },
                    children: {
                        type: 'integer',
                        description: 'Number of child passengers (default 0)',
                        default: 0
                    },
                    infants: {
                        type: 'integer',
                        description: 'Number of infant passengers (default 0)',
                        default: 0
                    },
                    cabinClass: {
                        type: 'string',
                        enum: ['economy', 'premium_economy', 'business', 'first'],
                        description: 'Preferred cabin class (default economy)',
                        default: 'economy'
                    },
                    tripType: {
                        type: 'string',
                        enum: ['one_way', 'round_trip'],
                        description: 'Trip type (default one_way)',
                        default: 'one_way'
                    }
                },
                required: ['origin', 'destination', 'departureDate']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getFlightFareRules',
            description: 'Get fare rules, cancellation policy, baggage allowance, and other details for a specific flight offer. Use this when the user asks about cancellation, refund, baggage, or fare conditions.',
            parameters: {
                type: 'object',
                properties: {
                    offerId: {
                        type: 'string',
                        description: 'The offer ID from flight search results'
                    }
                },
                required: ['offerId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'bookFlight',
            description: 'Create a provisional flight booking. Use this when the user confirms they want to book a specific flight and has provided passenger details.',
            parameters: {
                type: 'object',
                properties: {
                    offerId: {
                        type: 'string',
                        description: 'The offer ID from flight search results'
                    },
                    passengers: {
                        type: 'array',
                        description: 'List of passenger details',
                        items: {
                            type: 'object',
                            properties: {
                                title: {
                                    type: 'string',
                                    enum: ['Mr', 'Mrs', 'Ms', 'Miss'],
                                    description: 'Passenger title'
                                },
                                firstName: {
                                    type: 'string',
                                    description: 'Passenger first name'
                                },
                                lastName: {
                                    type: 'string',
                                    description: 'Passenger last name'
                                },
                                dateOfBirth: {
                                    type: 'string',
                                    description: 'Date of birth in YYYY-MM-DD format'
                                },
                                passportNumber: {
                                    type: 'string',
                                    description: 'Passport number'
                                },
                                passportExpiry: {
                                    type: 'string',
                                    description: 'Passport expiry date in YYYY-MM-DD format'
                                },
                                nationality: {
                                    type: 'string',
                                    description: 'Nationality (2-letter country code, e.g., AE, GB)'
                                },
                                type: {
                                    type: 'string',
                                    enum: ['adult', 'child', 'infant'],
                                    description: 'Passenger type'
                                }
                            },
                            required: ['title', 'firstName', 'lastName', 'dateOfBirth', 'type']
                        }
                    },
                    contactEmail: {
                        type: 'string',
                        description: 'Contact email for booking confirmation'
                    },
                    contactPhone: {
                        type: 'string',
                        description: 'Contact phone number'
                    }
                },
                required: ['offerId', 'passengers', 'contactEmail']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getFlightBookingStatus',
            description: 'Retrieve the status of an existing flight booking. Use this when the user wants to check their booking status, confirmation, or details.',
            parameters: {
                type: 'object',
                properties: {
                    bookingReferenceId: {
                        type: 'string',
                        description: 'The booking reference ID'
                    }
                },
                required: ['bookingReferenceId']
            }
        }
    }
];

/**
 * Execute flight tools
 */
async function executeFlightTool(functionName, args) {
    switch (functionName) {
        case 'searchFlights':
            return await searchFlights(args);
        case 'getFlightFareRules':
            return await getFlightFareRules(args);
        case 'bookFlight':
            return await bookFlight(args);
        case 'getFlightBookingStatus':
            return await getFlightBookingStatus(args);
        default:
            throw new Error(`Unknown flight tool: ${functionName}`);
    }
}

async function searchFlights(params) {
    try {
        const response = await fetch(`${FLIGHT_API_BASE}/flightSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                origin: params.origin,
                destination: params.destination,
                departureDate: params.departureDate,
                returnDate: params.returnDate || null,
                adults: params.adults || 1,
                children: params.children || 0,
                infants: params.infants || 0,
                cabinClass: params.cabinClass || 'economy',
                tripType: params.tripType || 'one_way'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to search flights', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Flight search failed:", error);
        return { error: `Flight search failed: ${error.message}` };
    }
}

async function getFlightFareRules(params) {
    try {
        const response = await fetch(`${FLIGHT_API_BASE}/fareRuleSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                offerId: params.offerId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to get fare rules', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Fare rule search failed:", error);
        return { error: `Fare rule search failed: ${error.message}` };
    }
}

async function bookFlight(params) {
    try {
        const response = await fetch(`${FLIGHT_API_BASE}/flightProvBooking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                offerId: params.offerId,
                passengers: params.passengers,
                contactEmail: params.contactEmail,
                contactPhone: params.contactPhone || ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to book flight', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Flight booking failed:", error);
        return { error: `Flight booking failed: ${error.message}` };
    }
}

async function getFlightBookingStatus(params) {
    try {
        const response = await fetch(`${FLIGHT_API_BASE}/retrieveFlightBooking`, {
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
            return { error: data.message || 'Failed to retrieve booking', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Booking retrieval failed:", error);
        return { error: `Booking retrieval failed: ${error.message}` };
    }
}

export {
    flightToolDefinitions,
    executeFlightTool
};
