require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const { sendBrevoEmail } = require("./lib/email");
const crypto = require("crypto");

// Routes & Models
const notifyRoutes = require("./routes/notifyRoutes");
const telegramNotify = require("./routes/telegramNotify"); // Telegram notifications
const Tracking = require("./models/Tracking.supabase");
const Admin = require("./models/Admin.supabase");
const TempShipment = require("./models/TempShipment.supabase");
const { bot, processIncomingMessage } = require("./telegramBot");

const app = express();

// ==========================================
// 1. GLOBAL MIDDLEWARE
// ==========================================
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = [
  "http://localhost:5000",
  "https://rapidroutes-five.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!allowedOrigins.includes(origin)) {
        return callback(new Error(`CORS blocked: ${origin}`), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// ==========================================
// 2. DATABASE CONFIGURATION
// ==========================================
// Supabase connection is handled by the data-access helpers
// in server/lib/supabase.js. No connection pooling needed here.

// ==========================================
// 3. AUTH & CONFIG VALIDATION
// ==========================================
const SECRET = process.env.SECRET;
const BASE_URL = process.env.BASE_URL || "https://rapidroutes-five.vercel.app";

// Validate critical config at startup
if (!SECRET) console.warn("⚠️ WARNING: SECRET not set in environment variables");
if (!BASE_URL || BASE_URL === "https://www.rapidroutesltd.com") {
  console.warn("⚠️ WARNING: BASE_URL may not be configured correctly");
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.adminId = decoded.id;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// ==========================================
// 4. ROUTES
// ==========================================

// HEALTH CHECK - Prevents Vercel cold-start delays
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Telegram webhook
app.use("/api/notify/telegram", telegramNotify);

// WEBHOOK: Set only once, cache state
let webhookSetAttempted = false;
let webhookSetSuccess = false;

if (process.env.TELEGRAM_BOT_TOKEN && bot) {
  if (!webhookSetAttempted) {
    webhookSetAttempted = true;
    const webhookPath = `/api/telegram-webhook-secure`; 
    const webhookUrl = `${BASE_URL}${webhookPath}`;
    
    console.log(`🔗 Registering Telegram webhook URL: ${webhookUrl}`);
    (async () => {
      try {
        // Set webhook with secret token if TELEGRAM_SECRET_TOKEN is configured
        const webhookOptions = process.env.TELEGRAM_SECRET_TOKEN 
          ? { secret_token: process.env.TELEGRAM_SECRET_TOKEN }
          : {};
        await bot.setWebHook(webhookUrl, undefined, webhookOptions);
        webhookSetSuccess = true;
        console.log(`✅ Telegram Webhook successfully set to: ${webhookUrl}`);
      } catch (err) {
        console.error("Webhook setup failed, but continuing server boot...", err.message);
      }
    })();

    // Catch the messages using the clean path
    app.post(webhookPath, async (req, res) => {
      // Validate Telegram secret token to ensure webhook is legitimate
      const secretToken = req.headers['x-telegram-bot-api-secret-token'];
      if (!secretToken || secretToken !== process.env.TELEGRAM_SECRET_TOKEN) {
        console.warn("⚠️ Unauthorized webhook access attempt (missing or invalid secret token)");
        return res.status(403).json({ error: "Forbidden" });
      }

      console.log("🔔 Telegram webhook received");

      try {
        const message = req.body?.message;
        if (message) {
          await processIncomingMessage(message);
        } else {
          console.log("ℹ️ Webhook payload did not include a message object");
        }
        console.log("✅ Update processed successfully");
      } catch (error) {
        console.error("❌ Bot processing error:", error.message);
      }

      res.sendStatus(200);
    });
  }
}

app.use("/api/notify", notifyRoutes);

// -------- PUBLIC TRACKING --------
app.get("/api/tracking/:trackingNumber", async (req, res) => {
  try {
    const record = await Tracking.findByTrackingNumber(req.params.trackingNumber);
    if (!record) return res.status(404).json({ message: "Parcel not found" });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------- ADMIN AUTH --------
app.post("/api/admin/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await Admin.findByUsername(username);
    if (exists) return res.status(400).json({ error: "Exists" });

    const hash = await bcrypt.hash(password, 10);
    await Admin.create({ username, password: hash });

    res.json({ message: "Created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findByUsername(username);
    if (!admin) return res.status(401).json({ error: "Invalid" });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: "Invalid" });

    const token = jwt.sign({ id: admin.id }, SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// -------- ADMIN TRACKING (GET) --------
app.get("/api/admin/tracking", authMiddleware, async (req, res) => {
  try {
    const data = await Tracking.listAll({ limit: 500, order: 'desc' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});


// -------- UPDATE EXPECTED DELIVERY --------
app.put("/api/admin/tracking/delivery/:trackingNumber", authMiddleware, async (req, res) => {
  try {
    const { expectedDelivery } = req.body;
    
    const updated = await Tracking.updateExpectedDelivery(
      req.params.trackingNumber,
      expectedDelivery
    );

    if (!updated) return res.status(404).json({ error: "Tracking number not found" });
    
    res.json(updated);
  } catch (err) {
    console.error("Update delivery error:", err);
    res.status(500).json({ error: "Failed to update delivery date" });
  }
});

// -------- UPDATE STATUS & LOCATION --------
app.put("/api/admin/tracking/number/:trackingNumber", authMiddleware, async (req, res) => {
  try {
    const { status, location } = req.body;
    
    const updated = await Tracking.updateStatus(
      req.params.trackingNumber,
      status,
      location
    );

    if (!updated) return res.status(404).json({ error: "Tracking number not found" });
    
    res.json(updated);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});


// -------- CREATE DIRECT TRACKING (POST) --------
app.post("/api/admin/tracking", authMiddleware, async (req, res) => {
  try {
    // SAFETY FALLBACK: Ensure all items have an itemId and name
    const safeItems = (req.body.items || []).map((item, index) => {
      return {
        ...item,
        itemId: item.itemId || "ITEM-" + crypto.randomUUID().slice(0, 8),
        name: item.name || `Item ${index + 1}`
      };
    });

    // Create the tracking document
    const newTracking = await Tracking.create({
      sender: req.body.sender,
      receiver: req.body.receiver,
      origin: req.body.origin || req.body.sender?.address || "Unknown",
      destination: req.body.destination || req.body.receiver?.address || "Unknown",
      location: req.body.location || "Warehouse",
      status: req.body.status || "Pending",
      expectedDelivery: req.body.expectedDelivery,
      items: safeItems, 
      updates: [{ 
        status: req.body.status || "Created", 
        location: req.body.location || "Warehouse",
        timestamp: new Date().toISOString()
      }],
    });

    res.status(201).json(newTracking);
  } catch (err) {
    console.error("Error creating direct tracking:", err);
    res.status(500).json({ error: "Failed to create tracking entry" });
  }
});

// -------- PENDING SHIPMENTS --------
app.get("/api/admin/pending-shipments", authMiddleware, async (req, res) => {
  try {
    const shipments = await TempShipment.listAll({ limit: 500, order: 'desc' });
    res.json(shipments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pending shipments" });
  }
});

// -------- APPROVE SHIPMENT --------
app.post("/api/admin/approve-shipment/:id", authMiddleware, async (req, res) => {
  try {
    const temp = await TempShipment.findById(req.params.id);
    if (!temp) return res.status(404).json({ error: "Not found" });

    // SAFETY FALLBACK: Ensure all items have an itemId AND a name
    const safeItems = (temp.items || []).map((item, index) => {
      const itemObj = item;
      return {
        ...itemObj,
        itemId: itemObj.itemId || "ITEM-" + crypto.randomUUID().slice(0, 8),
        name: itemObj.name || `Item ${index + 1}`
      };
    });

    const tracking = await Tracking.create({
      sender: temp.sender,
      receiver: temp.receiver,
      origin: temp.origin || temp.sender?.address || "Unknown",
      destination: temp.destination || temp.receiver?.address || "Unknown",
      location: "Warehouse",
      status: "Pending",
      items: safeItems,
      updates: [{ status: "Created", timestamp: new Date().toISOString() }],
    });

    res.json({ message: "Approved", trackingNumber: tracking.trackingNumber });

    // Send approval email via Brevo helper and await completion
    if (temp.receiver?.email) {
      try {
        const approvalHtml = `<p>Tracking: ${tracking.trackingNumber}</p>`;
        await sendBrevoEmail({
          to: temp.receiver.email,
          subject: "Shipment Approved",
          html: approvalHtml,
          senderEmail: process.env.BREVO_SENDER_EMAIL,
          senderName: process.env.BREVO_SENDER_NAME,
        });
        console.log('✅ Approval email sent to', temp.receiver.email);
      } catch (err) {
        console.error('❌ Failed to send approval email:', err.response || err.message || err);
      }
    }

    await TempShipment.deleteById(temp.id || temp._id);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Approval failed" });
  }
});

// -------- REJECT --------
app.delete("/api/admin/reject-shipment/:id", authMiddleware, async (req, res) => {
  try {
    await TempShipment.deleteById(req.params.id);
    res.json({ message: "Rejected" });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// -------- DELETE TRACKING ENTRY --------
app.delete("/api/admin/tracking/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Tracking.deleteById(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Tracking entry not found" });
    }
    
    res.json({ message: "Tracking entry deleted successfully" });
  } catch (err) {
    console.error("Delete tracking error:", err);
    res.status(500).json({ error: "Failed to delete tracking entry" });
  }
});


// -------- CREATE SHIPMENT LINK --------
app.post("/api/admin/shipment-link", authMiddleware, async (req, res) => {
  try {
    const tempId = "TMP-" + crypto.randomUUID().slice(0, 8);

    await TempShipment.createShipment({
      tempId,
      sender: req.body.sender,
      items: req.body.items || [],
      origin: req.body.origin,
      destination: req.body.destination,
      status: "Pending Receiver Info",
    });

    res.json({ tempId });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// -------- RECEIVER SUBMIT --------
app.post("/api/receiver/submit/:id", async (req, res) => {
  try {
    const temp = await TempShipment.findByTempId(req.params.id);
    if (!temp) return res.status(404).json({ error: "Invalid link" });

    await TempShipment.updateByTempId(req.params.id, {
      receiver: req.body.receiver,
      status: "Awaiting Admin Approval",
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// ==========================================
// STATIC
// ==========================================
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/landing.html"))
);

app.get("/ping", (req, res) => res.send("pong"));

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Local development server running on port ${PORT}`);
  });
}

