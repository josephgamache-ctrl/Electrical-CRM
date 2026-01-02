import jwtDecode from "jwt-decode";

export const API_BASE_URL = "/api";

// Development-only logging utility - logs are stripped in production builds
const isDev = process.env.NODE_ENV === 'development';
const logError = (message, error) => {
  if (isDev) {
    console.error(message, error);
  }
};

const withAuthHeaders = (token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  ...extra,
});

async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ username, password }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Login failed for ${username}:`, error);
    throw error;
  }
}

// Session expired error class for proper handling
class SessionExpiredError extends Error {
  constructor(message = "Session expired - please log in again") {
    super(message);
    this.name = "SessionExpiredError";
    this.isSessionExpired = true;
  }
}

// Helper to clear auth state
function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
}

// Helper to safely redirect to login (avoids infinite loops)
// IMPORTANT: Only call this from top-level error handlers, not from API functions
function redirectToLogin() {
  // Only redirect if we're not already on the login page
  if (!window.location.pathname.startsWith("/login")) {
    // Use replace to avoid polluting history
    window.location.replace("/login");
  }
}

function requireToken() {
  const token = localStorage.getItem("token");
  if (!token) {
    // Don't redirect here - let the calling code handle it
    throw new SessionExpiredError("Authentication token not found");
  }

  // Check if token is expired
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;

    // If token expires in less than 60 seconds, treat as expired
    if (decoded.exp && decoded.exp < currentTime + 60) {
      clearAuthState();
      // Throw error for calling code to handle - don't redirect directly
      // This allows React Router and App.js to handle the redirect properly
      throw new SessionExpiredError("Session expired - please log in again");
    }
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      throw err;
    }
    // If token decode fails, it's invalid
    clearAuthState();
    throw new SessionExpiredError("Invalid session - please log in again");
  }

  return token;
}

// ============================================================
// INVENTORY ENDPOINTS
// ============================================================

async function fetchInventory() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch inventory error:", error);
    throw error;
  }
}

async function fetchLowStock() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/low-stock`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch low stock error:", error);
    throw error;
  }
}

async function fetchInventoryItem(id) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch inventory item ${id} error:`, error);
    throw error;
  }
}

async function fetchInventoryByBarcode(upc) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/barcode/${encodeURIComponent(upc)}`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch inventory by barcode ${upc} error:`, error);
    throw error;
  }
}

async function createInventoryItem(data) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Create inventory item error:", error);
    throw error;
  }
}

async function updateInventoryItem(id, data) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
      method: "PATCH",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Update inventory item ${id} error:`, error);
    throw error;
  }
}

async function deleteInventoryItem(id) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
      method: "DELETE",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Delete inventory item ${id} error:`, error);
    throw error;
  }
}

// ============================================================
// STOCK MANAGEMENT
// ============================================================

async function adjustStock(itemId, quantityChange, reason = null) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/${itemId}/adjust-stock`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        quantity_change: quantityChange,
        reason: reason,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Adjust stock error for item ${itemId}:`, error);
    throw error;
  }
}

async function fetchStockTransactions(id) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/${id}/transactions`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch transactions for ID ${id} error:`, error);
    throw error;
  }
}

// ============================================================
// SEARCH & CATEGORIES
// ============================================================

async function searchInventory(query) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/inventory/search?query=${encodeURIComponent(query)}`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Search inventory error for query '${query}':`, error);
    throw error;
  }
}

async function fetchCategories() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch categories error:", error);
    throw error;
  }
}

// ============================================================
// IMPORT/EXPORT
// ============================================================

async function uploadInventory(file) {
  const token = requireToken();
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/inventory/import`, {
      method: "POST",
      headers: withAuthHeaders(token),
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Upload inventory error:", error);
    throw error;
  }
}

// ============================================================
// USER SETTINGS
// ============================================================

export async function fetchUserSettings() {
  const token = localStorage.getItem("token");
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch user settings error:", error);
    return null;
  }
}

export async function persistUserSettings(nextSettings) {
  const token = localStorage.getItem("token");
  if (!token) {
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(nextSettings),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  } catch (error) {
    logError("Persist user settings error:", error);
  }
}

// ============================================================
// VENDOR MANAGEMENT
// ============================================================

