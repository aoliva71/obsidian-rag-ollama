import { App, PluginSettingTab, Setting } from 'obsidian';
import RagOllamaPlugin from '../main';


export const DEFAULT_OLLAMA_URL: string = 'http://localhost:11434';
export const DEFAULT_EMBEDDINGS_MODEL: string = "nomic-embed-text";
export const DEFAULT_CHAT_MODEL: string = "llama3.2:3b";
export const DEFAULT_CHUNK_SIZE: number = 500;
export const DEFAULT_CHUNK_OVERLAP: number = 50;
export const DEFAULT_KNN: number = 3;

export interface RagOllamaPluginSettings {
	ollamaURL: string;
	embeddingsModel: string;
	chatModel: string;
	chunkSize: number;
	chunkOverlap: number;
	knn: number;
}

export const DEFAULT_SETTINGS: RagOllamaPluginSettings = {
	ollamaURL: DEFAULT_OLLAMA_URL,
	embeddingsModel: DEFAULT_EMBEDDINGS_MODEL,
	chatModel: DEFAULT_CHAT_MODEL,
	chunkSize: DEFAULT_CHUNK_SIZE,
	chunkOverlap: DEFAULT_CHUNK_OVERLAP,
	knn: DEFAULT_KNN
}

class RagOllamaSettingTab extends PluginSettingTab {
	plugin: RagOllamaPlugin;

	constructor(app: App, plugin: RagOllamaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Ollama URL')
			.setDesc('URL to instance of ollama')
			.addText(text => text
				.setPlaceholder(DEFAULT_OLLAMA_URL)
				.setValue(this.plugin.settings.ollamaURL)
				.onChange(async (value) => {
					this.plugin.settings.ollamaURL = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Embeddings model')
			.setDesc('(Must be installed in Ollama)')
			.addText(text => text
				.setPlaceholder(DEFAULT_EMBEDDINGS_MODEL)
				.setValue(this.plugin.settings.embeddingsModel)
				.onChange(async (value) => {
					this.plugin.settings.embeddingsModel = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Chat model')
			.setDesc('(Must be installed in Ollama)')
			.addText(text => text
				.setPlaceholder(DEFAULT_CHAT_MODEL)
				.setValue(this.plugin.settings.chatModel)
				.onChange(async (value) => {
					this.plugin.settings.chatModel = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Chunk size')
			.setDesc('Size of text chunks for embeddings')
			.addText(text => text
				.setPlaceholder(DEFAULT_CHUNK_SIZE.toString())
				.setValue(this.plugin.settings.chunkSize.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					this.plugin.settings.chunkSize = isNaN(numValue) ? DEFAULT_CHUNK_SIZE : numValue;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Chunk overlap')
			.setDesc('Overlap between consecutive chunks')
			.addText(text => text
				.setPlaceholder(DEFAULT_CHUNK_OVERLAP.toString())
				.setValue(this.plugin.settings.chunkOverlap.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					this.plugin.settings.chunkOverlap = isNaN(numValue) ? DEFAULT_CHUNK_OVERLAP : numValue;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('K-NN')
			.setDesc('Nearest neighbours')
			.addText(text => text
				.setPlaceholder(DEFAULT_KNN.toString())
				.setValue(this.plugin.settings.knn.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					this.plugin.settings.knn = isNaN(numValue) ? DEFAULT_CHUNK_OVERLAP : numValue;
					await this.plugin.saveSettings();
				}));
	}
}

export default RagOllamaSettingTab;