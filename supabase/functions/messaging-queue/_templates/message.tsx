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

/**
 * New optional props:
 * - webview_url?: string              // "View online" link
 * - unsubscribe_url?: string          // Unsubscribe link
 * - primary_cta?: { label: string; href: string }
 * - secondary_cta?: { label: string; href: string }
 * - accentColor?: string              // brand color for buttons/accents
 *
 * Inline CTA pattern (when not passing props):
 *   "CTA: Label | https://example.com"
 */
interface MessageEmailProps {
  subject: string
  body: string
  preheader?: string
  event_title?: string
  event_cover_image?: string
  org_name?: string
  org_logo_url?: string
  webview_url?: string
  unsubscribe_url?: string
  primary_cta?: { label: string; href: string }
  secondary_cta?: { label: string; href: string }
  accentColor?: string
}

export const MessageEmail = ({
  subject,
  body,
  preheader,
  event_title,
  event_cover_image,
  org_name,
  org_logo_url,
  webview_url,
  unsubscribe_url,
  primary_cta,
  secondary_cta,
  accentColor = '#6D28D9', // violet-700 default
}: MessageEmailProps) => {
  const brand = {
    accent: accentColor,
    accentHover: darkenHex(accentColor, 8),
  }

  // --- Parsing helpers ----------------------------------------------------
  // Split into paragraphs by blank line; keep order stable
  const rawParas = (body ?? '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)

  // Extract inline CTAs like "CTA: Label | https://…"
  const inlineCtas: { label: string; href: string }[] = []
  const paragraphs = rawParas.map(p => {
    const m = /^CTA:\s*(.+?)\s*\|\s*(https?:\/\/\S+)/i.exec(p)
    if (m) {
      inlineCtas.push({ label: m[1], href: m[2] })
      return '' // remove from normal rendering
    }
    return p
  }).filter(Boolean)

  // Linkify plain URLs and support light Markdown (**bold**, *italic*, [text](url))
  const renderInline = (s: string) => {
    // escape basic HTML entities
    let t = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // [label](url)
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, href) =>
      `<a href="${href}" style="${inlineLinkStyle}">${label}</a>`
    )
    // **bold**
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // *italic*
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // raw links
    t = t.replace(/(?<!["'>])(https?:\/\/[^\s]+)/g, (url) =>
      `<a href="${url}" style="${inlineLinkStyle}">${url}</a>`
    )
    return <span dangerouslySetInnerHTML={{ __html: t }} />
  }

  // Decide paragraph type: bullets, numbers, or normal
  const paraToNode = (para: string, key: number) => {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean)

    // bullet list (• or -)
    if (lines.every(l => /^[•\-]\s+/.test(l))) {
      return (
        <ul key={key} style={ul}>
          {lines.map((l, i) => (
            <li key={i} style={li}>
              <Text style={text}>{renderInline(l.replace(/^[•\-]\s+/, ''))}</Text>
            </li>
          ))}
        </ul>
      )
    }

    // numbered list
    if (lines.every(l => /^\d+\.\s+/.test(l))) {
      return (
        <ol key={key} style={ol}>
          {lines.map((l, i) => (
            <li key={i} style={li}>
              <Text style={text}>{renderInline(l.replace(/^\d+\.\s+/, ''))}</Text>
            </li>
          ))}
        </ol>
      )
    }

    // normal paragraph (allow hard line breaks)
    return (
      <Text key={key} style={text}>
        {lines.map((l, i) => (
          <React.Fragment key={i}>
            {renderInline(l)}{i < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </Text>
    )
  }

  const ctas = [
    primary_cta,
    secondary_cta,
    ...inlineCtas.filter(Boolean),
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <Html>
      <Head>
        {/* mobile padding + dark mode tweaks (supported in many clients) */}
        <style
          // some clients strip classes; keep selectors simple
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 600px) {
                .content-pad { padding-left: 20px !important; padding-right: 20px !important; }
              }
              @media (prefers-color-scheme: dark) {
                body { background-color: #0b0b0b !important; }
              }
            `
          }}
        />
      </Head>

      {/* Inbox preview text */}
      {preheader && <Preview>{preheader}</Preview>}

      {/* Hidden preheader fallback for clients that ignore <Preview> */}
      {preheader && (
        <div style={hiddenPreheader}>
          {preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
        </div>
      )}

      <Body style={main}>
        <Container style={container}>

          {/* Header */}
          <Section style={header}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td align="center">
                    <Img
                      src={org_logo_url || 'https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/Liventix%20Official/org-images/logo.png'}
                      width={100}
                      alt={org_name || 'Liventix'}
                      style={{...logo, width: '100px', height: 'auto', maxWidth: '100%', borderRadius: '12px'}}
                    />
                  </td>
                </tr>
                {subject && (
                  <tr>
                    <td align="center" style={{ paddingTop: 8 }}>
                      <Text style={subjectLine}>{subject}</Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          {/* Cover image */}
          {event_cover_image && (
            <Section style={coverImageSection}>
              <Img
                src={event_cover_image}
                alt={event_title || 'Event'}
                style={coverImage}
                width={600}
                height={300}
              />
            </Section>
          )}

          {/* Content */}
          <Section style={content} className="content-pad">
            {event_title && (
              <Heading as="h2" style={eventTitleText}>
                {event_title}
              </Heading>
            )}

            {paragraphs.map((p, i) => paraToNode(p, i))}

            {/* CTA buttons */}
            {ctas.length > 0 && (
              <div style={{ marginTop: 20, textAlign: 'center' as const }}>
                {ctas.map((c, i) => (
                  <a
                    key={`${c.href}-${i}`}
                    href={c.href}
                    style={button(brand.accent)}
                  >
                    {c.label}
                  </a>
                ))}
              </div>
            )}
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer} className="content-pad">
            <Text style={footerLinks}>
              <Link href="https://liventix.tech" style={footerLink}>{org_name || 'Liventix'}</Link>
              {' · '}
              <Link href="https://liventix.tech/help" style={footerLink}>Help Center</Link>
              {' · '}
              <Link href="https://liventix.tech/privacy" style={footerLink}>Privacy</Link>
              {' · '}
              <Link href="https://liventix.tech/terms" style={footerLink}>Terms</Link>
              {unsubscribe_url ? (
                <>
                  {' · '}
                  <Link href={unsubscribe_url} style={footerLink}>Unsubscribe</Link>
                </>
              ) : null}
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} {org_name || 'Liventix'}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default MessageEmail

// ------------------------------ Styles ----------------------------------

const main = {
  backgroundColor: '#f6f9fc',
  margin: 0,
  padding: 0,
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0 0 48px',
  marginBottom: '64px',
  maxWidth: '640px',
  width: '100%',
}

const header = {
  padding: '24px 24px 8px',
  textAlign: 'center' as const,
}

const logo = { margin: '0 auto', display: 'block' }

const coverImageSection = { padding: 0, margin: 0 }

const coverImage = {
  width: '100%',
  maxHeight: '300px',
  objectFit: 'cover' as const,
  display: 'block',
}

const content = {
  padding: '0 48px',
  marginTop: '24px',
}

const subjectLine = {
  color: '#4b5563',
  fontSize: '13px',
  lineHeight: '18px',
  margin: 0,
}

const eventTitleText = {
  color: '#111827',
  fontSize: '22px',
  fontWeight: 700,
  lineHeight: '28px',
  margin: '0 0 16px',
  textAlign: 'center' as const,
}

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '14px 0',
}

const ul = { paddingLeft: '20px', margin: '12px 0' }
const ol = { paddingLeft: '20px', margin: '12px 0' }
const li = { margin: '6px 0' }

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
}

const footer = {
  padding: '0 48px',
  marginTop: '16px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
}

const footerCopyright = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
}

const footerLink = {
  color: '#6b7280',
  textDecoration: 'underline',
}

const viewOnlineLink = {
  color: '#6b7280',
  fontSize: '12px',
  textDecoration: 'underline',
}

const inlineLinkStyle =
  'color:#4f46e5;text-decoration:underline;'

const hiddenPreheader: React.CSSProperties = {
  display: 'none',
  fontSize: '1px',
  lineHeight: '1px',
  maxHeight: '0px',
  maxWidth: '0px',
  opacity: 0,
  overflow: 'hidden',
  msoHide: 'all',
}

// Button uses inline styles (better email client support)
const button = (bg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '12px 18px',
  margin: '0 6px 6px',
  borderRadius: '6px',
  backgroundColor: bg,
  color: '#ffffff',
  fontSize: '14px',
  lineHeight: '20px',
  textDecoration: 'none',
})

// ------------------------------ Utils -----------------------------------

function darkenHex(hex: string, amount = 8) {
  // naive darken; hex like #RRGGBB
  const to = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `#${to(r - (255 * amount) / 100)}${to(g - (255 * amount) / 100)}${to(b - (255 * amount) / 100)}`
}
