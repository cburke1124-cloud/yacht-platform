from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    user_type: str = "dealer"
    company_name: Optional[str] = None
    subscription_tier: Optional[str] = "free"
    agree_terms: bool = False
    agree_communications: bool = False
    marketing_opt_in: bool = False
    referral_code: Optional[str] = None
    deal_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TrialStart(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    trial_days: int = 5
    sales_rep_id: Optional[int] = None


class TrialConvert(BaseModel):
    tier: str = "basic"