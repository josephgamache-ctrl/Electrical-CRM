"""
Settings Module API Endpoints
Handles user settings, profile updates, password changes, and communication settings.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from psycopg2.extras import Json
import bcrypt
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Settings"])

# Module-level variables set by init function
_get_db_connection = None
_get_current_user = None
_limiter = None

# Communication service imports (set during init)
_EmailService = None
_SMSService = None
_SMSGatewayService = None
_SendGridEmailService = None
_encrypt_config = None
_decrypt_config = None
_mask_config = None
_log_communication = None
_get_email_template = None
_render_template = None
_get_email_service = None
_TWILIO_AVAILABLE = False
_SENDGRID_AVAILABLE = False
_CARRIER_GATEWAYS = {}


def init_settings_module(db_func, auth_func, limiter, communication_imports):
    """Initialize the module with database, auth, rate limiter, and communication functions from main.py"""
    global _get_db_connection, _get_current_user, _limiter
    global _EmailService, _SMSService, _SMSGatewayService, _SendGridEmailService
    global _encrypt_config, _decrypt_config, _mask_config, _log_communication
    global _get_email_template, _render_template, _get_email_service
    global _TWILIO_AVAILABLE, _SENDGRID_AVAILABLE, _CARRIER_GATEWAYS

    _get_db_connection = db_func
    _get_current_user = auth_func
    _limiter = limiter

    # Unpack communication imports
    _EmailService = communication_imports['EmailService']
    _SMSService = communication_imports['SMSService']
    _SMSGatewayService = communication_imports['SMSGatewayService']
    _SendGridEmailService = communication_imports['SendGridEmailService']
    _encrypt_config = communication_imports['encrypt_config']
    _decrypt_config = communication_imports['decrypt_config']
    _mask_config = communication_imports['mask_config']
    _log_communication = communication_imports['log_communication']
    _get_email_template = communication_imports['get_email_template']
    _render_template = communication_imports['render_template']
    _get_email_service = communication_imports['get_email_service']
    _TWILIO_AVAILABLE = communication_imports['TWILIO_AVAILABLE']
    _SENDGRID_AVAILABLE = communication_imports['SENDGRID_AVAILABLE']
    _CARRIER_GATEWAYS = communication_imports['CARRIER_GATEWAYS']


def get_db():
    """Get database connection"""
    return _get_db_connection()


async def get_current_user_from_request(request: Request):
    """Extract token from request and get current user."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return await _get_current_user(token)


def require_admin_or_manager(current_user: dict):
    """Check if user is admin or manager."""
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")


# ============================================================
# PYDANTIC MODELS
# ============================================================

