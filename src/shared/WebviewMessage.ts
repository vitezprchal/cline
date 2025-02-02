import { ApiConfiguration } from "./api"
import { AutoApprovalSettings } from "./AutoApprovalSettings"
import { BrowserSettings } from "./BrowserSettings"
import { QdrantConfiguration } from "./QdrantConfiguration"

export interface WebviewMessage {
	type:
	| "apiConfiguration"
	| "customInstructions"
	| "webviewDidLaunch"
	| "newTask"
	| "askResponse"
	| "clearTask"
	| "didShowAnnouncement"
	| "selectImages"
	| "exportCurrentTask"
	| "showTaskWithId"
	| "deleteTaskWithId"
	| "exportTaskWithId"
	| "resetState"
	| "requestOllamaModels"
	| "requestLmStudioModels"
	| "openImage"
	| "openFile"
	| "openMention"
	| "cancelTask"
	| "refreshOpenRouterModels"
	| "openMcpSettings"
	| "restartMcpServer"
	| "autoApprovalSettings"
	| "browserSettings"
	| "checkpointDiff"
	| "checkpointRestore"
	| "taskCompletionViewChanges"
	| "generateEmbeddings"
	| "qdrantConfiguration"
	| "command"
	text?: string
	command?: string
	args?: any[]
	askResponse?: ClineAskResponse
	apiConfiguration?: ApiConfiguration
	qdrantConfiguration?: QdrantConfiguration
	images?: string[]
	bool?: boolean
	number?: number
	autoApprovalSettings?: AutoApprovalSettings
	browserSettings?: BrowserSettings
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"

export type ClineCheckpointRestore = "task" | "workspace" | "taskAndWorkspace"
