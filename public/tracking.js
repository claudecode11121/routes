const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://rapidroutes-five.vercel.app";



// Override the default alert() to log instead of showing popup
window.alert = function (message) {
  console.log("🔔 ALERT:", message);
};

let latestTrackingData = null; // store the last fetched tracking data

async function loadTrackingInfo() {
  const params = new URLSearchParams(window.location.search);
  const trackingNumber = params.get("number");
  const resultBox = document.getElementById("trackingResult");

  if (!trackingNumber) {
    resultBox.innerHTML = "<p>No tracking number provided.</p>";
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/tracking/${trackingNumber}`);
    const data = await response.json();

    if (response.ok) {
      latestTrackingData = data; // save for invoice generation

      const updates = Array.isArray(data.updates) ? data.updates : [];
      const items = Array.isArray(data.items) ? data.items : [];

      const sender = data.sender || {};
      const receiver = data.receiver || {};

      // Helper function to get status color and icon
      function getStatusStyle(status) {
        const statusLower = (status || "Pending").toLowerCase();
        const styles = {
          pending: { color: "#9CA3AF", bgColor: "#F3F4F6", icon: "⏳" },
          in_transit: { color: "#1c3f6e", bgColor: "#E3F2FD", icon: "🚚" },
          "in transit": { color: "#1c3f6e", bgColor: "#E3F2FD", icon: "🚚" },
          out_for_delivery: { color: "#FF9800", bgColor: "#FFF3E0", icon: "🔵" },
          "out for delivery": { color: "#FF9800", bgColor: "#FFF3E0", icon: "🔵" },
          delivered: { color: "#25d366", bgColor: "#E8F5E9", icon: "✓" },
          delayed: { color: "#e74c3c", bgColor: "#FFEBEE", icon: "⚠" }
        };
        return styles[statusLower] || styles.pending;
      }

      const statusStyle = getStatusStyle(data.status);
      const daysInTransit = data.createdAt ? Math.floor((Date.now() - new Date(data.createdAt)) / (1000 * 60 * 60 * 24)) : 0;

// Render HTML with premium design
resultBox.innerHTML = `
  <!-- STATUS HIGHLIGHT CARD -->
  <div class="status-card" style="background-color: ${statusStyle.bgColor}; border-left: 5px solid ${statusStyle.color};">
    <div class="status-header">
      <div class="tracking-number-large">
        <span class="label">Tracking Number</span>
        <span class="number">${data.trackingNumber}</span>
      </div>
      <div class="status-badge" style="background-color: ${statusStyle.color};">
        <span class="status-text">${data.status || "Pending"}</span>
      </div>
    </div>
  </div>

  <!-- KEY METRICS CARDS -->
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c3f6e" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      <div class="metric-content">
        <span class="metric-label">Days in Transit</span>
        <span class="metric-value">${daysInTransit}</span>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c3f6e" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
      <div class="metric-content">
        <span class="metric-label">Est. Delivery</span>
        <span class="metric-value">${data.expectedDelivery ? new Date(data.expectedDelivery).toLocaleDateString() : "Not set"}</span>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c3f6e" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
      <div class="metric-content">
        <span class="metric-label">Current Location</span>
        <span class="metric-value">${data.location || "Not Available"}</span>
      </div>
    </div>
  </div>

  <!-- SENDER / RECEIVER INFO CARDS -->
  <div class="info-cards-grid">
    <div class="info-card">
      <div class="card-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c3f6e" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <h3>Sender</h3>
      </div>
      <div class="card-content">
        <div class="info-row">
          <span class="info-label">Name</span>
          <span class="info-value">${sender.name || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">${sender.email || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${sender.phone || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Address</span>
          <span class="info-value">${sender.address || "N/A"}</span>
        </div>
      </div>
    </div>

    <div class="info-card">
      <div class="card-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25d366" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <h3>Receiver</h3>
      </div>
      <div class="card-content">
        <div class="info-row">
          <span class="info-label">Name</span>
          <span class="info-value">${receiver.name || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">${receiver.email || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${receiver.phone || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Address</span>
          <span class="info-value">${receiver.address || "N/A"}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ROUTE SUMMARY -->
  <div class="route-summary">
    <div class="route-point">
      <span class="route-point-label">From</span>
      <span class="route-point-value">${data.origin || "N/A"}</span>
    </div>
    <div class="route-arrow">
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
        <path d="M2 12 L38 12" stroke="#25d366" stroke-width="2" stroke-linecap="round"/>
        <path d="M32 6 L38 12 L32 18" stroke="#25d366" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="route-point">
      <span class="route-point-label">To</span>
      <span class="route-point-value">${data.destination || "N/A"}</span>
    </div>
  </div>

  <!-- ITEMS SECTION -->
  <div class="section">
    <h3>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; margin-right: 8px; vertical-align: middle;">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      Items in Shipment
    </h3>
    ${
      items.length > 0
        ? `<div class="items-grid">
            ${items.map(it => `
              <div class="item-card">
                <div class="item-header">
                  <span class="item-name">${it.name || "-"}</span>
                  <span class="item-qty">Qty: ${it.quantity || 1}</span>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">${it.description || "-"}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Weight</span>
                    <span class="detail-value">${it.weight || "-"} kg</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Cost</span>
                    <span class="detail-value">$${it.cost || 0}</span>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>`
        : "<p>No items listed for this parcel.</p>"
    }
  </div>

  <!-- TRACKING HISTORY TIMELINE -->
  <div class="section">
    <h3>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; margin-right: 8px; vertical-align: middle;">
        <circle cx="12" cy="12" r="1"></circle>
        <path d="M12 1v6m0 6v4"></path>
        <path d="M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24"></path>
        <path d="M1 12h6m6 0h4"></path>
        <path d="M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path>
      </svg>
      Tracking History
    </h3>
    ${
      updates.length > 0
        ? `<div class="timeline">
            ${updates.map((u, idx) => `
              <div class="timeline-item">
                <div class="timeline-marker">
                  <div class="timeline-dot"></div>
                  ${idx < updates.length - 1 ? '<div class="timeline-line"></div>' : ''}
                </div>
                <div class="timeline-content">
                  <div class="timeline-time">${u.timestamp ? new Date(u.timestamp).toLocaleString() : "Unknown Date"}</div>
                  <div class="timeline-location">${u.location || "Unknown Location"}</div>
                  <div class="timeline-status">${u.status || "No Status"}</div>
                </div>
              </div>
            `).join("")}
          </div>`
        : "<p>No tracking history yet.</p>"
    }
  </div>
      `;

        // ✅ NEW LINE HERE — triggers your route update in tracking.html
        document.dispatchEvent(new CustomEvent("trackingDataLoaded", { 
          detail: { 
            origin: data.origin, 
            destination: data.destination,
            sender, 
            receiver 
          } 
        }));


    } else {
      resultBox.innerHTML = `
        <h3>Parcel not found</h3>
        <p>${data.message || "We couldn’t locate tracking info for this number."}</p>
        <button onclick="window.location.href='/reschedule.html'">Reschedule Collection</button>
      `;
    }
  } catch (err) {
    console.error("Fetch error:", err);
    resultBox.innerHTML = "<p>⚠️ Error fetching tracking info. Please try again later.</p>";
  }
}


// ✅ Improved Invoice Generation with multiple items
// ✅ Final Improved Invoice Generation
// ✅ Final Polished Invoice with AutoTable
function generateInvoice() {
  if (!latestTrackingData) {
    alert("No tracking data available for invoice.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  const sender = latestTrackingData.sender || {};
  const receiver = latestTrackingData.receiver || {};

  // ================== HEADER ==================
  doc.addImage("./img/logistics2-copy.png", "PNG", 14, 10, 50, 20); // left logo
  doc.addImage("./img/cd3fac.jpg", "JPEG", pageWidth - 100, 10, 100, 50); // right banner

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INVOICE", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.text(
    `Tracking #: ${latestTrackingData.trackingNumber}`,
    39, // logo center
    35,
    { align: "center" }
  );

  // ================== COMPANY INFO ==================
let y = 70;
const companyInfo = [
  { text: "RapidRoute Logistics & Delivery Company", bold: true, size: 16 },
  { text: "Address: USA, Europe, Africa", bold: true, size: 16 },
  { text: "Email: support@rapidroute.com", bold: true, size: 16 },
  { text: "Website: www.rapidroute.com", bold: true, size: 12 }
];

companyInfo.forEach(line => {
  doc.setFont("helvetica", line.bold ? "bold" : "normal");
  doc.setFontSize(line.size || 12); // fallback if size is missing
  const textWidth = doc.getTextWidth(line.text);
  const x = (pageWidth - textWidth) / 2; // center align
  doc.text(line.text, x, y);
  y += line.size > 16 ? 4 : 6; // add more spacing if font is big
});


  // Divider
  doc.setLineWidth(0.1);
  doc.line(20, y + 2, pageWidth - 20, y + 2);
  y += 15;

    // ================== SHIPMENT INFO ==================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Shipment Information", 14, y);
  y += 8;

  // --- Generate barcode ---
  const canvas = document.getElementById("barcode");
  JsBarcode(canvas, latestTrackingData.trackingNumber || "N/A", {
    format: "CODE128",
    lineColor: "#000",
    width: 2,
    height: 40,
    displayValue: true // shows tracking number under barcode
  });

  // Convert barcode to image and place above Order ID
  const barcodeImg = canvas.toDataURL("image/png");
  doc.addImage(barcodeImg, "PNG", pageWidth / 2 + 10, y - 14, 50, 15); // right side
  y += 5; // add spacing below barcode

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const infoLeft = [
    `Est. Delivery: ${
      latestTrackingData.expectedDelivery
        ? new Date(latestTrackingData.expectedDelivery).toLocaleDateString()
        : "Not set"
    }`,
    `Mode of Transport: Air Freight`
  ];
  const infoRight = [
    `Order ID: ${latestTrackingData._id || "N/A"}`,
    `Payment Mode: Online Payment`
  ];

  infoLeft.forEach((line, i) => {
    doc.text(line, 14, y + i * 6);
  });
  infoRight.forEach((line, i) => {
    doc.text(line, pageWidth / 2 + 10, y + i * 6);
  });
  y += 18;


  // ================== SENDER / RECEIVER ==================
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("FROM (SENDER)", 14, y - 2);
  doc.text("TO (CONSIGNEE)", pageWidth / 2 + 10, y - 2);
  y += 7;

  function capitalizeWords(str) {
    return str
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  doc.setFontSize(20);

  doc.text(capitalizeWords(sender.name || "N/A"), 14, y);
  doc.text(capitalizeWords(receiver.name || "N/A"), pageWidth / 2 + 10, y);

  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Address: ${sender.address || "-"}`, 14, y);
  doc.text(`Address: ${receiver.address || "-"}`, pageWidth / 2 + 10, y);
  y += 6;

  doc.text(`Phone: ${sender.phone || "-"}`, 14, y);
  doc.text(`Phone: ${receiver.phone || "-"}`, pageWidth / 2 + 10, y);
  y += 6;

  doc.text(`Email: ${sender.email || "-"}`, 14, y);
  doc.text(`Email: ${receiver.email || "-"}`, pageWidth / 2 + 10, y);
  y += 16;

  // ================== SHIPMENT DETAILS TABLE ==================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Shipment Details", 14, y + 2);
  y += 6;

  const tableData = latestTrackingData.items.map(item => [
  item.quantity || 1,
  "Parcel ",
  item.name || "-",
  item.description || "-",
  "$" + ((item.cost || 0) * (item.quantity || 1))
  ]);

  doc.autoTable({
      startY: y + 4,
      head: [["Qty", "Type of Shipment", "Product", "Description", "Total Cost"]],
      body: tableData,
      styles: { font: "helvetica", fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [60, 60, 243], textColor: 255, fontStyle: "bold" },
      tableWidth: 'auto'
  });


  y = doc.lastAutoTable.finalY + 15;


  // After the table, add a grand total
  const totalAmount = latestTrackingData.items.reduce((sum, item) => {
    return sum + (item.cost || 0) * (item.quantity || 1);
  }, 0);

  doc.setFontSize(12);
  doc.text(`Grand Total: $${totalAmount.toFixed(2)}`, pageWidth - 70, doc.lastAutoTable.finalY + 10);




  // ================== FOOTER ==================
  doc.setLineWidth(0.3);
  doc.line(14, y + 30, pageWidth - 14, y + 30);

  y += 38;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text("Payment Methods:", 14, y);
  doc.text("Visa / MasterCard / PayPal", 14, y + 6);

  doc.text(
    `Official Stamp / ${new Date().toLocaleDateString()}`,
    pageWidth - 70,
    y
  );

  // ================== SAVE ==================
  doc.save(`Invoice_${latestTrackingData.trackingNumber}.pdf`);
}

window.onload = () => {
  loadTrackingInfo();
  document.getElementById("generateInvoiceBtn").addEventListener("click", generateInvoice);
};
