/**
 * Customer support tool definitions and executors
 * Escalates issues to the customer-support microservice
 */

const SUPPORT_API_BASE = process.env.SUPPORT_API_BASE || process.env.MAIN_ENDPOINT;

/**
 * Tool definitions for OpenAI function calling
 */
const supportToolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'createSupportTicket',
            description: 'Create a customer support ticket when the user has an issue that cannot be resolved through the chatbot, needs human assistance, wants to file a complaint, or reports a problem with their booking.',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'Customer full name'
                    },
                    email: {
                        type: 'string',
                        description: 'Customer email address'
                    },
                    contactCode: {
                        type: 'string',
                        description: 'Phone country code (e.g., +971)'
                    },
                    contactNumber: {
                        type: 'string',
                        description: 'Phone number without country code'
                    },
                    reason: {
                        type: 'string',
                        description: 'Support reason category',
                        enum: ['technical-issue', 'billing-inquiry', 'feature-request', 'bug-report', 'general-inquiry']
                    },
                    message: {
                        type: 'string',
                        description: 'Detailed description of the issue'
                    }
                },
                required: ['name', 'email', 'reason', 'message']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getTicketStatus',
            description: 'Check the status of an existing support ticket. Use this when the user wants to know the status of their complaint or support request.',
            parameters: {
                type: 'object',
                properties: {
                    ticketId: {
                        type: 'string',
                        description: 'The support ticket ID (starts with TKT-)'
                    }
                },
                required: ['ticketId']
            }
        }
    }
];

/**
 * Execute support tools
 */
async function executeSupportTool(functionName, args) {
    switch (functionName) {
        case 'createSupportTicket':
            return await createSupportTicket(args);
        case 'getTicketStatus':
            return await getTicketStatus(args);
        default:
            throw new Error(`Unknown support tool: ${functionName}`);
    }
}

async function createSupportTicket(params) {
    try {
        const response = await fetch(`${SUPPORT_API_BASE}/ticket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: params.name,
                email: params.email,
                contact: {
                    code: params.contactCode || '+971',
                    number: params.contactNumber || '0000000000'
                },
                reason: params.reason,
                message: params.message
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to create support ticket', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Support ticket creation failed:", error);
        return { error: `Support ticket creation failed: ${error.message}` };
    }
}

async function getTicketStatus(params) {
    try {
        const response = await fetch(`${SUPPORT_API_BASE}/ticket/${params.ticketId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.message || 'Failed to get ticket status', statusCode: response.status };
        }

        return data;
    } catch (error) {
        console.error("Ticket status check failed:", error);
        return { error: `Ticket status check failed: ${error.message}` };
    }
}

export {
    supportToolDefinitions,
    executeSupportTool
};
