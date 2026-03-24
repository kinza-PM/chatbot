import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });

/**
 * Get conversation by ID
 */
async function getConversation(conversationId) {
    const result = await dynamo.send(new GetItemCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { conversationId: { S: conversationId } }
    }));

    if (!result.Item) return null;

    return {
        conversationId: result.Item.conversationId.S,
        userId: result.Item.userId.S,
        messages: JSON.parse(result.Item.messages.S),
        metadata: result.Item.metadata ? JSON.parse(result.Item.metadata.S) : {},
        createdAt: result.Item.createdAt.S,
        updatedAt: result.Item.updatedAt.S
    };
}

/**
 * Create new conversation
 */
async function createConversation(conversationId, userId, messages, metadata = {}) {
    const timestamp = new Date().toISOString();

    await dynamo.send(new PutItemCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Item: {
            conversationId: { S: conversationId },
            userId: { S: userId },
            messages: { S: JSON.stringify(messages) },
            metadata: { S: JSON.stringify(metadata) },
            messageCount: { N: String(messages.length) },
            createdAt: { S: timestamp },
            updatedAt: { S: timestamp }
        }
    }));

    return {
        conversationId,
        userId,
        messages,
        metadata,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

/**
 * Update conversation messages
 */
async function updateConversation(conversationId, messages, metadata = null) {
    const timestamp = new Date().toISOString();

    const updateExpressions = [
        'messages = :messages',
        'messageCount = :messageCount',
        'updatedAt = :updatedAt'
    ];
    const expressionAttributeValues = {
        ':messages': { S: JSON.stringify(messages) },
        ':messageCount': { N: String(messages.length) },
        ':updatedAt': { S: timestamp }
    };

    if (metadata !== null) {
        updateExpressions.push('metadata = :metadata');
        expressionAttributeValues[':metadata'] = { S: JSON.stringify(metadata) };
    }

    await dynamo.send(new UpdateItemCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { conversationId: { S: conversationId } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues
    }));
}

/**
 * Delete conversation
 */
async function deleteConversation(conversationId) {
    await dynamo.send(new DeleteItemCommand({
        TableName: process.env.CONVERSATIONS_TABLE,
        Key: { conversationId: { S: conversationId } }
    }));
}

/**
 * Get conversations by user ID
 */
async function getConversationsByUser(userId, limit = 20, lastEvaluatedKey = null) {
    const params = {
        TableName: process.env.CONVERSATIONS_TABLE,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': { S: userId } },
        ScanIndexForward: false,
        Limit: limit
    };

    if (lastEvaluatedKey) {
        params.ExclusiveStartKey = JSON.parse(
            Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8')
        );
    }

    const result = await dynamo.send(new QueryCommand(params));

    const conversations = result.Items.map(item => ({
        conversationId: item.conversationId.S,
        userId: item.userId.S,
        messageCount: parseInt(item.messageCount.N),
        metadata: item.metadata ? JSON.parse(item.metadata.S) : {},
        createdAt: item.createdAt.S,
        updatedAt: item.updatedAt.S
    }));

    let nextToken = null;
    if (result.LastEvaluatedKey) {
        nextToken = Buffer.from(
            JSON.stringify(result.LastEvaluatedKey)
        ).toString('base64');
    }

    return { conversations, nextToken };
}

/**
 * Trim conversation to keep within token limits
 * Keeps system prompt + last N messages
 */
function trimConversation(messages, maxMessages = 40) {
    if (messages.length <= maxMessages) return messages;

    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const trimmed = nonSystemMessages.slice(-maxMessages);
    return [...systemMessages, ...trimmed];
}

export {
    getConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    getConversationsByUser,
    trimConversation
};
