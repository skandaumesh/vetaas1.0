// Membership confirmation email — ported from src/lib/membershipEmail.ts so
// Cloud Functions (a separate, plain-JS codebase) can send it without a
// cross-project import. Keep the copies in sync if the design/copy changes.

const LINKS = {
  calendar: "https://www.vetaas.in/events",
  guide: "https://www.vetaas.in/services#membership",
  status: "https://www.vetaas.in/membership",
  maps: "https://maps.app.goo.gl/eMUJokfKE8opyhhz5",
  phone: "+91 89510 04160",
  phoneHref: "+918951004160",
  timings: "11 AM to 6 PM",
};

const planNames = (order) =>
  order.items.map((i) => (i.qty > 1 ? `${i.plan} × ${i.qty}` : i.plan)).join(", ");

const EMAIL_SUBJECT = "Welcome to The Nest by Vetaas! 🌿";

function buildEmailText(order) {
  return `Welcome to The Nest by Vetaas!

We're delighted to have your family join our community.

MEMBERSHIP DETAILS
Membership ID: ${order.membershipId ?? "-"}
Plan: ${planNames(order)}
Validity: ${order.validity ?? "-"}

Check your membership any time at ${LINKS.status} — you'll need the
Membership ID above and this email address.

QUICK LINKS
Monthly Calendar: ${LINKS.calendar}
Membership Guide: ${LINKS.guide}
Studio Location: ${LINKS.maps}

NEED HELP?
Contact us: ${LINKS.phone}
Studio Timings: ${LINKS.timings}

Please save this number so you don't miss important updates, session reminders, and community events.

We look forward to learning, playing, and growing together. See you at The Nest!

Vetaas Education Foundation
www.vetaas.in | @vetaaseducation`;
}

function buildEmailHtml(order) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

        <tr>
          <td align="center" style="background-color:#7C3AED;background-image:linear-gradient(135deg,#7C3AED 0%,#6D28D9 100%);padding:32px 24px;">
            <img src="https://www.vetaas.in/icon.png" width="72" height="72" alt="Vetaas" style="border-radius:50%;display:block;margin:0 auto 12px;background:#ffffff;" />
            <h1 style="margin:0;font-size:22px;color:#ffffff;">Welcome to The Nest by Vetaas! 🌿</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#e9d5ff;">We're delighted to have your family join our community</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px;">

            <p style="margin:0 0 10px;font-size:11px;letter-spacing:1px;color:#6b7280;font-weight:bold;">MEMBERSHIP DETAILS</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;margin:0 0 28px;">
              <tr><td style="padding:20px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b7280;width:110px;">Membership ID</td>
                    <td style="padding:5px 0;font-size:16px;color:#111827;font-weight:bold;letter-spacing:1px;">${order.membershipId ?? "-"}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b7280;">Plan</td>
                    <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:bold;">${planNames(order)}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b7280;">Validity</td>
                    <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:bold;">${order.validity ?? "-"}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:#6b7280;line-height:1.6;">
              Check your membership any time at
              <a href="${LINKS.status}" style="color:#7C3AED;font-weight:bold;text-decoration:none;">vetaas.in/membership</a>
              — you'll need the Membership ID above and this email address.
            </p>

            <p style="margin:0 0 10px;font-size:11px;letter-spacing:1px;color:#6b7280;font-weight:bold;">QUICK LINKS</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td width="30" valign="top" style="padding:7px 0;font-size:16px;">📅</td>
                <td style="padding:7px 0;font-size:14px;color:#374151;">
                  Monthly Calendar —
                  <a href="${LINKS.calendar}" style="color:#7C3AED;font-weight:bold;text-decoration:none;">View calendar</a>
                </td>
              </tr>
              <tr>
                <td width="30" valign="top" style="padding:7px 0;font-size:16px;">📖</td>
                <td style="padding:7px 0;font-size:14px;color:#374151;">
                  Membership Guide —
                  <a href="${LINKS.guide}" style="color:#7C3AED;font-weight:bold;text-decoration:none;">Read the guide</a>
                </td>
              </tr>
              <tr>
                <td width="30" valign="top" style="padding:7px 0;font-size:16px;">📍</td>
                <td style="padding:7px 0;font-size:14px;color:#374151;">
                  Studio Location —
                  <a href="${LINKS.maps}" style="color:#7C3AED;font-weight:bold;text-decoration:none;">Open in Google Maps</a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 10px;font-size:11px;letter-spacing:1px;color:#6b7280;font-weight:bold;">NEED HELP?</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin:0 0 20px;">
              <tr><td style="padding:18px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="30" valign="top" style="padding:5px 0;font-size:15px;">📞</td>
                    <td style="padding:5px 0;font-size:14px;color:#374151;">
                      Contact us:
                      <a href="tel:${LINKS.phoneHref}" style="color:#111827;font-weight:bold;text-decoration:none;">${LINKS.phone}</a>
                    </td>
                  </tr>
                  <tr>
                    <td width="30" valign="top" style="padding:5px 0;font-size:15px;">🕘</td>
                    <td style="padding:5px 0;font-size:14px;color:#374151;">
                      Studio Timings: <strong style="color:#111827;">${LINKS.timings}</strong>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
              Please save this number so you don't miss important updates, session reminders, and community events.
            </p>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              We look forward to learning, playing, and growing together. See you at The Nest! 🌿
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="background:#111827;padding:24px;">
            <p style="margin:0 0 6px;font-size:14px;color:#ffffff;font-weight:bold;">Vetaas Education Foundation</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="https://www.vetaas.in" style="color:#9ca3af;text-decoration:none;">www.vetaas.in</a>
              &nbsp;·&nbsp;
              <a href="https://www.instagram.com/vetaaseducation/" style="color:#9ca3af;text-decoration:none;">@vetaaseducation</a>
              &nbsp;·&nbsp;
              <a href="mailto:kirti@vetaas.in" style="color:#9ca3af;text-decoration:none;">kirti@vetaas.in</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { EMAIL_SUBJECT, buildEmailText, buildEmailHtml };
