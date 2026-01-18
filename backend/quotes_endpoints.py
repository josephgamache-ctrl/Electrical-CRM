"""
Quote/Estimate Module API Endpoints
Supports Good/Better/Best pricing tiers with easy conversion to work orders.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime, timedelta
from decimal import Decimal
from psycopg2.extras import Json
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quotes", tags=["Quotes"])

def log_and_raise_quote_error(e: Exception, context: str = ""):
    """Helper to log errors and raise HTTPException with generic message."""
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"Quote Error {error_id} ({context}): {type(e).__name__}: {str(e)}")
    raise HTTPException(status_code=500, detail=f"Quote operation failed. Reference: {error_id}")

# These will be set by main.py when registering the router
_get_db_connection = None
_get_current_user_func = None

def init_quotes_module(db_func, auth_func):
    """Initialize the module with database and auth functions from main.py"""
    global _get_db_connection, _get_current_user_func
    _get_db_connection = db_func
    _get_current_user_func = auth_func

def get_db():
    """Get database connection"""
    return _get_db_connection()


# ============================================================
# PYDANTIC MODELS
# ============================================================

class QuoteLineItemCreate(BaseModel):
    item_type: str = Field(default="material", description="labor, material, equipment, service, other")
    inventory_id: Optional[int] = None
    description: str
    quantity: float = 1.0
    unit: str = "Each"
    unit_cost: float = 0.0
    unit_price: float
    markup_percent: float = 0.0
    tier_basic: bool = True
    tier_standard: bool = True
    tier_premium: bool = True
    line_order: int = 0
    is_optional: bool = False
    notes: Optional[str] = None


class QuoteLineItemUpdate(BaseModel):
    item_type: Optional[str] = None
    inventory_id: Optional[int] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    markup_percent: Optional[float] = None
    tier_basic: Optional[bool] = None
    tier_standard: Optional[bool] = None
    tier_premium: Optional[bool] = None
    line_order: Optional[int] = None
    is_optional: Optional[bool] = None
    notes: Optional[str] = None


class QuoteCreate(BaseModel):
    customer_id: int
    customer_site_id: Optional[int] = None
    title: str
    job_description: Optional[str] = None
    scope_of_work: Optional[str] = None
    service_address: Optional[str] = None
    service_city: Optional[str] = None
    service_state: str = "MA"
    service_zip: Optional[str] = None
    job_type: str = "service_call"
    valid_until: Optional[date] = None
    estimated_start_date: Optional[date] = None
    estimated_duration_days: Optional[int] = None
    discount_percent: float = 0.0
    tax_rate: float = 0.0625
    internal_notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None


class QuoteUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_site_id: Optional[int] = None
    title: Optional[str] = None
    job_description: Optional[str] = None
    scope_of_work: Optional[str] = None
    service_address: Optional[str] = None
    service_city: Optional[str] = None
    service_state: Optional[str] = None
    service_zip: Optional[str] = None
    job_type: Optional[str] = None
    valid_until: Optional[date] = None
    estimated_start_date: Optional[date] = None
    estimated_duration_days: Optional[int] = None
    discount_percent: Optional[float] = None
    tax_rate: Optional[float] = None
    internal_notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    status: Optional[str] = None


class QuoteTierCreate(BaseModel):
    tier_key: str  # basic, standard, premium
    tier_name: str  # "Good", "Better", "Best"
    tier_description: Optional[str] = None
    display_order: int = 2
    is_recommended: bool = False


class CustomerApproval(BaseModel):
    selected_tier: str  # basic, standard, premium
    customer_approved_by: Optional[str] = None
    customer_signature: Optional[str] = None
    customer_notes: Optional[str] = None


# ============================================================
# HELPER FUNCTIONS
# ============================================================

# SECURITY: Valid tier keys whitelist to prevent SQL injection
VALID_TIER_KEYS = {'basic', 'standard', 'premium'}

# SECURITY: Whitelist of allowed fields for UPDATE operations to prevent SQL injection
# Field names from Pydantic models must match these exactly
ALLOWED_QUOTE_UPDATE_FIELDS = {
    'customer_id', 'customer_site_id', 'title', 'job_description', 'scope_of_work',
    'service_address', 'service_city', 'service_state', 'service_zip', 'job_type',
    'valid_until', 'estimated_start_date', 'estimated_duration_days',
    'discount_percent', 'tax_rate', 'internal_notes', 'terms_and_conditions', 'status'
}

ALLOWED_LINE_ITEM_UPDATE_FIELDS = {
    'item_type', 'inventory_id', 'description', 'quantity', 'unit',
    'unit_cost', 'unit_price', 'markup_percent', 'tier_basic', 'tier_standard',
    'tier_premium', 'line_order', 'is_optional', 'notes'
}

ALLOWED_TEMPLATE_UPDATE_FIELDS = {
    'name', 'description', 'job_type', 'scope_of_work',
    'terms_and_conditions', 'estimated_duration_days', 'is_active'
}


def validate_tier_key(tier_key: str) -> str:
    """
    Validate tier_key against whitelist to prevent SQL injection.
    Raises HTTPException if invalid.
    """
    if tier_key not in VALID_TIER_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier key: {tier_key}. Must be one of: {', '.join(sorted(VALID_TIER_KEYS))}"
        )
    return tier_key


def log_quote_history(conn, quote_id: int, action: str, performed_by: str,
                      old_status: str = None, new_status: str = None,
                      details: dict = None, notes: str = None):
    """Log an action to quote history"""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO quote_history (quote_id, action, performed_by, old_status, new_status, details, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (quote_id, action, performed_by, old_status, new_status,
          Json(details) if details else None, notes))


def calculate_tier_totals(conn, quote_id: int, tier_key: str) -> dict:
    """Calculate totals for a specific tier"""
    # SECURITY: Validate tier_key against whitelist before using in SQL
    validate_tier_key(tier_key)

    cur = conn.cursor()

    # Get tax rate from quote
    cur.execute("SELECT tax_rate, discount_percent FROM quotes WHERE id = %s", (quote_id,))
    quote = cur.fetchone()
    tax_rate = float(quote['tax_rate']) if quote else 0.0625
    discount_percent = float(quote['discount_percent']) if quote else 0.0

    # Build tier filter - safe because tier_key is validated against whitelist
    tier_column = f"tier_{tier_key}"

    # Calculate labor
    cur.execute(f"""
        SELECT COALESCE(SUM(quantity * unit_price), 0) as total
        FROM quote_line_items
        WHERE quote_id = %s AND item_type = 'labor' AND {tier_column} = true
    """, (quote_id,))
    labor_subtotal = float(cur.fetchone()['total'])

    # Calculate materials
    cur.execute(f"""
        SELECT COALESCE(SUM(quantity * unit_price), 0) as total
        FROM quote_line_items
        WHERE quote_id = %s AND item_type = 'material' AND {tier_column} = true
    """, (quote_id,))
    material_subtotal = float(cur.fetchone()['total'])

    # Calculate other
    cur.execute(f"""
        SELECT COALESCE(SUM(quantity * unit_price), 0) as total
        FROM quote_line_items
        WHERE quote_id = %s AND item_type NOT IN ('labor', 'material') AND {tier_column} = true
    """, (quote_id,))
    other_subtotal = float(cur.fetchone()['total'])

    subtotal = labor_subtotal + material_subtotal + other_subtotal
    discount_amount = subtotal * (discount_percent / 100)
    taxable = subtotal - discount_amount
    tax_amount = taxable * tax_rate
    total = taxable + tax_amount

    return {
        'labor_subtotal': round(labor_subtotal, 2),
        'material_subtotal': round(material_subtotal, 2),
        'other_subtotal': round(other_subtotal, 2),
        'subtotal': round(subtotal, 2),
        'discount_amount': round(discount_amount, 2),
        'tax_amount': round(tax_amount, 2),
        'total_amount': round(total, 2)
    }


async def get_current_user_dep():
    """Dependency that calls the actual auth function"""
    # This will be resolved by the actual dependency at request time
    return await _get_current_user_func()


# ============================================================
# QUOTE CRUD ENDPOINTS
# ============================================================

@router.post("")
async def create_quote(quote: QuoteCreate, request: Request):
    """Create a new quote/estimate"""
    # Get user from request state (set by main.py's auth dependency)
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # Check permission
    if user['role'] not in ('admin', 'manager') and not user.get('can_create_quotes'):
        raise HTTPException(status_code=403, detail="Not authorized to create quotes")

    conn = get_db()
    try:
        cur = conn.cursor()

        # Generate quote number
        cur.execute("SELECT generate_quote_number()")
        quote_number = cur.fetchone()['generate_quote_number']

        # Set valid_until to 30 days if not provided
        valid_until = quote.valid_until or (date.today() + timedelta(days=30))

        cur.execute("""
            INSERT INTO quotes (
                quote_number, customer_id, customer_site_id, title, job_description,
                scope_of_work, service_address, service_city, service_state, service_zip,
                job_type, valid_until, estimated_start_date, estimated_duration_days,
                discount_percent, tax_rate, internal_notes, terms_and_conditions,
                status, created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s
            ) RETURNING id
        """, (
            quote_number, quote.customer_id, quote.customer_site_id, quote.title,
            quote.job_description, quote.scope_of_work, quote.service_address,
            quote.service_city, quote.service_state, quote.service_zip,
            quote.job_type, valid_until, quote.estimated_start_date,
            quote.estimated_duration_days, quote.discount_percent, quote.tax_rate,
            quote.internal_notes, quote.terms_and_conditions, user['username']
        ))

        quote_id = cur.fetchone()['id']

        # Create default tiers
        tiers = [
            ('basic', 'Good', 'Basic service package', 1, False),
            ('standard', 'Better', 'Recommended option', 2, True),
            ('premium', 'Best', 'Premium full-service package', 3, False),
        ]
        for tier_key, tier_name, tier_desc, order, recommended in tiers:
            cur.execute("""
                INSERT INTO quote_tiers (quote_id, tier_key, tier_name, tier_description, display_order, is_recommended)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (quote_id, tier_key, tier_name, tier_desc, order, recommended))

        # Log history
        log_quote_history(conn, quote_id, 'created', user['username'],
                         new_status='draft', details={'quote_number': quote_number})

        conn.commit()

        # Return created quote
        cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
        return cur.fetchone()

    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.get("")
