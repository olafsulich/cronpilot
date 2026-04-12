import { Button, Link, Text } from "@react-email/components";
import { Layout } from "../components/layout";

export interface AlertResolvedEmailProps {
	monitorName: string;
	teamName: string;
	resolvedAt: Date;
	dashboardUrl: string;
	downDuration: string;
}

export function AlertResolvedEmail({
	monitorName,
	teamName,
	resolvedAt,
	dashboardUrl,
	downDuration,
}: AlertResolvedEmailProps) {
	const campaign = "alert-resolved";
	const dashboardUrlWithUtm = appendUtm(dashboardUrl, campaign);
	const formattedTime = formatDateTime(resolvedAt);

	return (
		<Layout previewText={`Resolved: "${monitorName}" is back to normal`}>
			{/* Success banner */}
			<div style={successBannerStyle}>
				<span style={successIconStyle}>✓</span>
				<span style={successBannerTextStyle}>Monitor Recovered</span>
			</div>

			<Text style={headingStyle}>
				&ldquo;{monitorName}&rdquo; is back to normal
			</Text>

			<Text style={bodyTextStyle}>Hi {teamName} team,</Text>

			<Text style={bodyTextStyle}>
				Great news — your cron job <strong>{monitorName}</strong> has
				successfully checked in and is back to a healthy state. The incident has
				been automatically resolved.
			</Text>

			{/* Details card */}
			<div style={detailsCardStyle}>
				<DetailRow label="Monitor" value={monitorName} />
				<DetailRow label="Recovered at" value={formattedTime} />
				<DetailRow label="Total downtime" value={downDuration} />
				<DetailRow label="Status" value="Healthy" valueColor="#16a34a" />
			</div>

			<Text style={bodyTextStyle}>
				No further action is required. If this issue recurs, consider reviewing
				your job&rsquo;s reliability and adding better error handling or retry
				logic.
			</Text>

			<div style={buttonWrapperStyle}>
				<Button href={dashboardUrlWithUtm} style={buttonStyle}>
					View monitor &rarr;
				</Button>
			</div>

			<Text style={helpTextStyle}>
				You received this notification because you are a member of the{" "}
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

const successBannerStyle: React.CSSProperties = {
	alignItems: "center",
	backgroundColor: "#f0fdf4",
	border: "1px solid #bbf7d0",
	borderRadius: "6px",
	display: "flex",
	gap: "8px",
	marginBottom: "24px",
	padding: "12px 16px",
};

const successIconStyle: React.CSSProperties = {
	alignItems: "center",
	backgroundColor: "#16a34a",
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

const successBannerTextStyle: React.CSSProperties = {
	color: "#14532d",
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

const buttonWrapperStyle: React.CSSProperties = {
	margin: "28px 0",
	textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
	backgroundColor: "#16a34a",
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

AlertResolvedEmail.subject = (props: AlertResolvedEmailProps) =>
	`Your job "${props.monitorName}" is back to normal`;
