/**
 * Create response object
 */
function createResponse(statusCode, body, headers = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            ...headers
        },
        body: JSON.stringify(body)
    };
}

/**
 * Sanitize input to prevent injection
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Log error with context
 */
async function logError(error, context) {
    const errorLog = {
        type: 'error',
        error: {
            message: error.message,
            stack: error.stack,
            name: error.name
        },
        context,
        timestamp: new Date().toISOString()
    };

    console.error("Error occurred:", errorLog);
}

/**
 * Parse JSON request body from API Gateway event
 */
function parseBody(event) {
    try {
        const body = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64').toString('utf-8')
            : event.body;
        return JSON.parse(body);
    } catch (error) {
        throw new Error("Invalid JSON in request body");
    }
}

/**
 * Generate conversation ID
 */
function generateConversationId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `CONV-${timestamp}-${random}`.toUpperCase();
}

export {
    createResponse,
    sanitizeInput,
    logError,
    parseBody,
    generateConversationId
};
