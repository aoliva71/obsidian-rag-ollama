import { App, TFile, TFolder, Notice } from 'obsidian';
import { OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatResponse, Ollama } from 'ollama';
import { DEFAULT_OLLAMA_URL, DEFAULT_EMBEDDINGS_MODEL, RagOllamaPluginSettings, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP, DEFAULT_KNN } from 'settings/settings';
import { DocumentInterface } from '@langchain/core/documents';



export type ReIndexProgressCallbackFunction = (message: string|null, nl: boolean) => void;
export class ChatReference {
    index: number;
    document: string;
    link: string;
    score: number;
    constructor(index: number, document: string, link: string, score: number) {
        this.index = index;
        this.document = document;
        this.link = link;
        this.score = score;
    }
};
export class ChatErrorResponse {
    message: string
    constructor(message: string) {
        this.message = message;
    }
};
export type AnswerCallbackFunction = (response: ChatReference|ChatResponse|ChatErrorResponse|null) => void;


class Engine {

    app: App;
	contentDir: TFolder;
    ollama: Ollama;
    chatModel: string;

	testSplitter: RecursiveCharacterTextSplitter;
    vectorStore: MemoryVectorStore;
    knn: number;
    ready: boolean;
    references: Set<string>;

	constructor(app: App, settings: RagOllamaPluginSettings) {
        this.app = app;
		this.contentDir = app.vault.getRoot();
        const embeddingsModel: OllamaEmbeddings = new OllamaEmbeddings({
            model: settings.embeddingsModel || DEFAULT_EMBEDDINGS_MODEL,
            baseUrl: settings.ollamaURL || DEFAULT_OLLAMA_URL
        });
        this.ollama = new Ollama({host: settings.ollamaURL || DEFAULT_OLLAMA_URL});
        this.chatModel = settings.chatModel;
        this.testSplitter = new RecursiveCharacterTextSplitter({
            "chunkSize": settings.chunkSize|DEFAULT_CHUNK_SIZE,
            "chunkOverlap": settings.chunkOverlap|DEFAULT_CHUNK_OVERLAP
        });
        this.vectorStore = new MemoryVectorStore(embeddingsModel);
        this.knn = settings.knn||DEFAULT_KNN;
        this.ready = false;
        this.references = new Set<string>();
	}

	start(progress: ReIndexProgressCallbackFunction) {
		setTimeout(() => {
			this.reindex(progress).catch(error => {
				new Notice(`indexing failed: ${error.message}`);
			});
		}, 100);
	}

	stop() {
		
	}

	async reindex(callback: ReIndexProgressCallbackFunction) {

        try {
            await this.walkFolder(this.contentDir!, callback);
            callback(null, true)
            this.ready = true;
        } catch(error) {
            callback('Error:', true)
            callback(error, true)
        }
    }

	private async walkFolder(folder: TFolder, callback: ReIndexProgressCallbackFunction) {
		// Get all files in the current folder
		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === 'md') {
                callback(' + ', false)
                callback(file.basename, false)
                callback('... ', false)
                try {
                    // Read the file content
                    const content = await this.app.vault.read(file);

                    // Skip empty files
                    if (!content.trim()) {
                        callback('empty', true)
                        continue;
		            }

                    // Split the content into chunks
                    const docs = await this.testSplitter.createDocuments(
                        [content],
                        [{ name: file.basename, path: file.path }]
                    );

                    this.vectorStore.addDocuments(docs);
                    callback('ok', true)
                } catch (error) {
                    callback('error', true)
                }
			} else if (file instanceof TFolder) {
				// Recursively walk through subfolders
				await this.walkFolder(file, callback);
            }
		}
	}

    async answer(query: string, callback: AnswerCallbackFunction) {

        this.references.clear();
        try {
            // Retrieve relevant documents using similarity search
            const searchResult = await this.vectorStore.similaritySearchWithScore(query, this.knn);

            const threshold = this.dynamicThreshold(searchResult);
            // Format the context from the retrieved documents
            let context = "";
            searchResult.forEach((result, index) => {
                const doc: DocumentInterface = result[0];
                const score: number = result[1];
                const metadata = doc.metadata as { name?: string, path?: string };
                const path = metadata.path || 'Unknown';
                const name = metadata.name || 'Unnamed';
                context += `(${path}) (${name}):\n${doc.pageContent}\n\n`;
                if((this.references.has(path) == false) && (score >= threshold)) {
                    callback(new ChatReference(index, name, path, score));
                    this.references.add(path);
                }
            });

            // Create the prompt with both context and query
            const prompt = `
You are a helpful assistant that answers questions based on the provided context.

CONTEXT:
${context}

USER QUESTION: ${query}

Please provide a concise and accurate answer based only on the information in the context. If the context doesn't contain relevant information, acknowledge that you don't have enough information to answer.
`;

            // Send streaming request to Ollama
            const stream = await this.ollama.chat({
                model: this.chatModel,
                messages: [
                    { role: "system", content: "You are a helpful assistant that answers questions based on the provided documents." },
                    { role: "user", content: prompt }
                ],
                stream: true
            });

            // Process the stream
            for await (const chunk of stream) {
                callback(chunk);
            }

        } catch (error) {
            callback(new ChatErrorResponse(`Error generating answer: ${error.message}`));
        }

        // Signal that the stream is complete
        callback(null);
    }

    private dynamicThreshold(results: [DocumentInterface, number][]): number {

        // Extract scores
        const scores = results.map(r => r[1]);

        // Calculate mean and standard deviation
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const stdDev = Math.sqrt(
            scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
        );

        const threshold = mean - (1.5 * stdDev);

        return threshold;
    }
}

export default Engine;
