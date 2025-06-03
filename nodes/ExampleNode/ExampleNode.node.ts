import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class ExampleNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Execute UiPath',
		name: 'uiPath',
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
		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Process',
				name: 'process',
				type: 'options',
				typeOptions: {
                    loadOptionsMethod: 'getEntities',
                },
                default: '',
                description: 'Select an entity dynamically'
			},
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let myString: string;

		// Iterates over all input items and add the key "myString" with the
		// value the parameter "myString" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				myString = this.getNodeParameter('myString', itemIndex, '') as string;
				item = items[itemIndex];

				item.json.myString = myString;
			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}

	methods = {
        loadOptions: {
            async getEntities(this: ILoadOptionsFunctions) {
				try {
					const response = await this.helpers.request({
						method: 'GET',
						url: 'https://dummyjson.com/c/c999-4e06-40c7-8da6?folderid=x',
						json: true,
					});

					console.log(response);

                    if (!response || !response.data) {
                        throw new Error('Unexpected API response format');
                    }

                    return response.data.map((entity: any) => ({
                        name: entity.Name,
                        value: entity.Key,
                    }));

				} catch (error) {
                    console.error('Error fetching entities:', error.message);
                    throw new Error('Failed to fetch entities');
                }
            },
        },
    };
}
