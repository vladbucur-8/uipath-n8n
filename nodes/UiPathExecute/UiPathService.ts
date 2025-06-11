import { ILoadOptionsFunctions, NodeApiError, IHttpRequestMethods, INode } from 'n8n-workflow';


interface UiPathCredentials {
    organization: string;
    tenant: string;
    patToken: string;
}

export class UiPathService {
    private baseUrl: string;
    private headers: Record<string, string>;
    private helpers: ILoadOptionsFunctions['helpers'];
    private node: INode;

    constructor(credentials: UiPathCredentials, helpers: ILoadOptionsFunctions['helpers'], node: INode) {
        this.baseUrl = `https://staging.uipath.com/${credentials.organization}/${credentials.tenant}/orchestrator_`;
        this.headers = {
            Authorization: `Bearer ${credentials.patToken}`,
        };
        this.helpers = helpers;
        this.node = node;
    }

    private async makeRequest(method: IHttpRequestMethods, url: string, customRequestHeaders: Record<string, string> | null = null, body: object | null = null) {
        const response = await this.helpers.request({
            method,
            url: `${this.baseUrl}${url}`,
            body: body,
            json: true,
            headers: customRequestHeaders == null ? this.headers : { ...this.headers, ...customRequestHeaders }
        });

        if (!response) {
            throw new NodeApiError(this.node, { message: 'Unexpected API response format' });
        }

        return response;
    }

    async getProcesses(folderId: string) {
        try {
            const response = await this.makeRequest('GET', `/odata/Releases?$filter=OrganizationUnitId eq ${folderId}`);
            return response.value.map((entity: any) => ({
                name: entity.Name,
                value: JSON.stringify({
		            key: entity.Key,
                    processKey: entity.ProcessKey,
                    version: entity.ProcessVersion
                })
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
                '/odata/Folders'
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

    async startJobAndWaitForFinalState(folderId: string, body: object) {

        let maxRetries = 20;
        let attempt = 0;
        let requestHeaders: Record<string, string> = {
            'X-UIPATH-OrganizationUnitId': `${folderId}`
        }

        try {
            const startJobResponse = await this.makeRequest(
                'POST',
                '/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs',
                requestHeaders,
                body
            )

            const jobId = startJobResponse.value[0].Id;

            while (attempt < maxRetries) {
                let getJobResponse = await this.makeRequest(
                    'GET',
                    `/odata/Jobs(${jobId})`,
                    requestHeaders
                )

                if (getJobResponse.State == 'Successful') {
                    return getJobResponse.OutputArguments;
                }

                if(getJobResponse.State == 'Faulted') {
                    throw new NodeApiError(this.node, { message: 'Orchestrator job faulted' });
                }

                await new Promise(resolve => setTimeout(resolve, 5000));
                ++attempt;
            }

            // Job wasn't successful so throw an error to fail the node
            throw new NodeApiError(this.node, { message: 'Orchestrator job failed to complete' });
        }
        catch (error) {
            console.error('Error starting job:', error.message);
            throw new NodeApiError(this.node, { message: 'Failed to start Orchestrator job' });
        }
    }

    async getEntryPoints(processInfo: { key: string, processKey: string, version: string }, folderId: string) {
        try {
            const requestHeaders: Record<string, string> = {
                'X-UIPATH-OrganizationUnitId': `${folderId}`
            };
            const response = await this.makeRequest(
                'GET',
                `/odata/Processes/UiPath.Server.Configuration.OData.GetPackageEntryPointsV2(key='${processInfo.processKey}:${processInfo.version}')`,
                requestHeaders
            );

            return response.value.map((entity: any) => ({
                name: entity.Path,
                value: entity.UniqueId,
            }));
        } catch (error) {
            console.error('Error fetching entry points:', error.message);
            throw new NodeApiError(this.node, { message: 'Failed to fetch entry points' });
        }
    }

    async getEntryPointInputArguments(processInfo: { key: string, processKey: string, version: string }, folderId: string, entryPointUniqueId: string) {
        try {
            const requestHeaders: Record<string, string> = {
                'X-UIPATH-OrganizationUnitId': `${folderId}`
            };
            const response = await this.makeRequest(
                'GET',
                `/odata/Processes/UiPath.Server.Configuration.OData.GetPackageEntryPointsV2(key='${processInfo.processKey}:${processInfo.version}')`,
                requestHeaders
            );

            const entryPoint = response.value.find((entity: any) => entity.UniqueId === entryPointUniqueId);

            if (!entryPoint) {
                throw new NodeApiError(this.node, { message: 'Entry point not found' });
            }

            return entryPoint.InputArguments || '{}';
        } catch (error) {
            console.error('Error fetching entry point input arguments:', error.message);
            throw new NodeApiError(this.node, { message: 'Failed to fetch entry point input arguments' });
        }
    }
}