async def list_quotes(
    request: Request,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
):
    """List quotes with optional filtering"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        query = """
            SELECT q.*,
                   COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as customer_name,
                   c.email as customer_email
            FROM quotes q
            LEFT JOIN customers c ON q.customer_id = c.id
            WHERE 1=1
        """
        params = []

        if status:
            query += " AND q.status = %s"
            params.append(status)

        if customer_id:
            query += " AND q.customer_id = %s"
            params.append(customer_id)

        query += " ORDER BY q.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cur.execute(query, params)
        quotes = cur.fetchall()

        return quotes

    finally:
        conn.close()


@router.get("/{quote_id}")
async def get_quote(quote_id: int, request: Request):
    """Get quote details with line items and tier totals"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        # Get quote
        cur.execute("""
            SELECT q.*,
                   COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as customer_name,
                   c.email as customer_email,
                   c.phone_primary as customer_phone
            FROM quotes q
            LEFT JOIN customers c ON q.customer_id = c.id
            WHERE q.id = %s
        """, (quote_id,))
        quote = cur.fetchone()

        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        # Get line items
        cur.execute("""
            SELECT qli.*, i.item_id as inventory_item_id, i.description as inventory_description
            FROM quote_line_items qli
            LEFT JOIN inventory i ON qli.inventory_id = i.id
            WHERE qli.quote_id = %s
            ORDER BY qli.line_order, qli.id
        """, (quote_id,))
        line_items = cur.fetchall()

        # Get tiers with calculated totals
        cur.execute("SELECT * FROM quote_tiers WHERE quote_id = %s ORDER BY display_order", (quote_id,))
        tiers = cur.fetchall()

        # Calculate totals for each tier
        tier_totals = {}
        for tier in tiers:
            tier_key = tier['tier_key']
            totals = calculate_tier_totals(conn, quote_id, tier_key)
            tier_totals[tier_key] = {
                **dict(tier),
                **totals,
                'line_items': [
                    dict(li) for li in line_items
                    if li.get(f'tier_{tier_key}', True)
                ]
            }

        # Get history
        cur.execute("""
            SELECT * FROM quote_history
            WHERE quote_id = %s
            ORDER BY action_date DESC
        """, (quote_id,))
        history = cur.fetchall()

        return {
            **dict(quote),
            'line_items': [dict(li) for li in line_items],
            'tiers': tier_totals,
            'history': [dict(h) for h in history]
        }

    finally:
        conn.close()


