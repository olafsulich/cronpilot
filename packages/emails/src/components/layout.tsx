import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const UTM_PARAMS = "utm_source=email&utm_campaign=base";

interface LayoutProps {
	children: ReactNode;
	previewText?: string;
}

export function Layout({ children, previewText }: LayoutProps) {
	return (
		<Html lang="en">
			<Head />
			{previewText !== undefined && <Preview>{previewText}</Preview>}
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					{/* Logo */}
					<Section style={logoSectionStyle}>
						<Text style={logoStyle}>Cronpilot</Text>
					</Section>

					{/* Content */}
					<Section style={contentSectionStyle}>{children}</Section>

					{/* Footer */}
					<Hr style={hrStyle} />
					<Section style={footerSectionStyle}>
						<Text style={footerTextStyle}>
							{"© 2026 Cronpilot · "}
							<Link
								href={`https://cronpilot.io/unsubscribe?${UTM_PARAMS}`}
								style={footerLinkStyle}
							>
								Unsubscribe
							</Link>
							{" · "}
							<Link
								href={`https://cronpilot.io/privacy?${UTM_PARAMS}`}
								style={footerLinkStyle}
							>
								Privacy Policy
							</Link>
						</Text>
						<Text style={footerAddressStyle}>
							Cronpilot Inc. · 340 Pine Street, Suite 800 · San Francisco, CA
							94104
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

const bodyStyle: React.CSSProperties = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	margin: "0",
	padding: "0",
};

const containerStyle: React.CSSProperties = {
	backgroundColor: "#ffffff",
	margin: "40px auto",
	maxWidth: "600px",
	borderRadius: "8px",
	border: "1px solid #e6ebf1",
	overflow: "hidden",
};

const logoSectionStyle: React.CSSProperties = {
	backgroundColor: "#0f172a",
	padding: "24px 40px",
};

const logoStyle: React.CSSProperties = {
	color: "#ffffff",
	fontSize: "22px",
	fontWeight: "700",
	letterSpacing: "-0.5px",
	margin: "0",
	padding: "0",
};

const contentSectionStyle: React.CSSProperties = {
	padding: "40px 40px 32px",
};

const hrStyle: React.CSSProperties = {
	borderColor: "#e6ebf1",
	margin: "0",
};

const footerSectionStyle: React.CSSProperties = {
	padding: "24px 40px",
};

const footerTextStyle: React.CSSProperties = {
	color: "#8898aa",
	fontSize: "13px",
	lineHeight: "20px",
	margin: "0 0 4px",
	textAlign: "center",
};

const footerLinkStyle: React.CSSProperties = {
	color: "#8898aa",
	textDecoration: "underline",
};

const footerAddressStyle: React.CSSProperties = {
	color: "#b0bec5",
	fontSize: "12px",
	lineHeight: "18px",
	margin: "0",
	textAlign: "center",
};
