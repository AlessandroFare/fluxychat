/** Fluxychat-specific Clerk UI copy (sign-in / sign-up). */
export const clerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to Fluxychat",
      subtitle: "Operator console for your chat deployment",
    },
  },
  signUp: {
    start: {
      title: "Create your Fluxychat account",
      subtitle: "Hosted cloud — project and API keys provisioned after sign-up",
    },
  },
  socialButtonsBlockButton: "Continue with {{provider|titleize}}",
  dividerText: "or",
  formFieldLabel__emailAddress: "Email",
  formFieldLabel__password: "Password",
  formButtonPrimary: "Continue",
  footerActionLink__signIn: "Sign in",
  footerActionLink__signUp: "Sign up",
};

export const clerkAuthAppearance = {
  variables: {
    colorPrimary: "#C2410C",
    colorText: "#0f172a",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "shadow-[var(--shadow-3)] w-full",
    headerTitle: "font-heading text-xl",
    headerSubtitle: "text-sm text-slate-600",
    formButtonPrimary: "bg-[#C2410C] text-white hover:bg-[#9A3A0A]",
    footerActionLink: "text-[#C2410C] hover:text-[#9A3A0A]",
  },
} as const;

