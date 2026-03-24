/**
 * Hotel search and booking tool definitions and executors
 * Connects to hotel booking APIs
 */

const HOTEL_API_BASE = process.env.HOTEL_API_BASE || process.env.MAIN_ENDPOINT;

/**
 * Tool definitions for OpenAI function calling
 */
const hotelToolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'searchHotels',
            description: 'Search for available hotels in a city or near a location. Use this when the user wants to find hotels, check room availability, or compare hotel options.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name or city code (e.g., Dubai, London, DXB)'
                    },
                    checkInDate: {
                        type: 'string',
                        description: 'Check-in date in YYYY-MM-DD format'
                    },
                    checkOutDate: {
                        type: 'string',
                        description: 'Check-out date in YYYY-MM-DD format'
                    },
                    rooms: {
                        type: 'integer',
                        description: 'Number of rooms needed (default 1)',
                        default: 1
                    },
                    adults: {
                        type: 'integer',
                        description: 'Number of adult guests per room (default 2)',
                        default: 2
                    },
                    children: {
                        type: 'integer',
                        description: 'Number of children per room (default 0)',
                        default: 0
                    },
                    starRating: {
                        type: 'integer',
                        description: 'Minimum star rating (1-5)',
                        minimum: 1,
                        maximum: 5
                    },
                    maxPrice: {
                        type: 'number',
                        description: 'Maximum price per night in USD'
                    },
                    amenities: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Desired amenities (e.g., pool, spa, gym, wifi, parking, breakfast)'
                    }
                },
                required: ['city', 'checkInDate', 'checkOutDate']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getHotelDetails',
            description: 'Get detailed information about a specific hotel including room types, amenities, photos, and policies. Use this when the user wants more info about a particular hotel.',
            parameters: {
                type: 'object',
                properties: {
                    hotelId: {
                        type: 'string',
                        description: 'The hotel ID from search results'
                    },
                    checkInDate: {
                        type: 'string',
                        description: 'Check-in date in YYYY-MM-DD format'
                    },
                    checkOutDate: {
                        type: 'string',
                        description: 'Check-out date in YYYY-MM-DD format'
                    }
                },
                required: ['hotelId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'bookHotel',
            description: 'Book a hotel room. Use this when the user confirms they want to book a specific hotel room and has provided guest details.',
            parameters: {
                type: 'object',
                properties: {
                    hotelId: {
                        type: 'string',
                        description: 'The hotel ID'
                    },
                    roomId: {
                        type: 'string',
                        description: 'The room type/rate ID from hotel details'
                    },
                    checkInDate: {
                        type: 'string',
                        description: 'Check-in date in YYYY-MM-DD format'
                    },
                    checkOutDate: {
                        type: 'string',
                        description: 'Check-out date in YYYY-MM-DD format'
                    },
                    rooms: {
                        type: 'integer',
                        description: 'Number of rooms',
                        default: 1
                    },
                    guests: {
                        type: 'array',
                        description: 'List of guest details',
                        items: {
                            type: 'object',
                            properties: {
                                title: {
                                    type: 'string',
                                    enum: ['Mr', 'Mrs', 'Ms', 'Miss']
                                },
                                firstName: { type: 'string' },
                                lastName: { type: 'string' }
                            },
                            required: ['title', 'firstName', 'lastName']
                        }
                    },
                    contactEmail: {
                        type: 'string',
                        description: 'Contact email for booking confirmation'
                    },
                    contactPhone: {
                        type: 'string',
                        description: 'Contact phone number'
                    },
                    specialRequests: {
                        type: 'string',
                        description: 'Any special requests (e.g., late check-in, extra bed)'
                    }
                },
                required: ['hotelId', 'roomId', 'checkInDate', 'checkOutDate', 'guests', 'contactEmail']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getHotelBookingStatus',
            description: 'Check the status of an existing hotel booking. Use this when the user wants to check their hotel reservation status.',
            parameters: {
                type: 'object',
                properties: {
                    bookingReferenceId: {
                        type: 'string',
                        description: 'The hotel booking reference ID'
                    }
                },
                required: ['bookingReferenceId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'cancelHotelBooking',
            description: 'Cancel an existing hotel booking. Use this only when the user explicitly asks to cancel their hotel reservation.',
            parameters: {
                type: 'object',
                properties: {
                    bookingReferenceId: {
                        type: 'string',
                        description: 'The hotel booking reference ID to cancel'
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
 * Execute hotel tools
 */
async function executeHotelTool(functionName, args) {
    switch (functionName) {
        case 'searchHotels':
            return await searchHotels(args);
        case 'getHotelDetails':
            return await getHotelDetails(args);
        case 'bookHotel':
            return await bookHotel(args);
        case 'getHotelBookingStatus':
            return await getHotelBookingStatus(args);
        case 'cancelHotelBooking':
            return await cancelHotelBooking(args);
        default:
            throw new Error(`Unknown hotel tool: ${functionName}`);
    }
}

async function searchHotels(params) {
    try {
        const response = await fetch(`${HOTEL_API_BASE}/hotelSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                city: params.city,
                checkInDate: params.checkInDate,
                checkOutDate: params.checkOutDate,
                rooms: params.rooms || 1,
                adults: params.adults || 2,
                children: params.children || 0,
                starRating: params.starRating || null,
                maxPrice: params.maxPrice || null,
                amenities: params.amenities || []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to search hotels', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Hotel search failed:", error);
        return { error: `Hotel search failed: ${error.message}` };
    }
}

async function getHotelDetails(params) {
    try {
        const response = await fetch(`${HOTEL_API_BASE}/hotelDetails`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                hotelId: params.hotelId,
                checkInDate: params.checkInDate || null,
                checkOutDate: params.checkOutDate || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to get hotel details', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Hotel details failed:", error);
        return { error: `Hotel details failed: ${error.message}` };
    }
}

async function bookHotel(params) {
    try {
        const response = await fetch(`${HOTEL_API_BASE}/hotelBooking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.X_API_KEY || ''
            },
            body: JSON.stringify({
                hotelId: params.hotelId,
                roomId: params.roomId,
                checkInDate: params.checkInDate,
                checkOutDate: params.checkOutDate,
                rooms: params.rooms || 1,
                guests: params.guests,
                contactEmail: params.contactEmail,
                contactPhone: params.contactPhone || '',
                specialRequests: params.specialRequests || ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to book hotel', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Hotel booking failed:", error);
        return { error: `Hotel booking failed: ${error.message}` };
    }
}

async function getHotelBookingStatus(params) {
    try {
        const response = await fetch(`${HOTEL_API_BASE}/hotelBookingStatus`, {
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
            return { error: data.message || 'Failed to get booking status', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Hotel booking status failed:", error);
        return { error: `Hotel booking status failed: ${error.message}` };
    }
}

async function cancelHotelBooking(params) {
    try {
        const response = await fetch(`${HOTEL_API_BASE}/hotelBookingCancel`, {
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
            return { error: data.message || 'Failed to cancel booking', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Hotel cancellation failed:", error);
        return { error: `Hotel cancellation failed: ${error.message}` };
    }
}

export {
    hotelToolDefinitions,
    executeHotelTool
};
