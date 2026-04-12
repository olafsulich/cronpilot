import { Button, Text } from "@react-email/components";
import { Layout } from "../components/layout";
import { MonitorStatus } from "../components/monitor-status";

export interface DigestEmailProps {
	teamName: string;
	weekStart: Date;
	weekEnd: Date;
	monitors: Array<{
		name: string;
		status: "healthy" | "late" | "down" | "paused";
		uptime: number;
		incidents: number;
	}>;
	totalIncidents: number;
	dashboardUrl: string;
}

export function DigestEmail({
	teamName,
	weekStart,
	weekEnd,
	monitors,
	totalIncidents,
	dashboardUrl,
}: DigestEmailProps) {
	const campaign = "weekly-digest";
	const dashboardUrlWithUtm = appendUtm(dashboardUrl, campaign);

	const activeMonitors = monitors.filter((m) => m.status !== "paused");
	const overallUptime =
		activeMonitors.length > 0
			? activeMonitors.reduce((sum, m) => sum + m.uptime, 0) /
				activeMonitors.length
			: 100;

	const healthyCount = monitors.filter((m) => m.status === "healthy").length;
	const issueCount = monitors.filter(
		(m) => m.status === "late" || m.status === "down",
	).length;

	const weekStartStr = formatDate(weekStart);
	const weekEndStr = formatDate(weekEnd);

	const uptimeColor =
		overallUptime >= 99
			? "#16a34a"
			: overallUptime >= 95
				? "#d97706"
				: "#dc2626";

	return (
		<Layout
			previewText={`Your weekly Cronpilot digest — ${weekStartStr} to ${weekEndStr}`}
		>
			<Text style={headingStyle}>Weekly Digest</Text>
			<Text style={subheadingStyle}>
				{weekStartStr} &ndash; {weekEndStr} &middot; {teamName}
			</Text>

			{/* Summary stats */}
			<div style={statsGridStyle}>
				<StatCard
					label="Overall uptime"
					value={
						activeMonitors.length > 0 ? `${overallUptime.toFixed(2)}%` : "—"
					}
					valueColor={uptimeColor}
				/>
				<StatCard
					label="Monitors healthy"
					value={`${healthyCount} / ${monitors.length}`}
					valueColor={issueCount === 0 ? "#16a34a" : "#d97706"}
				/>
				<StatCard
					label="Total incidents"
					value={String(totalIncidents)}
					valueColor={totalIncidents === 0 ? "#16a34a" : "#dc2626"}
				/>
			</div>

			{/* Status summary message */}
			{totalIncidents === 0 ? (
				<div style={allClearBannerStyle}>
					<Text style={allClearTextStyle}>
						All systems ran without incident this week.
					</Text>
				</div>
			) : (
				<div style={incidentBannerStyle}>
					<Text style={incidentBannerTextStyle}>
						{totalIncidents} incident{totalIncidents !== 1 ? "s" : ""} recorded
						across {issueCount} monitor{issueCount !== 1 ? "s" : ""} this week.
					</Text>
				</div>
			)}

			{/* Monitor breakdown */}
			<Text style={sectionHeadingStyle}>Monitor breakdown</Text>

			<div style={monitorListStyle}>
				{/* Table header */}
				<div style={monitorHeaderStyle}>
					<span style={monitorHeaderCellStyle}>Monitor</span>
					<span style={monitorHeaderStatusStyle}>Status</span>
					<span style={monitorHeaderUptimeStyle}>Uptime</span>
				</div>
				{monitors.map((monitor) => (
					<MonitorStatus
						key={monitor.name}
						name={monitor.name}
						status={monitor.status}
						uptime={monitor.uptime}
					/>
				))}
			</div>

			{/* Incidents note */}
			{totalIncidents > 0 && (
				<Text style={incidentsNoteStyle}>
					Visit your dashboard for a full incident timeline and per-monitor
					event history.
				</Text>
			)}

			<div style={buttonWrapperStyle}>
				<Button href={dashboardUrlWithUtm} style={buttonStyle}>
					Open dashboard &rarr;
				</Button>
			</div>

			<Text style={footerNoteStyle}>
				This digest is sent every Monday for the previous week. You can adjust
				digest frequency or disable it in your notification settings.
			</Text>
		</Layout>
	);
}

