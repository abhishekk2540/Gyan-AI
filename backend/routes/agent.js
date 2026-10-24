import { chat } from '../services/llmService.js';


const SYSTEM_PROMPT = `
You are a helpful AI Agent with access to tools. 
Answer the user's question as best as you can.

You MUST follow this format strictly:
Thought: your internal reasoning about what to do next.
Action: the name of the tool to use.
Action Input: the input to the tool.
Observation: the result of the tool call (this will be provided to you).
... (this Thought/Action/Action Input/Observation can repeat N times)
Final Answer: your final response to the user.

Available Tools:
- calculator: Takes a mathematical expression as input. Example: Action: calculator, Action Input: 25 * 4
- web_search: Takes a search query as input. Example: Action: web_search, Action Input: Latest AI news

CRITICAL: If a tool returns a "mock" result or an error, DO NOT keep trying the same tool. Instead, use your internal knowledge to provide the best possible "Final Answer" based on what you already know.

Let's begin!
`;

// Simple tools implementation
const tools = {
  calculator: (input) => {
    try {
      // Basic math evaluation (safe enough for this demo)
      // Remove any non-math characters except numbers, operators, and parentheses
      const clean = input.replace(/[^0-9+\-*/().]/g, '');
      return eval(clean).toString();
    } catch (e) {
      return "Error: Invalid math expression";
    }
  },
  web_search: async (input) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return `[MOCK SEARCH RESULT]: No TAVILY_API_KEY provided in .env. (Note to Agent: You cannot search the web right now. Use your internal knowledge or tell the user to provide a Tavily key).`;
    }

    try {
      const TAVILY_API_URL = process.env.TAVILY_API_URL || 'https://api.tavily.com/search';
      console.log(`[Agent] Searching web for: ${input}...`);
      const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: input,
          search_depth: "basic",
          include_answer: true,
          max_results: 3
        })
      });

      const data = await response.json();
      
      // If Tavily provided a direct answer, use it
      if (data.answer) return data.answer;
      
      // Otherwise, combine the snippets from the results
      if (data.results && data.results.length > 0) {
        return data.results.map(r => `Source: ${r.url}\nContent: ${r.content}`).join('\n\n');
      }

      return "No relevant search results found.";
    } catch (e) {
      console.error('[Search Error]:', e.message);
      return `Error during web search: ${e.message}`;
    }
  }
};

export const agentRouter = async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  console.log(`[Agent] Running query: ${query}`);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: query }
  ];

  const steps = [];
  let iterations = 0;
  const MAX_ITERATIONS = 2; // Reduced to 2 to prevent infinite loops

  try {
    while (iterations < MAX_ITERATIONS) {
      const response = await chat(messages);
      messages.push({ role: 'assistant', content: response });

      // Log the raw response for debugging
      console.log(`[Agent Response]:\n${response}`);

      // Extract parts using more robust regex
      const thoughtMatch = response.match(/Thought:\s*(.*)/i);
      const actionMatch = response.match(/Action:\s*(.*)/i);
      const actionInputMatch = response.match(/Action Input:\s*(.*)/i);
      const finalAnswerMatch = response.match(/Final Answer:\s*([\s\S]*)/i);

      if (thoughtMatch) {
        steps.push({ type: 'thought', content: thoughtMatch[1].trim() });
      }

      if (actionMatch && actionInputMatch) {
        const toolName = actionMatch[1].trim().toLowerCase();
        const toolInput = actionInputMatch[1].trim();
        
        steps.push({ type: 'tool', tool: toolName, content: `Calling ${toolName}...` });

        let observation = '';
        if (tools[toolName]) {
          observation = await tools[toolName](toolInput);
        } else {
          observation = `Error: Tool "${toolName}" not found.`;
        }

        steps.push({ type: 'result', content: observation });
        messages.push({ role: 'user', content: `Observation: ${observation}` });
        
        iterations++;
        continue;
      }

      if (finalAnswerMatch) {
        return res.json({ steps, answer: finalAnswerMatch[1].trim() });
      }

      // Fallback: If it gave an answer without the tag
      if (!actionMatch) {
        return res.json({ steps, answer: response.replace(/Thought: .*/, '').trim() });
      }
      
      iterations++;
    }

    res.json({ steps, answer: "I reached the maximum reasoning steps without a final answer." });

  } catch (error) {
    console.error('[Agent Error]:', error);
    res.status(500).json({ error: 'Agent reasoning failed.' });
  }
};