async function getVendors() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/vendors`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch vendors error:", error);
    throw error;
  }
}

// ============================================================
// WORK ORDERS
// ============================================================

async function fetchWorkOrders(status = null, assigned_to = null) {
  const token = requireToken();
  try {
    let url = `${API_BASE_URL}/work-orders`;
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (assigned_to) params.append('assigned_to', assigned_to);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch work orders error:", error);
    throw error;
  }
}

async function createWorkOrder(workOrderData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(workOrderData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Create work order error:", error);
    throw error;
  }
}

async function fetchWorkOrder(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch work order ${workOrderId} error:`, error);
    throw error;
  }
}

async function updateWorkOrder(workOrderId, workOrderData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}`, {
      method: "PATCH",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(workOrderData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Update work order ${workOrderId} error:`, error);
    throw error;
  }
}

async function allocateMaterials(workOrderId, materialIds) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/allocate-materials`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(materialIds),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Allocate materials for WO ${workOrderId} error:`, error);
    throw error;
  }
}

async function deallocateMaterials(workOrderId, materialIds) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/deallocate-materials`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(materialIds),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Deallocate materials for WO ${workOrderId} error:`, error);
    throw error;
  }
}

async function addMaterialToWorkOrder(workOrderId, material) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/add-material`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(material),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Add material to WO ${workOrderId} error:`, error);
    throw error;
  }
}

async function removeMaterialFromWorkOrder(workOrderId, materialId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/materials/${materialId}`, {
      method: "DELETE",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Remove material from WO ${workOrderId} error:`, error);
    throw error;
  }
}

async function fetchCustomers() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Fetch customers error:", error);
    throw error;
  }
}

async function createCustomer(customerData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(customerData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError("Create customer error:", error);
    throw error;
  }
}

async function updateCustomer(customerId, customerData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
      method: "PUT",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(customerData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Update customer ${customerId} error:`, error);
    throw error;
  }
}

async function deleteCustomer(customerId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
      method: "DELETE",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Delete customer ${customerId} error:`, error);
    throw error;
  }
}

// ============================================================
// WORK ORDER NOTES & PHOTOS
// ============================================================

async function fetchWorkOrderNotes(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/notes`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch work order notes error:`, error);
    throw error;
  }
}

async function addWorkOrderNote(workOrderId, note) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/notes`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ note_text: note }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Add work order note error:`, error);
    throw error;
  }
}

async function deleteWorkOrderNote(workOrderId, noteId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/notes/${noteId}`, {
      method: "DELETE",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Delete work order note error:`, error);
    throw error;
  }
}

async function fetchWorkOrderPhotos(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/photos`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch work order photos error:`, error);
    throw error;
  }
}

async function uploadWorkOrderPhoto(workOrderId, file, options = {}) {
  const token = requireToken();
  const { caption = null, notes = null, photoType = 'general' } = options;

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) {
      formData.append('caption', caption);
    }
    if (notes) {
      formData.append('notes', notes);
    }
    formData.append('photo_type', photoType);

    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/photos`, {
      method: "POST",
      headers: withAuthHeaders(token),
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Upload work order photo error:`, error);
    throw error;
  }
}

async function deleteWorkOrderPhoto(workOrderId, photoId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/photos/${photoId}`, {
      method: "DELETE",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Delete work order photo error:`, error);
    throw error;
  }
}

function getPhotoUrl(filename) {
  return `${API_BASE_URL}/work-orders/photos/${filename}`;
}

// Fetch photo with authentication and return blob URL for viewing
/**
 * Fetches a photo with authentication and returns a blob URL.
 * IMPORTANT: Caller MUST call URL.revokeObjectURL(url) when done to prevent memory leaks.
 * @param {string} filename - The photo filename to fetch
 * @returns {Promise<string>} A blob URL that must be revoked when no longer needed
 */
async function fetchAuthenticatedPhoto(filename) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/photos/${filename}`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch photo`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    logError('Fetch authenticated photo error:', error);
    throw error;
  }
}

// ============================================================
// USER & ADMIN ENDPOINTS
// ============================================================

async function getCurrentUser() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/user/me`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get current user error:', error);
    throw error;
  }
}

async function updateUserProfile(profileData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(profileData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logError('Update user profile error:', error);
    throw error;
  }
}

async function changePassword(currentPassword, newPassword) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/user/change-password`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logError('Change password error:', error);
    throw error;
  }
}

async function getUserSettings() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get user settings error:', error);
    throw error;
  }
}

async function updateUserSettings(settings) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/user/settings`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Update user settings error:', error);
    throw error;
  }
}

// ============================================================
// COMMUNICATION SETTINGS (Email/SMS)
// ============================================================

async function getCommunicationSettings() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get communication settings error:', error);
    throw error;
  }
}

async function saveEmailSettings(settings) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/email`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Save email settings error:', error);
    throw error;
  }
}

