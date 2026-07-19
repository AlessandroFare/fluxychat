import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";

export interface OrganizationInvitationTemplateProps {
	inviteLink: string;
	username: string;
	invitedByUsername: string;
	invitedByEmail: string;
	teamName: string;
}

export function OrganizationInvitationTemplate({
	inviteLink,
	username,
	invitedByUsername,
	invitedByEmail,
	teamName,
}: OrganizationInvitationTemplateProps) {
	return (
		<Html>
			<Head />
			<Preview>You've been invited to join {teamName}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Heading style={h1}>Team Invitation</Heading>
					<Text style={text}>
						Hi {username}, you've been invited by {invitedByUsername} (
						{invitedByEmail}) to join the team {teamName}.
					</Text>
					<Section style={buttonContainer}>
						<Button style={button} href={inviteLink}>
							Accept Invitation
						</Button>
					</Section>
					<Text style={text}>
						If you didn't expect this invitation, you can safely ignore it.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const main = {
	backgroundColor: "#ffffff",
	fontFamily:
		"-apple-system,BlinkMacSystemFont," +
		'"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
	margin: "0 auto",
	padding: "20px 0 48px",
	maxWidth: "560px",
};

const h1 = {
	fontSize: "24px",
	fontWeight: "bold",
	marginTop: "48px",
	marginBottom: "24px",
};

const text = {
	fontSize: "16px",
	lineHeight: "26px",
	marginBottom: "24px",
};

const buttonContainer = {
	marginBottom: "24px",
};

const button = {
	backgroundColor: "#5F51E8",
	borderRadius: "3px",
	color: "#fff",
	fontSize: "16px",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	padding: "12px",
};