interface StatCardProps {
	label: string;
	value: string;
	valueColor: string;
}

function StatCard({ label, value, valueColor }: StatCardProps) {
	return (
		<div style={statCardStyle}>
			<div style={{ ...statValueStyle, color: valueColor }}>{value}</div>
			<div style={statLabelStyle}>{label}</div>
		</div>
	);
}

function appendUtm(url: string, campaign: string): string {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}utm_source=email&utm_campaign=${campaign}`;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	});
}

const headingStyle: React.CSSProperties = {
	color: "#0f172a",
	fontSize: "28px",
	fontWeight: "700",
	letterSpacing: "-0.5px",
	lineHeight: "36px",
	margin: "0 0 4px",
};

const subheadingStyle: React.CSSProperties = {
	color: "#64748b",
	fontSize: "14px",
	lineHeight: "20px",
	margin: "0 0 28px",
};

const statsGridStyle: React.CSSProperties = {
	display: "flex",
	gap: "12px",
	margin: "0 0 24px",
};

const statCardStyle: React.CSSProperties = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "8px",
	flex: "1",
	padding: "16px",
	textAlign: "center",
};

const statValueStyle: React.CSSProperties = {
	fontSize: "24px",
	fontWeight: "700",
	letterSpacing: "-0.5px",
	lineHeight: "32px",
};

const statLabelStyle: React.CSSProperties = {
	color: "#64748b",
	fontSize: "12px",
	fontWeight: "500",
	lineHeight: "16px",
	marginTop: "4px",
};

const allClearBannerStyle: React.CSSProperties = {
	backgroundColor: "#f0fdf4",
	border: "1px solid #bbf7d0",
	borderRadius: "6px",
	marginBottom: "28px",
	padding: "12px 16px",
	textAlign: "center",
};

const allClearTextStyle: React.CSSProperties = {
	color: "#14532d",
	fontSize: "14px",
	fontWeight: "500",
	margin: "0",
};

const incidentBannerStyle: React.CSSProperties = {
	backgroundColor: "#fff7ed",
	border: "1px solid #fed7aa",
	borderRadius: "6px",
	marginBottom: "28px",
	padding: "12px 16px",
	textAlign: "center",
};

const incidentBannerTextStyle: React.CSSProperties = {
	color: "#9a3412",
	fontSize: "14px",
	fontWeight: "500",
	margin: "0",
};

const sectionHeadingStyle: React.CSSProperties = {
	color: "#0f172a",
	fontSize: "16px",
	fontWeight: "600",
	margin: "0 0 12px",
};

const monitorListStyle: React.CSSProperties = {
	marginBottom: "24px",
};

const monitorHeaderStyle: React.CSSProperties = {
	display: "flex",
	gap: "12px",
	paddingBottom: "8px",
	borderBottom: "2px solid #e2e8f0",
	marginBottom: "4px",
};

const monitorHeaderCellStyle: React.CSSProperties = {
	color: "#64748b",
	flex: 1,
	fontSize: "12px",
	fontWeight: "600",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
};

const monitorHeaderStatusStyle: React.CSSProperties = {
	color: "#64748b",
	fontSize: "12px",
	fontWeight: "600",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	width: "72px",
	textAlign: "center",
};

const monitorHeaderUptimeStyle: React.CSSProperties = {
	color: "#64748b",
	fontSize: "12px",
	fontWeight: "600",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	width: "56px",
	textAlign: "right",
};

const incidentsNoteStyle: React.CSSProperties = {
	color: "#64748b",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "0 0 20px",
};

const buttonWrapperStyle: React.CSSProperties = {
	margin: "24px 0",
	textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
	backgroundColor: "#0f172a",
	borderRadius: "6px",
	color: "#ffffff",
	display: "inline-block",
	fontSize: "15px",
	fontWeight: "600",
	padding: "12px 28px",
	textDecoration: "none",
};

const footerNoteStyle: React.CSSProperties = {
	color: "#94a3b8",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "0",
};

DigestEmail.subject = (props: DigestEmailProps) => {
	const weekStartStr = props.weekStart.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	});
	const weekEndStr = props.weekEnd.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	});
	return `Your weekly Cronpilot digest — ${weekStartStr} to ${weekEndStr}`;
};