async function testEmailSettings(toEmail) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/email/test`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ to_email: toEmail }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Test email settings error:', error);
    throw error;
  }
}

async function saveSmsSettings(settings) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/sms`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Save SMS settings error:', error);
    throw error;
  }
}

async function testSmsSettings(toPhone) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/sms/test`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ to_phone: toPhone }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Test SMS settings error:', error);
    throw error;
  }
}

// SMS Gateway (Free - uses email to send SMS via carrier gateways)
async function saveSmsGatewaySettings(settings) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/sms-gateway`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Save SMS Gateway settings error:', error);
    throw error;
  }
}

async function testSmsGatewaySettings(toPhone, carrier) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/sms-gateway/test`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ to_phone: toPhone, carrier: carrier }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Test SMS Gateway settings error:', error);
    throw error;
  }
}

async function deleteCommunicationSetting(settingType) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/settings/communication/${settingType}`, {
      method: "DELETE",
      headers: withAuthHeaders(token),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Delete communication setting error:', error);
    throw error;
  }
}

async function getCommunicationLog(filters = {}) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (filters.type) params.append('communication_type', filters.type);
    if (filters.status) params.append('status', filters.status);
    if (filters.relatedType) params.append('related_type', filters.relatedType);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const url = `${API_BASE_URL}/settings/communication/log${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get communication log error:', error);
    throw error;
  }
}

async function fetchUsers() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Fetch users error:', error);
    throw error;
  }
}

async function createUser(userData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Create user error:', error);
    throw error;
  }
}

async function updateUser(username, userData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${username}`, {
      method: "PUT",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Update user error:', error);
    throw error;
  }
}

async function deleteUser(username) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/${username}`, {
      method: "DELETE",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Delete user error:', error);
    throw error;
  }
}

// ============================================================
// TIME TRACKING API FUNCTIONS
// ============================================================

/**
 * Get the current user's timecard for a specific week
 * @param {string} weekEnding - Optional week ending date (Sunday) in YYYY-MM-DD format
 * @returns {Promise<Object>} - Timecard data with entries and totals
 */
async function getMyWeekTimecard(weekEnding = null) {
  const token = requireToken();
  try {
    const url = weekEnding
      ? `${API_BASE_URL}/time-entries/my-week?week_ending=${weekEnding}`
      : `${API_BASE_URL}/time-entries/my-week`;

    const response = await fetch(url, {
      method: "GET",
      headers: withAuthHeaders(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get my week timecard error:', error);
    throw error;
  }
}

/**
 * Get list of available jobs for time entry, prioritized by assignment
 * @param {string} workDate - Work date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Grouped jobs by priority
 */
async function getAvailableJobsForTimecard(workDate) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries/available-jobs?work_date=${workDate}`, {
      method: "GET",
      headers: withAuthHeaders(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get available jobs error:', error);
    throw error;
  }
}

/**
 * Create multiple time entries at once (batch submit)
 * @param {string} workDate - Work date in YYYY-MM-DD format
 * @param {Array} entries - Array of entry objects {work_order_id, hours_worked, notes}
 * @returns {Promise<Object>} - Created entries
 */
async function createTimeEntriesBatch(workDate, entries) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries/batch`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        work_date: workDate,
        entries: entries
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Create time entries batch error:', error);
    throw error;
  }
}

/**
 * Create a single time entry
 * @param {Object} entry - Entry data {work_order_id, work_date, hours_worked, notes, break_minutes}
 * @returns {Promise<Object>} - Created entry
 */
async function createTimeEntry(entry) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Create time entry error:', error);
    throw error;
  }
}

/**
 * Update an existing time entry
 * @param {number} entryId - Time entry ID
 * @param {Object} updates - Fields to update {hours_worked, notes, break_minutes}
 * @returns {Promise<Object>} - Updated entry
 */
async function updateTimeEntry(entryId, updates) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries/${entryId}`, {
      method: "PUT",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Update time entry error:', error);
    throw error;
  }
}

/**
 * Delete a time entry
 * @param {number} entryId - Time entry ID
 * @returns {Promise<Object>} - Deletion confirmation
 */
