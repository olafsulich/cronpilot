interface MonitorStatusProps {
	name: string;
	status: "healthy" | "late" | "down" | "paused";
	uptime: number;
}

const STATUS_CONFIG: Record<
	MonitorStatusProps["status"],
	{ color: string; label: string; bgColor: string }
> = {
	healthy: { color: "#16a34a", label: "Healthy", bgColor: "#dcfce7" },
	late: { color: "#d97706", label: "Late", bgColor: "#fef3c7" },
	down: { color: "#dc2626", label: "Down", bgColor: "#fee2e2" },
	paused: { color: "#6b7280", label: "Paused", bgColor: "#f3f4f6" },
};

export function MonitorStatus({ name, status, uptime }: MonitorStatusProps) {
	const config = STATUS_CONFIG[status];
	const uptimeDisplay = status === "paused" ? "—" : `${uptime.toFixed(2)}%`;

	return (
		<div style={rowStyle}>
			{/* Status dot */}
			<span style={dotStyle(config.color)} />

			{/* Monitor name */}
			<span style={nameStyle}>{name}</span>

			{/* Status badge */}
			<span style={badgeStyle(config.color, config.bgColor)}>
				{config.label}
			</span>

			{/* Uptime */}
			<span style={uptimeStyle(config.color)}>{uptimeDisplay}</span>
		</div>
	);
}

const rowStyle: React.CSSProperties = {
	alignItems: "center",
	borderBottom: "1px solid #f1f5f9",
	display: "flex",
	gap: "12px",
	padding: "10px 0",
};

const dotStyle = (color: string): React.CSSProperties => ({
	backgroundColor: color,
	borderRadius: "50%",
	display: "inline-block",
	flexShrink: 0,
	height: "8px",
	width: "8px",
});

const nameStyle: React.CSSProperties = {
	color: "#1e293b",
	flex: 1,
	fontSize: "14px",
	fontWeight: "500",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const badgeStyle = (color: string, bgColor: string): React.CSSProperties => ({
	backgroundColor: bgColor,
	borderRadius: "4px",
	color: color,
	fontSize: "12px",
	fontWeight: "600",
	padding: "2px 8px",
});

const uptimeStyle = (color: string): React.CSSProperties => ({
	color: color,
	fontSize: "13px",
	fontWeight: "600",
	minWidth: "56px",
	textAlign: "right",
});
