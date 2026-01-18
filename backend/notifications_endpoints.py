"""
Notifications Module API Endpoints
Handles user notifications for low stock, license expiration, overdue work orders, etc.
"""

from fastapi import APIRouter, HTTPException, Request
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Notifications"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None


def init_notifications_module(db_func, auth_func):
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
# NOTIFICATIONS ENDPOINTS
# ============================================================

@router.get("/notifications")
async def get_notifications(
    request: Request,
    unread_only: bool = False,
    notification_type: str = None,
    limit: int = 50
):
    """Get notifications for the current user"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT id, target_username, notification_type, notification_subtype,
               title, message, severity, related_entity_type, related_entity_id,
               action_url, is_read, read_at, created_at, expires_at
        FROM notifications
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    """
    params = [current_user['username']]

    if unread_only:
        query += " AND is_read = FALSE"

    if notification_type:
        query += " AND notification_type = %s"
        params.append(notification_type)

    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)

    cur.execute(query, params)
    notifications = cur.fetchall()

    # Get unread count
    cur.execute("""
        SELECT COUNT(*) as count FROM notifications
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_read = FALSE
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    """, (current_user['username'],))
    unread_count = cur.fetchone()['count']

    cur.close()
    conn.close()

    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.get("/notifications/count")
async def get_notification_count(request: Request):
    """Get unread notification count (lightweight endpoint for badge)"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*) as count FROM notifications
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_read = FALSE
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    """, (current_user['username'],))
    result = cur.fetchone()

    cur.close()
    conn.close()

    return {"unread_count": result['count']}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    request: Request
):
    """Mark a notification as read"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE id = %s AND (target_username = %s OR target_username IS NULL)
    """, (notification_id, current_user['username']))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read for the current user"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE (target_username = %s OR target_username IS NULL)
          AND is_read = FALSE
    """, (current_user['username'],))

    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    return {"message": f"Marked {affected} notifications as read"}


@router.post("/notifications/{notification_id}/dismiss")
async def dismiss_notification(
    notification_id: int,
    request: Request
):
    """Dismiss a notification (hide it permanently)"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE notifications
        SET is_dismissed = TRUE, dismissed_at = CURRENT_TIMESTAMP
        WHERE id = %s AND (target_username = %s OR target_username IS NULL)
    """, (notification_id, current_user['username']))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Notification dismissed"}


@router.post("/notifications/generate")
async def generate_notifications(request: Request):
    """
    Generate system notifications (low stock, license expiration, etc.)
    This can be called manually or scheduled via cron.
    Only admins/managers should be able to trigger this.
    """
    current_user = await get_current_user_from_request(request)
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db()
    cur = conn.cursor()
    notifications_created = 0

    # 1. LOW STOCK NOTIFICATIONS
    cur.execute("""
        SELECT id, item_id, description, qty, min_stock, location
        FROM inventory
        WHERE qty <= min_stock AND active = TRUE
    """)
    low_stock_items = cur.fetchall()

    for item in low_stock_items:
        dedup_key = f"low_stock_{item['id']}"

        # Check if notification already exists and is not dismissed
        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'inventory', 'low_stock',
                    %s, %s, 'warning', 'inventory', %s,
                    %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                f"Low Stock: {item['description']}",
                f"{item['item_id']} - {item['description']} has {item['qty']} units (min: {item['min_stock']}). Location: {item['location'] or 'N/A'}",
                item['id'],
                f"/inventory?search={item['item_id']}",
                dedup_key
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    # 2. LICENSE EXPIRATION NOTIFICATIONS
    # Alert for licenses expiring in 30, 14, 7 days, or already expired
    cur.execute("""
        SELECT username, full_name, license_number, license_expiration,
               (license_expiration - CURRENT_DATE) as days_until
        FROM users
        WHERE license_expiration IS NOT NULL
          AND active = TRUE
          AND license_expiration <= CURRENT_DATE + INTERVAL '30 days'
    """)
    expiring_licenses = cur.fetchall()

    for user in expiring_licenses:
        days = int(user['days_until']) if user['days_until'] else 0

        if days < 0:
            severity = 'error'
            title = f"License EXPIRED: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expired {abs(days)} days ago!"
            subtype = 'expired'
        elif days <= 7:
            severity = 'error'
            title = f"License Expiring Soon: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expires in {days} days!"
            subtype = 'expiring_urgent'
        elif days <= 14:
            severity = 'warning'
            title = f"License Expiring: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expires in {days} days."
            subtype = 'expiring_soon'
        else:  # 15-30 days
            severity = 'info'
            title = f"License Reminder: {user['full_name'] or user['username']}"
            message = f"License #{user['license_number']} expires in {days} days."
            subtype = 'expiring_notice'

        dedup_key = f"license_{user['username']}_{subtype}"

        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'license', %s,
                    %s, %s, %s, 'user',
                    %s, %s, %s
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                subtype,
                title,
                message,
                severity,
                '/admin/users',
                dedup_key,
                user['license_expiration']
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    # 3. OVERDUE WORK ORDERS (jobs past scheduled date that aren't completed)
    cur.execute("""
        SELECT wo.id, wo.work_order_number, wo.job_description, wo.scheduled_date,
               c.first_name || ' ' || c.last_name as customer_name
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE wo.status NOT IN ('completed', 'cancelled', 'invoiced')
          AND wo.scheduled_date < CURRENT_DATE
    """)
    overdue_orders = cur.fetchall()

    for wo in overdue_orders:
        dedup_key = f"overdue_wo_{wo['id']}"

        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'work_order', 'overdue',
                    %s, %s, 'warning', 'work_order', %s,
                    %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                f"Overdue: WO #{wo['work_order_number']}",
                f"Work order for {wo['customer_name']} was scheduled for {wo['scheduled_date']}",
                wo['id'],
                f"/work-orders/{wo['id']}",
                dedup_key
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    # 4. UPCOMING UNSCHEDULED WORK ORDERS
    # Jobs with scheduled_date coming up (within 3 days) but status is still 'pending' (no crew/schedule assigned)
    cur.execute("""
        SELECT wo.id, wo.work_order_number, wo.job_description, wo.scheduled_date,
               c.first_name || ' ' || c.last_name as customer_name,
               (wo.scheduled_date - CURRENT_DATE) as days_until
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        WHERE wo.status = 'pending'
          AND wo.scheduled_date IS NOT NULL
          AND wo.scheduled_date <= CURRENT_DATE + INTERVAL '3 days'
          AND wo.scheduled_date >= CURRENT_DATE
    """)
    upcoming_unscheduled = cur.fetchall()

    for wo in upcoming_unscheduled:
        days = int(wo['days_until']) if wo['days_until'] is not None else 0
        dedup_key = f"upcoming_unscheduled_wo_{wo['id']}"

        # Determine severity based on how soon the date is
        if days == 0:
            severity = 'error'
            time_msg = "TODAY"
        elif days == 1:
            severity = 'error'
            time_msg = "TOMORROW"
        else:
            severity = 'warning'
            time_msg = f"in {days} days"

        cur.execute("""
            SELECT id FROM notifications
            WHERE dedup_key = %s AND is_dismissed = FALSE
        """, (dedup_key,))

        if not cur.fetchone():
            cur.execute("""
                INSERT INTO notifications (
                    target_username, notification_type, notification_subtype,
                    title, message, severity, related_entity_type, related_entity_id,
                    action_url, dedup_key, expires_at
                ) VALUES (
                    NULL, 'work_order', 'upcoming_unscheduled',
                    %s, %s, %s, 'work_order', %s,
                    %s, %s, %s::date + INTERVAL '1 day'
                )
                ON CONFLICT (dedup_key) DO NOTHING
            """, (
                f"Unscheduled Job {time_msg}: WO #{wo['work_order_number']}",
                f"Work order for {wo['customer_name']} is scheduled for {wo['scheduled_date']} but has no crew assigned. Please assign crew in the Schedule module.",
                severity,
                wo['id'],
                f"/work-orders/{wo['id']}",
                dedup_key,
                wo['scheduled_date']
            ))
            if cur.rowcount > 0:
                notifications_created += 1

    conn.commit()
    cur.close()
    conn.close()

    return {
        "message": f"Generated {notifications_created} new notifications",
        "notifications_created": notifications_created
    }
