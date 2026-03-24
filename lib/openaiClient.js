import OpenAI from 'openai';

let openaiInstance = null;

/**
 * Get OpenAI client singleton
 */
function getOpenAIClient() {
    if (!openaiInstance) {
        openaiInstance = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openaiInstance;
}

/**
 * Send chat completion request with tools
 * Handles the tool call loop automatically
 */
async function chatCompletion(messages, tools, toolExecutor, options = {}) {
    const openai = getOpenAIClient();

    const {
        model = process.env.OPENAI_MODEL || 'gpt-4o',
        temperature = 0.7,
        maxTokens = 2048,
        maxToolRounds = 5
    } = options;

    let currentMessages = [...messages];
    let round = 0;

    while (round < maxToolRounds) {
        round++;

        const completionParams = {
            model,
            messages: currentMessages,
            temperature,
            max_tokens: maxTokens
        };

        if (tools && tools.length > 0) {
            completionParams.tools = tools;
            completionParams.tool_choice = 'auto';
        }

        console.log(`OpenAI request round ${round}:`, JSON.stringify({
            model,
            messageCount: currentMessages.length,
            toolCount: tools?.length || 0
        }));

        const response = await openai.chat.completions.create(completionParams);
        const choice = response.choices[0];

        // If no tool calls, return the final text response
        if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
            return {
                message: choice.message,
                usage: response.usage,
                rounds: round
            };
        }

        // Process tool calls
        currentMessages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
            const functionName = toolCall.function.name;
            let functionArgs;

            try {
                functionArgs = JSON.parse(toolCall.function.arguments);
            } catch (error) {
                console.error(`Failed to parse tool arguments for ${functionName}:`, error);
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'Invalid function arguments' })
                });
                continue;
            }

            console.log(`Executing tool: ${functionName}`, JSON.stringify(functionArgs));

            try {
                const result = await toolExecutor(functionName, functionArgs);
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                });
            } catch (error) {
                console.error(`Tool execution failed for ${functionName}:`, error);
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        error: `Failed to execute ${functionName}: ${error.message}`
                    })
                });
            }
        }
    }

    // Max rounds exceeded — ask OpenAI to wrap up without tools
    const finalResponse = await openai.chat.completions.create({
        model,
        messages: [
            ...currentMessages,
            { role: 'system', content: 'You have reached the maximum number of tool calls. Please provide a final response to the user based on the information gathered so far.' }
        ],
        temperature,
        max_tokens: maxTokens
    });

    return {
        message: finalResponse.choices[0].message,
        usage: finalResponse.usage,
        rounds: round
    };
}

export {
    getOpenAIClient,
    chatCompletion
};
