import { ILoadOptionsFunctions, NodeApiError, IHttpRequestMethods, INode } from 'n8n-workflow';

interface UiPathCredentials {
	organization: string;
	tenant: string;
	patToken: string;
}

export class UiPathService {
	private baseUrl: string;
	private headers: { Authorization: string };
	private helpers: ILoadOptionsFunctions['helpers'];
	private node: INode;

	constructor(credentials: UiPathCredentials, helpers: ILoadOptionsFunctions['helpers'], node: INode) {
		this.baseUrl = `https://alpha.uipath.com/${credentials.organization}/${credentials.tenant}/orchestrator_`;
		this.headers = {
			Authorization: `Bearer ${credentials.patToken}`,
		};
		this.helpers = helpers;
		this.node = node;
	}

	private async makeRequest(method: IHttpRequestMethods, url: string) {
		const response = await this.helpers.request({
			method,
			url: `${this.baseUrl}${url}`,
			json: true,
			headers: this.headers,
		});

		if (!response || !response.value) {
			throw new NodeApiError(this.node, { message: 'Unexpected API response format' });
		}

		return response;
	}

	async getProcesses(folderId: string) {
		try {
			const response = await this.makeRequest('GET', `/odata/Releases?$filter=OrganizationUnitId eq ${folderId}`);
			return response.value.map((entity: any) => ({
				name: entity.Name,
				value: entity.Key,
			}));
		} catch (error) {
			console.error('Error fetching processes:', error.message);
			throw new NodeApiError(this.node, { message: 'Failed to fetch processes' });
		}
	}

	async getFolders() {
		try {
			const response = await this.makeRequest(
				'GET',
				'/odata/Folders/UiPath.Server.Configuration.OData.GetFoldersPage(skip=0,take=100,expandedParentIds=[])'
			);
			return response.value.map((entity: any) => ({
				name: entity.FullyQualifiedName,
				value: entity.Id,
			}));
		} catch (error) {
			console.error('Error fetching folders:', error.message);
			throw new NodeApiError(this.node, { message: 'Failed to fetch folders' });
		}
	}
}
