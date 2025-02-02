import { extractTextFromFile } from './extract-text'
import { listFiles } from '../../services/glob/list-files'
import * as vscode from 'vscode'
import * as path from "path"
import os from "os"
import { QdrantClient } from "@qdrant/qdrant-js"
import OpenAI from "openai"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { extname } from 'path'
import { createHash } from 'crypto'

let qdrantInstance: QdrantClient | null = null
let openaiInstance: OpenAI | null = null

function getOpenAIClient(apiKey: string): OpenAI {
	if (!openaiInstance) {
		openaiInstance = new OpenAI({
			apiKey: apiKey
		})
	}
	return openaiInstance
}

function getQdrantClient(config: QdrantConfig): QdrantClient {
	if (!qdrantInstance) {
		qdrantInstance = new QdrantClient({
			url: config.qdrantUrl,
			apiKey: config.qdrantApiKey || ""
		})
	}
	return qdrantInstance
}

export interface CodeMetadata {
	language?: string
	filename?: string
	author?: string
	contentHash?: string
	lastUpdated?: number
	[key: string]: any
}

export interface CodeChunk {
	id: number
	vector: number[]
	payload: {
		text: string
		chunkIndex: number
		totalChunks: number
	} & CodeMetadata
}

export interface SearchResult {
	text: string
	score: number
	metadata: {
		chunkIndex: number
		totalChunks: number
	} & CodeMetadata
}

interface QdrantConfig {
	qdrantUrl: string
	collectionName: string
	qdrantApiKey?: string
	openaiApiKey: string
}

export interface QdrantSearchConfig {
	embeddingInstance: OpenAI
	instance: QdrantClient
	collectionName: string
}

const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop") // may or may not exist but fs checking existence would immediately ask for permission which would be bad UX, need to come up with a better solution

const VECTOR_SIZE = 1536 // ada-002 embeddings

export async function generateEmbeddings(configStr: string | null): Promise<QdrantSearchConfig | null> {
	try {
		if (!configStr) {
			vscode.window.showErrorMessage('Configuration is required')
			return null
		}

		const config: QdrantConfig = JSON.parse(configStr)

		if (!config.qdrantUrl || !config.collectionName || !config.openaiApiKey) {
			vscode.window.showErrorMessage('Qdrant URL, Collection Name, and OpenAI API Key are required')
			return null
		}

		vscode.window.showInformationMessage(`Starting embeddings generation for collection: ${config.collectionName}`)

		const [files, didHitLimit] = await listFiles(cwd, true)

		if (didHitLimit) {
			vscode.window.showWarningMessage('File limit reached. Some files may be skipped.')
		}

		vscode.window.showInformationMessage(`Found ${files.length} files to process`)

		const qdrant = getQdrantClient(config)

		const collections = await qdrant.getCollections()
		const exists = collections.collections.some(c => c.name === config.collectionName)

		if (!exists) {
			await qdrant.createCollection(config.collectionName, {
				vectors: {
					size: VECTOR_SIZE,
					distance: "Cosine"
				},
				optimizers_config: {
					default_segment_number: 2
				},
				replication_factor: 1
			})

			vscode.window.showInformationMessage(`Collection ${config.collectionName} created successfully`)
		}

		for (const file of files) {
			try {
				const content = await extractTextFromFile(file)
				if (content) {
					const relativePath = file.replace(process.cwd(), '')

					console.log(`Processing file: ${relativePath}`)

					await storeCodeEmbeddings(content, {
						language: getLanguageFromFile(file),
						filename: relativePath,
						filePath: relativePath
					}, config)
				}
			} catch (error) {
				console.error(`Error processing file ${file}:`, error)
				vscode.window.showErrorMessage(`Failed to process file: ${file}`)
			}
		}

		vscode.window.showInformationMessage('Embeddings generation completed successfully!')

		const openai = getOpenAIClient(config.openaiApiKey)
		
		return {
			collectionName: config.collectionName,
			instance: qdrant,
			embeddingInstance: openai
		}
	} catch (error) {
		console.error('Error generating embeddings:', error)
		vscode.window.showErrorMessage('Failed to generate embeddings: ' + (error as Error).message)
	}

	return null
}

export async function generateEmbedding(text: string, openai: OpenAI): Promise<number[]> {
	try {
		const response = await openai.embeddings.create({
			input: text,
			model: "text-embedding-ada-002"
		})
		return response.data[0].embedding
	} catch (error) {
		console.error("Error generating embedding:", error)
		throw error
	}
}

async function generateContentHash(content: string): Promise<string> {
	return createHash('sha256').update(content).digest('hex')
}

async function checkIfContentExists(collectionName: string, filename: string, contentHash: string, config: QdrantConfig): Promise<boolean> {
	try {
		const qdrant = getQdrantClient(config)
		const searchResult = await qdrant.scroll(collectionName, {
			filter: {
				should: [
					{
						key: 'filename',
						match: { value: filename }
					},
					{
						key: 'contentHash',
						match: { value: contentHash }
					}
				]
			},
			limit: 1
		})

		return searchResult.points.length > 0
	} catch (error) {
		console.error("Error checking content existence:", error)
		return false
	}
}

async function storeCodeEmbeddings(code: string, metadata: CodeMetadata = {}, config: QdrantConfig): Promise<void> {
	try {
		const contentHash = await generateContentHash(code)
		const qdrant = getQdrantClient(config)

		if (await checkIfContentExists(config.collectionName, metadata.filename || '', contentHash, config)) {
			console.log(`Content for ${metadata.filename} hasn't changed, skipping reindexing`)
			return
		}

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 1000,
			chunkOverlap: 200
		})

		const chunks = await splitter.splitText(code)

		const points: CodeChunk[] = await Promise.all(
			chunks.map(async (chunk, index) => {
				const openai = getOpenAIClient(config.openaiApiKey)
				const embedding = await generateEmbedding(chunk, openai)
				return {
					id: Date.now() + index,
					vector: embedding,
					payload: {
						text: chunk,
						chunkIndex: index,
						totalChunks: chunks.length,
						contentHash,
						lastUpdated: Date.now(),
						...metadata
					}
				}
			})
		)

		if (metadata.filename) {
			await qdrant.delete(config.collectionName, {
				filter: {
					should: [
						{
							key: 'filename',
							match: { value: metadata.filename }
						}
					]
				}
			})
		}

		await qdrant.upsert(config.collectionName, {
			wait: true,
			points
		})

		console.log(`Stored ${chunks.length} code chunks in Qdrant for file: ${metadata.filename}`)
	} catch (error) {
		console.error("Error storing code embeddings:", error)
		throw error
	}
}

function getLanguageFromFile(filePath: string): string {
	const ext = extname(filePath).toLowerCase()
	switch (ext) {
		case '.ts':
		case '.tsx':
			return 'typescript'
		case '.js':
		case '.jsx':
			return 'javascript'
		default:
			return 'unknown'
	}
}