async function deleteTimeEntry(entryId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries/${entryId}`, {
      method: "DELETE",
      headers: withAuthHeaders(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Delete time entry error:', error);
    throw error;
  }
}

/**
 * Get all time entries for a specific work order (managers/admins only)
 * @param {number} workOrderId - Work order ID
 * @returns {Promise<Object>} - Time entries and totals for the work order
 */
async function getTimeEntriesForWorkOrder(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries/work-order/${workOrderId}`, {
      method: "GET",
      headers: withAuthHeaders(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get time entries for work order error:', error);
    throw error;
  }
}

/**
 * Lock a week's time entries for payroll (admin only)
 * @param {string} weekEnding - Week ending date (Sunday) in YYYY-MM-DD format
 * @returns {Promise<Object>} - Lock confirmation with count
 */
async function lockWeekForPayroll(weekEnding) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/time-entries/lock-week`, {
      method: "POST",
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ week_ending: weekEnding }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Lock week for payroll error:', error);
    throw error;
  }
}

// ============================================================================
// REPORTS API FUNCTIONS
// ============================================================================

async function getFinancialSnapshot() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/reports/financial-snapshot`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get financial snapshot error:', error);
    throw error;
  }
}

async function getJobFinancialDetail(filters = {}) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.customer_id) params.append('customer_id', filters.customer_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const url = `${API_BASE_URL}/reports/job-financial-detail${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get job financial detail error:', error);
    throw error;
  }
}

async function getMonthlySummary(months = 12) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/reports/monthly-summary?months=${months}`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get monthly summary error:', error);
    throw error;
  }
}

async function getCustomerSummary(limit = 100, minLifetimeValue = 0) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/reports/customer-summary?limit=${limit}&min_lifetime_value=${minLifetimeValue}`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get customer summary error:', error);
    throw error;
  }
}

async function getInventoryValuation(category = null, lowStockOnly = false) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (lowStockOnly) params.append('low_stock_only', 'true');

    const url = `${API_BASE_URL}/reports/inventory-valuation${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get inventory valuation error:', error);
    throw error;
  }
}

async function getEmployeeProductivity() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/reports/employee-productivity`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get employee productivity error:', error);
    throw error;
  }
}

async function getFinancialReportDateRange(startDate, endDate) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/reports/date-range?start_date=${startDate}&end_date=${endDate}`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get financial report date range error:', error);
    throw error;
  }
}

// ============================================================
// PROFIT & LOSS REPORT
// ============================================================

async function getProfitLossReport(options = {}) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (options.period) params.append('period', options.period);
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    if (options.view) params.append('view', options.view);
    if (options.groupBy) params.append('group_by', options.groupBy);

    const url = `${API_BASE_URL}/reports/profit-loss${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get profit loss report error:', error);
    throw error;
  }
}

async function getProfitLossComparison(period1Start, period1End, period2Start, period2End) {
  const token = requireToken();
  try {
    const params = new URLSearchParams({
      period1_start: period1Start,
      period1_end: period1End,
      period2_start: period2Start,
      period2_end: period2End
    });

    const response = await fetch(`${API_BASE_URL}/reports/profit-loss/compare?${params.toString()}`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get profit loss comparison error:', error);
    throw error;
  }
}

async function getJobProfitabilityDetail(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/reports/profitability/job/${workOrderId}`, {
      headers: { ...withAuthHeaders(token) },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get job profitability detail error:', error);
    throw error;
  }
}

// ============================================================
// WORK ORDER STATUS UPDATE
// ============================================================

async function updateWorkOrderStatus(workOrderId, status) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/status`, {
      method: 'PATCH',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Update work order status error:`, error);
    throw error;
  }
}

// ============================================================
// INVOICES
// ============================================================

async function fetchInvoices(status = null, customerId = null) {
  const token = requireToken();
  try {
    let url = `${API_BASE_URL}/invoices`;
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (customerId) params.append('customer_id', customerId);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, {
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Fetch invoices error:`, error);
    throw error;
  }
}

async function fetchInvoice(invoiceId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Fetch invoice error:`, error);
    throw error;
  }
}

async function createInvoice(invoiceData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(invoiceData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Create invoice error:`, error);
    throw error;
  }
}

async function updateInvoice(invoiceId, invoiceData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(invoiceData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Update invoice error:`, error);
    throw error;
  }
}

async function deleteInvoice(invoiceId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Delete invoice error:`, error);
    throw error;
  }
}

async function recordInvoicePayment(invoiceId, paymentData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Record payment error:`, error);
    throw error;
  }
}

