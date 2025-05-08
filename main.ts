import { Plugin } from 'obsidian';

import ReIndexModal from 'engine/reindexmodal';
import ChatView, { VIEW_TYPE_CHAT } from './view/chat';
import RagOllamaSettingsTab, { DEFAULT_SETTINGS, RagOllamaPluginSettings } from './settings/settings';
import Engine from 'engine/engine';


export default class RagOllamaPlugin extends Plugin {
	settings: RagOllamaPluginSettings;
	engine: Engine;

	async onload() {
		await this.loadSettings();

		this.engine = new Engine(this.app, this.settings);

		// Register the chat view
		this.registerView(
			VIEW_TYPE_CHAT,
			(leaf) => new ChatView(leaf, this)
		);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('message-square', 'RAG Ollama Plugin', async (evt: MouseEvent) => {
			// Open a new tab with the chat view
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_CHAT,
				active: true,
			});
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('rag-ollama-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addCommand({
			id: 'run-rag-ollama-reindex',
			name: 're-index vault content',
			callback: () => {
				new ReIndexModal(this.app, this.engine).open();
			}
		});

		this.addCommand({
			id: 'open-rag-ollama-chat',
			name: 'chat with vault content',
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_CHAT,
					active: true,
				});
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RagOllamaSettingsTab(this.app, this));
	}

	onunload() {
		// Unregister the view
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.engine = new Engine(this.app, this.settings);
	}
}
