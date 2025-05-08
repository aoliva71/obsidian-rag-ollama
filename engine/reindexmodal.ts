import { App, Modal } from 'obsidian';
import Engine from './engine';


class ReIndexModal extends Modal {

	engine: Engine;

	constructor(app: App, engine: Engine) {
		super(app);
		this.engine = engine;
		this.progress = this.progress.bind(this);
	}

	onOpen() {
        const {contentEl} = this;
        contentEl.setText('Indexing documents:');
        contentEl.createEl('br');
        this.engine.start(this.progress);
	}

	onClose() {
		this.engine.stop();
	}

	progress(message: string|null, nl: boolean=true) {
		const {contentEl} = this;
		if(message===null) {
			this.close();
		}
        contentEl.appendText(message!);
		if(nl) {
			contentEl.createEl('br');
		}
	}
}

export default ReIndexModal;
