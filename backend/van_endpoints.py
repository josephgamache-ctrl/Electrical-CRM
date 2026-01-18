"""
Van Inventory Management Module API Endpoints
Handles work van CRUD, van inventory tracking, and warehouse-to-van transfers.
"""

import logging
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status, Request, Body
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vans", tags=["vans"])

# ============================================================
# MODULE INITIALIZATION
# ============================================================

_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None


def init_van_module(db_func, auth_func, log_raise_func):
    """Initialize the module with dependencies from main.py"""
    global _get_db_connection, _get_current_user_func, _log_and_raise
    _get_db_connection = db_func
    _get_current_user_func = auth_func
    _log_and_raise = log_raise_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user_func(token)


def require_manager_or_admin(current_user: dict):
    """Check that requires manager or admin role"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or admin access required"
        )
    return current_user


def require_admin_access(current_user: dict):
    """Ensure user has admin role only"""
    if current_user['role'] != 'admin':
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )
    return current_user


# ============================================================
# PYDANTIC MODELS
# ============================================================

class WorkVanCreate(BaseModel):
    van_number: str
    name: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class WorkVanUpdate(BaseModel):
    van_number: Optional[str] = None
    name: Optional[str] = None
    assigned_to: Optional[str] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class TransferRequest(BaseModel):
    inventory_id: int
    quantity: int
    notes: Optional[str] = None


class BulkTransferItem(BaseModel):
    inventory_id: int
    quantity: int


class BulkTransferRequest(BaseModel):
    items: List[BulkTransferItem]
    notes: Optional[str] = None


class VanTransferBetweenRequest(BaseModel):
    from_van_id: int
    to_van_id: int
    inventory_id: int
    quantity: int
    notes: Optional[str] = None


class SetDefaultVanRequest(BaseModel):
    van_id: Optional[int] = None


# ============================================================
# VAN CRUD ENDPOINTS
# ============================================================

@router.get("")
async def list_vans(
    request: Request,
    active_only: bool = True,
    assigned_to: Optional[str] = None
):
    """Get all vans with optional filters"""
    await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        where_clauses = []
        params = []

        if active_only:
            where_clauses.append("wv.active = TRUE")

        if assigned_to:
            where_clauses.append("wv.assigned_to = %s")
            params.append(assigned_to)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        cur.execute(f"""
            SELECT
                wv.*,
                u.full_name as assigned_to_name,
                COALESCE(inv_summary.item_count, 0) as item_count,
                COALESCE(inv_summary.total_quantity, 0) as total_quantity,
                COALESCE(inv_summary.total_value, 0) as total_value
            FROM work_vans wv
            LEFT JOIN users u ON wv.assigned_to = u.username
            LEFT JOIN (
                SELECT
                    vi.van_id,
                    COUNT(*) as item_count,
                    SUM(vi.quantity) as total_quantity,
                    SUM(vi.quantity * i.cost) as total_value
                FROM van_inventory vi
                JOIN inventory i ON vi.inventory_id = i.id
                WHERE vi.quantity > 0
                GROUP BY vi.van_id
            ) inv_summary ON wv.id = inv_summary.van_id
            {where_sql}
            ORDER BY wv.van_number
        """, params)

        vans = cur.fetchall()
        return {"vans": vans, "count": len(vans)}

    except Exception as e:
        logger.error(f"Error listing vans: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/{van_id}")
async def get_van(van_id: int, request: Request):
    """Get a single van with inventory summary"""
    await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                wv.*,
                u.full_name as assigned_to_name
            FROM work_vans wv
            LEFT JOIN users u ON wv.assigned_to = u.username
            WHERE wv.id = %s
        """, (van_id,))

        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found")

        # Get inventory summary
        cur.execute("""
            SELECT
                COUNT(*) as item_count,
                COALESCE(SUM(vi.quantity), 0) as total_quantity,
                COALESCE(SUM(vi.quantity * i.cost), 0) as total_value,
                COUNT(CASE WHEN vi.quantity <= vi.min_quantity THEN 1 END) as low_stock_count
            FROM van_inventory vi
            JOIN inventory i ON vi.inventory_id = i.id
            WHERE vi.van_id = %s AND vi.quantity > 0
        """, (van_id,))

        summary = cur.fetchone()

        return {
            "van": van,
            "inventory_summary": summary
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting van {van_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("")
async def create_van(van: WorkVanCreate, request: Request):
    """Create a new work van (manager/admin only)"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Check for duplicate van_number
        cur.execute("SELECT id FROM work_vans WHERE van_number = %s", (van.van_number,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Van number '{van.van_number}' already exists")

        # Verify assigned_to user exists if provided
        if van.assigned_to:
            cur.execute("SELECT username FROM users WHERE username = %s AND active = TRUE", (van.assigned_to,))
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail=f"User '{van.assigned_to}' not found or inactive")

        cur.execute("""
            INSERT INTO work_vans (van_number, name, assigned_to, notes)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (van.van_number, van.name, van.assigned_to, van.notes))

        new_id = cur.fetchone()['id']
        conn.commit()

        logger.info(f"Van {van.van_number} created by {current_user['username']}")

        return {"message": "Van created successfully", "id": new_id, "van_number": van.van_number}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating van: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.patch("/{van_id}")
async def update_van(van_id: int, van: WorkVanUpdate, request: Request):
    """Update a work van (manager/admin only)"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Check van exists
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s", (van_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Van not found")

        # Build dynamic update
        update_fields = []
        values = []

        if van.van_number is not None:
            # Check for duplicate if changing van_number
            cur.execute("SELECT id FROM work_vans WHERE van_number = %s AND id != %s", (van.van_number, van_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Van number '{van.van_number}' already exists")
            update_fields.append("van_number = %s")
            values.append(van.van_number)

        if van.name is not None:
            update_fields.append("name = %s")
            values.append(van.name)

        if van.assigned_to is not None:
            if van.assigned_to:
                cur.execute("SELECT username FROM users WHERE username = %s AND active = TRUE", (van.assigned_to,))
                if not cur.fetchone():
                    raise HTTPException(status_code=400, detail=f"User '{van.assigned_to}' not found or inactive")
            update_fields.append("assigned_to = %s")
            values.append(van.assigned_to if van.assigned_to else None)

        if van.active is not None:
            # If deactivating, check for inventory
            if not van.active:
                cur.execute("SELECT SUM(quantity) as total FROM van_inventory WHERE van_id = %s", (van_id,))
                inv = cur.fetchone()
                if inv and inv['total'] and inv['total'] > 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot deactivate van with {inv['total']} items in inventory. Transfer items first."
                    )
            update_fields.append("active = %s")
            values.append(van.active)

        if van.notes is not None:
            update_fields.append("notes = %s")
            values.append(van.notes)

        if not update_fields:
            return {"message": "No changes provided"}

        values.append(van_id)
        cur.execute(f"""
            UPDATE work_vans
            SET {', '.join(update_fields)}, last_updated = CURRENT_TIMESTAMP
            WHERE id = %s
        """, values)

        conn.commit()

        logger.info(f"Van {existing['van_number']} updated by {current_user['username']}")

        return {"message": "Van updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating van {van_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.delete("/{van_id}")
async def delete_van(van_id: int, request: Request):
    """Soft delete a work van (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin_access(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s", (van_id,))
        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found")

        # Check for inventory
        cur.execute("SELECT SUM(quantity) as total FROM van_inventory WHERE van_id = %s", (van_id,))
        inv = cur.fetchone()
        if inv and inv['total'] and inv['total'] > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete van with {inv['total']} items in inventory. Transfer items first."
            )

        cur.execute("UPDATE work_vans SET active = FALSE WHERE id = %s", (van_id,))
        conn.commit()

        logger.info(f"Van {van['van_number']} deleted by {current_user['username']}")

        return {"message": "Van deactivated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting van {van_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# ============================================================
# VAN INVENTORY ENDPOINTS
# ============================================================

@router.get("/{van_id}/inventory")
async def get_van_inventory(
    van_id: int,
    request: Request,
    low_stock_only: bool = False,
    search: Optional[str] = None
):
    """Get all inventory items in a van"""
    await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify van exists
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s", (van_id,))
        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found")

        where_clauses = ["vi.van_id = %s", "vi.quantity > 0"]
        params = [van_id]

        if low_stock_only:
            where_clauses.append("vi.quantity <= vi.min_quantity")

        if search:
            where_clauses.append("(i.item_id ILIKE %s OR i.description ILIKE %s OR i.brand ILIKE %s)")
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern, search_pattern])

        where_sql = " AND ".join(where_clauses)

        cur.execute(f"""
            SELECT
                vi.*,
                i.item_id,
                i.description,
                i.brand,
                i.category,
                i.cost,
                i.sell_price,
                i.upc,
                i.location as warehouse_location,
                i.qty as warehouse_qty,
                i.qty_available as warehouse_available,
                (vi.quantity * i.cost) as line_value
            FROM van_inventory vi
            JOIN inventory i ON vi.inventory_id = i.id
            WHERE {where_sql}
            ORDER BY i.category, i.description
        """, params)

        items = cur.fetchall()

        # Calculate totals
        total_items = len(items)
        total_quantity = sum(item['quantity'] for item in items)
        total_value = sum(float(item['line_value'] or 0) for item in items)
        low_stock_items = sum(1 for item in items if item['quantity'] <= item['min_quantity'])

        return {
            "van": van,
            "items": items,
            "summary": {
                "total_items": total_items,
                "total_quantity": total_quantity,
                "total_value": round(total_value, 2),
                "low_stock_items": low_stock_items
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting van {van_id} inventory: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# ============================================================
# TRANSFER ENDPOINTS
# ============================================================

@router.post("/{van_id}/transfer-from-warehouse")
async def transfer_from_warehouse(van_id: int, transfer: TransferRequest, request: Request):
    """Transfer items from warehouse inventory to van inventory"""
    current_user = await get_current_user_from_request(request)

    if transfer.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify van exists and is active
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s AND active = TRUE", (van_id,))
        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found or inactive")

        # Check warehouse has sufficient qty_available
        cur.execute("""
            SELECT id, item_id, description, qty, qty_available, cost
            FROM inventory WHERE id = %s AND active = TRUE
        """, (transfer.inventory_id,))
        item = cur.fetchone()

        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        if item['qty_available'] < transfer.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient warehouse stock. Available: {item['qty_available']}, Requested: {transfer.quantity}"
            )

        # Decrease warehouse qty (atomic with constraint check)
        cur.execute("""
            UPDATE inventory
            SET qty = qty - %s
            WHERE id = %s AND qty >= %s
            RETURNING qty as new_qty, qty_available as new_available
        """, (transfer.quantity, transfer.inventory_id, transfer.quantity))

        warehouse_result = cur.fetchone()
        if not warehouse_result:
            raise HTTPException(status_code=400, detail="Insufficient warehouse stock (concurrent modification)")

        # Upsert van inventory
        cur.execute("""
            INSERT INTO van_inventory (van_id, inventory_id, quantity, last_restocked_date, last_restocked_by)
            VALUES (%s, %s, %s, CURRENT_DATE, %s)
            ON CONFLICT (van_id, inventory_id)
            DO UPDATE SET
                quantity = van_inventory.quantity + EXCLUDED.quantity,
                last_restocked_date = CURRENT_DATE,
                last_restocked_by = EXCLUDED.last_restocked_by,
                last_updated = CURRENT_TIMESTAMP
            RETURNING quantity as new_van_qty
        """, (van_id, transfer.inventory_id, transfer.quantity, current_user['username']))

        new_van_qty = cur.fetchone()['new_van_qty']

        # Record stock transaction
        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change,
                quantity_before, quantity_after, to_van_id,
                reason, performed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            transfer.inventory_id,
            'transfer',
            -transfer.quantity,
            item['qty'],
            warehouse_result['new_qty'],
            van_id,
            f"Transfer to {van['van_number']}: {transfer.notes or 'Restock'}",
            current_user['username']
        ))

        conn.commit()

        logger.info(f"Transferred {transfer.quantity}x {item['item_id']} to {van['van_number']} by {current_user['username']}")

        return {
            "message": f"Transferred {transfer.quantity} units of {item['item_id']} to {van['van_number']}",
            "item_id": item['item_id'],
            "description": item['description'],
            "van_quantity": new_van_qty,
            "warehouse_quantity": warehouse_result['new_qty'],
            "warehouse_available": warehouse_result['new_available']
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error transferring to van: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/{van_id}/transfer-to-warehouse")
async def transfer_to_warehouse(van_id: int, transfer: TransferRequest, request: Request):
    """Return items from van inventory back to warehouse"""
    current_user = await get_current_user_from_request(request)

    if transfer.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify van exists
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s", (van_id,))
        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found")

        # Check van has sufficient quantity
        cur.execute("""
            SELECT vi.*, i.item_id, i.description, i.qty as warehouse_qty
            FROM van_inventory vi
            JOIN inventory i ON vi.inventory_id = i.id
            WHERE vi.van_id = %s AND vi.inventory_id = %s
        """, (van_id, transfer.inventory_id))
        van_item = cur.fetchone()

        if not van_item:
            raise HTTPException(status_code=404, detail="Item not found in van inventory")
        if van_item['quantity'] < transfer.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient van stock. Available: {van_item['quantity']}, Requested: {transfer.quantity}"
            )

        # Decrease van inventory
        new_van_qty = van_item['quantity'] - transfer.quantity
        if new_van_qty == 0:
            # Remove record if zero
            cur.execute("DELETE FROM van_inventory WHERE van_id = %s AND inventory_id = %s", (van_id, transfer.inventory_id))
        else:
            cur.execute("""
                UPDATE van_inventory
                SET quantity = %s, last_updated = CURRENT_TIMESTAMP
                WHERE van_id = %s AND inventory_id = %s
            """, (new_van_qty, van_id, transfer.inventory_id))

        # Increase warehouse qty
        cur.execute("""
            UPDATE inventory
            SET qty = qty + %s
            WHERE id = %s
            RETURNING qty as new_qty, qty_available as new_available
        """, (transfer.quantity, transfer.inventory_id))

        warehouse_result = cur.fetchone()

        # Record stock transaction
        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change,
                quantity_before, quantity_after, from_van_id,
                reason, performed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            transfer.inventory_id,
            'transfer',
            transfer.quantity,
            van_item['warehouse_qty'],
            warehouse_result['new_qty'],
            van_id,
            f"Return from {van['van_number']}: {transfer.notes or 'Return to warehouse'}",
            current_user['username']
        ))

        conn.commit()

        logger.info(f"Returned {transfer.quantity}x {van_item['item_id']} from {van['van_number']} by {current_user['username']}")

        return {
            "message": f"Returned {transfer.quantity} units of {van_item['item_id']} to warehouse",
            "item_id": van_item['item_id'],
            "description": van_item['description'],
            "van_quantity": new_van_qty,
            "warehouse_quantity": warehouse_result['new_qty'],
            "warehouse_available": warehouse_result['new_available']
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error transferring from van: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/{van_id}/bulk-transfer-from-warehouse")
async def bulk_transfer_from_warehouse(van_id: int, transfer: BulkTransferRequest, request: Request):
    """Transfer multiple items from warehouse to van in one operation"""
    current_user = await get_current_user_from_request(request)

    if not transfer.items:
        raise HTTPException(status_code=400, detail="No items provided")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify van exists and is active
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s AND active = TRUE", (van_id,))
        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found or inactive")

        results = []
        errors = []

        for item in transfer.items:
            if item.quantity <= 0:
                errors.append({"inventory_id": item.inventory_id, "error": "Quantity must be positive"})
                continue

            # Check warehouse stock
            cur.execute("""
                SELECT id, item_id, description, qty, qty_available
                FROM inventory WHERE id = %s AND active = TRUE
            """, (item.inventory_id,))
            inv = cur.fetchone()

            if not inv:
                errors.append({"inventory_id": item.inventory_id, "error": "Item not found"})
                continue

            if inv['qty_available'] < item.quantity:
                errors.append({
                    "inventory_id": item.inventory_id,
                    "item_id": inv['item_id'],
                    "error": f"Insufficient stock. Available: {inv['qty_available']}"
                })
                continue

            # Perform transfer
            cur.execute("""
                UPDATE inventory SET qty = qty - %s
                WHERE id = %s AND qty >= %s
                RETURNING qty as new_qty
            """, (item.quantity, item.inventory_id, item.quantity))

            if not cur.fetchone():
                errors.append({"inventory_id": item.inventory_id, "item_id": inv['item_id'], "error": "Concurrent modification"})
                continue

            cur.execute("""
                INSERT INTO van_inventory (van_id, inventory_id, quantity, last_restocked_date, last_restocked_by)
                VALUES (%s, %s, %s, CURRENT_DATE, %s)
                ON CONFLICT (van_id, inventory_id)
                DO UPDATE SET
                    quantity = van_inventory.quantity + EXCLUDED.quantity,
                    last_restocked_date = CURRENT_DATE,
                    last_restocked_by = EXCLUDED.last_restocked_by
                RETURNING quantity as new_van_qty
            """, (van_id, item.inventory_id, item.quantity, current_user['username']))

            new_van_qty = cur.fetchone()['new_van_qty']

            # Record transaction
            cur.execute("""
                INSERT INTO stock_transactions (
                    inventory_id, transaction_type, quantity_change,
                    quantity_before, quantity_after, to_van_id,
                    reason, performed_by
                ) VALUES (%s, 'transfer', %s, %s, %s, %s, %s, %s)
            """, (
                item.inventory_id, -item.quantity, inv['qty'], inv['qty'] - item.quantity,
                van_id, f"Bulk transfer to {van['van_number']}: {transfer.notes or 'Restock'}",
                current_user['username']
            ))

            results.append({
                "inventory_id": item.inventory_id,
                "item_id": inv['item_id'],
                "quantity_transferred": item.quantity,
                "van_quantity": new_van_qty
            })

        if errors and not results:
            conn.rollback()
            raise HTTPException(status_code=400, detail={"message": "All transfers failed", "errors": errors})

        conn.commit()

        logger.info(f"Bulk transferred {len(results)} items to {van['van_number']} by {current_user['username']}")

        return {
            "message": f"Transferred {len(results)} items to {van['van_number']}",
            "successful": results,
            "errors": errors
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in bulk transfer: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/transfer-between")
async def transfer_between_vans(transfer: VanTransferBetweenRequest, request: Request):
    """Transfer items between two vans (manager/admin only)"""
    current_user = await get_current_user_from_request(request)
    require_manager_or_admin(current_user)

    if transfer.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    if transfer.from_van_id == transfer.to_van_id:
        raise HTTPException(status_code=400, detail="Source and destination vans must be different")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify both vans exist
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s AND active = TRUE", (transfer.from_van_id,))
        from_van = cur.fetchone()
        if not from_van:
            raise HTTPException(status_code=404, detail="Source van not found or inactive")

        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s AND active = TRUE", (transfer.to_van_id,))
        to_van = cur.fetchone()
        if not to_van:
            raise HTTPException(status_code=404, detail="Destination van not found or inactive")

        # Check source van has sufficient quantity
        cur.execute("""
            SELECT vi.*, i.item_id, i.description
            FROM van_inventory vi
            JOIN inventory i ON vi.inventory_id = i.id
            WHERE vi.van_id = %s AND vi.inventory_id = %s
        """, (transfer.from_van_id, transfer.inventory_id))
        source_item = cur.fetchone()

        if not source_item:
            raise HTTPException(status_code=404, detail="Item not found in source van")
        if source_item['quantity'] < transfer.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock in source van. Available: {source_item['quantity']}"
            )

        # Decrease source van inventory
        new_source_qty = source_item['quantity'] - transfer.quantity
        if new_source_qty == 0:
            cur.execute("DELETE FROM van_inventory WHERE van_id = %s AND inventory_id = %s",
                        (transfer.from_van_id, transfer.inventory_id))
        else:
            cur.execute("""
                UPDATE van_inventory SET quantity = %s, last_updated = CURRENT_TIMESTAMP
                WHERE van_id = %s AND inventory_id = %s
            """, (new_source_qty, transfer.from_van_id, transfer.inventory_id))

        # Increase destination van inventory
        cur.execute("""
            INSERT INTO van_inventory (van_id, inventory_id, quantity, last_restocked_date, last_restocked_by)
            VALUES (%s, %s, %s, CURRENT_DATE, %s)
            ON CONFLICT (van_id, inventory_id)
            DO UPDATE SET
                quantity = van_inventory.quantity + EXCLUDED.quantity,
                last_restocked_date = CURRENT_DATE,
                last_restocked_by = EXCLUDED.last_restocked_by
            RETURNING quantity as new_dest_qty
        """, (transfer.to_van_id, transfer.inventory_id, transfer.quantity, current_user['username']))

        new_dest_qty = cur.fetchone()['new_dest_qty']

        # Record stock transaction
        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change,
                quantity_before, quantity_after, from_van_id, to_van_id,
                reason, performed_by
            ) VALUES (%s, 'transfer', %s, %s, %s, %s, %s, %s, %s)
        """, (
            transfer.inventory_id, 0,  # net change is 0 for warehouse
            source_item['quantity'], new_source_qty,
            transfer.from_van_id, transfer.to_van_id,
            f"Van-to-van transfer: {from_van['van_number']} -> {to_van['van_number']}: {transfer.notes or ''}",
            current_user['username']
        ))

        conn.commit()

        logger.info(f"Transferred {transfer.quantity}x {source_item['item_id']} from {from_van['van_number']} to {to_van['van_number']} by {current_user['username']}")

        return {
            "message": f"Transferred {transfer.quantity} units from {from_van['van_number']} to {to_van['van_number']}",
            "item_id": source_item['item_id'],
            "description": source_item['description'],
            "from_van_quantity": new_source_qty,
            "to_van_quantity": new_dest_qty
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in van-to-van transfer: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# ============================================================
# USER DEFAULT VAN ENDPOINTS
# ============================================================

@router.get("/user/default-van", tags=["user"])
async def get_user_default_van(request: Request):
    """Get current user's default van"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT wv.*
            FROM users u
            LEFT JOIN work_vans wv ON u.default_van_id = wv.id
            WHERE u.username = %s
        """, (current_user['username'],))

        result = cur.fetchone()

        if result and result['id']:
            return {"default_van": result}
        return {"default_van": None}

    except Exception as e:
        logger.error(f"Error getting default van: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


class GotItRequest(BaseModel):
    """Request model for 'Got It' - field-acquired inventory"""
    inventory_id: int
    quantity: int
    cost_per_unit: Optional[float] = None  # Optional cost if known
    notes: Optional[str] = None


@router.post("/{van_id}/got-it")
async def got_it_to_van(van_id: int, got_it: GotItRequest, request: Request):
    """
    Add field-acquired inventory directly to van (Got It feature).
    This is for items acquired in the field (bought at store, etc.) that
    go directly into the van without coming from warehouse stock.
    Also increases warehouse total to track overall inventory.
    """
    current_user = await get_current_user_from_request(request)

    if got_it.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify van exists and is active
        cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s AND active = TRUE", (van_id,))
        van = cur.fetchone()
        if not van:
            raise HTTPException(status_code=404, detail="Van not found or inactive")

        # Get inventory item
        cur.execute("""
            SELECT id, item_id, description, qty, cost
            FROM inventory WHERE id = %s AND active = TRUE
        """, (got_it.inventory_id,))
        item = cur.fetchone()

        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")

        # Use provided cost or existing item cost
        unit_cost = got_it.cost_per_unit if got_it.cost_per_unit is not None else (item['cost'] or 0)

        # Increase warehouse qty (field acquisition adds to overall inventory)
        cur.execute("""
            UPDATE inventory
            SET qty = qty + %s
            WHERE id = %s
            RETURNING qty as new_qty, qty_available as new_available
        """, (got_it.quantity, got_it.inventory_id))

        warehouse_result = cur.fetchone()

        # Upsert van inventory
        cur.execute("""
            INSERT INTO van_inventory (van_id, inventory_id, quantity, last_restocked_date, last_restocked_by)
            VALUES (%s, %s, %s, CURRENT_DATE, %s)
            ON CONFLICT (van_id, inventory_id)
            DO UPDATE SET
                quantity = van_inventory.quantity + EXCLUDED.quantity,
                last_restocked_date = CURRENT_DATE,
                last_restocked_by = EXCLUDED.last_restocked_by,
                last_updated = CURRENT_TIMESTAMP
            RETURNING quantity as new_van_qty
        """, (van_id, got_it.inventory_id, got_it.quantity, current_user['username']))

        new_van_qty = cur.fetchone()['new_van_qty']

        # Record stock transaction
        cur.execute("""
            INSERT INTO stock_transactions (
                inventory_id, transaction_type, quantity_change,
                quantity_before, quantity_after, to_van_id,
                reason, performed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            got_it.inventory_id,
            'got_it',
            got_it.quantity,
            item['qty'],
            warehouse_result['new_qty'],
            van_id,
            f"Got It (field acquisition) to {van['van_number']}: {got_it.notes or 'Field acquisition'}",
            current_user['username']
        ))

        conn.commit()

        logger.info(f"Got It: {got_it.quantity}x {item['item_id']} to {van['van_number']} by {current_user['username']}")

        return {
            "message": f"Added {got_it.quantity} units of {item['item_id']} to {van['van_number']}",
            "item_id": item['item_id'],
            "description": item['description'],
            "van_quantity": new_van_qty,
            "warehouse_quantity": warehouse_result['new_qty'],
            "total_cost": round(got_it.quantity * unit_cost, 2)
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in Got It to van: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/user/default-van", tags=["user"])
async def set_user_default_van(req: SetDefaultVanRequest, request: Request):
    """Set current user's default van"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify van exists if provided
        if req.van_id:
            cur.execute("SELECT id, van_number FROM work_vans WHERE id = %s AND active = TRUE", (req.van_id,))
            van = cur.fetchone()
            if not van:
                raise HTTPException(status_code=404, detail="Van not found or inactive")

        cur.execute("""
            UPDATE users SET default_van_id = %s WHERE username = %s
        """, (req.van_id, current_user['username']))

        conn.commit()

        if req.van_id:
            return {"message": f"Default van set to {van['van_number']}", "van_id": req.van_id}
        return {"message": "Default van cleared", "van_id": None}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error setting default van: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