@router.patch("/{quote_id}")
async def update_quote(quote_id: int, quote: QuoteUpdate, request: Request):
    """Update quote details"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        # Get current quote
        cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Quote not found")

        # Can only edit draft quotes
        if existing['status'] not in ('draft',) and quote.status is None:
            raise HTTPException(status_code=400, detail="Can only edit draft quotes")

        # Build update - SECURITY: Only allow whitelisted fields to prevent SQL injection
        updates = []
        params = []
        update_data = quote.dict(exclude_unset=True)

        for field, value in update_data.items():
            if value is not None and field in ALLOWED_QUOTE_UPDATE_FIELDS:
                updates.append(f"{field} = %s")
                params.append(value)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            updates.append("updated_by = %s")
            params.append(user['username'])
            params.append(quote_id)

            cur.execute(f"""
                UPDATE quotes SET {', '.join(updates)} WHERE id = %s
            """, params)

            # Log status change if applicable
            if quote.status and quote.status != existing['status']:
                log_quote_history(conn, quote_id, 'status_changed', user['username'],
                                 old_status=existing['status'], new_status=quote.status)

        conn.commit()

        # Return updated quote
        cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
        return cur.fetchone()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.delete("/{quote_id}")
async def delete_quote(quote_id: int, request: Request):
    """Delete a quote (only drafts can be deleted, admin/manager only)"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # Authorization check - only admin or manager can delete quotes
    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Only admins and managers can delete quotes")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT status FROM quotes WHERE id = %s", (quote_id,))
        quote = cur.fetchone()
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        if quote['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Only draft quotes can be deleted")

        cur.execute("DELETE FROM quotes WHERE id = %s", (quote_id,))
        conn.commit()

        return {"message": "Quote deleted"}

    finally:
        conn.close()


# ============================================================
# LINE ITEM ENDPOINTS
# ============================================================

@router.post("/{quote_id}/line-items")
async def add_line_item(quote_id: int, item: QuoteLineItemCreate, request: Request):
    """Add a line item to a quote (admin/manager or users with quote permissions)"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # Authorization check
    if user['role'] not in ('admin', 'manager') and not user.get('can_create_quotes'):
        raise HTTPException(status_code=403, detail="Not authorized to modify quotes")

    conn = get_db()
    try:
        cur = conn.cursor()

        # Verify quote exists and is editable
        cur.execute("SELECT status FROM quotes WHERE id = %s", (quote_id,))
        quote = cur.fetchone()
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        if quote['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only add items to draft quotes")

        # If inventory_id provided, get details
        if item.inventory_id:
            cur.execute("SELECT description, sell_price, cost FROM inventory WHERE id = %s",
                       (item.inventory_id,))
            inv = cur.fetchone()
            if inv:
                if not item.description:
                    item.description = inv['description']
                if not item.unit_price:
                    item.unit_price = float(inv['sell_price'] or 0)
                if not item.unit_cost:
                    item.unit_cost = float(inv['cost'] or 0)

        cur.execute("""
            INSERT INTO quote_line_items (
                quote_id, item_type, inventory_id, description, quantity, unit,
                unit_cost, unit_price, markup_percent, tier_basic, tier_standard,
                tier_premium, line_order, is_optional, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            quote_id, item.item_type, item.inventory_id, item.description,
            item.quantity, item.unit, item.unit_cost, item.unit_price,
            item.markup_percent, item.tier_basic, item.tier_standard,
            item.tier_premium, item.line_order, item.is_optional, item.notes
        ))

        item_id = cur.fetchone()['id']
        conn.commit()

        # Return created item with line_total
        cur.execute("SELECT * FROM quote_line_items WHERE id = %s", (item_id,))
        return cur.fetchone()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.patch("/{quote_id}/line-items/{item_id}")
