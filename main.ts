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

		this.registerView(
			VIEW_TYPE_CHAT,
			(leaf) => new ChatView(leaf, this)
		);

		const ribbonIconEl = this.addRibbonIcon('message-square', 'RAG Ollama Plugin', async (evt: MouseEvent) => {
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_CHAT,
				active: true,
			});
		});

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

		this.addSettingTab(new RagOllamaSettingsTab(this.app, this));
	}

	onunload() {
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
