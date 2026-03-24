import { createResponse, logError } from "../helper/helper.js";
import { getConversation, getConversationsByUser } from "../lib/conversationStore.js";

export const handler = async (event) => {
    const startTime = Date.now();

    try {
        console.log("Get Chat History Request:", JSON.stringify(event, null, 2));

        // Get user info from headers
        const userId = event.headers?.user_id || 'guest';

        // Get query parameters
        const queryParams = event.queryStringParameters || {};
        const { conversationId, limit, lastEvaluatedKey } = queryParams;

        // If conversationId provided, return that specific conversation
        if (conversationId) {
            const conversation = await getConversation(conversationId);

            if (!conversation) {
                return createResponse(404, {
                    success: false,
                    message: "Conversation not found"
                });
            }

            // Verify ownership
            if (conversation.userId !== userId) {
                return createResponse(403, {
                    success: false,
                    message: "Access denied to this conversation"
                });
            }

            // Filter out system messages for the response
            const userMessages = conversation.messages.filter(m => m.role !== 'system');

            return createResponse(200, {
                success: true,
                message: "Conversation retrieved successfully",
                data: {
                    conversationId: conversation.conversationId,
                    messages: userMessages,
                    messageCount: userMessages.length,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt
                }
            });
        }

        // Otherwise, list all conversations for the user
        const result = await getConversationsByUser(
            userId,
            limit ? parseInt(limit) : 20,
            lastEvaluatedKey || null
        );

        return createResponse(200, {
            success: true,
            message: "Conversations retrieved successfully",
            data: {
                conversations: result.conversations,
                count: result.conversations.length,
                nextToken: result.nextToken
            }
        });

    } catch (error) {
        console.error("Error getting chat history:", error);

        await logError(error, {
            function: 'getChatHistory',
            event: JSON.stringify(event)
        });

        return createResponse(500, {
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
