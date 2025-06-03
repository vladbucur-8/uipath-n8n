import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError, NodeConnectionType } from 'n8n-workflow';
import axios, { RawAxiosRequestHeaders } from 'axios';

interface UiPathCredentials {
	organization: string;
	tenant: string;
	patToken: string;
}

export class UiPathReleases implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'UiPath Releases',
		name: 'uipathReleases',
        icon: { light: 'file:uipath-vector-logo.svg', dark: 'file:uipath-vector-logo.svg' },
		group: ['transform'],
		version: 1,
		description: 'List UiPath releases using PAT authentication',
		defaults: {
			name: 'UiPath Releases',
		},
		inputs: [{ type: NodeConnectionType.Main }],
		outputs: [{ type: NodeConnectionType.Main }],
		credentials: [
			{
				name: 'uipathApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Process Key',
						name: 'processKey',
						type: 'string',
						default: '',
						description: 'Filter releases by process key',
					},
					{
						displayName: 'Top',
						name: 'top',
						type: 'number',
						default: 50,
						description: 'Number of releases to return',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const credentials = await this.getCredentials('uipathApi') as UiPathCredentials;
				const additionalFields = this.getNodeParameter('additionalFields', itemIndex) as {
					processKey?: string;
					top?: number;
				};

				const baseUrl = `https://alpha.uipath.com/${credentials.organization}/${credentials.tenant}/orchestrator_`;
				const headers: RawAxiosRequestHeaders = {
					'X-UIPATH-TenantName': credentials.tenant,
					'Authorization': `Bearer ${credentials.patToken}`,
					'Content-Type': 'application/json',
				};

				// Build query parameters
				const queryParams = new URLSearchParams();
				if (additionalFields.processKey) {
					queryParams.append('$filter', `ProcessKey eq '${additionalFields.processKey}'`);
				}
				if (additionalFields.top) {
					queryParams.append('$top', additionalFields.top.toString());
				}

				const response = await axios.get(
					`${baseUrl}/odata/Releases?${queryParams.toString()}`,
					{ headers }
				);

				returnData.push({
					json: response.data,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: this.getInputData(itemIndex)[0].json,
						error,
						pairedItem: itemIndex,
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
