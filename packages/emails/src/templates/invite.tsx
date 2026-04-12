import { Button, Text } from "@react-email/components";
import { Layout } from "../components/layout";

export interface InviteEmailProps {
	inviterName: string;
	teamName: string;
	inviteUrl: string;
	expiresAt: Date;
}

export function InviteEmail({
	inviterName,
	teamName,
	inviteUrl,
	expiresAt,
}: InviteEmailProps) {
	const campaign = "team-invite";
	const inviteUrlWithUtm = appendUtm(inviteUrl, campaign);
	const expiresAtStr = formatDateTime(expiresAt);

	return (
		<Layout
			previewText={`${inviterName} invited you to join ${teamName} on Cronpilot`}
		>
			{/* Avatar / Invite graphic */}
			<div style={avatarContainerStyle}>
				<div style={avatarStyle}>{inviterName.charAt(0).toUpperCase()}</div>
				<div style={arrowStyle}>&rarr;</div>
				<div style={teamBadgeStyle}>
					<span style={teamBadgeTextStyle}>{teamName}</span>
				</div>
			</div>

			<Text style={headingStyle}>
				You&rsquo;ve been invited to join {teamName}
			</Text>

			<Text style={bodyTextStyle}>
				<strong>{inviterName}</strong> has invited you to join the{" "}
				<strong>{teamName}</strong> team on Cronpilot — a cron job monitoring
				platform that keeps your scheduled tasks running reliably.
			</Text>

			<Text style={bodyTextStyle}>
				Once you accept, you&rsquo;ll have access to the team&rsquo;s monitors,
				incident history, and alert settings.
			</Text>

			<div style={buttonWrapperStyle}>
				<Button href={inviteUrlWithUtm} style={buttonStyle}>
					Accept invitation
				</Button>
			</div>

			{/* Expiry notice */}
			<div style={expiryNoticeStyle}>
				<Text style={expiryTextStyle}>
					This invitation expires on <strong>{expiresAtStr}</strong>. If you
					need a new invite, ask {inviterName} to resend it.
				</Text>
			</div>

			<Text style={helpTextStyle}>
				If you weren&rsquo;t expecting this invitation or don&rsquo;t recognize{" "}
				{inviterName}, you can safely ignore this email.
			</Text>

			<Text style={helpTextStyle}>
				Having trouble with the button? Copy and paste this link into your
				browser:
			</Text>
			<Text style={rawLinkStyle}>{inviteUrlWithUtm}</Text>
		</Layout>
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

const avatarContainerStyle: React.CSSProperties = {
	alignItems: "center",
	display: "flex",
	gap: "16px",
	marginBottom: "28px",
};

const avatarStyle: React.CSSProperties = {
	alignItems: "center",
	backgroundColor: "#3b82f6",
	borderRadius: "50%",
	color: "#ffffff",
	display: "inline-flex",
	fontSize: "20px",
	fontWeight: "700",
	height: "48px",
	justifyContent: "center",
	width: "48px",
};

const arrowStyle: React.CSSProperties = {
	color: "#94a3b8",
	fontSize: "20px",
};

const teamBadgeStyle: React.CSSProperties = {
	alignItems: "center",
	backgroundColor: "#f1f5f9",
	border: "1px solid #e2e8f0",
	borderRadius: "8px",
	display: "inline-flex",
	padding: "8px 16px",
};

const teamBadgeTextStyle: React.CSSProperties = {
	color: "#0f172a",
	fontSize: "15px",
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

const buttonWrapperStyle: React.CSSProperties = {
	margin: "28px 0",
	textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
	backgroundColor: "#3b82f6",
	borderRadius: "6px",
	color: "#ffffff",
	display: "inline-block",
	fontSize: "16px",
	fontWeight: "600",
	padding: "14px 32px",
	textDecoration: "none",
};

const expiryNoticeStyle: React.CSSProperties = {
	backgroundColor: "#f8fafc",
	border: "1px solid #e2e8f0",
	borderRadius: "6px",
	margin: "0 0 20px",
	padding: "12px 16px",
};

const expiryTextStyle: React.CSSProperties = {
	color: "#475569",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "0",
};

const helpTextStyle: React.CSSProperties = {
	color: "#94a3b8",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "0 0 8px",
};

const rawLinkStyle: React.CSSProperties = {
	color: "#3b82f6",
	fontSize: "12px",
	fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
	lineHeight: "18px",
	margin: "0",
	wordBreak: "break-all",
};

InviteEmail.subject = (props: InviteEmailProps) =>
	`${props.inviterName} invited you to join ${props.teamName} on Cronpilot`;
