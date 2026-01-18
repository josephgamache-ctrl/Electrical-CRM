"""
Customers Module API Endpoints
Handles customer management including CRUD operations and customer sites.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Customers"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None


def init_customers_module(db_func, auth_func):
    """Initialize the module with database and auth functions from main.py"""
    global _get_db_connection, _get_current_user
    _get_db_connection = db_func
    _get_current_user = auth_func


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user(token)


# ============================================================
# PYDANTIC MODELS
# ============================================================

class CustomerCreate(BaseModel):
    customer_number: Optional[str] = None  # Auto-generated if not provided
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    customer_type: Optional[str] = "residential"
    phone_primary: str
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
    preferred_contact: Optional[str] = "phone"
    service_street: Optional[str] = None
    service_city: Optional[str] = None
    service_state: Optional[str] = "MA"
    service_zip: Optional[str] = None
    service_notes: Optional[str] = None
    billing_same_as_service: Optional[bool] = True
    billing_street: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    payment_terms: Optional[str] = "due_on_receipt"
    tax_exempt: Optional[bool] = False
    tax_exempt_cert: Optional[str] = None
    credit_limit: Optional[Decimal] = Decimal("0.00")
    referral_source: Optional[str] = None
    preferred_technician: Optional[str] = None
    vip: Optional[bool] = False
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    customer_type: Optional[str] = None
    phone_primary: Optional[str] = None
    phone_secondary: Optional[str] = None
    email: Optional[str] = None
    preferred_contact: Optional[str] = None
    service_street: Optional[str] = None
    service_city: Optional[str] = None
    service_state: Optional[str] = None
    service_zip: Optional[str] = None
    service_notes: Optional[str] = None
    billing_same_as_service: Optional[bool] = None
    billing_street: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    payment_terms: Optional[str] = None
    tax_exempt: Optional[bool] = None
    tax_exempt_cert: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    referral_source: Optional[str] = None
    preferred_technician: Optional[str] = None
    active: Optional[bool] = None
    vip: Optional[bool] = None
    notes: Optional[str] = None


class CustomerSite(BaseModel):
    site_name: str
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "MA"
    zip: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    access_notes: Optional[str] = None
    is_primary: Optional[bool] = False


# ============================================================
# CUSTOMER ENDPOINTS
# ============================================================

@router.get("/customers")
async def get_customers(
    request: Request,
    active_only: bool = True,
    customer_type: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all customers with optional filtering"""
    await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        query = """
            SELECT
                c.*,
                COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as display_name,
                (SELECT COUNT(*) FROM work_orders WHERE customer_id = c.id) as job_count,
                (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND payment_status = 'unpaid') as unpaid_invoices
            FROM customers c
            WHERE 1=1
        """
        params = []

        if active_only:
            query += " AND c.active = true"

        if customer_type:
            query += " AND c.customer_type = %s"
            params.append(customer_type)

        if search:
            query += """ AND (
                c.first_name ILIKE %s OR
                c.last_name ILIKE %s OR
                c.company_name ILIKE %s OR
                c.phone_primary ILIKE %s OR
                c.email ILIKE %s OR
                c.customer_number ILIKE %s
            )"""
            search_term = f"%{search}%"
            params.extend([search_term] * 6)

        query += " ORDER BY COALESCE(c.company_name, c.last_name, c.first_name)"

        cur.execute(query, params)
        customers = cur.fetchall()

        cur.close()
        conn.close()

        return {"customers": customers}

    except Exception as e:
        cur.close()
        conn.close()
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: int, request: Request):
    """Get a specific customer by ID with their sites"""
    await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Get customer details
        cur.execute("""
            SELECT
                c.*,
                COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as display_name
            FROM customers c
            WHERE c.id = %s
        """, (customer_id,))
        customer = cur.fetchone()

        if not customer:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Customer not found")

        # Get customer sites
        cur.execute("""
            SELECT * FROM customer_sites
            WHERE customer_id = %s
            ORDER BY is_primary DESC, site_name
        """, (customer_id,))
        sites = cur.fetchall()

        # Get recent work orders
        cur.execute("""
            SELECT id, work_order_number, job_name, status, created_at
            FROM work_orders
            WHERE customer_id = %s
            ORDER BY created_at DESC
            LIMIT 10
        """, (customer_id,))
        recent_jobs = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "customer": customer,
            "sites": sites,
            "recent_jobs": recent_jobs
        }

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        logger.error(f"Error fetching customer {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/customers")
async def create_customer(customer: CustomerCreate, request: Request):
    """Create a new customer"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Generate customer number if not provided
        customer_number = customer.customer_number
        if not customer_number:
            cur.execute("SELECT MAX(CAST(SUBSTRING(customer_number FROM 5) AS INTEGER)) FROM customers WHERE customer_number LIKE 'CUS-%'")
            result = cur.fetchone()
            max_num = result['max'] if result and result['max'] else 0
            customer_number = f"CUS-{max_num + 1:05d}"

        cur.execute("""
            INSERT INTO customers (
                customer_number, first_name, last_name, company_name, customer_type,
                phone_primary, phone_secondary, email, preferred_contact,
                service_street, service_city, service_state, service_zip, service_notes,
                billing_same_as_service, billing_street, billing_city, billing_state, billing_zip,
                payment_terms, tax_exempt, tax_exempt_cert, credit_limit,
                referral_source, preferred_technician, vip, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING *
        """, (
            customer_number, customer.first_name, customer.last_name, customer.company_name,
            customer.customer_type, customer.phone_primary, customer.phone_secondary,
            customer.email, customer.preferred_contact,
            customer.service_street, customer.service_city, customer.service_state,
            customer.service_zip, customer.service_notes,
            customer.billing_same_as_service, customer.billing_street, customer.billing_city,
            customer.billing_state, customer.billing_zip,
            customer.payment_terms, customer.tax_exempt, customer.tax_exempt_cert,
            customer.credit_limit, customer.referral_source, customer.preferred_technician,
            customer.vip, customer.notes
        ))

        new_customer = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Customer {customer_number} created by {current_user['username']}")
        return {"success": True, "customer": new_customer}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.error(f"Error creating customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: int, customer: CustomerUpdate, request: Request):
    """Update an existing customer"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Build dynamic update query
        update_fields = []
        values = []

        for field, value in customer.dict(exclude_unset=True).items():
            if value is not None:
                update_fields.append(f"{field} = %s")
                values.append(value)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(customer_id)
        query = f"""
            UPDATE customers
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING *
        """

        cur.execute(query, values)
        updated_customer = cur.fetchone()

        if not updated_customer:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Customer not found")

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Customer {customer_id} updated by {current_user['username']}")
        return {"success": True, "customer": updated_customer}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.error(f"Error updating customer {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: int, request: Request):
    """Soft delete a customer (set active = false)"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # Check for active work orders
        cur.execute("""
            SELECT COUNT(*) as count FROM work_orders
            WHERE customer_id = %s AND status NOT IN ('completed', 'cancelled')
        """, (customer_id,))
        active_jobs = cur.fetchone()['count']

        if active_jobs > 0:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete customer with {active_jobs} active work orders"
            )

        # Soft delete
        cur.execute("""
            UPDATE customers SET active = false WHERE id = %s RETURNING customer_number
        """, (customer_id,))
        result = cur.fetchone()

        if not result:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Customer not found")

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Customer {result['customer_number']} deactivated by {current_user['username']}")
        return {"success": True, "message": "Customer deactivated"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.error(f"Error deleting customer {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# CUSTOMER SITES ENDPOINTS
# ============================================================

@router.get("/customers/{customer_id}/sites")
async def get_customer_sites(customer_id: int, request: Request):
    """Get all sites for a customer"""
    await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT * FROM customer_sites
            WHERE customer_id = %s
            ORDER BY is_primary DESC, site_name
        """, (customer_id,))
        sites = cur.fetchall()

        cur.close()
        conn.close()

        return {"sites": sites}

    except Exception as e:
        cur.close()
        conn.close()
        logger.error(f"Error fetching sites for customer {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/customers/{customer_id}/sites")
async def create_customer_site(customer_id: int, site: CustomerSite, request: Request):
    """Add a new site for a customer"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        # If this is primary, unset other primary sites
        if site.is_primary:
            cur.execute("""
                UPDATE customer_sites SET is_primary = false WHERE customer_id = %s
            """, (customer_id,))

        cur.execute("""
            INSERT INTO customer_sites (
                customer_id, site_name, street, city, state, zip,
                contact_name, contact_phone, access_notes, is_primary
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            customer_id, site.site_name, site.street, site.city, site.state,
            site.zip, site.contact_name, site.contact_phone, site.access_notes,
            site.is_primary
        ))

        new_site = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Site '{site.site_name}' added to customer {customer_id} by {current_user['username']}")
        return {"success": True, "site": new_site}

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.error(f"Error creating site for customer {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/customers/{customer_id}/sites/{site_id}")
async def delete_customer_site(customer_id: int, site_id: int, request: Request):
    """Delete a customer site"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM customer_sites WHERE id = %s AND customer_id = %s RETURNING site_name
        """, (site_id, customer_id))
        result = cur.fetchone()

        if not result:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Site not found")

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Site '{result['site_name']}' deleted from customer {customer_id} by {current_user['username']}")
        return {"success": True, "message": "Site deleted"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.error(f"Error deleting site {site_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