async function markInvoiceSent(invoiceId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Mark invoice sent error:`, error);
    throw error;
  }
}

async function getInvoiceStats() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/invoices/summary/stats`, {
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Get invoice stats error:`, error);
    throw error;
  }
}

export {
  login,
  fetchInventory,
  fetchLowStock,
  fetchInventoryItem,
  fetchInventoryByBarcode,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustStock,
  fetchStockTransactions,
  searchInventory,
  fetchCategories,
  uploadInventory,
  getVendors,
  fetchWorkOrders,
  createWorkOrder,
  fetchWorkOrder,
  updateWorkOrder,
  allocateMaterials,
  deallocateMaterials,
  addMaterialToWorkOrder,
  removeMaterialFromWorkOrder,
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchWorkOrderNotes,
  addWorkOrderNote,
  deleteWorkOrderNote,
  fetchWorkOrderPhotos,
  uploadWorkOrderPhoto,
  deleteWorkOrderPhoto,
  getPhotoUrl,
  fetchAuthenticatedPhoto,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  getUserSettings,
  updateUserSettings,
  // Communication Settings (Email/SMS)
  getCommunicationSettings,
  saveEmailSettings,
  testEmailSettings,
  saveSmsSettings,
  testSmsSettings,
  saveSmsGatewaySettings,
  testSmsGatewaySettings,
  deleteCommunicationSetting,
  getCommunicationLog,
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  // Time Tracking
  getMyWeekTimecard,
  getAvailableJobsForTimecard,
  createTimeEntriesBatch,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getTimeEntriesForWorkOrder,
  lockWeekForPayroll,
  getFinancialSnapshot,
  getJobFinancialDetail,
  getMonthlySummary,
  getCustomerSummary,
  getInventoryValuation,
  getEmployeeProductivity,
  getFinancialReportDateRange,
  getProfitLossReport,
  getProfitLossComparison,
  getJobProfitabilityDetail,
  updateWorkOrderStatus,
  // Invoices
  fetchInvoices,
  fetchInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recordInvoicePayment,
  markInvoiceSent,
  getInvoiceStats,
  // Work Order Tasks
  fetchWorkOrderTasks,
  createWorkOrderTask,
  updateWorkOrderTask,
  deleteWorkOrderTask,
  convertScopeToTasks,
  // Work Order Activity
  fetchWorkOrderActivity,
  // Notifications
  fetchNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  generateNotifications,
  // Employee Availability / Call-Out
  getEmployeeAvailability,
  setEmployeeAvailability,
  deleteEmployeeAvailability,
  employeeCallOut,
  getEmployeesUnavailableToday,
  getEmployeesAvailableForDate,
  // PTO Request and Approval
  requestPTO,
  getPendingPTORequests,
  approvePTORequest,
  getAllPTORecords,
  // Dashboard
  getMyDashboardJobs,
  // Manager-Worker Assignments
  getManagers,
  getWorkers,
  getManagerWorkerAssignments,
  getManagerWorkers,
  assignWorkerToManager,
  removeWorkerFromManager,
  bulkAssignWorkersToManager,
  // Session management helpers
  SessionExpiredError,
  clearAuthState,
  redirectToLogin,
};

// ============================================================
// DASHBOARD
// ============================================================

async function getMyDashboardJobs() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/my-jobs`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Get my dashboard jobs error:`, error);
    throw error;
  }
}

// ============================================================
// WORK ORDER TASKS
// ============================================================

async function fetchWorkOrderTasks(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/tasks`, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch work order tasks error:`, error);
    throw error;
  }
}

async function createWorkOrderTask(workOrderId, taskData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/tasks`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(taskData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Create work order task error:`, error);
    throw error;
  }
}

async function updateWorkOrderTask(workOrderId, taskId, taskData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(taskData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Update work order task error:`, error);
    throw error;
  }
}

async function deleteWorkOrderTask(workOrderId, taskId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Delete work order task error:`, error);
    throw error;
  }
}

async function convertScopeToTasks(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/convert-scope-to-tasks`, {
      method: 'POST',
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Convert scope to tasks error:`, error);
    throw error;
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

async function fetchNotifications(unreadOnly = false, notificationType = null, limit = 50) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (unreadOnly) params.append('unread_only', 'true');
    if (notificationType) params.append('notification_type', notificationType);
    params.append('limit', limit.toString());

    const url = `${API_BASE_URL}/notifications?${params.toString()}`;
    const response = await fetch(url, {
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Fetch notifications error:', error);
    throw error;
  }
}

async function getNotificationCount() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/count`, {
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get notification count error:', error);
    throw error;
  }
}

async function markNotificationRead(notificationId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Mark notification read error:', error);
    throw error;
  }
}

