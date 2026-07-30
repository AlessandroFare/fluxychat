import { env } from "cloudflare:workers";
import {
	EmailVerificationTemplate,
	type EmailVerificationTemplateProps,
} from "@server/email/templates/email-verification";
import {
	OrganizationInvitationTemplate,
	type OrganizationInvitationTemplateProps,
} from "@server/email/templates/organization-invitation";
import {
	PasswordResetTemplate,
	type PasswordResetTemplateProps,
} from "@server/email/templates/password-reset";
import { type ComponentType, createElement } from "react";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

// Create a record of all available email templates
const emailTemplates = {
	"email-verification": {
		id: "email-verification",
		subject: "Verify your email address",
		component: EmailVerificationTemplate,
	},
	"password-reset": {
		id: "password-reset",
		subject: "Reset your password",
		component: PasswordResetTemplate,
	},
	"organization-invitation": {
		id: "organization-invitation",
		subject: "You've been invited to join an organization",
		component: OrganizationInvitationTemplate,
	},
} as const;

// Create a type that represents all possible template IDs
type TemplateId = keyof typeof emailTemplates;

// Create a type that maps template IDs to their respective prop types
type TemplateProps = {
	"email-verification": EmailVerificationTemplateProps;
	"password-reset": PasswordResetTemplateProps;
	"organization-invitation": OrganizationInvitationTemplateProps;
};

export const sendMail = async <T extends TemplateId>(
	to: string,
	templateId: T,
	props: TemplateProps[T],
): Promise<void> => {
	if (env.MOCK_SEND_EMAIL === "true") {
		console.log(
			"📨 Email sent to:",
			to,
			"with template:",
			templateId,
			"and props:",
			props,
		);
		return;
	}

	const emailSender = env.EMAIL_SENDER;

	if (!emailSender) {
		throw new Error("EMAIL_SENDER is not set");
	}

	const template = emailTemplates[templateId];
	const subject = template.subject;
	const Component = template.component;

	// Use a type assertion to help TypeScript understand the component type
	const emailElement = createElement(
		Component as ComponentType<TemplateProps[T]>,
		props,
	);

	try {
		await resend.emails.send({
			from: emailSender,
			to,
			subject,
			react: emailElement,
		});

		console.log("📨 Email sent to:", to, "with template:", templateId);
	} catch (error) {
		console.error("Failed to send email:", error);
		throw new Error("Failed to send email");
	}
};
