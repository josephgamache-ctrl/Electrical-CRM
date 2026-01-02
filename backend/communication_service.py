"""
Communication Service Module
Handles email (SMTP) and SMS (Twilio) sending functionality with encrypted credential storage.
"""

import os
import json
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
import base64
import hashlib
from cryptography.fernet import Fernet

# Twilio import - will be available after requirements update
try:
    from twilio.rest import Client as TwilioClient
    from twilio.base.exceptions import TwilioRestException
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    TwilioClient = None
    TwilioRestException = Exception


class EncryptionService:
    """Handles encryption/decryption of sensitive configuration data."""

    _instance = None
    _fernet = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        # Derive encryption key from SECRET_KEY environment variable
        # SECURITY: Require SECRET_KEY - do not allow fallback to default
        secret_key = os.environ.get('SECRET_KEY')
        if not secret_key:
            raise ValueError(
                "SECRET_KEY environment variable MUST be set for encryption. "
                "Generate a secure key with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )
        # Create a consistent 32-byte key from the secret
        key_bytes = hashlib.sha256(secret_key.encode()).digest()
        # Fernet requires base64-encoded 32-byte key
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        self._fernet = Fernet(fernet_key)

    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64-encoded result."""
        if not data:
            return data
        encrypted = self._fernet.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt a base64-encoded encrypted string."""
        if not encrypted_data:
            return encrypted_data
        try:
            decoded = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = self._fernet.decrypt(decoded)
            return decrypted.decode()
        except Exception:
            # If decryption fails, return empty string
            return ""


# Sensitive fields that should be encrypted in config
SENSITIVE_FIELDS = ['password', 'auth_token', 'api_key', 'secret_key']


def encrypt_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Encrypt sensitive fields in a configuration dictionary."""
    encryption = EncryptionService.get_instance()
    encrypted_config = config.copy()

    for field in SENSITIVE_FIELDS:
        if field in encrypted_config and encrypted_config[field]:
            # Don't re-encrypt already encrypted values (they start with specific pattern)
            value = encrypted_config[field]
            if not value.startswith('ENC:'):
                encrypted_config[field] = 'ENC:' + encryption.encrypt(value)

    return encrypted_config


def decrypt_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Decrypt sensitive fields in a configuration dictionary."""
    encryption = EncryptionService.get_instance()
    decrypted_config = config.copy()

    for field in SENSITIVE_FIELDS:
        if field in decrypted_config and decrypted_config[field]:
            value = decrypted_config[field]
            if value.startswith('ENC:'):
                decrypted_config[field] = encryption.decrypt(value[4:])

    return decrypted_config


def mask_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Mask sensitive fields for API responses."""
    masked_config = config.copy()

    for field in SENSITIVE_FIELDS:
        if field in masked_config and masked_config[field]:
            # Show only last 4 characters
            value = str(masked_config[field])
            if value.startswith('ENC:'):
                masked_config[field] = '••••••••'
            elif len(value) > 4:
                masked_config[field] = '••••' + value[-4:]
            else:
                masked_config[field] = '••••••••'

    return masked_config


class EmailService:
    """SMTP email sending service."""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize email service with SMTP configuration.

        Config should contain:
        - host: SMTP server hostname
        - port: SMTP port (usually 587 for TLS, 465 for SSL, 25 for plain)
        - username: SMTP username (usually email address)
        - password: SMTP password or app password
        - use_tls: Whether to use STARTTLS
        - use_ssl: Whether to use SSL (alternative to TLS)
        - from_name: Display name for sender
        - from_email: Sender email address
        """
        # Decrypt config if needed
        self.config = decrypt_config(config)
        self.host = self.config.get('host', 'smtp.gmail.com')
        self.port = int(self.config.get('port', 587))
        self.username = self.config.get('username', '')
        self.password = self.config.get('password', '')
        self.use_tls = self.config.get('use_tls', True)
        self.use_ssl = self.config.get('use_ssl', False)
        self.from_name = self.config.get('from_name', 'Pem2 Services')
        self.from_email = self.config.get('from_email', self.username)

    def test_connection(self) -> Tuple[bool, str]:
        """
        Test SMTP connection and authentication.
        Returns (success, message) tuple.
        """
        try:
            if self.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(self.host, self.port, context=context, timeout=10)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=10)
                if self.use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)

            server.login(self.username, self.password)
            server.quit()
            return True, "Connection successful! Email is configured correctly."
        except smtplib.SMTPAuthenticationError as e:
            return False, f"Authentication failed. Check your username and password. Error: {str(e)}"
        except smtplib.SMTPConnectError as e:
            return False, f"Could not connect to SMTP server. Check host and port. Error: {str(e)}"
        except smtplib.SMTPException as e:
            return False, f"SMTP error: {str(e)}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Tuple[str, bytes, str]]] = None  # (filename, content, mimetype)
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Send an email.

        Returns (success, message, message_id) tuple.
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            if cc:
                msg['Cc'] = ', '.join(cc)

            # Add text version (fallback)
            if body_text:
                msg.attach(MIMEText(body_text, 'plain'))

            # Add HTML version
            msg.attach(MIMEText(body_html, 'html'))

            # Add attachments
            if attachments:
                for filename, content, mimetype in attachments:
                    maintype, subtype = mimetype.split('/', 1)
                    attachment = MIMEBase(maintype, subtype)
                    attachment.set_payload(content)
                    encoders.encode_base64(attachment)
                    attachment.add_header(
                        'Content-Disposition',
                        'attachment',
                        filename=filename
                    )
                    msg.attach(attachment)

            # Build recipient list
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)

            # Connect and send
            if self.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(self.host, self.port, context=context, timeout=30)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=30)
                if self.use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)

            server.login(self.username, self.password)
            server.sendmail(self.from_email, recipients, msg.as_string())
            server.quit()

            # Generate a simple message ID
            message_id = f"email_{datetime.now().strftime('%Y%m%d%H%M%S')}_{hash(to_email) % 10000}"

            return True, "Email sent successfully", message_id

        except smtplib.SMTPRecipientsRefused as e:
            return False, f"Recipient address rejected: {str(e)}", None
        except smtplib.SMTPException as e:
            return False, f"SMTP error: {str(e)}", None
        except Exception as e:
            return False, f"Failed to send email: {str(e)}", None


