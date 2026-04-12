export type IntegrationType = "slack" | "pagerduty" | "webhook" | "email";

export interface SlackConfig {
	webhookUrl: string;
	channel: string;
}

export interface PagerDutyConfig {
	integrationKey: string;
}

export interface WebhookConfig {
	url: string;
	secret: string;
}

export interface EmailConfig {
	address: string;
}

export type IntegrationConfig =
	| SlackConfig
	| PagerDutyConfig
	| WebhookConfig
	| EmailConfig;

export interface Integration {
	id: string;
	teamId: string;
	type: IntegrationType;
	name: string;
	config: IntegrationConfig;
	createdAt: Date;
}

export interface AlertRule {
	id: string;
	monitorId: string;
	integrationId: string;
	notifyAfter: number;
}