class UserSettings(BaseModel):
    theme: Optional[str] = "light"
    textScale: Optional[float] = 1.0
    columnVisibility: Optional[dict] = {}
    default_page: Optional[str] = "/home"


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    license_expiration: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @validator('new_password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class EmailSettingsInput(BaseModel):
    host: str = Field(..., description="SMTP server hostname")
    port: int = Field(587, description="SMTP port")
    username: str = Field(..., description="SMTP username")
    password: Optional[str] = Field(None, description="SMTP password (leave empty to keep existing)")
    use_tls: bool = Field(True, description="Use STARTTLS")
    use_ssl: bool = Field(False, description="Use SSL instead of TLS")
    from_name: str = Field("Pem2 Services", description="Sender display name")
    from_email: str = Field(..., description="Sender email address")
    is_active: bool = Field(True, description="Enable email sending")


class SMSSettingsInput(BaseModel):
    account_sid: str = Field(..., description="Twilio Account SID")
    auth_token: Optional[str] = Field(None, description="Twilio Auth Token (leave empty to keep existing)")
    from_number: str = Field(..., description="Twilio phone number (+1XXXXXXXXXX)")
    is_active: bool = Field(True, description="Enable SMS sending")


class TestEmailInput(BaseModel):
    to_email: str = Field(..., description="Email address to send test to")


class TestSMSInput(BaseModel):
    to_phone: str = Field(..., description="Phone number to send test to")


class SMSGatewaySettingsInput(BaseModel):
    """Settings for Email-to-SMS Gateway (free, uses carrier email gateways)."""
    is_active: bool = Field(True, description="Enable SMS via email gateway")


class TestSMSGatewayInput(BaseModel):
    """Test SMS via carrier email gateway."""
    to_phone: str = Field(..., description="Phone number to send test to (10 digits)")
    carrier: str = Field(..., description="Carrier code (e.g., 'att', 'verizon', 'tmobile')")


class SendGridSettingsInput(BaseModel):
    """Settings for SendGrid email (HTTP API - bypasses SMTP port blocks)."""
    api_key: Optional[str] = Field(None, description="SendGrid API Key (leave empty to keep existing)")
    from_name: str = Field("Pem2 Services", description="Sender display name")
    from_email: str = Field(..., description="Verified sender email address")
    is_active: bool = Field(True, description="Enable SendGrid email sending")


# ============================================================
# USER SETTINGS ENDPOINTS
# ============================================================

@router.get("/user/settings")
async def get_user_settings(request: Request):
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT settings FROM user_settings WHERE username = %s", (current_user['username'],))
    result = cur.fetchone()
    cur.close()
    conn.close()

    if result:
        return result['settings']
    else:
        return {"theme": "light", "textScale": 1.0, "columnVisibility": {}}


@router.post("/user/settings")
async def update_user_settings(request: Request, settings: UserSettings):
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    settings_json = settings.dict()

    cur.execute("""
        INSERT INTO user_settings (username, settings)
        VALUES (%s, %s)
        ON CONFLICT (username) DO UPDATE SET settings = %s, updated_at = CURRENT_TIMESTAMP
    """, (current_user['username'], Json(settings_json), Json(settings_json)))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Settings updated successfully"}


@router.put("/user/profile")
async def update_user_profile(request: Request, profile: UserProfileUpdate):
    """Update current user's profile information"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    # Build update query dynamically based on provided fields
    updates = []
    params = []

    if profile.full_name is not None:
        updates.append("full_name = %s")
        params.append(profile.full_name)
    if profile.email is not None:
        updates.append("email = %s")
        params.append(profile.email)
    if profile.phone is not None:
        updates.append("phone = %s")
        params.append(profile.phone)
    if profile.license_number is not None:
        updates.append("license_number = %s")
        params.append(profile.license_number)
    if profile.license_expiration is not None:
        if profile.license_expiration == "":
            updates.append("license_expiration = NULL")
        else:
            updates.append("license_expiration = %s")
            params.append(profile.license_expiration)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(current_user['username'])

    cur.execute(f"""
        UPDATE users SET {', '.join(updates)}
        WHERE username = %s
    """, params)

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Profile updated successfully"}


@router.post("/user/change-password")
async def change_user_password(request: Request, password_data: PasswordChange):
    """Change current user's password"""
    current_user = await get_current_user_from_request(request)
    conn = get_db()
    cur = conn.cursor()

    # Get current password hash
    cur.execute("SELECT password FROM users WHERE username = %s", (current_user['username'],))
    result = cur.fetchone()

    if not result:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not bcrypt.checkpw(password_data.current_password.encode('utf-8'), result['password'].encode('utf-8')):
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash new password
    new_hash = bcrypt.hashpw(password_data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Update password
    cur.execute("UPDATE users SET password = %s WHERE username = %s", (new_hash, current_user['username']))

    conn.commit()
    cur.close()
    conn.close()

    return {"message": "Password changed successfully"}


# ============================================================
# COMMUNICATION SETTINGS ENDPOINTS
# ============================================================

@router.get("/settings/communication")
async def get_communication_settings(request: Request):
    """Get all communication settings (passwords masked)."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, setting_type, provider, config, is_active,
                   test_status, test_message, last_tested_at,
                   updated_by, updated_at
            FROM communication_settings
            ORDER BY setting_type, provider
        """)
        settings = cur.fetchall()

        result = {
            'email': None,         # SMTP email settings
            'sendgrid': None,      # SendGrid email (HTTP API - bypasses SMTP blocks)
            'sms_gateway': None,   # Email-to-SMS gateway (free)
            'sms_twilio': None,    # Twilio SMS (paid)
            'twilio_available': _TWILIO_AVAILABLE,
            'sendgrid_available': _SENDGRID_AVAILABLE,
            'carriers': [
                {'code': code, 'name': info['name']}
                for code, info in sorted(_CARRIER_GATEWAYS.items(), key=lambda x: x[1]['name'])
            ]
        }

        for setting in settings:
            masked_config = _mask_config(setting['config'] or {})
            setting_data = {
                'id': setting['id'],
                'provider': setting['provider'],
                'config': masked_config,
                'is_active': setting['is_active'],
                'test_status': setting['test_status'],
                'test_message': setting['test_message'],
                'last_tested_at': setting['last_tested_at'].isoformat() if setting['last_tested_at'] else None,
                'updated_by': setting['updated_by'],
                'updated_at': setting['updated_at'].isoformat() if setting['updated_at'] else None
            }

            if setting['setting_type'] == 'email':
                if setting['provider'] == 'sendgrid':
                    result['sendgrid'] = setting_data
                else:
                    result['email'] = setting_data
            elif setting['setting_type'] == 'sms':
                if setting['provider'] == 'email_gateway':
                    result['sms_gateway'] = setting_data
                elif setting['provider'] == 'twilio':
                    result['sms_twilio'] = setting_data

        return result

    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/email")
async def save_email_settings(request: Request, settings: EmailSettingsInput):
    """Save email (SMTP) settings."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get existing config to preserve password if not provided
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp'
        """)
        existing = cur.fetchone()

        # Build config
        config = {
            'host': settings.host,
            'port': settings.port,
            'username': settings.username,
            'use_tls': settings.use_tls,
            'use_ssl': settings.use_ssl,
            'from_name': settings.from_name,
            'from_email': settings.from_email
        }

        # Handle password
        if settings.password:
            config['password'] = settings.password
        elif existing and existing['config']:
            # Keep existing password
            existing_config = existing['config']
            if 'password' in existing_config:
                config['password'] = existing_config['password']

        # Encrypt sensitive fields
        encrypted_config = _encrypt_config(config)

        # Upsert settings
        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('email', 'smtp', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(encrypted_config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "Email settings saved successfully", "id": setting_id}

    except Exception as e:
        conn.rollback()
        error_id = str(uuid.uuid4())[:8]
        logger.error(f"Settings Error {error_id}: Failed to save email settings: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save email settings. Reference: {error_id}")
    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/email/test")
async def test_email_settings(request: Request, test_input: TestEmailInput):
    """Test email configuration by sending a test email."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get email settings
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp'
        """)
        setting = cur.fetchone()

        if not setting or not setting['config']:
            raise HTTPException(status_code=400, detail="Email not configured. Please save settings first.")

        # Create email service and test
        email_service = _EmailService(setting['config'])

        # First test connection
        success, message = email_service.test_connection()

        if success:
            # Send test email
            test_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #1e3a5f;">Email Configuration Test</h2>
                <p>This is a test email from Pem2 Services system.</p>
                <p>If you receive this, your email configuration is working correctly!</p>
                <p style="color: gray; font-size: 12px;">
                    Tested by: {current_user['username']}<br>
                    Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </p>
            </body>
            </html>
            """
            send_success, send_message, _ = email_service.send_email(
                test_input.to_email,
                "Test Email from Pem2 Services",
                test_html
            )

            if send_success:
                message = f"Test email sent successfully to {test_input.to_email}"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'email' AND provider = 'smtp'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/sendgrid")
async def save_sendgrid_settings(request: Request, settings: SendGridSettingsInput):
    """Save SendGrid email settings (HTTP API - bypasses SMTP port blocks)."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get existing config to preserve api_key if not provided
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'sendgrid'
        """)
        existing = cur.fetchone()

        # Build config
        config = {
            'from_name': settings.from_name,
            'from_email': settings.from_email
        }

        # Handle API key
        if settings.api_key:
            config['api_key'] = settings.api_key
        elif existing and existing['config']:
            # Keep existing api_key
            existing_config = existing['config']
            if 'api_key' in existing_config:
                config['api_key'] = existing_config['api_key']

        # Encrypt sensitive fields
        encrypted_config = _encrypt_config(config)

        # Upsert settings
        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('email', 'sendgrid', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(encrypted_config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "SendGrid settings saved successfully", "id": setting_id}

    except Exception as e:
        conn.rollback()
        error_id = str(uuid.uuid4())[:8]
        logger.error(f"Settings Error {error_id}: Failed to save SendGrid settings: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save SendGrid settings. Reference: {error_id}")
    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/sendgrid/test")
async def test_sendgrid_settings(request: Request, test_input: TestEmailInput):
    """Test SendGrid configuration by sending a test email."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    if not _SENDGRID_AVAILABLE:
        raise HTTPException(status_code=400, detail="SendGrid library not installed. Contact administrator.")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get SendGrid settings
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'sendgrid'
        """)
        setting = cur.fetchone()

        if not setting or not setting['config']:
            raise HTTPException(status_code=400, detail="SendGrid not configured. Please save settings first.")

        # Create SendGrid service and test
        sendgrid_service = _SendGridEmailService(setting['config'])

        # First test connection
        success, message = sendgrid_service.test_connection()

        if success:
            # Send test email
            test_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #1e3a5f;">SendGrid Email Test</h2>
                <p>This is a test email from Pem2 Services via SendGrid.</p>
                <p>If you receive this, your SendGrid configuration is working correctly!</p>
                <p style="color: gray; font-size: 12px;">
                    Tested by: {current_user['username']}<br>
                    Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </p>
            </body>
            </html>
            """
            send_success, send_message, _ = sendgrid_service.send_email(
                test_input.to_email,
                "Test Email from Pem2 Services (SendGrid)",
                test_html
            )

            if send_success:
                message = f"Test email sent successfully via SendGrid to {test_input.to_email}"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'email' AND provider = 'sendgrid'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/sms")
