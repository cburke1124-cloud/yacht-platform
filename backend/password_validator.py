import re
from typing import Tuple, List
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PasswordValidator:
    """Comprehensive password validation"""
    
    MIN_LENGTH = 8
    MAX_LENGTH = 128
    
    # Common weak passwords to reject
    COMMON_PASSWORDS = {
        'password', 'password123', '12345678', 'qwerty', 'abc123',
        'monkey', '1234567890', 'letmein', 'trustno1', 'dragon',
        'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
        'bailey', 'passw0rd', 'shadow', '123123', '654321',
        'admin', 'admin123', 'root', 'toor', 'changeme'
    }
    
    @classmethod
    def validate(cls, password: str) -> Tuple[bool, List[str]]:
        """
        Validate password strength
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check length
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters long")
        
        if len(password) > cls.MAX_LENGTH:
            errors.append(f"Password must not exceed {cls.MAX_LENGTH} characters")
        
        # Check for uppercase
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
        
        # Check for lowercase
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
        
        # Check for digit
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one number")
        
        # Check for special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;~`]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>_-+=[]\\\/;~`)")
        
        # Check against common passwords
        if password.lower() in cls.COMMON_PASSWORDS:
            errors.append("This password is too common. Please choose a stronger password")
        
        # Check for sequential characters
        if cls._has_sequential_chars(password):
            errors.append("Password contains too many sequential characters")
        
        # Check for repeated characters
        if cls._has_repeated_chars(password):
            errors.append("Password contains too many repeated characters")
        
        return (len(errors) == 0, errors)
    
    @staticmethod
    def _has_sequential_chars(password: str, max_sequential: int = 3) -> bool:
        """Check for sequential characters like '123' or 'abc'"""
        password_lower = password.lower()
        
        for i in range(len(password_lower) - max_sequential + 1):
            substring = password_lower[i:i + max_sequential]
            
            # Check if all characters are digits
            if substring.isdigit():
                nums = [int(c) for c in substring]
                if all(nums[j] + 1 == nums[j + 1] for j in range(len(nums) - 1)):
                    return True
                if all(nums[j] - 1 == nums[j + 1] for j in range(len(nums) - 1)):
                    return True
            
            # Check if all characters are letters
            if substring.isalpha():
                ords = [ord(c) for c in substring]
                if all(ords[j] + 1 == ords[j + 1] for j in range(len(ords) - 1)):
                    return True
                if all(ords[j] - 1 == ords[j + 1] for j in range(len(ords) - 1)):
                    return True
        
        return False
    
    @staticmethod
    def _has_repeated_chars(password: str, max_repeats: int = 3) -> bool:
        """Check for repeated characters like 'aaa' or '111'"""
        for i in range(len(password) - max_repeats + 1):
            if len(set(password[i:i + max_repeats])) == 1:
                return True
        return False
    
    @classmethod
    def check_breach(cls, password: str) -> bool:
        """
        Check if password appears in known breaches using haveibeenpwned API
        
        Note: This uses k-anonymity - only first 5 chars of SHA-1 hash are sent
        Returns True if password is breached, False if safe
        """
        import hashlib
        import requests
        
        # SHA-1 hash of password
        sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
        prefix = sha1_hash[:5]
        suffix = sha1_hash[5:]
        
        try:
            # Query haveibeenpwned API
            url = f"https://api.pwnedpasswords.com/range/{prefix}"
            response = requests.get(url, timeout=2)
            
            if response.status_code == 200:
                # Check if our suffix appears in results
                hashes = response.text.split('\r\n')
                for hash_line in hashes:
                    hash_suffix, count = hash_line.split(':')
                    if hash_suffix == suffix:
                        return True  # Password found in breach
            
            return False  # Password not found
        except Exception:
            # If API fails, don't block the user
            return False
    
    @classmethod
    def get_strength_score(cls, password: str) -> Tuple[int, str]:
        """
        Calculate password strength score
        
        Returns:
            Tuple of (score 0-100, strength_label)
        """
        score = 0
        
        # Length contribution (max 30 points)
        score += min(len(password) * 2, 30)
        
        # Character variety (max 40 points)
        has_lower = bool(re.search(r'[a-z]', password))
        has_upper = bool(re.search(r'[A-Z]', password))
        has_digit = bool(re.search(r'\d', password))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;~`]', password))
        
        variety_count = sum([has_lower, has_upper, has_digit, has_special])
        score += variety_count * 10
        
        # No sequential/repeated chars (max 20 points)
        if not cls._has_sequential_chars(password):
            score += 10
        if not cls._has_repeated_chars(password):
            score += 10
        
        # Not common password (max 10 points)
        if password.lower() not in cls.COMMON_PASSWORDS:
            score += 10
        
        # Determine strength label
        if score >= 80:
            label = "Strong"
        elif score >= 60:
            label = "Good"
        elif score >= 40:
            label = "Fair"
        else:
            label = "Weak"
        
        return (min(score, 100), label)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


# Pydantic schema for validation
from pydantic import BaseModel, validator

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        is_valid, errors = PasswordValidator.validate(v)
        if not is_valid:
            raise ValueError('; '.join(errors))
        return v
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v


if __name__ == "__main__":
    # Test the validator
    test_passwords = [
        "weak",
        "password123",
        "StrongP@ssw0rd!",
        "Abc123!@#",
        "aaaaAAAA1111!!!!",  # Repeated chars
        "Abcd1234!@#$"       # Sequential
    ]
    
    print("Password Validation Tests:\n")
    for pwd in test_passwords:
        is_valid, errors = PasswordValidator.validate(pwd)
        score, strength = PasswordValidator.get_strength_score(pwd)
        
        print(f"Password: {pwd}")
        print(f"Valid: {is_valid}")
        print(f"Strength: {strength} ({score}/100)")
        if errors:
            print(f"Errors: {', '.join(errors)}")
        print("-" * 50)
