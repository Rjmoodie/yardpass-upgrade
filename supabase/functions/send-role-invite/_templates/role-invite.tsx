import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface RoleInviteEmailProps {
  first_name: string
  event_title: string
  event_date: string
  role: string
  invite_link: string
  expires_in_hours: number
}

export const RoleInviteEmail = ({
  first_name,
  event_title,
  event_date,
  role,
  invite_link,
  expires_in_hours,
}: RoleInviteEmailProps) => {
  const previewText = `Lend a hand at ${event_title}?`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo/Header */}
          <Section style={header}>
            <Img
              src="https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/assets/yardpass-logo.png"
              width="120"
              height="40"
              alt="YardPass"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>Lend a hand at {event_title}?</Heading>
            
            <Text style={text}>
              Hi {first_name},
            </Text>

            <Text style={text}>
              We're looking for volunteers for <strong>{event_title}</strong> on{' '}
              <strong>{event_date}</strong>.
            </Text>

            <Text style={text}>
              Roles: check-in, ushers, scanners
              <br />
              Shifts: 1–2 hours
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={invite_link}>
                Sign Up
              </Button>
            </Section>

            <Text style={text}>
              Thank you! — Team
            </Text>

            <Hr style={hr} />

            {/* Footer Info */}
            <Text style={footerText}>
              Or copy and paste this link into your browser:
              <br />
              <Link href={invite_link} style={link}>
                {invite_link}
              </Link>
            </Text>

            <Text style={footerText}>
              This invitation expires in {expires_in_hours} hours.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} YardPass. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://yardpass.app" style={footerLink}>
                YardPass
              </Link>
              {' · '}
              <Link href="https://yardpass.app/help" style={footerLink}>
                Help Center
              </Link>
              {' · '}
              <Link href="https://yardpass.app/privacy" style={footerLink}>
                Privacy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default RoleInviteEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const header = {
  padding: '32px 20px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const content = {
  padding: '0 48px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '36px',
  margin: '0 0 24px',
}

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#f59e0b',
  borderRadius: '8px',
  color: '#000000',
  fontSize: '16px',
  fontWeight: '700',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '32px 0',
}

const link = {
  color: '#3b82f6',
  fontSize: '14px',
  textDecoration: 'underline',
}

const footerText = {
  color: '#737373',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '12px 0',
}

const footer = {
  padding: '0 48px',
  marginTop: '32px',
}

const footerCopyright = {
  color: '#a3a3a3',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#a3a3a3',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#737373',
  textDecoration: 'underline',
}
