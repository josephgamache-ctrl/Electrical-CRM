"""
Notification Service Module
Handles sending notifications via in-app notifications and optionally email.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

from communication_service import (
    get_email_service,
    get_email_template,
    render_template,
    log_communication
)

logger = logging.getLogger(__name__)


def get_user_notification_preferences(conn, username: str, notification_type: str) -> Dict[str, Any]:
    """
    Get a user's notification preferences for a specific notification type.
    Returns {'enabled': bool, 'delivery_method': str} where delivery_method is 'in_app', 'email', 'both', or 'none'
    """
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT enabled, delivery_method
            FROM user_notification_preferences
            WHERE username = %s AND notification_type = %s
        """, (username, notification_type))
        row = cur.fetchone()

        if row:
            return {
                'enabled': row['enabled'],
                'delivery_method': row['delivery_method']
            }
        # Default: in-app only if no preference set
        return {'enabled': True, 'delivery_method': 'in_app'}
    finally:
        cur.close()


def get_user_email(conn, username: str) -> Optional[str]:
    """Get user's email address from users table."""
    cur = conn.cursor()
    try:
        cur.execute("SELECT email FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        return row['email'] if row else None
    finally:
        cur.close()


def get_admins_and_managers(conn) -> List[Dict[str, str]]:
    """Get list of admin and manager users with their emails."""
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT username, full_name, email
            FROM users
            WHERE role IN ('admin', 'manager') AND active = true
        """)
        return [dict(row) for row in cur.fetchall()]
    finally:
        cur.close()


def create_in_app_notification(
    conn,
    target_username: str,
    notification_type: str,
    title: str,
    message: str,
    notification_subtype: Optional[str] = None,
    severity: str = 'info',
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    action_url: Optional[str] = None,
    dedup_key: Optional[str] = None
) -> Optional[int]:
    """
    Create an in-app notification.
    Returns the notification ID if created, None if skipped (duplicate or preference disabled).
    """
    cur = conn.cursor()
    try:
        # Check user preferences
        prefs = get_user_notification_preferences(conn, target_username, notification_type)
        if not prefs['enabled'] or prefs['delivery_method'] == 'none':
            return None

        if prefs['delivery_method'] == 'email':
            # User only wants email, skip in-app
            return None

        cur.execute("""
            INSERT INTO notifications (
                target_username, notification_type, notification_subtype,
                title, message, severity,
                related_entity_type, related_entity_id, action_url,
                dedup_key
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (dedup_key) DO NOTHING
            RETURNING id
        """, (
            target_username, notification_type, notification_subtype,
            title, message, severity,
            related_entity_type, related_entity_id, action_url,
            dedup_key
        ))

        result = cur.fetchone()
        conn.commit()
        return result['id'] if result else None

    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        conn.rollback()
        return None
    finally:
        cur.close()


def send_notification_email(
    conn,
    to_email: str,
    template_key: str,
    variables: Dict[str, Any],
    sent_by: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None
) -> bool:
    """
    Send a notification email using a template.
    Returns True if sent successfully, False otherwise.
    """
    try:
        # Get email service
        email_service = get_email_service(conn)
        if not email_service:
            logger.warning("Email not configured, skipping email notification")
            return False

        # Get template
        template = get_email_template(conn, template_key)
        if not template:
            logger.warning(f"Email template '{template_key}' not found")
            return False

        # Render subject and body
        subject = render_template(template['subject'], variables)
        body_html = render_template(template['body'], variables)

        # Send email
        success, message, message_id = email_service.send_email(
            to_email=to_email,
            subject=subject,
            body_html=body_html
        )

        # Log the communication
        log_communication(
            conn,
            communication_type='email',
            recipient_address=to_email,
            status='sent' if success else 'failed',
            subject=subject,
            message_preview=body_html[:500] if body_html else None,
            related_type=related_type,
            related_id=related_id,
            error_message=None if success else message,
            provider_message_id=message_id,
            sent_by=sent_by or 'system'
        )

        return success

    except Exception as e:
        logger.error(f"Failed to send notification email: {e}")
        return False


def notify_user(
    conn,
    username: str,
    notification_type: str,
    title: str,
    message: str,
    email_template_key: Optional[str] = None,
    email_variables: Optional[Dict[str, Any]] = None,
    notification_subtype: Optional[str] = None,
    severity: str = 'info',
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    action_url: Optional[str] = None,
    dedup_key: Optional[str] = None,
    sent_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send a notification to a user via their preferred delivery method(s).

    Returns dict with 'in_app': bool, 'email': bool indicating which methods succeeded.
    """
    result = {'in_app': False, 'email': False}

    # Get user preferences
    prefs = get_user_notification_preferences(conn, username, notification_type)

    if not prefs['enabled']:
        return result

    delivery = prefs['delivery_method']

    # Send in-app notification
    if delivery in ('in_app', 'both'):
        notif_id = create_in_app_notification(
            conn,
            target_username=username,
            notification_type=notification_type,
            title=title,
            message=message,
            notification_subtype=notification_subtype,
            severity=severity,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            action_url=action_url,
            dedup_key=dedup_key
        )
        result['in_app'] = notif_id is not None

    # Send email notification
    if delivery in ('email', 'both') and email_template_key:
        user_email = get_user_email(conn, username)
        if user_email:
            result['email'] = send_notification_email(
                conn,
                to_email=user_email,
                template_key=email_template_key,
                variables=email_variables or {},
                sent_by=sent_by,
                related_type=related_entity_type,
                related_id=related_entity_id
            )

    return result


def notify_admins_and_managers(
    conn,
    notification_type: str,
    title: str,
    message: str,
    email_template_key: Optional[str] = None,
    email_variables: Optional[Dict[str, Any]] = None,
    notification_subtype: Optional[str] = None,
    severity: str = 'info',
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    action_url: Optional[str] = None,
    dedup_key_prefix: Optional[str] = None,
    sent_by: Optional[str] = None
) -> int:
    """
    Send notification to all admin and manager users.
    Returns count of notifications sent.
    """
    admins_managers = get_admins_and_managers(conn)
    count = 0

    for user in admins_managers:
        dedup_key = f"{dedup_key_prefix}_{user['username']}" if dedup_key_prefix else None

        result = notify_user(
            conn,
            username=user['username'],
            notification_type=notification_type,
            title=title,
            message=message,
            email_template_key=email_template_key,
            email_variables=email_variables,
            notification_subtype=notification_subtype,
            severity=severity,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            action_url=action_url,
            dedup_key=dedup_key,
            sent_by=sent_by
        )

        if result['in_app'] or result['email']:
            count += 1

    return count


# ============================================================
# SPECIFIC NOTIFICATION HELPERS
# ============================================================

def notify_pto_request_submitted(conn, pto_request: Dict[str, Any], sent_by: str) -> int:
    """Notify admins/managers about a new PTO request."""
    variables = {
        'employee_name': pto_request.get('full_name', pto_request.get('username', 'Unknown')),
        'pto_type': pto_request.get('pto_type', 'Time Off'),
        'pto_dates': pto_request.get('date_display', pto_request.get('start_date', '')),
        'pto_hours': str(pto_request.get('hours', 8)),
        'pto_reason': pto_request.get('reason', 'Not specified'),
        'submitted_date': datetime.now().strftime('%B %d, %Y at %I:%M %p')
    }

    return notify_admins_and_managers(
        conn,
        notification_type='pto',
        title=f"PTO Request: {variables['employee_name']}",
        message=f"{variables['employee_name']} has requested {variables['pto_hours']} hours of {variables['pto_type']}",
        email_template_key='pto_request_submitted',
        email_variables=variables,
        notification_subtype='request_submitted',
        severity='info',
        related_entity_type='pto_request',
        related_entity_id=pto_request.get('id'),
        action_url='/admin/pto-requests',
        dedup_key_prefix=f"pto_submitted_{pto_request.get('id')}",
        sent_by=sent_by
    )


def notify_pto_request_approved(conn, pto_request: Dict[str, Any], approved_by: str) -> Dict[str, Any]:
    """Notify employee that their PTO request was approved."""
    username = pto_request.get('username')
    if not username:
        return {'in_app': False, 'email': False}

    variables = {
        'pto_type': pto_request.get('pto_type', 'Time Off'),
        'pto_dates': pto_request.get('date_display', pto_request.get('start_date', '')),
        'pto_hours': str(pto_request.get('hours', 8)),
        'approved_by': approved_by
    }

    return notify_user(
        conn,
        username=username,
        notification_type='pto',
        title='Time Off Request Approved',
        message=f"Your {variables['pto_type']} request for {variables['pto_dates']} has been approved",
        email_template_key='pto_request_approved',
        email_variables=variables,
        notification_subtype='request_approved',
        severity='success',
        related_entity_type='pto_request',
        related_entity_id=pto_request.get('id'),
        action_url='/my-timecard',
        sent_by=approved_by
    )


def notify_pto_request_denied(conn, pto_request: Dict[str, Any], denied_by: str, denial_reason: str = '') -> Dict[str, Any]:
    """Notify employee that their PTO request was denied."""
    username = pto_request.get('username')
    if not username:
        return {'in_app': False, 'email': False}

    variables = {
        'pto_type': pto_request.get('pto_type', 'Time Off'),
        'pto_dates': pto_request.get('date_display', pto_request.get('start_date', '')),
        'reviewed_by': denied_by,
        'denial_reason': denial_reason or 'Not specified'
    }

    return notify_user(
        conn,
        username=username,
        notification_type='pto',
        title='Time Off Request Denied',
        message=f"Your {variables['pto_type']} request for {variables['pto_dates']} was not approved",
        email_template_key='pto_request_denied',
        email_variables=variables,
        notification_subtype='request_denied',
        severity='warning',
        related_entity_type='pto_request',
        related_entity_id=pto_request.get('id'),
        action_url='/my-timecard',
        sent_by=denied_by
    )


def notify_job_assigned(conn, work_order: Dict[str, Any], assigned_username: str, assigned_by: str) -> Dict[str, Any]:
    """Notify technician about a new job assignment."""
    variables = {
        'work_order_number': work_order.get('work_order_number', 'N/A'),
        'customer_name': work_order.get('customer_name', 'Unknown'),
        'job_type': work_order.get('job_type', 'Service'),
        'scheduled_date': work_order.get('scheduled_date', 'TBD'),
        'job_address': work_order.get('service_address', ''),
        'job_description': work_order.get('job_description', '')[:200]
    }

    return notify_user(
        conn,
        username=assigned_username,
        notification_type='job_assignment',
        title=f"New Job: {variables['work_order_number']}",
        message=f"You have been assigned to {variables['job_type']} for {variables['customer_name']}",
        email_template_key='job_assigned',
        email_variables=variables,
        notification_subtype='assigned',
        severity='info',
        related_entity_type='work_order',
        related_entity_id=work_order.get('id'),
        action_url=f"/jobs/{work_order.get('id')}",
        sent_by=assigned_by
    )


def notify_callout(conn, callout_info: Dict[str, Any], username: str) -> int:
    """Notify admins/managers about an employee callout."""
    variables = {
        'employee_name': callout_info.get('full_name', username),
        'callout_date': callout_info.get('date', datetime.now().strftime('%B %d, %Y')),
        'callout_type': callout_info.get('type', 'Sick'),
        'callout_reason': callout_info.get('reason', 'Not specified')
    }

    return notify_admins_and_managers(
        conn,
        notification_type='callout',
        title=f"Call-Out: {variables['employee_name']}",
        message=f"{variables['employee_name']} has called out for {variables['callout_date']}",
        email_template_key='callout_notification',
        email_variables=variables,
        notification_subtype='callout',
        severity='warning',
        action_url='/schedule',
        dedup_key_prefix=f"callout_{username}_{callout_info.get('date')}",
        sent_by=username
    )