async function markAllNotificationsRead() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Mark all notifications read error:', error);
    throw error;
  }
}

async function dismissNotification(notificationId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/dismiss`, {
      method: 'POST',
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Dismiss notification error:', error);
    throw error;
  }
}

async function generateNotifications() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/generate`, {
      method: 'POST',
      headers: withAuthHeaders(token)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Generate notifications error:', error);
    throw error;
  }
}

// ============================================================
// WORK ORDER ACTIVITY LOG
// ============================================================

async function fetchWorkOrderActivity(workOrderId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/work-orders/${workOrderId}/activity`, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError(`Fetch work order activity error:`, error);
    throw error;
  }
}

// ============================================================
// EMPLOYEE AVAILABILITY / CALL-OUT MANAGEMENT
// ============================================================

async function getEmployeeAvailability(username, startDate = null, endDate = null) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/employees/${username}/availability${queryString ? '?' + queryString : ''}`;

    const response = await fetch(url, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get employee availability error:', error);
    throw error;
  }
}

async function setEmployeeAvailability(username, availabilityData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/employees/${username}/availability`, {
      method: 'POST',
      headers: withAuthHeaders(token),
      body: JSON.stringify(availabilityData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Set employee availability error:', error);
    throw error;
  }
}

async function deleteEmployeeAvailability(username, availabilityId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/employees/${username}/availability/${availabilityId}`, {
      method: 'DELETE',
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Delete employee availability error:', error);
    throw error;
  }
}

async function employeeCallOut(username, callOutData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/employees/${username}/call-out`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(callOutData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Employee call-out error:', error);
    throw error;
  }
}

async function getEmployeesUnavailableToday() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/employees/unavailable-today`, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get unavailable employees error:', error);
    throw error;
  }
}

async function getEmployeesAvailableForDate(targetDate, startTime = '07:00', endTime = '15:30') {
  const token = requireToken();
  try {
    const params = new URLSearchParams({
      target_date: targetDate,
      start_time: startTime,
      end_time: endTime
    });

    const response = await fetch(`${API_BASE_URL}/employees/available-for-date?${params.toString()}`, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get available employees error:', error);
    throw error;
  }
}

// ============================================================
// PTO REQUEST AND APPROVAL
// ============================================================

async function requestPTO(username, ptoData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/employees/${username}/request-pto`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(ptoData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Request PTO error:', error);
    throw error;
  }
}

async function getPendingPTORequests() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/pto/pending`, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get pending PTO requests error:', error);
    throw error;
  }
}

async function approvePTORequest(ptoId, approvalData) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/pto/${ptoId}/approve`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(approvalData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Approve PTO request error:', error);
    throw error;
  }
}

async function getAllPTORecords(filters = {}) {
  const token = requireToken();
  try {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.employee_username) params.append('employee_username', filters.employee_username);
    if (filters.include_pending !== undefined) params.append('include_pending', filters.include_pending);

    const url = `${API_BASE_URL}/pto/all${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: withAuthHeaders(token)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    logError('Get all PTO records error:', error);
    throw error;
  }
}

// ============================================================
// MANAGER-WORKER ASSIGNMENTS
// ============================================================

async function getManagers() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/managers`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logError('Get managers error:', error);
    throw error;
  }
}

async function getWorkers() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/workers`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logError('Get workers error:', error);
    throw error;
  }
}

async function getManagerWorkerAssignments() {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/manager-workers`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logError('Get manager-worker assignments error:', error);
    throw error;
  }
}

async function getManagerWorkers(managerUsername) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/manager-workers/${managerUsername}`, {
      headers: withAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logError('Get manager workers error:', error);
    throw error;
  }
}

async function assignWorkerToManager(managerUsername, workerUsername, notes = '') {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/manager-workers`, {
      method: 'POST',
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ manager_username: managerUsername, worker_username: workerUsername, notes }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logError('Assign worker to manager error:', error);
    throw error;
  }
}

async function removeWorkerFromManager(assignmentId) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/manager-workers/${assignmentId}`, {
      method: 'DELETE',
      headers: withAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logError('Remove worker from manager error:', error);
    throw error;
  }
}

async function bulkAssignWorkersToManager(managerUsername, workerUsernames) {
  const token = requireToken();
  try {
    const response = await fetch(`${API_BASE_URL}/admin/manager-workers/bulk/${managerUsername}`, {
      method: 'PUT',
      headers: withAuthHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(workerUsernames),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logError('Bulk assign workers to manager error:', error);
    throw error;
  }
}
