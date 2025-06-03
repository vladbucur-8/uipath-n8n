import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class UiPathApi implements ICredentialType {
	name = 'uipathApi';
	displayName = 'UiPath API';
	documentationUrl = 'https://docs.uipath.com/orchestrator/reference/authentication';
	properties: INodeProperties[] = [
		{
			displayName: 'Organization',
			name: 'organization',
			type: 'string',
			default: '',
			required: true,
			description: 'Your UiPath organization name',
		},
		{
			displayName: 'Tenant',
			name: 'tenant',
			type: 'string',
			default: '',
			required: true,
			description: 'Your UiPath tenant name',
		},
		{
			displayName: 'PAT Token',
			name: 'patToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Your UiPath PAT token',
		},
	];
}
