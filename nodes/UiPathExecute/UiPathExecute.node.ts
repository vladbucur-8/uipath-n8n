import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeApiError } from 'n8n-workflow';
import { UiPathService } from './UiPathService';

interface UiPathCredentials {
	organization: string;
	tenant: string;
	patToken: string;
}

export class UiPathExecute implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Execute UiPath',
		name: 'uiPathExecute',
		group: ['transform'],
		version: 1,
		description: 'Executes a UiPath process and waits for output',
		defaults: {
			name: 'Execute UiPath Process',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		icon: 'file:UiPath-Logo.svg',
		usableAsTool: true,
		credentials: [
			{
				name: 'uipathApi',
				required: true,
			}],
		properties: [
			{
				displayName: 'Folder', // eslint-disable-line
				name: 'folder',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getFolders',
				},
				default: '',
				description: 'The folder context of the process' // eslint-disable-line
			},
			{
				displayName: 'Process', // eslint-disable-line
				name: 'process',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getProcesses',
					loadOptionsDependsOn: ['folder'],
				},
				default: '',
				description: 'The process you want to execute', // eslint-disable-line
				displayOptions: {
					hide: {
						folder: [''],
					},
				},
			},
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

		const credentials = await this.getCredentials('uipathApi') as UiPathCredentials;
		const folderId = this.getNodeParameter('folder', 0) as string;
		const releaseKey = this.getNodeParameter('process', 0) as string;
		const service = new UiPathService(credentials, this.helpers, this.getNode());

		const startJobRequestBody =
		{
			startInfo:
			{
				JobsCount: 1,
				ReleaseKey: `${releaseKey}`
			}
		}

		return this.prepareOutputData([{ json: await service.startJobAndWaitForFinalState(folderId, startJobRequestBody) }]);
	}

	methods = {
		loadOptions: {
			async getProcesses(this: ILoadOptionsFunctions) {
				try {
					const credentials = await this.getCredentials('uipathApi') as UiPathCredentials;
					const folderId = this.getNodeParameter('folder') as string;
					const service = new UiPathService(credentials, this.helpers, this.getNode());
					return await service.getProcesses(folderId);
				} catch (error) {
					console.error('Error fetching processes:', error.message);
					throw new NodeApiError(this.getNode(), { message: 'Failed to fetch processes' });
				}
			},
			async getFolders(this: ILoadOptionsFunctions) {
				try {
					const credentials = await this.getCredentials('uipathApi') as UiPathCredentials;
					const service = new UiPathService(credentials, this.helpers, this.getNode());
					return await service.getFolders();
				} catch (error) {
					console.error('Error fetching folders:', error.message);
					throw new NodeApiError(this.getNode(), { message: 'Failed to fetch folders' });
				}
			},
		},
	};
}