async def save_sms_settings(request: Request, settings: SMSSettingsInput):
    """Save SMS (Twilio) settings."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    if not _TWILIO_AVAILABLE:
        raise HTTPException(status_code=400, detail="Twilio library not installed on server")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get existing config to preserve auth_token if not provided
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'sms' AND provider = 'twilio'
        """)
        existing = cur.fetchone()

        # Build config
        config = {
            'account_sid': settings.account_sid,
            'from_number': settings.from_number
        }

        # Handle auth token
        if settings.auth_token:
            config['auth_token'] = settings.auth_token
        elif existing and existing['config']:
            existing_config = existing['config']
            if 'auth_token' in existing_config:
                config['auth_token'] = existing_config['auth_token']

        # Encrypt sensitive fields
        encrypted_config = _encrypt_config(config)

        # Upsert settings
        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('sms', 'twilio', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(encrypted_config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "SMS settings saved successfully", "id": setting_id}

    except Exception as e:
        conn.rollback()
        error_id = str(uuid.uuid4())[:8]
        logger.error(f"Settings Error {error_id}: Failed to save SMS settings: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save SMS settings. Reference: {error_id}")
    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/sms/test")
async def test_sms_settings(request: Request, test_input: TestSMSInput):
    """Test SMS configuration by sending a test message."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    if not _TWILIO_AVAILABLE:
        raise HTTPException(status_code=400, detail="Twilio library not installed on server")

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get SMS settings
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'sms' AND provider = 'twilio'
        """)
        setting = cur.fetchone()

        if not setting or not setting['config']:
            raise HTTPException(status_code=400, detail="SMS not configured. Please save settings first.")

        # Create SMS service and test
        sms_service = _SMSService(setting['config'])

        # Test connection first
        success, message = sms_service.test_connection()

        if success:
            # Send test SMS
            test_message = f"Pem2 Services: Test SMS. If you receive this, SMS is configured correctly! Tested by {current_user['username']}"
            send_success, send_message, _ = sms_service.send_sms(
                test_input.to_phone,
                test_message
            )

            if send_success:
                message = f"Test SMS sent successfully to {test_input.to_phone}"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'sms' AND provider = 'twilio'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


