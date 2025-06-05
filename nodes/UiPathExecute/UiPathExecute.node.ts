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

interface JSONSchema {
	type: string;
	properties: {
		[key: string]: {
			type: string;
			title?: string;
			default?: any;
		};
	};
	required?: string[];
}

function getDefaultsFromSchema(schema: JSONSchema): string {
	const result: Record<string, any> = {};

	for (const [key, prop] of Object.entries(schema.properties)) {
		if ('default' in prop) {
			result[key] = prop.default;
		}
	}

	return JSON.stringify(result, null, 2);
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
			{
				displayName: 'Entry Point Name', // eslint-disable-line
				name: 'entryPoint',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getEntryPoints',
					loadOptionsDependsOn: ['process'],
				},
				default: '',
				description: 'The entry point of the process. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					hide: {
						process: [''],
						folder: [''],
					},
				},
			},
			{
				displayName: 'Input arguments', // eslint-disable-line
				name: 'inputArguments',
				type: 'options',
				default: '',
				description: 'Input arguments for the process. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getInputArguments',
					loadOptionsDependsOn: ['entryPoint'],
				},
				displayOptions: {
					hide: {
						process: [''],
						folder: [''],
						entryPoint: [''],
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
		const inputArguments = this.getNodeParameter('inputArguments', 0) as string;
		const rawProcessInfo = this.getNodeParameter('process', 0) as string;
		const processInfo = JSON.parse(rawProcessInfo);

		const service = new UiPathService(credentials, this.helpers, this.getNode());

		const startJobRequestBody = {
			startInfo: {
				JobsCount: 1,
				ReleaseKey: processInfo.key,
				InputArguments: inputArguments
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
			async getEntryPoints(this: ILoadOptionsFunctions) {
				try {
					const credentials = await this.getCredentials('uipathApi') as UiPathCredentials;
					const rawProcessInfo = this.getNodeParameter('process', 0) as string;
					const processInfo = JSON.parse(rawProcessInfo);
					const folderId = this.getNodeParameter('folder') as string;
					const service = new UiPathService(credentials, this.helpers, this.getNode());

					return await service.getEntryPoints(processInfo, folderId);
				} catch (error) {
					console.error('Error fetching entry points:', error.message);
					throw new NodeApiError(this.getNode(), { message: 'Failed to fetch entry points' });
				}
			},
			async getInputArguments(this: ILoadOptionsFunctions) {
				try {
					const credentials = await this.getCredentials('uipathApi') as UiPathCredentials;
					const entryPointUniqueId = this.getNodeParameter('entryPoint', 0) as string;
					const rawProcessInfo = this.getNodeParameter('process', 0) as string;
					const processInfo = JSON.parse(rawProcessInfo);
					const folderId = this.getNodeParameter('folder') as string;
					const service = new UiPathService(credentials, this.helpers, this.getNode());

					const inputArguments = await service.getEntryPointInputArguments(processInfo, folderId, entryPointUniqueId);
					const schema = JSON.parse(inputArguments) as JSONSchema;
					const defaults = getDefaultsFromSchema(schema);

					const options = [{
						name: 'Default Arguments',
						value: defaults
					}];

					return options;
					
				} catch (error) {
					console.error('Error fetching input arguments:', error.message);
					throw new NodeApiError(this.getNode(), { message: 'Failed to fetch input arguments' });
				}
			}
		},
	};
}
