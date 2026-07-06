import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Pre-baked 96×96 PNG of the AuditQR logo (generated from the app SVG)
const LOGO_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAACs0lEQVR4nO3WQYoUURAEUAUv5Plcez4vJKiLXPajDMiqP9rxNkITxM+p2Pj56/efvz59ID++ffn855+/pvvVo/wpHeCwDnBYBzisAxzWAQ7jAPoDtqTvKi9pj/Jb9G4HGMpv0bsdYCi/Re92gKH8Fr3bAYbyW/RuBxjKb9G78QDKS9qzlZe0R3lJezrAUI/ykvZ0gKEe5SXt6QBDPcpL2tMBhnqUl7SnAwz1KC9pTwcY6lFe0p4OMNSjvKQ9HWCoR3lJezrAUI/ykvZ0gKEe5SXt6QBDPcpL2hMPsGXr3bQnzW/Rux1gKL9F73aAofwWvdsBhvJb9G4HGMpv0bsdYCi/Re9ygFPSD6H71aP8KR3gsA5wWAc4rAMc1gEOe3nkR6QPpw/9r/hnju8Ah3WAwzrAYR3gsP92AP1hqa0Pkd6jd9OeLek9HWBZek8HWJbe0wGWpfd0gGXpPR1gWXoPB0iLttz9rvrvpvs7wEN0fwd4iO7vAA/R/R3gIbq/AzxE9x855iPSBxINqR7lX/74jvThRB9UPcq//PEd6cOJPqh6lH/54zvShxN9UPUo//LHd6QPJ/qg6lH+5Y/vSB9O9EHVozz/G3qKDt26M+1XXtQjHWCoX3lRj3SAoX7lRT3SAYb6lRf1SAcY6lde1CMdYKhfeVGPcID04dTd7271b/VIB7iw1SMd4MJWj3SAC1s90gEubPVIB7iw1SPxAMpL2rOVT6X9yqc6wEj7lU91gJH2K5/qACPtVz7VAUbar3yqA4y0X/nUfzuA8qm0X3npABfSfuWlA1xI+5WXDnAh7VdeOsCFtF956QAX0n7lJR5gS/pumv9odH8HeIju7wAP0f0d4CG6vwM8RPd3gIfofg5wij7oqTvvvqcDXLj7ng5w4e57OsCFu+/pABfuvqcDXLj7nt9HQAKDOPMuBwAAAABJRU5ErkJggg==";

const LOGO_DATA_URI = `data:image/png;base64,${LOGO_PNG_B64}`;

const HEADER = `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;">
    <tr>
      <td align="center" style="padding:33px 40px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <img src="${LOGO_DATA_URI}" width="36" height="36" alt="AuditQR" style="display:block;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AuditQR</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

export async function sendMagicLinkEmail(to: string, businessName: string, magicLink: string) {
  await resend.emails.send({
    from: "AuditQR <onboarding@resend.dev>",
    to: [to],
    subject: "Verify your AuditQR account",
    html: `
      <div style="background-color:#f0f2f5;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">

          ${HEADER}

          <!-- Body -->
          <div style="padding:36px 40px;">
            <h2 style="margin:0 0 12px;color:#111827;font-size:19px;font-weight:600;text-align:center;">Verify your account</h2>
            <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;text-align:center;">
              Hi <strong>${businessName}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;text-align:center;">
              Your account has been created. Click the button below to verify your email and access your dashboard.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <a href="${magicLink}" style="display:inline-block;padding:13px 36px;background:#3185FC;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                    Verify my account &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;" />

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">
              This link expires in <strong style="color:#6b7280;">24 hours</strong> and can only be used once.<br/>
              After verifying, use your email and password to log in going forward.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;">
              If you did not create this account, you can safely ignore this email.
            </p>
          </div>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />

          <div style="padding:18px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; 2026 AuditQR &middot; Built for Nigerian SMEs</p>
          </div>

        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, businessName: string, resetLink: string) {
  await resend.emails.send({
    from: "AuditQR <onboarding@resend.dev>",
    to: [to],
    subject: "Reset your AuditQR password",
    html: `
      <div style="background-color:#f0f2f5;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">

          ${HEADER}

          <!-- Body -->
          <div style="padding:36px 40px;">
            <h2 style="margin:0 0 12px;color:#111827;font-size:19px;font-weight:600;text-align:center;">Reset your password</h2>
            <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;text-align:center;">
              Hi <strong>${businessName}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;text-align:center;">
              We received a request to reset your AuditQR password. Click the button below to set a new one.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <a href="${resetLink}" style="display:inline-block;padding:13px 36px;background:#3185FC;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                    Reset password &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;" />

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.6;text-align:center;">
              This link expires in <strong style="color:#6b7280;">1 hour</strong> and can only be used once.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;">
              If you did not request this, you can safely ignore this email.
            </p>
          </div>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />

          <div style="padding:18px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; 2026 AuditQR &middot; Built for Nigerian SMEs</p>
          </div>

        </div>
      </div>
    `,
  });
}
