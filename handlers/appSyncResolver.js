import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { 
    createResponse, 
    sanitizeInput,
    logError,
    generateConversationId
} from "../helper/helper.js";
import { getSupportConversation, updateSupportConversation } from "../lib/supportConversationStore.js";

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });

export const handler = async (event) => {
    console.log("AppSync Event:", JSON.stringify(event, null, 2));

    try {
        const { typeName, fieldName, arguments: args, identity } = event;

        // Route to appropriate resolver based on type and field
        if (typeName === "Query") {
            return await handleQuery(fieldName, args);
        } else if (typeName === "Mutation") {
            return await handleMutation(fieldName, args, identity);
        } else if (typeName === "Subscription") {
            return await handleSubscription(fieldName, args, identity);
        }

        throw new Error(`Unknown type: ${typeName}`);
    } catch (error) {
        console.error("AppSync Resolver Error:", error);
        await logError(error, {
            function: 'appSyncResolver',
            event: JSON.stringify(event)
        });
        throw error;
    }
};

async function handleQuery(fieldName, args) {
    switch (fieldName) {
        case "getConversation":
            return await getConversation(args.conversationId);
        case "listConversationsByUser":
            return await listConversationsByUser(args.userId, args.limit, args.nextToken);
        case "getMessage":
            return await getMessage(args.messageId);
        default:
            throw new Error(`Unknown query: ${fieldName}`);
    }
}

async function handleMutation(fieldName, args, identity) {
    switch (fieldName) {
        case "sendMessage":
            return await sendMessage(args.input, identity);
        case "updateConversationStatus":
            return await updateConversationStatus(args.conversationId, args.status);
        case "createTicketFromConversation":
            return await createTicketFromConversation(args.conversationId, args.category, args.subcategory);
        default:
            throw new Error(`Unknown mutation: ${fieldName}`);
    }
}

async function handleSubscription(fieldName, args, identity) {
    switch (fieldName) {
        case "onMessageReceived":
            return { conversationId: args.conversationId };
        case "onConversationUpdated":
            return { conversationId: args.conversationId };
        default:
            throw new Error(`Unknown subscription: ${fieldName}`);
    }
}

async function getConversation(conversationId) {
    try {
        const conversation = await getSupportConversation(conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }
        return conversation;
    } catch (error) {
        console.error("Error getting conversation:", error);
        throw error;
    }
}

async function listConversationsByUser(userId, limit = 20, nextToken = null) {
    try {
        const params = {
            TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': { S: userId } },
            ScanIndexForward: false,
            Limit: limit || 20
        };

        if (nextToken) {
            params.ExclusiveStartKey = JSON.parse(
                Buffer.from(nextToken, 'base64').toString('utf-8')
            );
        }

        const result = await dynamo.send(new QueryCommand(params));

        const conversations = result.Items.map(item => ({
            conversationId: item.conversationId.S,
            userId: item.userId.S,
            email: item.email.S,
            name: item.name.S,
            phone: item.phone.S,
            category: item.category?.S,
            subcategory: item.subcategory?.S,
            ticketId: item.ticketId?.S,
            status: item.status.S,
            createdAt: item.createdAt.S,
            updatedAt: item.updatedAt.S
        }));

        let newNextToken = null;
        if (result.LastEvaluatedKey) {
            newNextToken = Buffer.from(
                JSON.stringify(result.LastEvaluatedKey)
            ).toString('base64');
        }

        return {
            items: conversations,
            nextToken: newNextToken
        };
    } catch (error) {
        console.error("Error listing conversations:", error);
        throw error;
    }
}

async function getMessage(messageId) {
    try {
        const result = await dynamo.send(new GetItemCommand({
            TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
            Key: { messageId: { S: messageId } }
        }));

        if (!result.Item) {
            throw new Error("Message not found");
        }

        return {
            id: result.Item.messageId.S,
            conversationId: result.Item.conversationId.S,
            sender: result.Item.sender.S,
            text: result.Item.text.S,
            timestamp: result.Item.timestamp.S,
            status: result.Item.status?.S
        };
    } catch (error) {
        console.error("Error getting message:", error);
        throw error;
    }
}

async function sendMessage(input, identity) {
    try {
        const { conversationId, message, sender } = input;
        const timestamp = new Date().toISOString();
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Get existing conversation
        const conversation = await getSupportConversation(conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        // Add new message to conversation
        const updatedMessages = [
            ...conversation.messages,
            {
                id: messageId,
                sender: sanitizeInput(sender),
                text: sanitizeInput(message),
                timestamp,
                status: 'sent'
            }
        ];

        // Update conversation with new message
        await updateSupportConversation(conversationId, updatedMessages);

        return {
            id: messageId,
            conversationId,
            sender: sanitizeInput(sender),
            text: sanitizeInput(message),
            timestamp,
            status: 'sent'
        };
    } catch (error) {
        console.error("Error sending message:", error);
        throw error;
    }
}

async function updateConversationStatus(conversationId, status) {
    try {
        const conversation = await getSupportConversation(conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        const timestamp = new Date().toISOString();

        await dynamo.send(new UpdateItemCommand({
            TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
            Key: { conversationId: { S: conversationId } },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':status': { S: status },
                ':updatedAt': { S: timestamp }
            }
        }));

        return {
            conversationId,
            status,
            updatedAt: timestamp
        };
    } catch (error) {
        console.error("Error updating conversation status:", error);
        throw error;
    }
}

async function createTicketFromConversation(conversationId, category, subcategory) {
    try {
        const conversation = await getSupportConversation(conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        // Call CustomerSupport-PM API to create ticket
        const ticketResponse = await fetch(`${process.env.SUPPORT_API_BASE}/ticket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPPORT_API_KEY || ''}`
            },
            body: JSON.stringify({
                name: conversation.name,
                email: conversation.email,
                contact: {
                    code: '+971',
                    number: conversation.phone
                },
                reason: category,
                message: conversation.messages.map(m => `${m.sender}: ${m.text}`).join('\n'),
                source: 'chatbot',
                conversationId,
                category,
                subcategory
            })
        });

        if (!ticketResponse.ok) {
            throw new Error(`Failed to create ticket: ${ticketResponse.statusText}`);
        }

        const result = await ticketResponse.json();

        if (result.success) {
            const ticketId = result.data?.ticketId || result.ticketId;

            // Update conversation with ticket ID
            await updateSupportConversation(conversationId, conversation.messages, {
                ticketId,
                status: 'closed'
            });

            return {
                success: true,
                ticketId,
                message: `Ticket ${ticketId} created successfully`
            };
        }

        throw new Error(result.message || 'Failed to create ticket');
    } catch (error) {
        console.error("Error creating ticket from conversation:", error);
        throw error;
    }
}
