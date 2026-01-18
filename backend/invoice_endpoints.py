"""
Invoice Module API Endpoints
Handles invoice creation, payments, and communication (email/SMS).
"""

from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Invoices"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user_func = None
_log_and_raise = None


def init_invoice_module(db_func, auth_func, log_raise_func):
    """Initialize the module with database, auth, and logging functions from main.py"""
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


def require_admin_or_office_check(user: dict):
    """Check that user has admin or office role"""
    if user.get('role') not in ['admin', 'office']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or office access required"
        )
    return user


def require_admin_check(user: dict):
    """Check that user has admin role"""
    if user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


# ============================================================
# PYDANTIC MODELS
# ============================================================

class InvoiceCreate(BaseModel):
    work_order_id: int
    due_days: Optional[int] = 30
    tax_rate: Optional[float] = 0.0
    permit_cost: Optional[float] = 0.0
    travel_charge: Optional[float] = 0.0
    emergency_surcharge: Optional[float] = 0.0
    discount_amount: Optional[float] = 0.0
    notes: Optional[str] = None
    terms: Optional[str] = "Payment due within 30 days. Late payments subject to 1.5% monthly interest."


class InvoiceUpdate(BaseModel):
    due_date: Optional[str] = None
    tax_rate: Optional[float] = None
    permit_cost: Optional[float] = None
    travel_charge: Optional[float] = None
    emergency_surcharge: Optional[float] = None
    discount_amount: Optional[float] = None
    notes: Optional[str] = None
    terms: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float
    payment_method: str  # cash, check, credit_card, debit_card, ach, other
    check_number: Optional[str] = None
    card_last_four: Optional[str] = None
    card_type: Optional[str] = None
    transaction_id: Optional[str] = None
    notes: Optional[str] = None


class InvoiceEmailRequest(BaseModel):
    email: str
    message: Optional[str] = None


class InvoiceSMSRequest(BaseModel):
    phone: str
    message: Optional[str] = None
    carrier: Optional[str] = None  # Required for SMS Gateway


class InvoiceLineItemUpdate(BaseModel):
    unit_price: Optional[float] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def generate_invoice_number(cur):
    """Generate next invoice number in format INV-YYYY-NNNN"""
    year = datetime.now().year
    cur.execute("""
        SELECT invoice_number FROM invoices
        WHERE invoice_number LIKE %s
        ORDER BY invoice_number DESC LIMIT 1
    """, (f"INV-{year}-%",))

    result = cur.fetchone()
    if result:
        last_num = int(result['invoice_number'].split('-')[2])
        next_num = last_num + 1
    else:
        next_num = 1

    return f"INV-{year}-{next_num:04d}"


# ============================================================
# INVOICE ENDPOINTS
# ============================================================

