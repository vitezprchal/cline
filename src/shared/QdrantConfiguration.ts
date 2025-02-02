export interface QdrantConfiguration {
	qdrantUrl: string
	collectionName: string
	qdrantApiKey?: string
	openaiApiKey: string
}

export const DEFAULT_QDRANT_SETTINGS: QdrantConfiguration = {
	qdrantUrl: "",
	collectionName: "code_embeddings",
	qdrantApiKey: "",
	openaiApiKey: ""
} 