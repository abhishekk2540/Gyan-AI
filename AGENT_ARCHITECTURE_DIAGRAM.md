# AI Agent Architecture: ReAct Reasoning Loop

This diagram explains the "Thought-Action-Observation" loop that allows the Agent to use tools like Web Search and a Calculator.

```mermaid
sequenceDiagram
    participant User
    participant Frontend as AgentTab.jsx
    participant Server as server.js
    participant Route as agent.js (ReAct Engine)
    participant LLM as llmService.js (Brain)
    participant Search as Tavily API (Search Tool)
    participant Calc as Math Engine (Calculator Tool)

    User->>Frontend: "Who is the CEO of OpenAI?"
    Frontend->>Server: POST /api/agent/run
    Server->>Route: agentRouter

    loop ReAct Loop (Max 2 Iterations)
        Note over Route: Formats prompt with Tools list
        Route->>LLM: chat(messages)
        LLM-->>Route: "Thought: I need to search... Action: web_search"
        
        alt Action: web_search
            Route->>Search: search(query)
            Search-->>Route: "Result: Sam Altman is CEO"
        else Action: calculator
            Route->>Calc: evaluate(math_expr)
            Calc-->>Route: "Result: 42"
        end

        Note over Route: Appends Observation to memory
    end

    Route->>LLM: Final Answer Generation
    LLM-->>Route: "The CEO of OpenAI is Sam Altman."
    Route-->>Frontend: { steps: [...], answer: "..." }
    Frontend-->>User: Displays thought steps & final answer
```

### Key Components Explained:
1. **ReAct Logic**: The `agent.js` file manages the state. It tells the LLM: "Don't just answer, think first. If you need a tool, write `Action: [tool_name]`."
2. **`Tavily API`**: A specialized AI search engine that returns clean, parsed data from the internet instead of raw HTML.
3. **Reasoning Loop**: The agent loops until it has enough information or hits the `MAX_ITERATIONS` limit.
