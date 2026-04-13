import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-west-1" });

/**
 * Get support conversation by ID
 */
async function getSupportConversation(conversationId) {
    const result = await dynamo.send(new GetItemCommand({
        TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
        Key: { conversationId: { S: conversationId } }
    }));

    if (!result.Item) return null;

    return {
        conversationId: result.Item.conversationId.S,
        userId: result.Item.userId?.S || null,
        email: result.Item.email.S,
        name: result.Item.name.S,
        phone: result.Item.phone.S,
        category: result.Item.category.S,
        subcategory: result.Item.subcategory?.S || null,
        messages: JSON.parse(result.Item.messages.S),
        ticketId: result.Item.ticketId?.S || null,
        status: result.Item.status.S,
        createdAt: result.Item.createdAt.S,
        updatedAt: result.Item.updatedAt.S
    };
}

/**
 * Create new support conversation
 */
async function createSupportConversation(conversationId, userId, email, name, phone, category, subcategory, messages = []) {
    const timestamp = new Date().toISOString();

    const item = {
        conversationId: { S: conversationId },
        userId: { S: userId || 'guest' },
        email: { S: email },
        name: { S: name },
        phone: { S: phone },
        category: { S: category },
        messages: { S: JSON.stringify(messages) },
        status: { S: 'active' },
        messageCount: { N: String(messages.length) },
        createdAt: { S: timestamp },
        updatedAt: { S: timestamp }
    };

    // Only add subcategory if it has a value
    if (subcategory) {
        item.subcategory = { S: subcategory };
    }

    await dynamo.send(new PutItemCommand({
        TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
        Item: item
    }));

    const result = {
        conversationId,
        userId: userId || 'guest',
        email,
        name,
        phone,
        category,
        messages,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Only include subcategory if it has a value
    if (subcategory) {
        result.subcategory = subcategory;
    }

    return result;
}

/**
 * Update support conversation messages
 */
async function updateSupportConversation(conversationId, messages, metadata = null) {
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

    if (metadata?.ticketId) {
        updateExpressions.push('ticketId = :ticketId');
        expressionAttributeValues[':ticketId'] = { S: metadata.ticketId };
    }

    if (metadata?.status) {
        updateExpressions.push('#status = :status');
        expressionAttributeValues[':status'] = { S: metadata.status };
    }

    await dynamo.send(new UpdateItemCommand({
        TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
        Key: { conversationId: { S: conversationId } },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: metadata?.status ? { '#status': 'status' } : undefined,
        ExpressionAttributeValues: expressionAttributeValues
    }));
}

/**
 * Link ticket to conversation
 */
async function linkTicketToConversation(conversationId, ticketId) {
    await updateSupportConversation(conversationId, [], { ticketId });
}

/**
 * Delete support conversation
 */
async function deleteSupportConversation(conversationId) {
    await dynamo.send(new DeleteItemCommand({
        TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
        Key: { conversationId: { S: conversationId } }
    }));
}

/**
 * Get conversations by user ID
 */
async function getSupportConversationsByUser(userId, limit = 20, lastEvaluatedKey = null) {
    const params = {
        TableName: process.env.SUPPORT_CONVERSATIONS_TABLE,
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
        email: item.email.S,
        name: item.name.S,
        category: item.category.S,
        subcategory: item.subcategory?.S || null,
        messageCount: parseInt(item.messageCount.N),
        ticketId: item.ticketId?.S || null,
        status: item.status.S,
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

export {
    getSupportConversation,
    createSupportConversation,
    updateSupportConversation,
    linkTicketToConversation,
    deleteSupportConversation,
    getSupportConversationsByUser
};
