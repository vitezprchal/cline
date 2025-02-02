import { VSCodeButton, VSCodeTextField, VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react'
import { useExtensionState } from '../../context/ExtensionStateContext'
import { vscode } from '../../utils/vscode'
import { useState } from 'react'
import { QdrantConfiguration } from '../../../../src/shared/QdrantConfiguration'

const defaultQdrantSettings: QdrantConfiguration = {
	qdrantUrl: "",
	collectionName: "code_embeddings",
	qdrantApiKey: "",
	openaiApiKey: ""
}

const VectorDbOptions = () => {
	const { qdrantConfiguration = defaultQdrantSettings, setQdrantConfiguration } = useExtensionState()
	const [isGenerating, setIsGenerating] = useState(false)

	const handleInputChange = (field: any) => (event: any) => {
		const value = event.target?.value ?? ""
		setQdrantConfiguration({
			...qdrantConfiguration,
			[field]: value
		})
		vscode.postMessage({
			type: "qdrantConfiguration",
			qdrantConfiguration: {
				...qdrantConfiguration,
				[field]: value
			}
		})
	}

	const generateEmbeddings = () => {
		setIsGenerating(true)
		vscode.postMessage({
			type: "command",
			command: "cline.generateEmbeddings",
			args: [JSON.stringify(qdrantConfiguration)]
		})
		setIsGenerating(false)
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
				<h3 style={{ margin: 0, fontSize: '1em' }}>Qdrant Configuration</h3>
				<VSCodeTextField
					value={qdrantConfiguration.qdrantUrl}
					style={{ width: "100%" }}
					type="url"
					placeholder={'e.g. "http://localhost:6333"'}
					onInput={handleInputChange('qdrantUrl')}>
					<span style={{ fontWeight: "500" }}>Qdrant API URL</span>
				</VSCodeTextField>

				<VSCodeTextField
					value={qdrantConfiguration.qdrantApiKey}
					style={{ width: "100%" }}
					type="password"
					placeholder={'Optional: Your Qdrant API key'}
					onInput={handleInputChange('qdrantApiKey')}>
					<span style={{ fontWeight: "500" }}>Qdrant API Key (Optional)</span>
				</VSCodeTextField>

				<VSCodeTextField
					value={qdrantConfiguration.collectionName}
					style={{ width: "100%" }}
					placeholder={'e.g. "code_embeddings"'}
					onInput={handleInputChange('collectionName')}>
					<span style={{ fontWeight: "500" }}>Collection Name</span>
				</VSCodeTextField>

				<VSCodeTextField
					value={qdrantConfiguration.openaiApiKey}
					style={{ width: "100%" }}
					type="password"
					placeholder={'Your OpenAI API key'}
					onInput={handleInputChange('openaiApiKey')}>
					<span style={{ fontWeight: "500" }}>OpenAI API Key</span>
				</VSCodeTextField>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
				<VSCodeButton
					onClick={generateEmbeddings}
					style={{ margin: "5px 0 0 0" }}
					appearance="secondary"
					disabled={isGenerating || !qdrantConfiguration.qdrantUrl || !qdrantConfiguration.collectionName || !qdrantConfiguration.openaiApiKey}>
					{isGenerating ? "Generating..." : "Generate embeddings"}
				</VSCodeButton>
				{isGenerating && <VSCodeProgressRing />}
			</div>
		</div>
	)
}

export default VectorDbOptions
