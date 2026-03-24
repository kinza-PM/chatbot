import { createResponse, sanitizeInput, logError, parseBody, generateConversationId } from "../helper/helper.js";
import { chatCompletion } from "../lib/openaiClient.js";
import { getConversation, createConversation, updateConversation, trimConversation } from "../lib/conversationStore.js";
import { allToolDefinitions, executeTool } from "../lib/tools/index.js";
import { SYSTEM_PROMPT } from "../lib/systemPrompt.js";

export const handler = async (event) => {
    const startTime = Date.now();
    let conversationId = null;

    try {
        console.log("Chat Request:", JSON.stringify(event, null, 2));

        // Get user info from headers
        const userId = event.headers?.user_id || 'guest';
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

        const { message, conversationId: existingConversationId } = body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return createResponse(400, {
                success: false,
                message: "Message is required and must be a non-empty string"
            });
        }

        const sanitizedMessage = sanitizeInput(message);

        // Load or create conversation
        let conversation = null;
        let messages = [];

        if (existingConversationId) {
            conversationId = existingConversationId;
            conversation = await getConversation(conversationId);

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

            messages = conversation.messages;
        } else {
            // New conversation
            conversationId = generateConversationId();
            messages = [
                { role: 'system', content: SYSTEM_PROMPT }
            ];
        }

        // Add user message
        messages.push({ role: 'user', content: sanitizedMessage });

        // Trim conversation if too long (keep system + last 40 messages)
        messages = trimConversation(messages, 40);

        // Call OpenAI with tools
        const result = await chatCompletion(
            messages,
            allToolDefinitions,
            executeTool,
            {
                model: process.env.OPENAI_MODEL || 'gpt-4o',
                temperature: 0.7,
                maxTokens: 2048,
                maxToolRounds: 5
            }
        );

        const assistantMessage = result.message;

        // Add assistant response to messages
        messages.push({
            role: 'assistant',
            content: assistantMessage.content
        });

        // Save conversation
        const metadata = {
            lastUserMessage: sanitizedMessage.substring(0, 100),
            lastAssistantMessage: (assistantMessage.content || '').substring(0, 100),
            toolRounds: result.rounds,
            userType
        };

        if (conversation) {
            await updateConversation(conversationId, messages, metadata);
        } else {
            await createConversation(conversationId, userId, messages, metadata);
        }

        const duration = Date.now() - startTime;
        console.log(`Chat completed in ${duration}ms, rounds: ${result.rounds}, usage:`, result.usage);

        return createResponse(200, {
            success: true,
            message: "Chat response generated",
            data: {
                conversationId,
                response: assistantMessage.content,
                usage: {
                    promptTokens: result.usage?.prompt_tokens,
                    completionTokens: result.usage?.completion_tokens,
                    totalTokens: result.usage?.total_tokens
                },
                isNewConversation: !existingConversationId,
                duration
            }
        });

    } catch (error) {
        console.error("Error in chat handler:", error);

        await logError(error, {
            function: 'chat',
            conversationId,
            event: JSON.stringify(event)
        });

        if (error.status === 429) {
            return createResponse(429, {
                success: false,
                message: "Rate limit exceeded. Please try again in a moment."
            });
        }

        if (error.status === 401) {
            return createResponse(500, {
                success: false,
                message: "AI service configuration error"
            });
        }

        return createResponse(500, {
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