# ============================================================
# SMS GATEWAY ENDPOINTS (Free Email-to-SMS via carrier gateways)
# ============================================================

@router.post("/settings/communication/sms-gateway")
async def save_sms_gateway_settings(request: Request, settings: SMSGatewaySettingsInput):
    """Save SMS Gateway settings (uses email to send SMS - requires email to be configured first)."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        # Check if email is configured
        cur.execute("""
            SELECT id FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp' AND is_active = true
        """)
        email_setting = cur.fetchone()

        if not email_setting:
            raise HTTPException(
                status_code=400,
                detail="Email must be configured and active before enabling SMS Gateway. Configure your email settings first."
            )

        # Upsert gateway settings (minimal config - just uses email)
        config = {'provider': 'email_gateway'}

        cur.execute("""
            INSERT INTO communication_settings (setting_type, provider, config, is_active, updated_by, updated_at)
            VALUES ('sms', 'email_gateway', %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_type, provider) DO UPDATE SET
                config = EXCLUDED.config,
                is_active = EXCLUDED.is_active,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """, (Json(config), settings.is_active, current_user['username']))

        setting_id = cur.fetchone()['id']
        conn.commit()

        return {"message": "SMS Gateway enabled successfully. SMS will be sent via your email settings.", "id": setting_id}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        error_id = str(uuid.uuid4())[:8]
        logger.error(f"Settings Error {error_id}: Failed to save SMS Gateway settings: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save SMS Gateway settings. Reference: {error_id}")
    finally:
        cur.close()
        conn.close()


@router.post("/settings/communication/sms-gateway/test")
async def test_sms_gateway_settings(request: Request, test_input: TestSMSGatewayInput):
    """Test SMS Gateway by sending a test message via carrier email gateway."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    # Validate carrier
    if test_input.carrier not in _CARRIER_GATEWAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid carrier: {test_input.carrier}. Valid carriers: {', '.join(_CARRIER_GATEWAYS.keys())}"
        )

    conn = get_db()
    cur = conn.cursor()

    try:
        # Get email service
        email_service = _get_email_service(conn)
        if not email_service:
            raise HTTPException(
                status_code=400,
                detail="Email not configured. Configure and test email settings first."
            )

        # Create gateway service and test
        gateway_service = _SMSGatewayService(email_service)

        # Test connection (email connection)
        success, message = gateway_service.test_connection()

        if success:
            # Send test SMS
            carrier_name = _CARRIER_GATEWAYS[test_input.carrier]['name']
            test_message = f"Pem2 Services: Test SMS via {carrier_name} gateway. Tested by {current_user['username']}"
            send_success, send_message, _ = gateway_service.send_sms(
                test_input.to_phone,
                test_input.carrier,
                test_message
            )

            if send_success:
                message = f"Test SMS sent to {test_input.to_phone} via {carrier_name} gateway"
                test_status = 'success'
            else:
                message = send_message
                test_status = 'failed'
                success = False
        else:
            test_status = 'failed'

        # Update test status for gateway
        cur.execute("""
            UPDATE communication_settings
            SET test_status = %s, test_message = %s, last_tested_at = CURRENT_TIMESTAMP
            WHERE setting_type = 'sms' AND provider = 'email_gateway'
        """, (test_status, message))
        conn.commit()

        return {"success": success, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cur.close()
        conn.close()


@router.get("/settings/communication/carriers")
async def get_carriers(request: Request):
    """Get list of supported mobile carriers for SMS Gateway."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    return {
        'carriers': [
            {'code': code, 'name': info['name']}
            for code, info in sorted(_CARRIER_GATEWAYS.items(), key=lambda x: x[1]['name'])
        ]
    }


@router.delete("/settings/communication/{setting_type}")
async def delete_communication_setting(request: Request, setting_type: str):
    """Delete/disable a communication setting."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    if setting_type not in ['email', 'sms']:
        raise HTTPException(status_code=400, detail="Invalid setting type. Use 'email' or 'sms'")

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM communication_settings
            WHERE setting_type = %s
        """, (setting_type,))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{setting_type} settings not found")

        conn.commit()
        return {"message": f"{setting_type} settings deleted successfully"}

    finally:
        cur.close()
        conn.close()


@router.get("/settings/communication/templates")
async def get_email_templates(request: Request):
    """Get all email templates."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, template_key, template_name, subject_template, body_template,
                   description, is_active, updated_by, updated_at
            FROM email_templates
            ORDER BY template_key
        """)
        templates = cur.fetchall()

        return [
            {
                'id': t['id'],
                'key': t['template_key'],
                'name': t['template_name'],
                'subject': t['subject_template'],
                'body': t['body_template'],
                'description': t['description'],
                'is_active': t['is_active'],
                'updated_by': t['updated_by'],
                'updated_at': t['updated_at'].isoformat() if t['updated_at'] else None
            }
            for t in templates
        ]

    finally:
        cur.close()
        conn.close()


@router.get("/settings/communication/log")
async def get_communication_log(
    request: Request,
    communication_type: Optional[str] = None,
    status: Optional[str] = None,
    related_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get communication log entries."""
    current_user = await get_current_user_from_request(request)
    require_admin_or_manager(current_user)

    conn = get_db()
    cur = conn.cursor()

    try:
        query = "SELECT * FROM communication_log WHERE 1=1"
        params = []

        if communication_type:
            query += " AND communication_type = %s"
            params.append(communication_type)
        if status:
            query += " AND status = %s"
            params.append(status)
        if related_type:
            query += " AND related_type = %s"
            params.append(related_type)

        query += " ORDER BY sent_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cur.execute(query, params)
        logs = cur.fetchall()

        return [
            {
                'id': log['id'],
                'type': log['communication_type'],
                'recipient': log['recipient_address'],
                'subject': log['subject'],
                'preview': log['message_preview'],
                'related_type': log['related_type'],
                'related_id': log['related_id'],
                'status': log['status'],
                'error': log['error_message'],
                'sent_by': log['sent_by'],
                'sent_at': log['sent_at'].isoformat() if log['sent_at'] else None
            }
            for log in logs
        ]

    finally:
        cur.close()
        conn.close()
