import { Button, Link, Text } from "@react-email/components";
import { Layout } from "../components/layout";

export interface AlertFailedEmailProps {
	monitorName: string;
	teamName: string;
	failedAt: Date;
	dashboardUrl: string;
	exitCode?: number;
}

export function AlertFailedEmail({
	monitorName,
	teamName,
	failedAt,
	dashboardUrl,
	exitCode,
}: AlertFailedEmailProps) {
	const campaign = "alert-failed";
	const dashboardUrlWithUtm = appendUtm(dashboardUrl, campaign);
	const formattedTime = formatDateTime(failedAt);

	return (
		<Layout previewText={`Alert: "${monitorName}" reported a failure`}>
			{/* Alert banner */}
			<div style={alertBannerStyle}>
				<span style={alertIconStyle}>✕</span>
				<span style={alertBannerTextStyle}>Job Failed</span>
			</div>

			<Text style={headingStyle}>
				&ldquo;{monitorName}&rdquo; reported a failure
			</Text>

			<Text style={bodyTextStyle}>Hi {teamName} team,</Text>

			<Text style={bodyTextStyle}>
				Your cron job <strong>{monitorName}</strong> completed but reported an
				explicit failure by sending a non-zero exit code to Cronpilot.
				{exitCode !== undefined
					? ` The job exited with code ${exitCode}.`
					: " No exit code details were provided."}
			</Text>

			{/* Details card */}
			<div style={detailsCardStyle}>
				<DetailRow label="Monitor" value={monitorName} />
				<DetailRow label="Failed at" value={formattedTime} />
				{exitCode !== undefined && (
					<DetailRow
						label="Exit code"
						value={String(exitCode)}
						valueColor="#dc2626"
					/>
				)}
				<DetailRow label="Status" value="Failed" valueColor="#dc2626" />
			</div>

			<Text style={bodyTextStyle}>
				A non-zero exit code typically indicates that your job encountered an
				error during execution. Review your job&rsquo;s logs to identify the
				root cause. Common causes include:
			</Text>

			<ul style={listStyle}>
				<li style={listItemStyle}>
					Uncaught exceptions or unhandled errors in your script
				</li>
				<li style={listItemStyle}>
					External dependency failures (database, API, filesystem)
				</li>
				<li style={listItemStyle}>Insufficient permissions or disk space</li>
				<li style={listItemStyle}>
					Explicit failure signaling (e.g.,{" "}
					<code style={codeStyle}>sys.exit(1)</code> in Python,{" "}
					<code style={codeStyle}>process.exit(1)</code> in Node.js)
				</li>
			</ul>

			<div style={buttonWrapperStyle}>
				<Button href={dashboardUrlWithUtm} style={buttonStyle}>
					View monitor &rarr;
				</Button>
			</div>

			<Text style={helpTextStyle}>
				You received this alert because you are a member of the{" "}
				<strong>{teamName}</strong> team on Cronpilot. Manage your alert
				preferences in{" "}
				<Link
					href={`https://cronpilot.io/settings/alerts?utm_source=email&utm_campaign=${campaign}`}
					style={linkStyle}
				>
					notification settings
				</Link>
				.
			</Text>
		</Layout>
	);
}

interface DetailRowProps {
	label: string;
	value: string;
	valueColor?: string;
}

function DetailRow({ label, value, valueColor }: DetailRowProps) {
	return (
		<div style={detailRowStyle}>
			<span style={detailLabelStyle}>{label}</span>
			<span style={{ ...detailValueStyle, color: valueColor ?? "#1e293b" }}>
				{value}
			</span>
		</div>
	);
}

function appendUtm(url: string, campaign: string): string {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}utm_source=email&utm_campaign=${campaign}`;
}

function formatDateTime(date: Date): string {
	return date.toLocaleString("en-US", {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "long",
		timeZone: "UTC",
		timeZoneName: "short",
		year: "numeric",
	});
}

const alertBannerStyle: React.CSSProperties = {
	alignItems: "center",
	backgroundColor: "#fef2f2",
	border: "1px solid #fecaca",
	borderRadius: "6px",
	display: "flex",
	gap: "8px",
	marginBottom: "24px",
	padding: "12px 16px",
};

const alertIconStyle: React.CSSProperties = {
	alignItems: "center",
	backgroundColor: "#dc2626",
	borderRadius: "50%",
	color: "#ffffff",
	display: "inline-flex",
	fontSize: "12px",
	fontWeight: "700",
	height: "20px",
	justifyContent: "center",
	lineHeight: "1",
	width: "20px",
};

const alertBannerTextStyle: React.CSSProperties = {
	color: "#991b1b",
	fontSize: "14px",
	fontWeight: "600",
};

const headingStyle: React.CSSProperties = {
	color: "#0f172a",
	fontSize: "24px",
	fontWeight: "700",
	letterSpacing: "-0.3px",
	lineHeight: "32px",
	margin: "0 0 20px",
};

const bodyTextStyle: React.CSSProperties = {
	color: "#475569",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 16px",
};

const detailsCardStyle: React.CSSProperties = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "8px",
	margin: "24px 0",
	padding: "16px 20px",
};

const detailRowStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	padding: "6px 0",
};

const detailLabelStyle: React.CSSProperties = {
	color: "#64748b",
	fontSize: "13px",
	fontWeight: "500",
};

const detailValueStyle: React.CSSProperties = {
	color: "#1e293b",
	fontSize: "13px",
	fontWeight: "600",
};

const listStyle: React.CSSProperties = {
	color: "#475569",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "0 0 24px",
	paddingLeft: "20px",
};

const listItemStyle: React.CSSProperties = {
	marginBottom: "8px",
};

const codeStyle: React.CSSProperties = {
	backgroundColor: "#f1f5f9",
	borderRadius: "3px",
	fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
	fontSize: "13px",
	padding: "1px 5px",
};

const buttonWrapperStyle: React.CSSProperties = {
	margin: "28px 0",
	textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
	backgroundColor: "#dc2626",
	borderRadius: "6px",
	color: "#ffffff",
	display: "inline-block",
	fontSize: "15px",
	fontWeight: "600",
	padding: "12px 28px",
	textDecoration: "none",
};

const helpTextStyle: React.CSSProperties = {
	color: "#94a3b8",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "0",
};

const linkStyle: React.CSSProperties = {
	color: "#3b82f6",
	textDecoration: "underline",
};

AlertFailedEmail.subject = (props: AlertFailedEmailProps) =>
	`Your job "${props.monitorName}" reported a failure`;