@router.get("/invoices")
async def get_invoices(
    request: Request,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get all invoices with optional filtering and pagination"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        base_query = """
            FROM invoices i
            JOIN work_orders wo ON i.work_order_id = wo.id
            JOIN customers c ON i.customer_id = c.id
            WHERE 1=1
        """
        params = []

        if status:
            base_query += " AND i.payment_status = %s"
            params.append(status)

        if customer_id:
            base_query += " AND i.customer_id = %s"
            params.append(customer_id)

        if search:
            base_query += """ AND (
                i.invoice_number ILIKE %s OR
                wo.work_order_number ILIKE %s OR
                c.first_name ILIKE %s OR c.last_name ILIKE %s OR
                c.company_name ILIKE %s
            )"""
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param, search_param, search_param])

        # Get total count
        cur.execute(f"SELECT COUNT(*) as total {base_query}", params)
        total = cur.fetchone()['total']

        # Get paginated results
        select_query = f"""
            SELECT
                i.*,
                wo.work_order_number,
                wo.job_description,
                c.first_name || ' ' || c.last_name as customer_name,
                c.email as customer_email,
                c.phone_primary as customer_phone,
                c.service_street as customer_address,
                c.service_city as customer_city,
                c.service_state as customer_state,
                c.service_zip as customer_zip
            {base_query}
            ORDER BY i.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])

        cur.execute(select_query, params)
        invoices = cur.fetchall()

        # Convert to list of dicts with proper decimal handling
        result = []
        for inv in invoices:
            inv_dict = dict(inv)
            # Convert Decimal to float for JSON serialization
            for key in ['labor_cost', 'material_cost', 'permit_cost', 'travel_charge',
                       'emergency_surcharge', 'subtotal', 'discount_amount', 'tax_rate',
                       'tax_amount', 'total_amount', 'amount_paid', 'balance_due', 'late_fee_amount']:
                if key in inv_dict and inv_dict[key] is not None:
                    inv_dict[key] = float(inv_dict[key])
            result.append(inv_dict)

        cur.close()
        conn.close()

        return {
            "invoices": result,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.get("/invoices/summary/stats")
async def get_invoice_stats(request: Request):
    """Get invoice summary statistics"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                COUNT(*) as total_invoices,
                COUNT(*) FILTER (WHERE payment_status = 'unpaid') as unpaid_count,
                COUNT(*) FILTER (WHERE payment_status = 'partial') as partial_count,
                COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count,
                COALESCE(SUM(total_amount), 0) as total_invoiced,
                COALESCE(SUM(amount_paid), 0) as total_collected,
                COALESCE(SUM(balance_due), 0) as total_outstanding,
                COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid') as overdue_count,
                COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE AND payment_status != 'paid'), 0) as overdue_amount
            FROM invoices
        """)

        stats = cur.fetchone()
        stats_dict = dict(stats)

        # Convert Decimal to float
        for key in ['total_invoiced', 'total_collected', 'total_outstanding', 'overdue_amount']:
            if key in stats_dict and stats_dict[key] is not None:
                stats_dict[key] = float(stats_dict[key])

        cur.close()
        conn.close()

        return stats_dict

    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    request: Request,
    invoice_id: int
):
    """Get a single invoice with all details"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get invoice with customer and work order info
        cur.execute("""
            SELECT
                i.*,
                wo.work_order_number,
                wo.job_description,
                wo.job_type,
                wo.service_address,
                wo.scheduled_date,
                wo.completed_date,
                c.first_name || ' ' || c.last_name as customer_name,
                c.company_name,
                c.email as customer_email,
                c.phone_primary as customer_phone,
                c.service_street as customer_address,
                c.service_city as customer_city,
                c.service_state as customer_state,
                c.service_zip as customer_zip
            FROM invoices i
            JOIN work_orders wo ON i.work_order_id = wo.id
            JOIN customers c ON i.customer_id = c.id
            WHERE i.id = %s
        """, (invoice_id,))

        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        invoice_dict = dict(invoice)

        # Convert Decimal to float
        for key in ['labor_cost', 'material_cost', 'permit_cost', 'travel_charge',
                   'emergency_surcharge', 'subtotal', 'discount_amount', 'tax_rate',
                   'tax_amount', 'total_amount', 'amount_paid', 'balance_due', 'late_fee_amount']:
            if key in invoice_dict and invoice_dict[key] is not None:
                invoice_dict[key] = float(invoice_dict[key])

        # Get line items (materials used on the work order) - use LEFT JOIN for custom materials
        cur.execute("""
            SELECT
                jm.id,
                jm.inventory_id,
                COALESCE(inv.item_id, 'CUSTOM') as item_id,
                COALESCE(inv.description, jm.custom_description) as description,
                COALESCE(inv.brand, jm.custom_manufacturer) as brand,
                jm.quantity_used as quantity,
                jm.unit_cost,
                jm.unit_price,
                (jm.quantity_used * jm.unit_price) as line_total,
                CASE WHEN jm.inventory_id IS NULL THEN true ELSE false END as is_custom,
                COALESCE(jm.customer_provided, false) as customer_provided
            FROM job_materials_used jm
            LEFT JOIN inventory inv ON jm.inventory_id = inv.id
            WHERE jm.work_order_id = %s
            ORDER BY jm.installed_date
        """, (invoice_dict['work_order_id'],))

        materials = cur.fetchall()
        invoice_dict['line_items'] = []
        for mat in materials:
            mat_dict = dict(mat)
            for key in ['unit_cost', 'unit_price', 'line_total']:
                if key in mat_dict and mat_dict[key] is not None:
                    mat_dict[key] = float(mat_dict[key])
            invoice_dict['line_items'].append(mat_dict)

        # Get labor entries
        cur.execute("""
            SELECT
                te.id,
                te.work_date,
                te.hours_worked,
                te.billable_rate,
                te.billable_amount as line_total,
                te.notes as work_description,
                u.full_name as employee_name
            FROM time_entries te
            JOIN users u ON te.employee_username = u.username
            WHERE te.work_order_id = %s
            ORDER BY te.work_date
        """, (invoice_dict['work_order_id'],))

        labor = cur.fetchall()
        invoice_dict['labor_entries'] = []
        for lab in labor:
            lab_dict = dict(lab)
            for key in ['hours_worked', 'billable_rate', 'line_total']:
                if key in lab_dict and lab_dict[key] is not None:
                    lab_dict[key] = float(lab_dict[key])
            invoice_dict['labor_entries'].append(lab_dict)

        # Get payment history
        cur.execute("""
            SELECT
                ip.*,
                u.full_name as recorded_by_name
            FROM invoice_payments ip
            LEFT JOIN users u ON ip.recorded_by = u.username
            WHERE ip.invoice_id = %s
            ORDER BY ip.payment_date DESC
        """, (invoice_id,))

        payments = cur.fetchall()
        invoice_dict['payments'] = []
        for pay in payments:
            pay_dict = dict(pay)
            if 'amount' in pay_dict and pay_dict['amount'] is not None:
                pay_dict['amount'] = float(pay_dict['amount'])
            invoice_dict['payments'].append(pay_dict)

        cur.close()
        conn.close()

        return invoice_dict

    except HTTPException:
        raise
    except Exception as e:
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.post("/invoices")
async def create_invoice(
    request: Request,
    invoice: InvoiceCreate
):
    """Create an invoice from a work order"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get work order details
        cur.execute("""
            SELECT wo.*, c.id as cust_id
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            WHERE wo.id = %s
        """, (invoice.work_order_id,))

        wo = cur.fetchone()
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")

        # Check if invoice already exists for this work order
        cur.execute("SELECT id FROM invoices WHERE work_order_id = %s", (invoice.work_order_id,))
        existing = cur.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Invoice already exists for this work order")

        # Calculate labor cost from time entries
        cur.execute("""
            SELECT COALESCE(SUM(billable_amount), 0) as total_labor
            FROM time_entries
            WHERE work_order_id = %s
        """, (invoice.work_order_id,))
        labor_result = cur.fetchone()
        labor_cost = float(labor_result['total_labor']) if labor_result else 0.0

        # Calculate material cost from job_materials_used
        cur.execute("""
            SELECT COALESCE(SUM(quantity_used * unit_price), 0) as total_materials
            FROM job_materials_used
            WHERE work_order_id = %s
        """, (invoice.work_order_id,))
        material_result = cur.fetchone()
        material_cost = float(material_result['total_materials']) if material_result else 0.0

        # Generate invoice number
        invoice_number = generate_invoice_number(cur)

        # Calculate totals
        subtotal = labor_cost + material_cost + invoice.permit_cost + invoice.travel_charge + invoice.emergency_surcharge
        tax_amount = (subtotal - invoice.discount_amount) * (invoice.tax_rate / 100)
        total_amount = subtotal - invoice.discount_amount + tax_amount

        # Calculate due date
        due_date = datetime.now() + timedelta(days=invoice.due_days)

        # Insert invoice
        cur.execute("""
            INSERT INTO invoices (
                invoice_number, work_order_id, customer_id,
                invoice_date, due_date, labor_cost, material_cost,
                permit_cost, travel_charge, emergency_surcharge,
                subtotal, discount_amount, tax_rate, tax_amount,
                total_amount, notes, terms, created_by
            ) VALUES (
                %s, %s, %s, CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """, (
            invoice_number, invoice.work_order_id, wo['cust_id'],
            due_date.date(), labor_cost, material_cost,
            invoice.permit_cost, invoice.travel_charge, invoice.emergency_surcharge,
            subtotal, invoice.discount_amount, invoice.tax_rate, tax_amount,
            total_amount, invoice.notes, invoice.terms, current_user['username']
        ))

        new_id = cur.fetchone()['id']

        # Update work order status to invoiced
        cur.execute("""
            UPDATE work_orders SET status = 'invoiced', last_updated = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (invoice.work_order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Invoice created successfully",
            "invoice_id": new_id,
            "invoice_number": invoice_number,
            "total_amount": total_amount
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.put("/invoices/{invoice_id}")
async def update_invoice(
    request: Request,
    invoice_id: int,
    invoice: InvoiceUpdate
):
    """Update an invoice"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get current invoice
        cur.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Build update query dynamically
        updates = []
        params = []

        if invoice.due_date is not None:
            updates.append("due_date = %s")
            params.append(invoice.due_date)

        if invoice.tax_rate is not None:
            updates.append("tax_rate = %s")
            params.append(invoice.tax_rate)

        if invoice.permit_cost is not None:
            updates.append("permit_cost = %s")
            params.append(invoice.permit_cost)

        if invoice.travel_charge is not None:
            updates.append("travel_charge = %s")
            params.append(invoice.travel_charge)

        if invoice.emergency_surcharge is not None:
            updates.append("emergency_surcharge = %s")
            params.append(invoice.emergency_surcharge)

        if invoice.discount_amount is not None:
            updates.append("discount_amount = %s")
            params.append(invoice.discount_amount)

        if invoice.notes is not None:
            updates.append("notes = %s")
            params.append(invoice.notes)

        if invoice.terms is not None:
            updates.append("terms = %s")
            params.append(invoice.terms)

        if updates:
            # Recalculate totals
            labor_cost = float(existing['labor_cost'])
            material_cost = float(existing['material_cost'])
            permit_cost = invoice.permit_cost if invoice.permit_cost is not None else float(existing['permit_cost'] or 0)
            travel_charge = invoice.travel_charge if invoice.travel_charge is not None else float(existing['travel_charge'] or 0)
            emergency_surcharge = invoice.emergency_surcharge if invoice.emergency_surcharge is not None else float(existing['emergency_surcharge'] or 0)
            discount_amount = invoice.discount_amount if invoice.discount_amount is not None else float(existing['discount_amount'] or 0)
            tax_rate = invoice.tax_rate if invoice.tax_rate is not None else float(existing['tax_rate'])

            subtotal = labor_cost + material_cost + permit_cost + travel_charge + emergency_surcharge
            tax_amount = (subtotal - discount_amount) * (tax_rate / 100)
            total_amount = subtotal - discount_amount + tax_amount

            updates.extend(["subtotal = %s", "tax_amount = %s", "total_amount = %s"])
            params.extend([subtotal, tax_amount, total_amount])

            params.append(invoice_id)
            query = f"UPDATE invoices SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)

            conn.commit()

        cur.close()
        conn.close()

        return {"message": "Invoice updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(
    request: Request,
    invoice_id: int
):
    """Delete an invoice (admin only)"""
    current_user = await get_current_user_from_request(request)
    require_admin_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get work order id before deleting
        cur.execute("SELECT work_order_id FROM invoices WHERE id = %s", (invoice_id,))
        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        work_order_id = invoice['work_order_id']

        # Delete invoice (payments cascade)
        cur.execute("DELETE FROM invoices WHERE id = %s", (invoice_id,))

        # Revert work order status
        cur.execute("""
            UPDATE work_orders SET status = 'completed', last_updated = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (work_order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Invoice deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.post("/invoices/{invoice_id}/payments")
async def record_payment(
    request: Request,
    invoice_id: int,
    payment: PaymentCreate
):
    """Record a payment against an invoice"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get current invoice
        cur.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Insert payment
        cur.execute("""
            INSERT INTO invoice_payments (
                invoice_id, payment_date, amount, payment_method,
                check_number, card_last_four, card_type, transaction_id,
                notes, recorded_by
            ) VALUES (
                %s, CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id
        """, (
            invoice_id, payment.amount, payment.payment_method,
            payment.check_number, payment.card_last_four, payment.card_type,
            payment.transaction_id, payment.notes, current_user['username']
        ))

        payment_id = cur.fetchone()['id']

        # Update invoice amount_paid
        new_amount_paid = float(invoice['amount_paid'] or 0) + payment.amount

        # Determine payment status
        total_amount = float(invoice['total_amount'])
        if new_amount_paid >= total_amount:
            payment_status = 'paid'
        elif new_amount_paid > 0:
            payment_status = 'partial'
        else:
            payment_status = 'unpaid'

        cur.execute("""
            UPDATE invoices SET amount_paid = %s, payment_status = %s
            WHERE id = %s
        """, (new_amount_paid, payment_status, invoice_id))

        # If fully paid, update work order status
        if payment_status == 'paid':
            cur.execute("""
                UPDATE work_orders SET status = 'paid', last_updated = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (invoice['work_order_id'],))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Payment recorded successfully",
            "payment_id": payment_id,
            "new_balance": total_amount - new_amount_paid,
            "payment_status": payment_status
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.post("/invoices/{invoice_id}/send")
async def mark_invoice_sent(
    request: Request,
    invoice_id: int
):
    """Mark an invoice as sent to customer"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE invoices SET sent_to_customer = TRUE, sent_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (invoice_id,))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Invoice not found")

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Invoice marked as sent"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.post("/invoices/{invoice_id}/email")
async def send_invoice_email(
    request: Request,
    invoice_id: int,
    email_request: InvoiceEmailRequest
):
    """Send an invoice to customer via email"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get invoice details
        cur.execute("""
            SELECT i.*, c.email as customer_email,
                   COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as customer_name,
                   c.company_name,
                   wo.work_order_number
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN work_orders wo ON i.work_order_id = wo.id
            WHERE i.id = %s
        """, (invoice_id,))
        invoice = cur.fetchone()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Get email configuration
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND is_active = TRUE
            LIMIT 1
        """)
        email_config = cur.fetchone()

        if not email_config:
            raise HTTPException(
                status_code=400,
                detail="Email is not configured. Please configure email settings first."
            )

        # Create email service
        from communication_service import EmailService
        email_service = EmailService(email_config['config'])

        # Build invoice email
        customer_name = invoice['customer_name'] or 'Customer'
        invoice_number = invoice['invoice_number']
        total_amount = float(invoice['total_amount'] or 0)
        balance_due = float(invoice['balance_due'] or 0)
        due_date = invoice['due_date'].strftime('%B %d, %Y') if invoice['due_date'] else 'N/A'

        # Email subject
        subject = f"Invoice {invoice_number} from Pem2 Services"

        # Build HTML body
        custom_message = email_request.message or ''
        custom_message_html = custom_message.replace('\n', '<br>') if custom_message else ''

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0;">Pem2 Services</h1>
                    <p style="margin: 5px 0 0 0;">Invoice {invoice_number}</p>
                </div>

                <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p>Dear {customer_name},</p>

                    {f'<div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #1976d2;">{custom_message_html}</div>' if custom_message_html else ''}

                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="color: #1976d2; margin-top: 0;">Invoice Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">{invoice_number}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Total Amount:</strong></td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${total_amount:,.2f}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Balance Due:</strong></td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; color: {'#d32f2f' if balance_due > 0 else '#388e3c'}; font-weight: bold;">${balance_due:,.2f}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
                                <td style="padding: 8px 0; text-align: right;">{due_date}</td>
                            </tr>
                        </table>
                    </div>

                    <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

                    <p>Thank you for your business!</p>

                    <p style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                        <strong>Pem2 Services</strong><br>
                        This email was sent regarding Invoice {invoice_number}
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        # Send email
        success, message, _ = email_service.send_email(
            email_request.email,
            subject,
            html_body
        )

        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {message}")

        # Mark invoice as sent
        cur.execute("""
            UPDATE invoices SET sent_to_customer = TRUE, sent_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (invoice_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": f"Invoice sent successfully to {email_request.email}",
            "sent_to": email_request.email
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.post("/invoices/{invoice_id}/sms")
async def send_invoice_sms(
    request: Request,
    invoice_id: int,
    sms_request: InvoiceSMSRequest
):
    """Send an invoice summary to customer via SMS"""
    current_user = await get_current_user_from_request(request)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get invoice details
        cur.execute("""
            SELECT i.*, c.phone_primary as customer_phone,
                   COALESCE(c.company_name, c.first_name || ' ' || c.last_name) as customer_name,
                   wo.work_order_number
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN work_orders wo ON i.work_order_id = wo.id
            WHERE i.id = %s
        """, (invoice_id,))
        invoice = cur.fetchone()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Try Twilio SMS first, then SMS Gateway
        cur.execute("""
            SELECT config, setting_type FROM communication_settings
            WHERE setting_type IN ('sms', 'sms_gateway') AND is_active = TRUE
            ORDER BY CASE setting_type WHEN 'sms' THEN 1 ELSE 2 END
            LIMIT 1
        """)
        sms_config = cur.fetchone()

        if not sms_config:
            raise HTTPException(
                status_code=400,
                detail="SMS is not configured. Please configure SMS settings first."
            )

        # Build invoice SMS message
        customer_name = invoice['customer_name'] or 'Customer'
        invoice_number = invoice['invoice_number']
        total_amount = float(invoice['total_amount'] or 0)
        balance_due = float(invoice['balance_due'] or 0)
        due_date = invoice['due_date'].strftime('%m/%d/%Y') if invoice['due_date'] else 'N/A'

        # Build SMS body (keep it short for SMS limits)
        custom_message = sms_request.message or ''

        sms_body = f"Pem2 Services Invoice {invoice_number}\n"
        sms_body += f"Total: ${total_amount:,.2f}\n"
        if balance_due > 0:
            sms_body += f"Balance Due: ${balance_due:,.2f}\n"
            sms_body += f"Due Date: {due_date}\n"
        else:
            sms_body += "Status: PAID\n"

        if custom_message:
            sms_body += f"\n{custom_message}"

        # Send via appropriate service
        if sms_config['setting_type'] == 'sms':
            from communication_service import SMSService
            sms_service = SMSService(sms_config['config'])
            success, message, _ = sms_service.send_sms(sms_request.phone, sms_body)
        else:
            # SMS Gateway requires carrier
            if not sms_request.carrier:
                raise HTTPException(
                    status_code=400,
                    detail="Carrier is required when using SMS Gateway. Please select the customer's mobile carrier."
                )
            from communication_service import SMSGatewayService
            sms_service = SMSGatewayService(sms_config['config'])
            success, message, _ = sms_service.send_sms(
                sms_request.phone,
                sms_body,
                sms_request.carrier
            )

        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to send SMS: {message}")

        # Mark invoice as sent
        cur.execute("""
            UPDATE invoices SET sent_to_customer = TRUE, sent_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (invoice_id,))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": f"Invoice SMS sent successfully to {sms_request.phone}",
            "sent_to": sms_request.phone
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


# ============================================================
# INVOICE LINE ITEM MANAGEMENT
# ============================================================

@router.put("/invoices/{invoice_id}/line-items/{line_item_id}")
async def update_invoice_line_item(
    request: Request,
    invoice_id: int,
    line_item_id: int,
    item: InvoiceLineItemUpdate
):
    """Update a line item on an invoice (material) - allows adjusting price or quantity"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify invoice exists
        cur.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Verify line item exists and belongs to this invoice's work order (LEFT JOIN for custom materials)
        cur.execute("""
            SELECT jm.*, COALESCE(inv.description, jm.custom_description) as description
            FROM job_materials_used jm
            LEFT JOIN inventory inv ON jm.inventory_id = inv.id
            WHERE jm.id = %s AND jm.work_order_id = %s
        """, (line_item_id, invoice['work_order_id']))
        line_item = cur.fetchone()
        if not line_item:
            raise HTTPException(status_code=404, detail="Line item not found")

        # Store original values for audit logging
        original_price = float(line_item['unit_price']) if line_item['unit_price'] else 0
        original_qty = int(line_item['quantity_used']) if line_item['quantity_used'] else 0

        # Build update query
        updates = []
        params = []

        if item.unit_price is not None:
            updates.append("unit_price = %s")
            params.append(item.unit_price)

        if item.quantity is not None:
            updates.append("quantity_used = %s")
            params.append(item.quantity)

        if item.notes is not None:
            updates.append("notes = %s")
            params.append(item.notes)

        new_material_cost = 0.0
        total_amount = 0.0

        if updates:
            params.append(line_item_id)
            query = f"UPDATE job_materials_used SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)

            # Recalculate invoice material cost
            cur.execute("""
                SELECT COALESCE(SUM(quantity_used * unit_price), 0) as total_materials
                FROM job_materials_used
                WHERE work_order_id = %s
            """, (invoice['work_order_id'],))
            material_result = cur.fetchone()
            new_material_cost = float(material_result['total_materials']) if material_result else 0.0

            # Recalculate invoice totals
            labor_cost = float(invoice['labor_cost'])
            permit_cost = float(invoice['permit_cost'] or 0)
            travel_charge = float(invoice['travel_charge'] or 0)
            emergency_surcharge = float(invoice['emergency_surcharge'] or 0)
            discount_amount = float(invoice['discount_amount'] or 0)
            tax_rate = float(invoice['tax_rate'])

            subtotal = labor_cost + new_material_cost + permit_cost + travel_charge + emergency_surcharge
            tax_amount = (subtotal - discount_amount) * (tax_rate / 100)
            total_amount = subtotal - discount_amount + tax_amount

            cur.execute("""
                UPDATE invoices
                SET material_cost = %s, subtotal = %s, tax_amount = %s, total_amount = %s
                WHERE id = %s
            """, (new_material_cost, subtotal, tax_amount, total_amount, invoice_id))

            # Also update work order totals so reports stay in sync
            cur.execute("""
                UPDATE work_orders
                SET actual_material_cost = %s, total_amount = %s
                WHERE id = %s
            """, (new_material_cost, total_amount, invoice['work_order_id']))

            # Audit log the line item change
            new_price = item.unit_price if item.unit_price is not None else original_price
            new_qty = item.quantity if item.quantity is not None else original_qty
            changes = []
            if item.unit_price is not None and item.unit_price != original_price:
                changes.append(f"price ${original_price:.2f} → ${new_price:.2f}")
            if item.quantity is not None and item.quantity != original_qty:
                changes.append(f"qty {original_qty} → {new_qty}")

            if changes:
                logger.info(
                    f"Invoice {invoice['invoice_number']} line item updated by {current_user['username']}: "
                    f"{line_item['description']} - {', '.join(changes)}"
                )

            conn.commit()

        cur.close()
        conn.close()

        return {
            "message": "Line item updated successfully",
            "new_material_cost": new_material_cost,
            "new_total": total_amount
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)


@router.put("/invoices/{invoice_id}/labor-entries/{entry_id}")
async def update_invoice_labor_entry(
    request: Request,
    invoice_id: int,
    entry_id: int,
    billable_rate: Optional[float] = None,
    hours_worked: Optional[float] = None,
    notes: Optional[str] = None
):
    """Update a labor entry on an invoice - allows adjusting rate or hours"""
    current_user = await get_current_user_from_request(request)
    require_admin_or_office_check(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Verify invoice exists
        cur.execute("SELECT * FROM invoices WHERE id = %s", (invoice_id,))
        invoice = cur.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Verify labor entry exists and belongs to this invoice's work order
        cur.execute("""
            SELECT te.*, u.full_name as employee_name FROM time_entries te
            LEFT JOIN users u ON te.employee_username = u.username
            WHERE te.id = %s AND te.work_order_id = %s
        """, (entry_id, invoice['work_order_id']))
        entry = cur.fetchone()
        if not entry:
            raise HTTPException(status_code=404, detail="Labor entry not found")

        # Store original values for audit logging
        original_rate = float(entry['billable_rate']) if entry['billable_rate'] else 0
        original_hours = float(entry['hours_worked']) if entry['hours_worked'] else 0

        # Update entry
        new_rate = billable_rate if billable_rate is not None else float(entry['billable_rate'] or 0)
        new_hours = hours_worked if hours_worked is not None else float(entry['hours_worked'])
        new_billable_amount = new_rate * new_hours

        cur.execute("""
            UPDATE time_entries
            SET billable_rate = %s, hours_worked = %s, billable_amount = %s, notes = COALESCE(%s, notes)
            WHERE id = %s
        """, (new_rate, new_hours, new_billable_amount, notes, entry_id))

        # Recalculate invoice labor cost
        cur.execute("""
            SELECT COALESCE(SUM(billable_amount), 0) as total_labor
            FROM time_entries
            WHERE work_order_id = %s
        """, (invoice['work_order_id'],))
        labor_result = cur.fetchone()
        new_labor_cost = float(labor_result['total_labor']) if labor_result else 0.0

        # Recalculate invoice totals
        material_cost = float(invoice['material_cost'])
        permit_cost = float(invoice['permit_cost'] or 0)
        travel_charge = float(invoice['travel_charge'] or 0)
        emergency_surcharge = float(invoice['emergency_surcharge'] or 0)
        discount_amount = float(invoice['discount_amount'] or 0)
        tax_rate = float(invoice['tax_rate'])

        subtotal = new_labor_cost + material_cost + permit_cost + travel_charge + emergency_surcharge
        tax_amount = (subtotal - discount_amount) * (tax_rate / 100)
        total_amount = subtotal - discount_amount + tax_amount

        cur.execute("""
            UPDATE invoices
            SET labor_cost = %s, subtotal = %s, tax_amount = %s, total_amount = %s
            WHERE id = %s
        """, (new_labor_cost, subtotal, tax_amount, total_amount, invoice_id))

        # Also update work order totals so reports stay in sync
        cur.execute("""
            UPDATE work_orders
            SET actual_labor_cost = %s, total_amount = %s
            WHERE id = %s
        """, (new_labor_cost, total_amount, invoice['work_order_id']))

        # Audit log the labor entry change
        changes = []
        if billable_rate is not None and billable_rate != original_rate:
            changes.append(f"rate ${original_rate:.2f}/hr → ${new_rate:.2f}/hr")
        if hours_worked is not None and hours_worked != original_hours:
            changes.append(f"hours {original_hours} → {new_hours}")

        if changes:
            employee_name = entry.get('employee_name') or entry.get('employee_username')
            work_date = entry['work_date'].strftime('%Y-%m-%d') if entry.get('work_date') else 'unknown'
            logger.info(
                f"Invoice {invoice['invoice_number']} labor entry updated by {current_user['username']}: "
                f"{employee_name} ({work_date}) - {', '.join(changes)}"
            )

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Labor entry updated successfully",
            "new_labor_cost": new_labor_cost,
            "new_total": total_amount
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        _log_and_raise(e)
