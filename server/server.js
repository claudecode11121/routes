require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Routes & Models
const notifyRoutes = require("./routes/notifyRoutes");
const telegramNotify = require("./routes/telegramNotify"); // Telegram notifications
const Tracking = require("./models/Tracking.supabase");
const Admin = require("./models/Admin.supabase");
const TempShipment = require("./models/TempShipment.supabase");
const { bot } = require("./telegramBot");

const app = express();

// ==========================================
// 1. GLOBAL MIDDLEWARE
// ==========================================
app.use(express.json());

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
const BASE_URL = process.env.BASE_URL || "https://www.rapidroutesltd.com";

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
    
    bot.setWebHook(webhookUrl)
      .then(() => {
        webhookSetSuccess = true;
        console.log(`✅ Telegram Webhook successfully set to: ${webhookUrl}`);
      })
      .catch(err => {
        console.error("❌ Failed to set Telegram webhook:", err.message);
      });

    // Catch the messages using the clean path
    app.post(webhookPath, async (req, res) => {
      console.log("🔔 TELEGRAM KNOCKING! Message:", JSON.stringify(req.body.message));
      
      try {
        // Add 'await' so Vercel does not kill the server before the bot sends the message!
        await bot.processUpdate(req.body); 
      } catch (error) {
        console.error("Bot Error:", error);
      }
      
      // ONLY send 200 after the bot has fully finished talking
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

    // Non-blocking email
    if (temp.receiver?.email) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      transporter
        .sendMail({
          from: process.env.EMAIL_USER,
          to: temp.receiver.email,
          subject: "Shipment Approved",
          html: `<p>Tracking: ${tracking.trackingNumber}</p>`,
        })
        .catch(console.error);
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

