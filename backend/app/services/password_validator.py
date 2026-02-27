class PasswordValidator:
    @staticmethod
    def validate(password: str):
        errors = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters")
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain a number")
        if not any(c.isalpha() for c in password):
            errors.append("Password must contain a letter")

        return (len(errors) == 0, errors)