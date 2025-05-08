import { WorkspaceLeaf, ItemView, MarkdownRenderer } from 'obsidian';
import RagOllamaPlugin from '../main';
import ReIndexModal from 'engine/reindexmodal';
import { ChatResponse } from 'ollama';
import { AnswerCallbackFunction, ChatErrorResponse, ChatReference } from '../engine/engine';

// Define a view type for our chat interface
export const VIEW_TYPE_CHAT = "rag-ollama-chat-view";

// Define a class for our chat view
class ChatView extends ItemView {
	private chatContainer: HTMLElement;
	private inputContainer: HTMLElement;
	private messagesContainer: HTMLElement;
	private plugin: RagOllamaPlugin;
	private content: HTMLDivElement|null = null;
	private spinnerElement: HTMLElement|null = null;
	private currentMessageContent: string = '';
	private references: ChatReference[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: RagOllamaPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.answer = this.answer.bind(this);
	}

	getViewType(): string {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText(): string {
		return "Chat";
	}

	async onOpen() {

		const { contentEl } = this;
		contentEl.empty();

		// Create chat container
		this.chatContainer = contentEl.createEl("div", { cls: "rag-ollama-chat-container" });

		// Create messages container
		this.messagesContainer = this.chatContainer.createEl("div", { cls: "rag-ollama-messages-container" });

		// Create input container at the bottom
		this.inputContainer = this.chatContainer.createEl("div", { cls: "rag-ollama-input-container" });

		// Create textarea for input
		const textarea = this.inputContainer.createEl("textarea", {
			cls: "rag-ollama-input",
			attr: { placeholder: "Ask a question..." }
		});

		// Create send button
		// Create send button with arrow icon
		const sendButton = this.inputContainer.createEl("button", {
			cls: "rag-ollama-send-button"
		});

		// Add arrow icon to send button
		const sendIcon = sendButton.createEl("div", {
			cls: "rag-ollama-send-icon"
		});

		// Handle send button click
		sendButton.addEventListener("click", () => {
			this.handleSendMessage(textarea.value);
			textarea.value = "";
			textarea.focus();
		});

		// Handle enter key to send message
		textarea.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.handleSendMessage(textarea.value);
				textarea.value = "";
			}
		});

		new ReIndexModal(this.app, this.plugin.engine).open();

		// Add some initial message
		this.addMessage("system", "Hello! How can I help you today?");

		// Add the view class to the content element
		contentEl.addClass("rag-ollama-chat-view");
	}

	private async handleSendMessage(message: string) {
		if (!message.trim()) return;

		if(!this.plugin.engine.ready) {
			new ReIndexModal(this.app, this.plugin.engine).open();
		}

		// Add user message to chat
		this.addMessage("user", message);

		try {
			const responseMessageEl = this.addMessage("assistant", '');
			this.content = responseMessageEl;
			this.currentMessageContent = '';

			// Add spinner to the response message
			this.spinnerElement = responseMessageEl.createEl("div", {
				cls: "rag-ollama-spinner"
			});

			await this.plugin.engine.answer(message, this.answer);
		} catch (error) {
				if (this.spinnerElement) {
					this.spinnerElement.remove();
					this.spinnerElement = null;
				}
			this.addMessage("system", `Error: ${error.message}`);
		}
  	}

	private addMessage(role: "user" | "assistant" | "system", content: string) {
		const messageEl = this.messagesContainer.createEl("div", {
			cls: `rag-ollama-message rag-ollama-message-${role}`
		});

		// Add message role indicator
		const roleEl = messageEl.createEl("div", {
			cls: "rag-ollama-message-role",
			text: role.charAt(0).toUpperCase() + role.slice(1) + ":"
		});
		// Add message content
		const contentEl = messageEl.createEl("div", {
			cls: "rag-ollama-message-content"
		});

		// Render the content as markdown if it's not empty
		if (content) {
			this.renderMarkdown(content, contentEl);
		}

		// Scroll to bottom
		this.messagesContainer.scrollTo({
			top: this.messagesContainer.scrollHeight,
			behavior: "smooth"
		});

		return contentEl;
	}

	// Helper method to render markdown content
	private async renderMarkdown(content: string, element: HTMLElement) {
		// Clear the element first
		element.empty();

		// Render markdown content
		await MarkdownRenderer.render(this.app, content, element, '', this.plugin);

		// Add copy buttons to all code blocks
		this.addCodeBlockCopyButtons(element);
}

	// Helper method to add copy buttons to code blocks
	private addCodeBlockCopyButtons(element: HTMLElement) {
		const codeBlocks = element.querySelectorAll('pre > code');

		codeBlocks.forEach((codeBlock) => {
			const pre = codeBlock.parentElement;
			if (!pre) return;

			// Check if copy button already exists
			if (pre.querySelector('.copy-code-button')) return;

			// Create wrapper for the copy button (top-right positioning)
			const buttonWrapper = document.createElement('div');
			buttonWrapper.className = 'copy-code-button-wrapper';
			pre.appendChild(buttonWrapper);

			// Create the copy button
			const copyButton = document.createElement('button');
			copyButton.className = 'copy-code-button';
			copyButton.textContent = 'Copy';
			copyButton.ariaLabel = 'Copy code to clipboard';
			buttonWrapper.appendChild(copyButton);

			// Add click handler
			copyButton.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();

				const code = codeBlock.textContent || '';
				navigator.clipboard.writeText(code)
					.then(() => {
						// Show success state
						const originalText = copyButton.textContent;
						copyButton.textContent = 'Copied!';
						copyButton.classList.add('success');

						setTimeout(() => {
							copyButton.textContent = originalText;
							copyButton.classList.remove('success');
						}, 2000);
					})
					.catch(err => {
						console.error('Failed to copy code:', err);
					});
			});
		});
	}

	async onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	// Explicitly specify the type to match AnswerCallbackFunction
	answer: AnswerCallbackFunction = (response: ChatReference|ChatResponse|ChatErrorResponse|null) => {
		if(response === null) {
			// Remove the spinner when the response is complete
			if (this.spinnerElement) {
				this.spinnerElement.remove();
				this.spinnerElement = null;
			}

			// Finalize rendering the complete message
			if (this.content && this.currentMessageContent) {
				this.renderMarkdown(this.currentMessageContent, this.content);
			}

			if (this.references.length > 0) {
				// Create a references section
				const referencesSection = this.content?.createEl("div", {
					cls: "rag-ollama-references-section"
				});

				const referencesTitle = referencesSection?.createEl("cite", {
					text: "References:"
				});

				const referencesList = referencesSection?.createEl("ul", {
					cls: "rag-ollama-references-list"
				});

				// Add each reference as a list item with a link
				this.references.forEach(ref => {
					const listItem = referencesList?.createEl("li");
					const link = listItem?.createEl("a", {
						text: ref.document,
						attr: {
							href: ref.link,
							"data-href": ref.link,
							class: "internal-link"
						}
					});

					// Make the link work within Obsidian
					link?.addEventListener("click", (event) => {
						event.preventDefault();
						this.app.workspace.openLinkText(ref.link, "", false);
					});
				});
			}

			this.content = null;
			this.currentMessageContent = '';
			this.references = [];
		} else {
			if(response instanceof ChatReference) {
				// Accumulate references
				this.references.push(response as ChatReference);
			} else if(response instanceof ChatErrorResponse) {
				// Remove the spinner after first chunk of text arrives
				if (this.spinnerElement) {
					this.spinnerElement.remove();
					this.spinnerElement = null;
				}

				// Accumulate the message content
				this.currentMessageContent += response.message;

				// Re-render the markdown with updated content
				if (this.content) {
					this.renderMarkdown(this.currentMessageContent, this.content);
				}
			} else {
				const chat: ChatResponse = response as ChatResponse;
				if(chat.message?.content) {
					// Remove the spinner after first chunk of text arrives
					if (this.spinnerElement) {
						this.spinnerElement.remove();
						this.spinnerElement = null;
					}

					// Accumulate the message content
					this.currentMessageContent += chat.message.content;

					// Re-render the markdown with updated content
					if (this.content) {
						this.renderMarkdown(this.currentMessageContent, this.content);
					}
				}
			}
		}

		// Scroll to the bottom after content update
		this.messagesContainer.scrollTo({
			top: this.messagesContainer.scrollHeight,
			behavior: "smooth"
		});
	}
}

export default ChatView;