# Email-to-SMS Gateway domains for major US carriers
# Format: phone@gateway sends SMS to that phone
CARRIER_GATEWAYS = {
    'att': {'name': 'AT&T', 'sms': 'txt.att.net', 'mms': 'mms.att.net'},
    'verizon': {'name': 'Verizon', 'sms': 'vtext.com', 'mms': 'vzwpix.com'},
    'tmobile': {'name': 'T-Mobile', 'sms': 'tmomail.net', 'mms': 'tmomail.net'},
    'sprint': {'name': 'Sprint', 'sms': 'messaging.sprintpcs.com', 'mms': 'pm.sprint.com'},
    'uscellular': {'name': 'US Cellular', 'sms': 'email.uscc.net', 'mms': 'mms.uscc.net'},
    'cricket': {'name': 'Cricket', 'sms': 'sms.cricketwireless.net', 'mms': 'mms.cricketwireless.net'},
    'boost': {'name': 'Boost Mobile', 'sms': 'sms.myboostmobile.com', 'mms': 'myboostmobile.com'},
    'metro': {'name': 'Metro PCS', 'sms': 'mymetropcs.com', 'mms': 'mymetropcs.com'},
    'virgin': {'name': 'Virgin Mobile', 'sms': 'vmobl.com', 'mms': 'vmpix.com'},
    'googlefi': {'name': 'Google Fi', 'sms': 'msg.fi.google.com', 'mms': 'msg.fi.google.com'},
    'xfinity': {'name': 'Xfinity Mobile', 'sms': 'vtext.com', 'mms': 'mypixmessages.com'},
    'visible': {'name': 'Visible', 'sms': 'vtext.com', 'mms': 'vzwpix.com'},
    'spectrum': {'name': 'Spectrum Mobile', 'sms': 'vtext.com', 'mms': 'vzwpix.com'},
    'consumer': {'name': 'Consumer Cellular', 'sms': 'mailmymobile.net', 'mms': 'mailmymobile.net'},
}


