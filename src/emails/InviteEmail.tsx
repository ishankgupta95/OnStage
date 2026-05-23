import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type InviteEmailProps = {
  teamName: string;
  inviterEmail: string;
  role: string;
  link: string;
};

// Light-on-white by design: email dark-mode handling is unreliable across
// clients, so we keep a safe light card and use the Onstage accent only on the
// CTA. Kept to inline styles for client compatibility.
export default function InviteEmail({ teamName, inviterEmail, role, link }: InviteEmailProps) {
  const roleLabel = role === "editor" ? "an editor" : "a viewer";
  return (
    <Html>
      <Head />
      <Preview>{`You've been invited to ${teamName} on Onstage`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={kicker}>ONSTAGE</Text>
          <Heading style={heading}>Join {teamName}</Heading>
          <Text style={paragraph}>
            {inviterEmail ? <strong>{inviterEmail}</strong> : "A teammate"} invited you to collaborate on{" "}
            <strong>{teamName}</strong> as {roleLabel}. Onstage is where the team builds App Store and Play Store
            screenshots together.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Link href={link} style={button}>
              Accept invitation
            </Link>
          </Section>
          <Text style={small}>
            Or paste this link into your browser:
            <br />
            <Link href={link} style={{ color: "#0a6aa1", wordBreak: "break-all" }}>
              {link}
            </Link>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            This invitation expires in 7 days. If you weren&apos;t expecting it, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "32px 0",
};
const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: "1px solid #e4e4e7",
  maxWidth: "480px",
  margin: "0 auto",
  padding: "36px 40px",
};
const kicker: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.22em",
  color: "#71717a",
  fontWeight: 700,
  margin: "0 0 8px",
};
const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 800,
  color: "#18181b",
  margin: "0 0 16px",
  letterSpacing: "-0.01em",
};
const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#3f3f46",
  margin: "0 0 8px",
};
const button: React.CSSProperties = {
  backgroundColor: "#56b8e6",
  color: "#072030",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  padding: "12px 28px",
  borderRadius: "10px",
  display: "inline-block",
};
const small: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: "#71717a",
  margin: "0",
};
const hr: React.CSSProperties = { borderColor: "#e4e4e7", margin: "28px 0 16px" };
const footer: React.CSSProperties = { fontSize: "12px", color: "#a1a1aa", margin: 0 };
