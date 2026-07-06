import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_BASE = process.env.FRONTEND_BASE || "https://auditqr.vercel.app";
const LOGO_URL = `${FRONTEND_BASE}/images/auditqr-logo-preview.png`;

const HEADER = `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;">
    <tr>
      <td align="center" style="padding:33px 40px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <img src="${LOGO_URL}" width="36" height="36" alt="AuditQR" style="display:block;" />
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
    from: "AuditQR <noreply@auditqr.site>",
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
    from: "AuditQR <noreply@auditqr.site>",
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
