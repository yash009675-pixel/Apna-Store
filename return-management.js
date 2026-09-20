const API = "https://xxedwtmdylfufrfzyrdb.supabase.co/functions/v1/apna-return-actions";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[char]));

async function callApi(body) {
  const { data: { session } } = await apnaSupabase.auth.getSession();
  if (!session) throw new Error("Sign in required.");

  const response = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function renderRows(rows) {
  if (!rows.length) {
    $("list").innerHTML = '<div class="card muted">No return requests.</div>';
    return;
  }

  const body = rows.map((item) => {
    const order = item.orders || {};
    const logistics = [
      item.return_shipment_id ? "Reverse shipment linked" : "Not created",
      item.reverse_pickup_id ? "Pickup linked" : ""
    ].filter(Boolean).join("<br>");

    const actions = item.status === "requested"
      ? '<button type="button" data-action="approve" data-id="' + esc(item.id) + '">Approve</button>' +
        '<button type="button" data-action="reject" data-id="' + esc(item.id) + '">Reject</button>'
      : "—";

    return "<tr>" +
      "<td><strong>" + esc(order.order_number) + "</strong><br>" + esc(order.delivery_status) + "</td>" +
      "<td>" + esc(item.request_type) + "</td>" +
      "<td>" + esc(item.reason) + "<br><span class=\"muted\">" + esc(item.details) + "</span></td>" +
      '<td><span class="badge">' + esc(item.status) + "</span><br>" + esc(item.resolution_notes) + "</td>" +
      "<td>" + esc(new Date(item.requested_at).toLocaleString("en-IN")) + "</td>" +
      "<td>" + logistics + "</td>" +
      '<td class="actions">' + actions + "</td>" +
      "</tr>";
  }).join("");

  $("list").innerHTML =
    '<div class="card"><table class="table">' +
    "<thead><tr><th>Order</th><th>Request</th><th>Reason</th><th>Status</th><th>Requested</th><th>Logistics</th><th>Action</th></tr></thead>" +
    "<tbody>" + body + "</tbody></table></div>";

  $("list").querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const note = window.prompt(
        button.dataset.action === "approve" ? "Approval note (optional):" : "Rejection note (optional):",
        ""
      );
      if (note === null) return;

      button.disabled = true;
      try {
        await callApi({
          action: button.dataset.action,
          return_request_id: button.dataset.id,
          note
        });
        await load();
      } catch (error) {
        window.alert(error.message || "Return action failed.");
        button.disabled = false;
      }
    });
  });
}

async function load() {
  $("msg").textContent = "Loading returns…";
  try {
    const data = await callApi({ action: "list" });
    const rows = data.return_requests || [];
    $("msg").textContent = rows.length + " return request(s)";
    renderRows(rows);
  } catch (error) {
    $("msg").textContent = error.message || "Could not load returns.";
    $("list").innerHTML = "";
  }
}

$("refresh").addEventListener("click", load);
load();