import { createResponse, logError } from "../helper/helper.js";
import { getConversation, deleteConversation } from "../lib/conversationStore.js";

export const handler = async (event) => {
    const startTime = Date.now();
    let conversationId = null;

    try {
        console.log("Delete Conversation Request:", JSON.stringify(event, null, 2));

        // Get user info from headers
        const userId = event.headers?.user_id || 'guest';

        // Get conversation ID from path parameters
        conversationId = event.pathParameters?.conversationId;
        if (!conversationId) {
            return createResponse(400, {
                success: false,
                message: "Conversation ID is required"
            });
        }

        // Check if conversation exists
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

        // Delete conversation
        await deleteConversation(conversationId);

        return createResponse(200, {
            success: true,
            message: "Conversation deleted successfully",
            data: {
                conversationId,
                deletedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("Error deleting conversation:", error);

        await logError(error, {
            function: 'deleteConversation',
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
