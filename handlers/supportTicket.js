import { createResponse, sanitizeInput, logError, parseBody, generateConversationId } from "../helper/helper.js";
import { getSupportConversation, createSupportConversation, updateSupportConversation, linkTicketToConversation } from "../lib/supportConversationStore.js";

export const handler = async (event) => {
    const startTime = Date.now();
    let conversationId = null;

    try {
        console.log("Support Ticket Request:", JSON.stringify(event, null, 2));

        // Get user info from headers
        const userId = event.headers?.user_id || null;
        const userType = event.headers?.user_type || 'guest';

        // Parse request body
        let body;
        try {
            body = parseBody(event);
        } catch (error) {
            return createResponse(400, {
                success: false,
                message: "Invalid request body: " + error.message
            });
        }

        const { message, conversationId: existingConversationId, email, name, phone, category, subcategory, createTicket } = body;

        // Validate required fields
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return createResponse(400, {
                success: false,
                message: "Message is required and must be a non-empty string"
            });
        }

        // For new conversations, validate user info
        if (!existingConversationId) {
            if (!email || !name || !phone || !category || !subcategory) {
                return createResponse(400, {
                    success: false,
                    message: "Missing required fields: email, name, phone, category, subcategory"
                });
            }
        }

        const sanitizedMessage = sanitizeInput(message);

        // Load or create conversation
        let conversation = null;
        let messages = [];

        if (existingConversationId) {
            conversationId = existingConversationId;
            conversation = await getSupportConversation(conversationId);

            if (!conversation) {
                return createResponse(404, {
                    success: false,
                    message: "Conversation not found"
                });
            }

            // Verify ownership (for logged-in users)
            if (userId && conversation.userId !== userId && conversation.userId !== 'guest') {
                return createResponse(403, {
                    success: false,
                    message: "Access denied to this conversation"
                });
            }

            messages = conversation.messages;
        } else {
            // New conversation
            conversationId = generateConversationId();
            messages = [];
        }

        // Add user message
        messages.push({
            id: `msg-${Date.now()}`,
            sender: 'user',
            text: sanitizedMessage,
            timestamp: new Date().toISOString()
        });

        // Save or update conversation
        if (conversation) {
            await updateSupportConversation(conversationId, messages);
        } else {
            await createSupportConversation(
                conversationId,
                userId,
                email,
                name,
                phone,
                category,
                subcategory,
                messages
            );
        }

        // If createTicket flag is set, call CustomerSupport-PM API
        let ticketId = null;
        let redirectUrl = null;

        if (createTicket) {
            try {
                const ticketResponse = await createSupportTicket({
                    email,
                    name,
                    phone,
                    category,
                    subcategory,
                    message: sanitizedMessage,
                    source: 'chatbot',
                    conversationId
                });

                if (ticketResponse.success) {
                    ticketId = ticketResponse.ticketId;
                    redirectUrl = `/support/tickets/${ticketId}`;

                    // Link ticket to conversation
                    await linkTicketToConversation(conversationId, ticketId);

                    // Update conversation status
                    await updateSupportConversation(conversationId, messages, { status: 'closed', ticketId });
                }
            } catch (error) {
                console.error("Error creating ticket:", error);
                await logError(error, {
                    function: 'supportTicket',
                    conversationId,
                    action: 'createTicket'
                });
            }
        }

        const duration = Date.now() - startTime;
        console.log(`Support ticket request completed in ${duration}ms`);

        return createResponse(200, {
            success: true,
            message: "Message saved successfully",
            data: {
                conversationId,
                ticketId,
                redirectUrl,
                messages,
                isNewConversation: !existingConversationId,
                duration
            }
        });

    } catch (error) {
        console.error("Error in support ticket handler:", error);

        await logError(error, {
            function: 'supportTicket',
            conversationId,
            event: JSON.stringify(event)
        });

        return createResponse(500, {
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Call CustomerSupport-PM createTicket API
 */
async function createSupportTicket(ticketData) {
    try {
        const endpoint = `${process.env.SUPPORT_API_BASE}/ticket`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPPORT_API_KEY || ''}`
            },
            body: JSON.stringify(ticketData)
        });

        if (!response.ok) {
            throw new Error(`Failed to create ticket: ${response.statusText}`);
        }

        const result = await response.json();
        return {
            success: result.success,
            ticketId: result.data?.ticketId || result.ticketId
        };
    } catch (error) {
        console.error("Error calling CustomerSupport-PM API:", error);
        throw error;
    }
}
