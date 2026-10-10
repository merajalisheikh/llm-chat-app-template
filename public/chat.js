hathchath/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
	},
];
let isProcessing = false;
const STORAGE_KEY = "nvm-dark-ai-chats-v1";

let conversations = [];
let currentConversationId = null;

function saveConversations() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversations,
        currentConversationId
      })
    );
  } catch (error) {
    console.error("Could not save chat history:", error);
  }
}

function loadConversations() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );

    conversations = Array.isArray(saved.conversations)
      ? saved.conversations
      : [];

    currentConversationId = saved.currentConversationId || null;
  } catch (error) {
    conversations = [];
    currentConversationId = null;
  }
}

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the response
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages
	if (message === "" || isProcessing) return;

	// Disable input while processing
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to chat
	addMessageToChat("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	typingIndicator.classList.add("visible");

	// Add message to history
	chatHistory.push({ role: "user", content: message });
	saveCurrentMessages();

	try {
		// Create new assistant response element
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);
		const assistantTextEl = assistantMessageEl.querySelector("p");

		// Scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Send request to API
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		// Handle errors
		if (!response.ok) {
			throw new Error("Failed to get response");
		}
		if (!response.body) {
			throw new Error("Response body is null");
		}

		// Process streaming response
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";
		const flushAssistantText = () => {
			assistantTextEl.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

		let sawDone = false;
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// Process any remaining complete events in buffer
				const parsed = consumeSseEvents(buffer + "\n\n");
				for (const data of parsed.events) {
					if (data === "[DONE]") {
						break;
					}
					try {
						const jsonData = JSON.parse(data);
						// Handle both Workers AI format (response) and OpenAI format (choices[0].delta.content)
						let content = "";
						if (
							typeof jsonData.response === "string" &&
							jsonData.response.length > 0
						) {
							content = jsonData.response;
						} else if (jsonData.choices?.[0]?.delta?.content) {
							content = jsonData.choices[0].delta.content;
						}
						if (content) {
							responseText += content;
							flushAssistantText();
						}
					} catch (e) {
						console.error("Error parsing SSE data as JSON:", e, data);
					}
				}
				break;
			}

			// Decode chunk
			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			for (const data of parsed.events) {
				if (data === "[DONE]") {
					sawDone = true;
					buffer = "";
					break;
				}
				try {
					const jsonData = JSON.parse(data);
					// Handle both Workers AI format (response) and OpenAI format (choices[0].delta.content)
					let content = "";
					if (
						typeof jsonData.response === "string" &&
						jsonData.response.length > 0
					) {
						content = jsonData.response;
					} else if (jsonData.choices?.[0]?.delta?.content) {
						content = jsonData.choices[0].delta.content;
					}
					if (content) {
						responseText += content;
						flushAssistantText();
					}
				} catch (e) {
					console.error("Error parsing SSE data as JSON:", e, data);
				}
			}
			if (sawDone) {
				break;
			}
		}

		// Add completed response to chat history
		// Add completed response to chat history
		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
			saveCurrentMessages();
		}
		}
	} catch (error) {
		console.error("Error:", error);
		addMessageToChat(
			"assistant",
			"Sorry, there was an error processing your request.",
		);
	} finally {
		// Hide typing indicator
		typingIndicator.classList.remove("visible");

		// Re-enable input
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.innerHTML = `<p>${content}</p>`;
	chatMessages.appendChild(messageEl);

	// Scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice("data:".length).trimStart());
			}
		}
		if (dataLines.length === 0) continue;
		events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}
function getCurrentConversation() {
  return conversations.find(
    (conversation) => conversation.id === currentConversationId
  );
}

function saveCurrentMessages() {
  let conversation = getCurrentConversation();

  if (!conversation) {
    conversation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: "New Chat",
      messages: [],
      updatedAt: Date.now()
    };

    conversations.unshift(conversation);
    currentConversationId = conversation.id;
  }

  conversation.messages = [...chatHistory];
  conversation.updatedAt = Date.now();

  const firstUserMessage = chatHistory.find(
    (message) => message.role === "user"
  );

  if (firstUserMessage) {
    conversation.title =
      firstUserMessage.content.slice(0, 35) || "New Chat";
  }

  saveConversations();
  renderChatHistory();
}

function renderChatHistory() {
  const list = document.getElementById("chat-history-list");
  if (!list) return;

  list.innerHTML = "";

  conversations.forEach((conversation) => {
    const item = document.createElement("div");
    item.style.cssText =
      "display:flex;align-items:center;gap:6px;margin:4px 0;";

    const openButton = document.createElement("button");
    openButton.textContent = conversation.title || "New Chat";
    openButton.style.cssText =
      "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;" +
      "white-space:nowrap;text-align:left;padding:8px;border:0;" +
      "border-radius:8px;background:transparent;color:inherit;cursor:pointer;";

    openButton.onclick = () => {
      currentConversationId = conversation.id;
      chatHistory = [...conversation.messages];
      saveConversations();
      renderMessages();
    };

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "×";
    deleteButton.title = "Delete chat";
    deleteButton.style.cssText =
      "padding:6px 10px;border:0;border-radius:6px;" +
      "background:transparent;color:inherit;cursor:pointer;";

    deleteButton.onclick = () => {
      conversations = conversations.filter(
        (chat) => chat.id !== conversation.id
      );

      if (currentConversationId === conversation.id) {
        currentConversationId = null;
        createNewConversation();
        return;
      }

      saveConversations();
      renderChatHistory();
    };

    item.append(openButton, deleteButton);
    list.appendChild(item);
  });
}

function renderMessages() {
  const messages = document.getElementById("chat-messages");
  const welcome = document.getElementById("welcome");

  if (!messages) return;

  messages.innerHTML = "";

  chatHistory.forEach((message) => {
    addMessageToChat(message.role, message.content);
  });

  if (welcome) {
    welcome.style.display = chatHistory.some(
      (message) => message.role === "user"
    ) ? "none" : "block";
  }

  renderChatHistory();
}

function createNewConversation() {
  const conversation = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    title: "New Chat",
    messages: [
      {
        role: "assistant",
        content: "Hi! I'm Nvm Dark AI. How can I help you today?"
      }
    ],
    updatedAt: Date.now()
  };

  conversations.unshift(conversation);
  currentConversationId = conversation.id;
  chatHistory = [...conversation.messages];

  saveConversations();
  renderMessages();
}

function initializeChatHistory() {
  loadConversations();

  const current = getCurrentConversation();

  if (current) {
    chatHistory = [...current.messages];
  } else if (conversations.length > 0) {
    currentConversationId = conversations[0].id;
    chatHistory = [...conversations[0].messages];
  } else {
    createNewConversation();
    return;
  }

  renderMessages();

  const newChatButton = document.getElementById("new-chat-button");

  if (newChatButton) {
    newChatButton.addEventListener("click", () => {
      if (!isProcessing) createNewConversation();
    });
  }

  const historyToggle = document.getElementById("history-toggle");
  const historyList = document.getElementById("chat-history-list");

  if (historyToggle && historyList) {
    historyToggle.addEventListener("click", () => {
      historyList.style.display =
        historyList.style.display === "none" ? "block" : "none";
    });
  }
}

initializeChatHistory();