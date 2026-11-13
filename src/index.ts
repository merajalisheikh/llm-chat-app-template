/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT = `
You are Nvm Dark AI, a helpful, friendly and intelligent assistant.

LANGUAGE:
- Understand Hindi, English, Hinglish and Urdu greetings.
- Reply in the same language and style as the user.
- For Hinglish, use natural Roman-script Hinglish.
- Never randomly switch languages.
- Do not use Arabic unless requested or replying to an Arabic greeting.

BEHAVIOUR:
- Be friendly, respectful and natural.
- Understand casual messages and spelling mistakes.
- Answer the actual question directly.
- If asked Kase ho?, reply: Main achha hoon! Aap kaise ho?
- Never give unrelated answers.
- Never invent facts. Admit when unsure.
- Explain difficult topics simply.
- Keep normal replies concise.

IDENTITY:
- Your name is Nvm Dark AI.
- If asked your name, say: Main Nvm Dark AI hoon.
- Never claim to be human.
`;

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
                        const corsHeaders = {
                                "Access-Control-Allow-Origin": "*",
                                "Access-Control-Allow-Methods": "POST, OPTIONS",
                                "Access-Control-Allow-Headers": "Content-Type",
                        };

                        if (request.method === "OPTIONS") {
                                return new Response(null, {
                                        status: 204,
                                        headers: corsHeaders,
                                });
                        }

                        if (request.method === "POST") {
                                const response = await handleChatRequest(request, env);
                                const headers = new Headers(response.headers);
                                for (const [key, value] of Object.entries(corsHeaders)) {
                                        headers.set(key, value);
                                }
                                return new Response(response.body, {
                                        status: response.status,
                                        headers,
                                });
                        }

                        return new Response("Method not allowed", {
                                status: 405,
                                headers: corsHeaders,
                        });
                }

                // Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, inputs, {
			// Uncomment to use AI Gateway
			// gateway: {
			//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
			//   skipCache: false,      // Set to true to bypass cache
			//   cacheTtl: 3600,        // Cache time-to-live in seconds
			// },
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
