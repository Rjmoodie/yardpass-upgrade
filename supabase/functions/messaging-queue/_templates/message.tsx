import {
  Body,
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

interface MessageEmailProps {
  subject: string
  body: string
  preheader?: string
  event_title?: string
  event_cover_image?: string
  org_name?: string
  org_logo_url?: string
}

export const MessageEmail = ({
  subject,
  body,
  preheader,
  event_title,
  event_cover_image,
  org_name,
  org_logo_url,
}: MessageEmailProps) => {
  // Convert plain text to HTML paragraphs
  const bodyParagraphs = body.split('\n\n').filter(p => p.trim());

  return (
    <Html>
      <Head />
      {preheader && <Preview>{preheader}</Preview>}
      <Body style={main}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={header}>
            <Img
              src={org_logo_url || "https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/assets/yardpass-logo.png"}
              width="120"
              height="40"
              alt={org_name || "YardPass"}
              style={logo}
            />
          </Section>

          {/* Event cover image if available */}
          {event_cover_image && (
            <Section style={coverImageSection}>
              <Img
                src={event_cover_image}
                alt={event_title || "Event"}
                style={coverImage}
              />
            </Section>
          )}

          {/* Main Content */}
          <Section style={content}>
            {event_title && (
              <Text style={eventTitleText}>{event_title}</Text>
            )}

            {/* Body content */}
            {bodyParagraphs.map((para, i) => {
              // Check if paragraph contains a bullet point
              if (para.trim().startsWith('•') || para.trim().startsWith('-')) {
                const items = para.split('\n').filter(line => line.trim());
                return (
                  <div key={i} style={{ margin: '16px 0' }}>
                    {items.map((item, j) => (
                      <Text key={j} style={bulletText}>
                        • {item.replace(/^[•\-]\s*/, '')}
                      </Text>
                    ))}
                  </div>
                );
              }
              
              // Regular paragraph
              return (
                <Text key={i} style={text}>
                  {para}
                </Text>
              );
            })}
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} {org_name || "YardPass"}. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://yardpass.app" style={footerLink}>
                {org_name || "YardPass"}
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

export default MessageEmail

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

const coverImageSection = {
  padding: '0',
  margin: '0',
}

const coverImage = {
  width: '100%',
  maxHeight: '300px',
  objectFit: 'cover' as const,
}

const content = {
  padding: '0 48px',
  marginTop: '32px',
}

const eventTitleText = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '32px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const bulletText = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '4px 0',
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '32px 0',
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
