"""
Purchase Orders Module API Endpoints
Handles purchase order management, receiving, and vendor ordering.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Purchase Orders"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None
_log_and_raise = None


def init_purchase_orders_module(db_func, auth_func, log_raise_func):
    """Initialize the module with database, auth, and error handling functions from main.py"""
    global _get_db_connection, _get_current_user, _log_and_raise
    _get_db_connection = db_func
    _get_current_user = auth_func
    _log_and_raise = log_raise_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user(token)


def require_admin_access(current_user: dict):
    """Check if user is admin."""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")


# ============================================================
# PYDANTIC MODELS
# ============================================================

class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    notes: Optional[str] = None
    items: list  # List of {inventory_id, quantity_ordered, unit_cost}


class PurchaseOrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class ReceiveItemsRequest(BaseModel):
    items: list  # List of {purchase_order_item_id, quantity_received}


# ============================================================
# PURCHASE ORDER ENDPOINTS
# ============================================================

@router.get("/purchase-orders")
async def get_purchase_orders(
    request: Request,
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get all purchase orders with optional filters and pagination"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        base_query = """
            FROM purchase_orders po
            LEFT JOIN vendors v ON po.vendor_id = v.id
            WHERE 1=1
        """
        params = []

        if status:
            base_query += " AND po.status = %s"
            params.append(status)
        if vendor_id:
            base_query += " AND po.vendor_id = %s"
            params.append(vendor_id)
        if search:
            base_query += " AND (po.po_number ILIKE %s OR v.vendor_name ILIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param])

        # Get total count
        cur.execute(f"SELECT COUNT(*) as total {base_query}", params)
        total = cur.fetchone()['total']

        # Get paginated results
        select_query = f"""
            SELECT
                po.*,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as item_count,
                (SELECT COALESCE(SUM(quantity_ordered * unit_cost), 0)
                 FROM purchase_order_items WHERE purchase_order_id = po.id) as total_amount,
                (SELECT COALESCE(SUM(quantity_received), 0)
                 FROM purchase_order_items WHERE purchase_order_id = po.id) as total_received
            {base_query}
            ORDER BY po.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])

        cur.execute(select_query, params)
        orders = cur.fetchall()

        # Convert to list of dicts and handle dates
        results = []
        for order in orders:
            o = dict(order)
            if o.get('created_at'):
                o['created_at'] = str(o['created_at'])
            if o.get('updated_at'):
                o['updated_at'] = str(o['updated_at'])
            if o.get('order_date'):
                o['order_date'] = str(o['order_date'])
            if o.get('expected_date'):
                o['expected_date'] = str(o['expected_date'])
            if o.get('received_date'):
                o['received_date'] = str(o['received_date'])
            if o.get('approved_at'):
                o['approved_at'] = str(o['approved_at'])
            if o.get('total_amount'):
                o['total_amount'] = float(o['total_amount'])
            results.append(o)

        return {
            "purchase_orders": results,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    finally:
        cur.close()
        conn.close()


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: int,
    request: Request
):
    """Get single purchase order with line items"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get PO header
        cur.execute("""
            SELECT
                po.*,
                v.vendor_name,
                v.email as vendor_email,
                v.phone as vendor_phone,
                CONCAT(v.street, ', ', v.city, ', ', v.state, ' ', v.zip) as vendor_address
            FROM purchase_orders po
            LEFT JOIN vendors v ON po.vendor_id = v.id
            WHERE po.id = %s
        """, (po_id,))

        po = cur.fetchone()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        po_dict = dict(po)

        # Get line items
        cur.execute("""
            SELECT
                poi.*,
                i.item_id,
                i.description,
                i.brand,
                i.category,
                i.qty as current_stock
            FROM purchase_order_items poi
            JOIN inventory i ON poi.inventory_id = i.id
            WHERE poi.purchase_order_id = %s
            ORDER BY poi.id
        """, (po_id,))

        items = cur.fetchall()

        # Convert items
        item_list = []
        for item in items:
            i = dict(item)
            if i.get('received_date'):
                i['received_date'] = str(i['received_date'])
            if i.get('created_at'):
                i['created_at'] = str(i['created_at'])
            if i.get('unit_cost'):
                i['unit_cost'] = float(i['unit_cost'])
            if i.get('line_total'):
                i['line_total'] = float(i['line_total'])
            if i.get('linked_work_order_ids'):
                i['linked_work_order_ids'] = list(i['linked_work_order_ids']) if i['linked_work_order_ids'] else []
            item_list.append(i)

        po_dict['items'] = item_list
        po_dict['total_amount'] = sum(i.get('line_total', 0) or 0 for i in item_list)

        # Handle dates
        for key in ['created_at', 'updated_at', 'order_date', 'expected_date', 'received_date', 'approved_at']:
            if po_dict.get(key):
                po_dict[key] = str(po_dict[key])

        return po_dict
    finally:
        cur.close()
        conn.close()


@router.post("/purchase-orders")
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    request: Request
):
    """Create a new purchase order with line items"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Generate PO number
        year = date.today().year
        cur.execute("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 AS next_num
            FROM purchase_orders
            WHERE po_number LIKE %s
        """, (f'PO-{year}-%',))
        result = cur.fetchone()
        next_num = result['next_num'] if result else 1
        po_number = f"PO-{year}-{next_num:04d}"

        # Create PO header
        cur.execute("""
            INSERT INTO purchase_orders (po_number, vendor_id, status, notes, created_by)
            VALUES (%s, %s, 'draft', %s, %s)
            RETURNING id
        """, (po_number, po_data.vendor_id, po_data.notes, current_user.get('username')))

        result = cur.fetchone()
        po_id = result['id']

        # Add line items
        for item in po_data.items:
            cur.execute("""
                INSERT INTO purchase_order_items (
                    purchase_order_id, inventory_id, quantity_ordered, unit_cost
                ) VALUES (%s, %s, %s, %s)
            """, (po_id, item['inventory_id'], item['quantity_ordered'], item['unit_cost']))

        conn.commit()

        return {
            "message": "Purchase order created successfully",
            "id": po_id,
            "po_number": po_number
        }
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to create PO: ...")
    finally:
        cur.close()
        conn.close()


@router.post("/purchase-orders/from-shortages")
async def create_po_from_shortages(
    request: Request,
    vendor_id: int,
    days_ahead: int = 30
):
    """
    Auto-generate a purchase order from shortage report for a specific vendor.
    Creates PO with all items that are short and assigned to this vendor.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    end_date = date.today() + timedelta(days=days_ahead)

    try:
        # Get shortage items for this vendor
        cur.execute("""
            WITH shortage_items AS (
                SELECT
                    i.id as inventory_id,
                    i.item_id,
                    i.description,
                    i.cost,
                    i.qty_available,
                    MIN(wo.start_date) as first_needed_date,
                    SUM(jm.quantity_needed - jm.quantity_allocated) as total_needed,
                    GREATEST(0, SUM(jm.quantity_needed - jm.quantity_allocated) - i.qty_available) as shortage_qty,
                    array_agg(DISTINCT wo.id) as work_order_ids
                FROM job_materials_used jm
                JOIN inventory i ON jm.inventory_id = i.id
                JOIN work_orders wo ON jm.work_order_id = wo.id
                WHERE wo.status IN ('pending', 'scheduled', 'in_progress')
                  AND wo.start_date IS NOT NULL
                  AND wo.start_date BETWEEN CURRENT_DATE AND %s
                  AND jm.status IN ('planned', 'allocated')
                  AND i.active = TRUE
                  AND i.primary_vendor_id = %s
                GROUP BY i.id, i.item_id, i.description, i.cost, i.qty_available
                HAVING SUM(jm.quantity_needed - jm.quantity_allocated) > i.qty_available
            )
            SELECT * FROM shortage_items
            ORDER BY first_needed_date ASC
        """, (end_date, vendor_id))

        shortages = cur.fetchall()

        if not shortages:
            return {
                "message": "No shortages found for this vendor",
                "created": False
            }

        # Generate PO number
        year = date.today().year
        cur.execute("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-[0-9]{4}-([0-9]+)') AS INTEGER)), 0) + 1 AS next_num
            FROM purchase_orders
            WHERE po_number LIKE %s
        """, (f'PO-{year}-%',))
        result = cur.fetchone()
        next_num = result['next_num'] if result else 1
        po_number = f"PO-{year}-{next_num:04d}"

        # Create PO header
        cur.execute("""
            INSERT INTO purchase_orders (
                po_number, vendor_id, status, notes, created_by,
                triggered_by_projection, projection_end_date
            )
            VALUES (%s, %s, 'draft', %s, %s, TRUE, %s)
            RETURNING id
        """, (
            po_number,
            vendor_id,
            f"Auto-generated from shortage report for next {days_ahead} days",
            current_user.get('username'),
            end_date
        ))

        result = cur.fetchone()
        po_id = result['id']

        # Add line items
        total_items = 0
        total_cost = 0
        for item in shortages:
            shortage_qty = item['shortage_qty']
            unit_cost = float(item['cost']) if item['cost'] else 0
            work_order_ids = list(item['work_order_ids']) if item['work_order_ids'] else []

            cur.execute("""
                INSERT INTO purchase_order_items (
                    purchase_order_id, inventory_id, quantity_ordered,
                    unit_cost, linked_work_order_ids
                ) VALUES (%s, %s, %s, %s, %s::jsonb)
            """, (po_id, item['inventory_id'], shortage_qty, unit_cost, json.dumps(work_order_ids)))

            total_items += 1
            total_cost += shortage_qty * unit_cost

        conn.commit()

        return {
            "message": "Purchase order created from shortages",
            "created": True,
            "id": po_id,
            "po_number": po_number,
            "item_count": total_items,
            "total_estimated_cost": round(total_cost, 2)
        }
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to create PO: ...")
    finally:
        cur.close()
        conn.close()


@router.patch("/purchase-orders/{po_id}")
async def update_purchase_order(
    po_id: int,
    update_data: PurchaseOrderUpdate,
    request: Request
):
    """Update purchase order status or notes"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get current PO
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        updates = []
        params = []

        if update_data.status:
            valid_statuses = ['draft', 'pending_approval', 'approved', 'ordered', 'partial', 'received', 'cancelled']
            if update_data.status not in valid_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

            updates.append("status = %s")
            params.append(update_data.status)

            # Set additional fields based on status
            if update_data.status == 'approved':
                updates.append("approved_by = %s")
                params.append(current_user.get('username'))
                updates.append("approved_at = CURRENT_TIMESTAMP")
            elif update_data.status == 'ordered':
                updates.append("order_date = CURRENT_DATE")
            elif update_data.status == 'received':
                updates.append("received_date = CURRENT_TIMESTAMP")

        if update_data.notes is not None:
            updates.append("notes = %s")
            params.append(update_data.notes)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(po_id)

            cur.execute(f"""
                UPDATE purchase_orders
                SET {', '.join(updates)}
                WHERE id = %s
            """, params)

            conn.commit()

        return {"message": "Purchase order updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to update PO: ...")
    finally:
        cur.close()
        conn.close()


@router.post("/purchase-orders/{po_id}/receive")
async def receive_items(
    po_id: int,
    receive_data: ReceiveItemsRequest,
    request: Request
):
    """
    Record receipt of items from a purchase order.
    Updates inventory quantities and marks items as received.
    """
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify PO exists and is in valid state
        cur.execute("SELECT * FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] not in ['ordered', 'partial']:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive items - PO status is '{po['status']}'. Must be 'ordered' or 'partial'."
            )

        received_items = []
        for item in receive_data.items:
            poi_id = item['purchase_order_item_id']
            qty_received = item['quantity_received']

            # Get PO item and linked inventory
            cur.execute("""
                SELECT poi.*, i.id as inv_id, i.qty as current_qty
                FROM purchase_order_items poi
                JOIN inventory i ON poi.inventory_id = i.id
                WHERE poi.id = %s AND poi.purchase_order_id = %s
            """, (poi_id, po_id))

            poi = cur.fetchone()
            if not poi:
                raise HTTPException(status_code=404, detail=f"PO item {poi_id} not found")

            # Calculate new received total
            already_received = poi['quantity_received'] or 0
            new_total_received = already_received + qty_received

            if new_total_received > poi['quantity_ordered']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot receive {qty_received} - would exceed ordered quantity of {poi['quantity_ordered']}"
                )

            # Update PO item
            cur.execute("""
                UPDATE purchase_order_items
                SET quantity_received = %s,
                    received_date = CURRENT_TIMESTAMP,
                    received_by = %s
                WHERE id = %s
            """, (new_total_received, current_user.get('username'), poi_id))

            # Update inventory quantity atomically
            cur.execute("""
                UPDATE inventory SET qty = qty + %s WHERE id = %s
                RETURNING qty - %s as qty_before, qty as qty_after
            """, (qty_received, poi['inv_id'], qty_received))
            inv_result = cur.fetchone()
            qty_before = inv_result['qty_before']
            new_inv_qty = inv_result['qty_after']

            # Record stock transaction
            cur.execute("""
                INSERT INTO stock_transactions (
                    inventory_id, transaction_type, quantity_change,
                    quantity_before, quantity_after, reason, performed_by
                ) VALUES (%s, 'purchase_received', %s, %s, %s, %s, %s)
            """, (
                poi['inv_id'], qty_received, qty_before, new_inv_qty,
                f"Received from PO {po['po_number']}", current_user.get('username')
            ))

            received_items.append({
                "poi_id": poi_id,
                "inventory_id": poi['inv_id'],
                "quantity_received": qty_received,
                "new_inventory_qty": new_inv_qty
            })

        # Check if all items are fully received
        cur.execute("""
            SELECT
                COUNT(*) as total_items,
                SUM(CASE WHEN quantity_received >= quantity_ordered THEN 1 ELSE 0 END) as complete_items
            FROM purchase_order_items
            WHERE purchase_order_id = %s
        """, (po_id,))

        status_check = cur.fetchone()

        if status_check['total_items'] == status_check['complete_items']:
            # All items received - mark PO as received
            cur.execute("""
                UPDATE purchase_orders
                SET status = 'received', received_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (po_id,))
            new_po_status = 'received'
        else:
            # Partial receipt
            cur.execute("""
                UPDATE purchase_orders
                SET status = 'partial', updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (po_id,))
            new_po_status = 'partial'

        conn.commit()

        return {
            "message": "Items received successfully",
            "received_items": received_items,
            "po_status": new_po_status
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to receive items: ...")
    finally:
        cur.close()
        conn.close()


@router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(
    po_id: int,
    request: Request
):
    """Delete a draft purchase order"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("SELECT status FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] != 'draft':
            raise HTTPException(
                status_code=400,
                detail="Only draft purchase orders can be deleted"
            )

        cur.execute("DELETE FROM purchase_orders WHERE id = %s", (po_id,))
        conn.commit()

        return {"message": "Purchase order deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to delete PO: ...")
    finally:
        cur.close()
        conn.close()


@router.post("/purchase-orders/{po_id}/items")
async def add_po_item(
    po_id: int,
    request: Request,
    inventory_id: int,
    quantity_ordered: int,
    unit_cost: float
):
    """Add an item to an existing draft purchase order"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("SELECT status FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only add items to draft POs")

        cur.execute("""
            INSERT INTO purchase_order_items (
                purchase_order_id, inventory_id, quantity_ordered, unit_cost
            ) VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (po_id, inventory_id, quantity_ordered, unit_cost))

        new_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "Item added successfully", "id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to add item: ...")
    finally:
        cur.close()
        conn.close()


@router.delete("/purchase-orders/{po_id}/items/{item_id}")
async def remove_po_item(
    po_id: int,
    item_id: int,
    request: Request
):
    """Remove an item from a draft purchase order"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("SELECT status FROM purchase_orders WHERE id = %s", (po_id,))
        po = cur.fetchone()

        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")

        if po['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only remove items from draft POs")

        cur.execute("""
            DELETE FROM purchase_order_items
            WHERE id = %s AND purchase_order_id = %s
        """, (item_id, po_id))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found in this PO")

        conn.commit()

        return {"message": "Item removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        _log_and_raise(e, "Failed to remove item: ...")
    finally:
        cur.close()
        conn.close()
