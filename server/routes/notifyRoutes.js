// server/routes/notifyRoutes.js
const express = require("express");
const router = express.Router();
require("dotenv").config();
const { sendBrevoEmail } = require("../lib/email");

// ---------------- POST /email ----------------
router.post("/email", async (req, res) => {
  try {
    const { email, tempId, name } = req.body;

    if (!email || !tempId || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const BREVO_KEY = process.env.BREVO_KEY;

    if (!BREVO_KEY) {
      console.error("BREVO_KEY is missing from environment variables");
      return res.status(500).json({ error: "Email service not configured" });
    }

    const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "support@rapidroute.com";

    const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Rapid Route Logistics";
    const LOGO_URL = process.env.BREVO_LOGO_URL || "";

    // Build receiver link and email HTML (site-styled)
    const siteUrl = process.env.SITE_URL || "";
    const receiverLink = siteUrl ? `${siteUrl}/fill-receiver.html?id=${encodeURIComponent(tempId)}` : `https://example.com/fill-receiver.html?id=${encodeURIComponent(tempId)}`;

    const htmlContent = `
      <div style="font-family:Poppins,Arial,sans-serif;background:#f6f8fa;padding:16px;color:#333;">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;overflow:hidden;border:1px solid #ececec;">

          <!-- Header (site-style) -->
          <div style="background:#1d173c;padding:18px 20px;text-align:center;">
            ${LOGO_URL ? `<img src="${LOGO_URL}" alt="${SENDER_NAME} logo" style="max-width:220px;width:100%;height:auto;display:block;margin:0 auto;" />` : `<div style="color:#fff;font-size:20px;font-weight:700;">${SENDER_NAME}</div>`}
          </div>

          <!-- Body -->
          <div style="padding:22px 24px;line-height:1.6;background:#ffffff;">
            <h2 style="margin:0 0 10px;font-size:20px;color:#1d173c;text-align:left;">Receiver Details Received</h2>

            <p style="margin:0 0 12px;font-size:15px;">Hello <strong>${name}</strong>,</p>

            <p style="margin:0 0 14px;font-size:15px;">Thank you — we have received your receiver details for the shipment below. Please complete the payment step to allow us to process and dispatch your parcel.</p>

            <div style="margin:14px 0;padding:14px 12px;border-left:6px solid #d84659;background:#fff;border:1px solid #ececec;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#d84659;font-weight:700;margin-bottom:6px;">Shipment Temporary ID</div>
              <div style="font-size:18px;font-weight:700;color:#1d173c;word-break:break-word;">${tempId}</div>
            </div>

            <p style="margin:0 0 14px;font-size:15px;color:#444;">When payment is confirmed, your shipment will be scheduled for dispatch. You can complete payment using the link below or reply to this email for assistance.</p>

            <div style="text-align:center;margin:18px 0;">
              <a href="${receiverLink}" style="display:inline-block;background:#d84659;color:#fff;padding:10px 18px;text-decoration:none;font-weight:700;border-radius:4px;">Complete Payment</a>
            </div>

            <p style="margin:0 0 8px;font-size:14px;color:#555;">If you’ve already paid, please ignore this message or reply to let us know.</p>
            <p style="margin:0;font-size:14px;color:#555;">Need help? Contact us at <a href="mailto:${SENDER_EMAIL}" style="color:#d84659;text-decoration:none;">${SENDER_EMAIL}</a></p>
          </div>

          <!-- Footer (site-style) -->
          <div style="background:#1d173c;color:#fff;padding:18px 20px;text-align:center;font-size:13px;">
            <div style="max-width:640px;margin:0 auto;">
              <div style="font-weight:600;margin-bottom:6px;">${SENDER_NAME}</div>
              <div style="color:#c9c9d9;font-size:13px;line-height:1.6;">We are dedicated to providing fast, secure and reliable delivery solutions. For support, email <a href="mailto:${SENDER_EMAIL}" style="color:#fff;text-decoration:underline;">${SENDER_EMAIL}</a></div>
            </div>
          </div>

          <div style="background:#22183e;color:#fff;padding:12px 20px;text-align:center;font-size:12px;">© ${new Date().getFullYear()} ${SENDER_NAME}. All rights reserved.</div>

        </div>
      </div>
    `;

    // Send email via helper
    const brevoResponse = await sendBrevoEmail({
      to: email,
      subject: "Action Required: Complete Your Shipment Payment",
      html: htmlContent,
      senderEmail: SENDER_EMAIL,
      senderName: SENDER_NAME,
    });

    console.log("Brevo response:", brevoResponse);

    res.json({ success: true, message: "Email sent successfully" });
  } catch (err) {

    console.error(
      "Brevo email error:",
      err.response?.data || err.message
    );

    res.status(500).json({
      error: "Failed to send email",
    });
  }
});

module.exports = router;