async def update_line_item(quote_id: int, item_id: int, item: QuoteLineItemUpdate, request: Request):
    """Update a line item (admin/manager or users with quote permissions)"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # Authorization check
    if user['role'] not in ('admin', 'manager') and not user.get('can_create_quotes'):
        raise HTTPException(status_code=403, detail="Not authorized to modify quotes")

    conn = get_db()
    try:
        cur = conn.cursor()

        # Verify ownership
        cur.execute("""
            SELECT qli.id, q.status FROM quote_line_items qli
            JOIN quotes q ON qli.quote_id = q.id
            WHERE qli.id = %s AND qli.quote_id = %s
        """, (item_id, quote_id))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Line item not found")
        if existing['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only edit items in draft quotes")

        # Build update - SECURITY: Only allow whitelisted fields to prevent SQL injection
        updates = []
        params = []
        update_data = item.dict(exclude_unset=True)

        for field, value in update_data.items():
            if value is not None and field in ALLOWED_LINE_ITEM_UPDATE_FIELDS:
                updates.append(f"{field} = %s")
                params.append(value)

        if updates:
            params.append(item_id)
            cur.execute(f"""
                UPDATE quote_line_items SET {', '.join(updates)} WHERE id = %s
            """, params)
            conn.commit()

        cur.execute("SELECT * FROM quote_line_items WHERE id = %s", (item_id,))
        return cur.fetchone()

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.delete("/{quote_id}/line-items/{item_id}")
async def delete_line_item(quote_id: int, item_id: int, request: Request):
    """Delete a line item (admin/manager or users with quote permissions)"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # Authorization check
    if user['role'] not in ('admin', 'manager') and not user.get('can_create_quotes'):
        raise HTTPException(status_code=403, detail="Not authorized to modify quotes")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT qli.id, q.status FROM quote_line_items qli
            JOIN quotes q ON qli.quote_id = q.id
            WHERE qli.id = %s AND qli.quote_id = %s
        """, (item_id, quote_id))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Line item not found")
        if existing['status'] != 'draft':
            raise HTTPException(status_code=400, detail="Can only delete items from draft quotes")

        cur.execute("DELETE FROM quote_line_items WHERE id = %s", (item_id,))
        conn.commit()

        return {"message": "Line item deleted"}

    finally:
        conn.close()


# ============================================================
# WORKFLOW ENDPOINTS
# ============================================================

@router.post("/{quote_id}/send")
async def send_quote(quote_id: int, request: Request):
    """Mark quote as sent to customer"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT status, quote_number FROM quotes WHERE id = %s", (quote_id,))
        quote = cur.fetchone()
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        if quote['status'] not in ('draft', 'sent'):
            raise HTTPException(status_code=400, detail=f"Cannot send quote with status: {quote['status']}")

        old_status = quote['status']
        cur.execute("""
            UPDATE quotes SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (quote_id,))

        log_quote_history(conn, quote_id, 'sent', user['username'],
                         old_status=old_status, new_status='sent')

        conn.commit()

        return {"message": "Quote marked as sent", "quote_number": quote['quote_number']}

    finally:
        conn.close()


@router.post("/{quote_id}/approve")
async def approve_quote(quote_id: int, approval: CustomerApproval, request: Request):
    """Record customer approval of quote"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # SECURITY: Validate selected_tier before storing in database
    validate_tier_key(approval.selected_tier)

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT status FROM quotes WHERE id = %s", (quote_id,))
        quote = cur.fetchone()
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        if quote['status'] not in ('sent', 'viewed'):
            raise HTTPException(status_code=400, detail="Quote must be sent before approval")

        old_status = quote['status']
        cur.execute("""
            UPDATE quotes SET
                status = 'approved',
                customer_approved = true,
                customer_approved_at = CURRENT_TIMESTAMP,
                customer_approved_by = %s,
                customer_signature = %s,
                customer_notes = %s,
                selected_tier = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            approval.customer_approved_by, approval.customer_signature,
            approval.customer_notes, approval.selected_tier, quote_id
        ))

        log_quote_history(conn, quote_id, 'approved', user['username'],
                         old_status=old_status, new_status='approved',
                         details={'selected_tier': approval.selected_tier})

        conn.commit()

        return {"message": "Quote approved", "selected_tier": approval.selected_tier}

    finally:
        conn.close()


@router.post("/{quote_id}/decline")
async def decline_quote(quote_id: int, request: Request, reason: Optional[str] = None):
    """Record customer declining the quote"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT status FROM quotes WHERE id = %s", (quote_id,))
        quote = cur.fetchone()
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        old_status = quote['status']
        cur.execute("""
            UPDATE quotes SET status = 'declined', customer_notes = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (reason, quote_id))

        log_quote_history(conn, quote_id, 'declined', user['username'],
                         old_status=old_status, new_status='declined',
                         details={'reason': reason})

        conn.commit()

        return {"message": "Quote marked as declined"}

    finally:
        conn.close()


@router.post("/{quote_id}/convert-to-work-order")
async def convert_to_work_order(quote_id: int, request: Request):
    """Convert an approved quote to a work order"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        # Get quote with customer info
        cur.execute("""
            SELECT q.*,
                   COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as customer_name
            FROM quotes q
            JOIN customers c ON q.customer_id = c.id
            WHERE q.id = %s
        """, (quote_id,))
        quote = cur.fetchone()

        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        if quote['status'] != 'approved':
            raise HTTPException(status_code=400, detail="Only approved quotes can be converted")

        if quote['converted_to_work_order_id']:
            raise HTTPException(status_code=400, detail="Quote already converted")

        # Get tier to use - validate against whitelist for security
        selected_tier = quote['selected_tier'] or 'standard'
        validate_tier_key(selected_tier)  # SECURITY: Prevent SQL injection
        tier_column = f"tier_{selected_tier}"

        # Get line items for selected tier
        cur.execute(f"""
            SELECT * FROM quote_line_items
            WHERE quote_id = %s AND {tier_column} = true
            ORDER BY line_order
        """, (quote_id,))
        line_items = cur.fetchall()

        # Calculate totals for selected tier
        tier_totals = calculate_tier_totals(conn, quote_id, selected_tier)

        # Generate work order number (format: WO-YYYY-NNNN)
        from datetime import datetime as dt
        current_year = dt.now().year
        cur.execute("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 9) AS INTEGER)), 999) + 1 as next_num
            FROM work_orders
            WHERE work_order_number LIKE %s
            AND SUBSTRING(work_order_number FROM 9) ~ '^[0-9]+$'
        """, (f'WO-{current_year}-%',))
        next_num = cur.fetchone()['next_num']
        work_order_number = f"WO-{current_year}-{next_num}"

        # Build full service address
        service_address_full = quote['service_address'] or ''
        if quote['service_city']:
            service_address_full += f", {quote['service_city']}"
        if quote['service_state']:
            service_address_full += f", {quote['service_state']}"
        if quote['service_zip']:
            service_address_full += f" {quote['service_zip']}"

        # Create work order
        cur.execute("""
            INSERT INTO work_orders (
                work_order_number, customer_id, job_description, scope_of_work,
                service_address, job_type, status,
                quoted_labor_hours, quoted_labor_rate, quoted_labor_cost,
                quoted_material_cost, quoted_subtotal,
                quote_id, created_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, 'pending',
                %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """, (
            work_order_number, quote['customer_id'], quote['title'],
            quote['scope_of_work'], service_address_full.strip(', '), quote['job_type'],
            0, 0, tier_totals['labor_subtotal'],  # Labor hours/rate can be set later
            tier_totals['material_subtotal'], tier_totals['subtotal'],
            quote_id, user['username']
        ))

        work_order_id = cur.fetchone()['id']

        # Add materials to job_materials_used
        for item in line_items:
            if item['item_type'] == 'material' and item['inventory_id']:
                # Get actual cost from inventory for accurate cost tracking
                cur.execute("SELECT cost, sell_price FROM inventory WHERE id = %s", (item['inventory_id'],))
                inv_item = cur.fetchone()
                actual_cost = float(inv_item['cost'] or 0) if inv_item else 0
                actual_sell = float(inv_item['sell_price'] or item['unit_price'] or 0) if inv_item else float(item['unit_price'] or 0)

                cur.execute("""
                    INSERT INTO job_materials_used (
                        work_order_id, inventory_id, quantity_needed, unit_cost, unit_price, status
                    ) VALUES (%s, %s, %s, %s, %s, 'planned')
                """, (work_order_id, item['inventory_id'], item['quantity'], actual_cost, actual_sell))

        # Update quote
        cur.execute("""
            UPDATE quotes SET
                status = 'converted',
                converted_to_work_order_id = %s,
                converted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (work_order_id, quote_id))

        log_quote_history(conn, quote_id, 'converted', user['username'],
                         old_status='approved', new_status='converted',
                         details={'work_order_id': work_order_id, 'work_order_number': work_order_number})

        conn.commit()

        return {
            "message": "Quote converted to work order",
            "work_order_id": work_order_id,
            "work_order_number": work_order_number
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


# ============================================================
# TIER MANAGEMENT
# ============================================================

@router.get("/{quote_id}/tiers")
async def get_quote_tiers(quote_id: int, request: Request):
    """Get all tiers with calculated totals for a quote"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT * FROM quote_tiers WHERE quote_id = %s ORDER BY display_order", (quote_id,))
        tiers = cur.fetchall()

        result = []
        for tier in tiers:
            totals = calculate_tier_totals(conn, quote_id, tier['tier_key'])
            result.append({**dict(tier), **totals})

        return result

    finally:
        conn.close()


@router.patch("/{quote_id}/tiers/{tier_key}")
async def update_tier(quote_id: int, tier_key: str, tier: QuoteTierCreate, request: Request):
    """Update tier name/description"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    # SECURITY: Validate tier_key from URL path parameter
    validate_tier_key(tier_key)

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("""
            UPDATE quote_tiers SET
                tier_name = %s, tier_description = %s,
                display_order = %s, is_recommended = %s
            WHERE quote_id = %s AND tier_key = %s
            RETURNING *
        """, (tier.tier_name, tier.tier_description, tier.display_order,
              tier.is_recommended, quote_id, tier_key))

        updated = cur.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Tier not found")

        conn.commit()
        return updated

    finally:
        conn.close()


# ============================================================
# QUOTE TEMPLATES
# ============================================================

class QuoteTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    job_type: str = "service_call"
    scope_of_work: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    estimated_duration_days: Optional[int] = None
    line_items: Optional[List[Dict[str, Any]]] = []


class QuoteTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    job_type: Optional[str] = None
    scope_of_work: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    estimated_duration_days: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/templates/list")
async def list_quote_templates(request: Request, job_type: Optional[str] = None):
    """List all quote templates"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        query = """
            SELECT qt.*,
                   COUNT(qtli.id) as item_count,
                   COALESCE(SUM(qtli.quantity * qtli.unit_price), 0) as estimated_total
            FROM quote_templates qt
            LEFT JOIN quote_template_line_items qtli ON qt.id = qtli.template_id
            WHERE qt.is_active = true
        """
        params = []

        if job_type:
            query += " AND qt.job_type = %s"
            params.append(job_type)

        query += " GROUP BY qt.id ORDER BY qt.name"

        cur.execute(query, params)
        return cur.fetchall()

    finally:
        conn.close()


@router.get("/templates/{template_id}")
async def get_quote_template(template_id: int, request: Request):
    """Get a quote template with its line items"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT * FROM quote_templates WHERE id = %s", (template_id,))
        template = cur.fetchone()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        cur.execute("""
            SELECT qtli.*, i.item_id as inventory_item_id, i.description as inventory_description
            FROM quote_template_line_items qtli
            LEFT JOIN inventory i ON qtli.inventory_id = i.id
            WHERE qtli.template_id = %s
            ORDER BY qtli.line_order, qtli.id
        """, (template_id,))
        line_items = cur.fetchall()

        return {
            **dict(template),
            'line_items': [dict(li) for li in line_items]
        }

    finally:
        conn.close()


@router.post("/templates")
async def create_quote_template(template: QuoteTemplateCreate, request: Request):
    """Create a new quote template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Not authorized to create templates")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO quote_templates (
                name, description, job_type, scope_of_work,
                terms_and_conditions, estimated_duration_days, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            template.name, template.description, template.job_type,
            template.scope_of_work, template.terms_and_conditions,
            template.estimated_duration_days, user['username']
        ))

        template_id = cur.fetchone()['id']

        # Add line items if provided
        for idx, item in enumerate(template.line_items or []):
            cur.execute("""
                INSERT INTO quote_template_line_items (
                    template_id, item_type, inventory_id, description,
                    quantity, unit, unit_cost, unit_price, markup_percent,
                    tier_basic, tier_standard, tier_premium, line_order, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                template_id,
                item.get('item_type', 'material'),
                item.get('inventory_id'),
                item.get('description', ''),
                item.get('quantity', 1),
                item.get('unit', 'Each'),
                item.get('unit_cost', 0),
                item.get('unit_price', 0),
                item.get('markup_percent', 0),
                item.get('tier_basic', True),
                item.get('tier_standard', True),
                item.get('tier_premium', True),
                idx,
                item.get('notes')
            ))

        conn.commit()

        cur.execute("SELECT * FROM quote_templates WHERE id = %s", (template_id,))
        return cur.fetchone()

    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.patch("/templates/{template_id}")
async def update_quote_template(template_id: int, template: QuoteTemplateUpdate, request: Request):
    """Update a quote template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Not authorized to update templates")

    conn = get_db()
    try:
        cur = conn.cursor()

        # SECURITY: Only allow whitelisted fields to prevent SQL injection
        updates = []
        params = []
        update_data = template.dict(exclude_unset=True)

        for field, value in update_data.items():
            if value is not None and field in ALLOWED_TEMPLATE_UPDATE_FIELDS:
                updates.append(f"{field} = %s")
                params.append(value)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(template_id)

            cur.execute(f"""
                UPDATE quote_templates SET {', '.join(updates)} WHERE id = %s RETURNING *
            """, params)

            conn.commit()
            return cur.fetchone()

        cur.execute("SELECT * FROM quote_templates WHERE id = %s", (template_id,))
        return cur.fetchone()

    finally:
        conn.close()


@router.delete("/templates/{template_id}")
async def delete_quote_template(template_id: int, request: Request):
    """Soft delete a quote template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Not authorized to delete templates")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("UPDATE quote_templates SET is_active = false WHERE id = %s", (template_id,))
        conn.commit()

        return {"message": "Template deleted"}

    finally:
        conn.close()


@router.post("/templates/{template_id}/line-items")
async def add_template_line_item(template_id: int, item: QuoteLineItemCreate, request: Request):
    """Add a line item to a template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO quote_template_line_items (
                template_id, item_type, inventory_id, description, quantity, unit,
                unit_cost, unit_price, markup_percent, tier_basic, tier_standard,
                tier_premium, line_order, is_optional, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            template_id, item.item_type, item.inventory_id, item.description,
            item.quantity, item.unit, item.unit_cost, item.unit_price,
            item.markup_percent, item.tier_basic, item.tier_standard,
            item.tier_premium, item.line_order, item.is_optional, item.notes
        ))

        conn.commit()
        return cur.fetchone()

    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.delete("/templates/{template_id}/line-items/{item_id}")
async def delete_template_line_item(template_id: int, item_id: int, request: Request):
    """Delete a line item from a template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("DELETE FROM quote_template_line_items WHERE id = %s AND template_id = %s",
                   (item_id, template_id))
        conn.commit()

        return {"message": "Item deleted"}

    finally:
        conn.close()


@router.post("/from-template/{template_id}")
async def create_quote_from_template(template_id: int, request: Request, customer_id: int = None):
    """Create a new quote from a template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if not customer_id:
        raise HTTPException(status_code=400, detail="customer_id is required")

    conn = get_db()
    try:
        cur = conn.cursor()

        # Get template
        cur.execute("SELECT * FROM quote_templates WHERE id = %s AND is_active = true", (template_id,))
        template = cur.fetchone()

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Get customer for address
        cur.execute("SELECT * FROM customers WHERE id = %s", (customer_id,))
        customer = cur.fetchone()

        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Generate quote number
        cur.execute("SELECT generate_quote_number()")
        quote_number = cur.fetchone()['generate_quote_number']

        valid_until = date.today() + timedelta(days=30)

        # Create quote
        cur.execute("""
            INSERT INTO quotes (
                quote_number, customer_id, title, job_description, scope_of_work,
                service_address, service_city, service_state, service_zip,
                job_type, valid_until, estimated_duration_days,
                terms_and_conditions, status, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s)
            RETURNING id
        """, (
            quote_number, customer_id,
            f"{template['name']} - {customer.get('company_name') or customer.get('first_name', '')}",
            template['description'], template['scope_of_work'],
            customer.get('service_street') or customer.get('billing_street', ''),
            customer.get('service_city') or customer.get('billing_city', ''),
            customer.get('service_state') or customer.get('billing_state', 'MA'),
            customer.get('service_zip') or customer.get('billing_zip', ''),
            template['job_type'], valid_until, template['estimated_duration_days'],
            template['terms_and_conditions'], user['username']
        ))

        quote_id = cur.fetchone()['id']

        # Create default tiers
        tiers = [
            ('basic', 'Good', 'Basic service package', 1, False),
            ('standard', 'Better', 'Recommended option', 2, True),
            ('premium', 'Best', 'Premium full-service package', 3, False),
        ]
        for tier_key, tier_name, tier_desc, order, recommended in tiers:
            cur.execute("""
                INSERT INTO quote_tiers (quote_id, tier_key, tier_name, tier_description, display_order, is_recommended)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (quote_id, tier_key, tier_name, tier_desc, order, recommended))

        # Copy line items from template
        cur.execute("SELECT * FROM quote_template_line_items WHERE template_id = %s ORDER BY line_order", (template_id,))
        template_items = cur.fetchall()

        for item in template_items:
            cur.execute("""
                INSERT INTO quote_line_items (
                    quote_id, item_type, inventory_id, description, quantity, unit,
                    unit_cost, unit_price, markup_percent, tier_basic, tier_standard,
                    tier_premium, line_order, is_optional, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                quote_id, item['item_type'], item['inventory_id'], item['description'],
                item['quantity'], item['unit'], item['unit_cost'], item['unit_price'],
                item['markup_percent'], item['tier_basic'], item['tier_standard'],
                item['tier_premium'], item['line_order'], item['is_optional'], item['notes']
            ))

        log_quote_history(conn, quote_id, 'created_from_template', user['username'],
                         new_status='draft', details={'template_id': template_id, 'template_name': template['name']})

        conn.commit()

        return {"quote_id": quote_id, "quote_number": quote_number}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


# ============================================================
# QUOTE CLONING
# ============================================================

@router.post("/{quote_id}/clone")
async def clone_quote(quote_id: int, request: Request, customer_id: Optional[int] = None):
    """Clone an existing quote, optionally to a different customer"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    conn = get_db()
    try:
        cur = conn.cursor()

        # Get original quote
        cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
        original = cur.fetchone()

        if not original:
            raise HTTPException(status_code=404, detail="Quote not found")

        # Use original customer or new customer
        target_customer_id = customer_id or original['customer_id']

        # Get customer info
        cur.execute("SELECT * FROM customers WHERE id = %s", (target_customer_id,))
        customer = cur.fetchone()

        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Generate new quote number
        cur.execute("SELECT generate_quote_number()")
        quote_number = cur.fetchone()['generate_quote_number']

        valid_until = date.today() + timedelta(days=30)

        # Create new quote
        cur.execute("""
            INSERT INTO quotes (
                quote_number, customer_id, title, job_description, scope_of_work,
                service_address, service_city, service_state, service_zip,
                job_type, valid_until, estimated_start_date, estimated_duration_days,
                discount_percent, tax_rate, internal_notes, terms_and_conditions,
                status, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft', %s)
            RETURNING id
        """, (
            quote_number, target_customer_id,
            f"{original['title']} (Copy)",
            original['job_description'], original['scope_of_work'],
            customer.get('service_street') or original['service_address'] or '',
            customer.get('service_city') or original['service_city'] or '',
            customer.get('service_state') or original['service_state'] or 'MA',
            customer.get('service_zip') or original['service_zip'] or '',
            original['job_type'], valid_until, None,
            original['estimated_duration_days'], original['discount_percent'],
            original['tax_rate'], original['internal_notes'],
            original['terms_and_conditions'], user['username']
        ))

        new_quote_id = cur.fetchone()['id']

        # Copy tiers
        cur.execute("SELECT * FROM quote_tiers WHERE quote_id = %s", (quote_id,))
        tiers = cur.fetchall()

        for tier in tiers:
            cur.execute("""
                INSERT INTO quote_tiers (quote_id, tier_key, tier_name, tier_description, display_order, is_recommended)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (new_quote_id, tier['tier_key'], tier['tier_name'],
                  tier['tier_description'], tier['display_order'], tier['is_recommended']))

        # Copy line items
        cur.execute("SELECT * FROM quote_line_items WHERE quote_id = %s ORDER BY line_order", (quote_id,))
        items = cur.fetchall()

        for item in items:
            cur.execute("""
                INSERT INTO quote_line_items (
                    quote_id, item_type, inventory_id, description, quantity, unit,
                    unit_cost, unit_price, markup_percent, tier_basic, tier_standard,
                    tier_premium, line_order, is_optional, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                new_quote_id, item['item_type'], item['inventory_id'], item['description'],
                item['quantity'], item['unit'], item['unit_cost'], item['unit_price'],
                item['markup_percent'], item['tier_basic'], item['tier_standard'],
                item['tier_premium'], item['line_order'], item['is_optional'], item['notes']
            ))

        log_quote_history(conn, new_quote_id, 'cloned', user['username'],
                         new_status='draft',
                         details={'cloned_from': quote_id, 'original_number': original['quote_number']})

        conn.commit()

        return {"quote_id": new_quote_id, "quote_number": quote_number}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()


@router.post("/{quote_id}/save-as-template")
async def save_quote_as_template(quote_id: int, request: Request, name: str = None, description: str = None):
    """Save an existing quote as a reusable template"""
    user = await _get_current_user_func(request.headers.get("Authorization", "").replace("Bearer ", ""))

    if user['role'] not in ('admin', 'manager'):
        raise HTTPException(status_code=403, detail="Not authorized to create templates")

    conn = get_db()
    try:
        cur = conn.cursor()

        # Get quote
        cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
        quote = cur.fetchone()

        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")

        template_name = name or f"Template from {quote['quote_number']}"
        template_desc = description or quote['job_description']

        # Create template
        cur.execute("""
            INSERT INTO quote_templates (
                name, description, job_type, scope_of_work,
                terms_and_conditions, estimated_duration_days, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            template_name, template_desc, quote['job_type'],
            quote['scope_of_work'], quote['terms_and_conditions'],
            quote['estimated_duration_days'], user['username']
        ))

        template_id = cur.fetchone()['id']

        # Copy line items
        cur.execute("SELECT * FROM quote_line_items WHERE quote_id = %s ORDER BY line_order", (quote_id,))
        items = cur.fetchall()

        for item in items:
            cur.execute("""
                INSERT INTO quote_template_line_items (
                    template_id, item_type, inventory_id, description, quantity, unit,
                    unit_cost, unit_price, markup_percent, tier_basic, tier_standard,
                    tier_premium, line_order, is_optional, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                template_id, item['item_type'], item['inventory_id'], item['description'],
                item['quantity'], item['unit'], item['unit_cost'], item['unit_price'],
                item['markup_percent'], item['tier_basic'], item['tier_standard'],
                item['tier_premium'], item['line_order'], item['is_optional'], item['notes']
            ))

        conn.commit()

        return {"template_id": template_id, "template_name": template_name}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        log_and_raise_quote_error(e, "quote operation")
    finally:
        conn.close()