class SMSGatewayService:
    """
    Email-to-SMS Gateway service - sends SMS via carrier email gateways.
    FREE - no Twilio account needed. Uses your existing SMTP email config.
    """

    def __init__(self, email_service: 'EmailService'):
        """
        Initialize SMS Gateway service with an existing EmailService.
        This reuses your email configuration to send texts.
        """
        self.email_service = email_service

    @staticmethod
    def get_carriers() -> List[Dict[str, str]]:
        """Get list of supported carriers."""
        return [
            {'code': code, 'name': info['name']}
            for code, info in sorted(CARRIER_GATEWAYS.items(), key=lambda x: x[1]['name'])
        ]

    @staticmethod
    def format_phone_number(phone: str) -> str:
        """Format phone number to 10 digits only (no country code for gateways)."""
        # Remove all non-digits
        digits = ''.join(filter(str.isdigit, phone))

        # Remove country code if present
        if len(digits) == 11 and digits.startswith('1'):
            digits = digits[1:]

        return digits

    def get_gateway_email(self, phone: str, carrier: str) -> Optional[str]:
        """Get the email address for SMS gateway."""
        if carrier not in CARRIER_GATEWAYS:
            return None

        formatted_phone = self.format_phone_number(phone)
        if len(formatted_phone) != 10:
            return None

        gateway_domain = CARRIER_GATEWAYS[carrier]['sms']
        return f"{formatted_phone}@{gateway_domain}"

    def send_sms(
        self,
        to_number: str,
        carrier: str,
        message: str
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Send an SMS via email-to-SMS gateway.

        Args:
            to_number: Phone number (10 digits)
            carrier: Carrier code (e.g., 'att', 'verizon', 'tmobile')
            message: Message to send (keep under 160 chars for best results)

        Returns (success, message, message_id) tuple.
        """
        gateway_email = self.get_gateway_email(to_number, carrier)
        if not gateway_email:
            return False, f"Invalid phone number or unsupported carrier: {carrier}", None

        # SMS via email should be plain text, short subject or none
        # Many gateways ignore subject, so we put the message there too
        try:
            # For SMS gateways, we use plain text only
            # Keep message short - SMS limit is 160 chars
            truncated_message = message[:160] if len(message) > 160 else message

            success, result_message, message_id = self.email_service.send_email(
                to_email=gateway_email,
                subject="",  # Empty subject for SMS
                body_html=truncated_message,  # Plain text works best
                body_text=truncated_message
            )

            if success:
                return True, f"SMS sent via {CARRIER_GATEWAYS[carrier]['name']} gateway", message_id
            else:
                return False, result_message, None

        except Exception as e:
            return False, f"Failed to send SMS: {str(e)}", None

    def test_connection(self) -> Tuple[bool, str]:
        """Test the underlying email connection."""
        return self.email_service.test_connection()


class SMSService:
    """Twilio SMS sending service."""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize SMS service with Twilio configuration.

        Config should contain:
        - account_sid: Twilio Account SID
        - auth_token: Twilio Auth Token
        - from_number: Twilio phone number (E.164 format: +1XXXXXXXXXX)
        """
        if not TWILIO_AVAILABLE:
            raise ImportError("Twilio library not installed. Run: pip install twilio")

        # Decrypt config if needed
        self.config = decrypt_config(config)
        self.account_sid = self.config.get('account_sid', '')
        self.auth_token = self.config.get('auth_token', '')
        self.from_number = self.config.get('from_number', '')

        self.client = TwilioClient(self.account_sid, self.auth_token)

    def test_connection(self) -> Tuple[bool, str]:
        """
        Test Twilio connection by fetching account info.
        Returns (success, message) tuple.
        """
        try:
            # Try to fetch account info to verify credentials
            account = self.client.api.accounts(self.account_sid).fetch()
            return True, f"Connection successful! Account: {account.friendly_name}"
        except TwilioRestException as e:
            return False, f"Twilio authentication failed: {str(e)}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"

    def format_phone_number(self, phone: str) -> str:
        """Format phone number to E.164 format (+1XXXXXXXXXX)."""
        # Remove all non-digits
        digits = ''.join(filter(str.isdigit, phone))

        # Add country code if not present
        if len(digits) == 10:
            digits = '1' + digits

        # Ensure it starts with +
        return '+' + digits

    def send_sms(
        self,
        to_number: str,
        message: str
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Send an SMS message.

        Returns (success, message, message_sid) tuple.
        """
        if not TWILIO_AVAILABLE:
            return False, "Twilio library not installed", None

        try:
            # Format phone numbers
            formatted_to = self.format_phone_number(to_number)
            formatted_from = self.format_phone_number(self.from_number)

            # Send message
            message_obj = self.client.messages.create(
                body=message,
                from_=formatted_from,
                to=formatted_to
            )

            return True, "SMS sent successfully", message_obj.sid

        except TwilioRestException as e:
            return False, f"Twilio error: {str(e)}", None
        except Exception as e:
            return False, f"Failed to send SMS: {str(e)}", None


def get_email_service(db_connection) -> Optional[EmailService]:
    """
    Get configured email service from database.
    Returns None if not configured or not active.
    """
    try:
        cur = db_connection.cursor()
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'email' AND provider = 'smtp' AND is_active = true
        """)
        row = cur.fetchone()
        cur.close()

        if row and row['config']:
            return EmailService(row['config'])
        return None
    except Exception:
        return None


def get_sms_service(db_connection):
    """
    Get configured SMS service from database.
    Returns SMSService (Twilio), SMSGatewayService (email gateway), or None.
    Prefers email gateway if available since it's free.
    """
    try:
        cur = db_connection.cursor()

        # First check for email gateway (free option) - requires email to be configured
        cur.execute("""
            SELECT config FROM communication_settings
            WHERE setting_type = 'sms' AND provider = 'email_gateway' AND is_active = true
        """)
        gateway_row = cur.fetchone()

        if gateway_row and gateway_row['config']:
            # Email gateway needs active email config
            email_service = get_email_service(db_connection)
            if email_service:
                cur.close()
                return SMSGatewayService(email_service)

        # Fall back to Twilio if available
        if TWILIO_AVAILABLE:
            cur.execute("""
                SELECT config FROM communication_settings
                WHERE setting_type = 'sms' AND provider = 'twilio' AND is_active = true
            """)
            twilio_row = cur.fetchone()
            cur.close()

            if twilio_row and twilio_row['config']:
                return SMSService(twilio_row['config'])

        cur.close()
        return None
    except Exception:
        return None


def get_sms_gateway_service(db_connection) -> Optional[SMSGatewayService]:
    """
    Get SMS Gateway service specifically (uses email to send SMS).
    Returns None if email is not configured.
    """
    email_service = get_email_service(db_connection)
    if email_service:
        return SMSGatewayService(email_service)
    return None


def log_communication(
    db_connection,
    communication_type: str,
    recipient_address: str,
    status: str,
    subject: Optional[str] = None,
    message_preview: Optional[str] = None,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
    recipient_type: Optional[str] = None,
    recipient_id: Optional[int] = None,
    error_message: Optional[str] = None,
    provider_message_id: Optional[str] = None,
    sent_by: Optional[str] = None
) -> Optional[int]:
    """Log a communication (email or SMS) to the database."""
    try:
        cur = db_connection.cursor()
        cur.execute("""
            INSERT INTO communication_log (
                communication_type, recipient_type, recipient_id, recipient_address,
                subject, message_preview, related_type, related_id,
                status, error_message, provider_message_id, sent_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            communication_type, recipient_type, recipient_id, recipient_address,
            subject, message_preview[:500] if message_preview else None,
            related_type, related_id, status, error_message,
            provider_message_id, sent_by
        ))
        log_id = cur.fetchone()['id']
        db_connection.commit()
        cur.close()
        return log_id
    except Exception as e:
        print(f"Failed to log communication: {e}")
        return None


def render_template(template: str, variables: Dict[str, Any]) -> str:
    """Simple template rendering - replace {{variable}} with values."""
    result = template
    for key, value in variables.items():
        placeholder = '{{' + key + '}}'
        result = result.replace(placeholder, str(value) if value is not None else '')
    return result


def get_email_template(db_connection, template_key: str) -> Optional[Dict[str, str]]:
    """Get an email template by key."""
    try:
        cur = db_connection.cursor()
        cur.execute("""
            SELECT template_key, template_name, subject_template, body_template
            FROM email_templates
            WHERE template_key = %s AND is_active = true
        """, (template_key,))
        row = cur.fetchone()
        cur.close()

        if row:
            return {
                'key': row['template_key'],
                'name': row['template_name'],
                'subject': row['subject_template'],
                'body': row['body_template']
            }
        return None
    except Exception:
        return None
