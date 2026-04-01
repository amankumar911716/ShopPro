from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import razorpay
import hmac
import hashlib
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Razorpay Configuration
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_yourkeyid')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', 'yoursecretkey')
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Security
security = HTTPBearer()

app = FastAPI(title="E-Commerce API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "user"
    created_at: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    product_count: int = 0

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    compare_price: Optional[float] = None
    category_id: str
    images: List[str] = []
    stock: int = 0
    sku: Optional[str] = None
    featured: bool = False
    active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    compare_price: Optional[float] = None
    category_id: Optional[str] = None
    images: Optional[List[str]] = None
    stock: Optional[int] = None
    sku: Optional[str] = None
    featured: Optional[bool] = None
    active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    price: float
    compare_price: Optional[float] = None
    category_id: str
    category_name: Optional[str] = None
    images: List[str] = []
    stock: int = 0
    sku: Optional[str] = None
    featured: bool = False
    active: bool = True
    created_at: str

class CartItem(BaseModel):
    product_id: str
    quantity: int

class CartResponse(BaseModel):
    id: str
    user_id: str
    items: List[dict]
    total: float
    updated_at: str

class AddressModel(BaseModel):
    street: str
    city: str
    state: str
    pincode: str
    phone: str

class OrderCreate(BaseModel):
    shipping_address: AddressModel
    payment_method: str = "razorpay"

class OrderResponse(BaseModel):
    id: str
    order_number: str
    user_id: str
    items: List[dict]
    shipping_address: dict
    subtotal: float
    shipping_fee: float
    total: float
    status: str
    payment_status: str
    payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    created_at: str

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str
# ==================== AUTH HELPERS ====================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": get_password_hash(user_data.password),
        "phone": user_data.phone,
        "role": "user",
        "address": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id, "role": "user"})

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": user_data.name,
            "email": user_data.email,
            "phone": user_data.phone,
            "role": "user"
        }
    }


@api_router.post("/auth/login", response_model=dict)
async def login(user_data: UserLogin):

    user = await db.users.find_one({"email": user_data.email})

    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user["id"], "role": user["role"]})

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone"),
            "role": user["role"]
        }
    }


# ==================== FORGOT PASSWORD ====================

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPassword):

    user = await db.users.find_one({"email": data.email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reset_token = str(uuid.uuid4())

    await db.users.update_one(
    {"email": data.email},
    {
        "$set": {
            "reset_token": reset_token,
            "reset_token_expiry": datetime.now(timezone.utc) + timedelta(minutes=15)
        }
    }
)

    return {
        "message": "Password reset token generated",
        "reset_token": reset_token
    }


# ==================== RESET PASSWORD ====================

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPassword):

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    token = data.token.strip()

    user = await db.users.find_one({"reset_token": token})

    print("TOKEN RECEIVED:", token)
    print("USER FOUND:", user)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    expiry = user.get("reset_token_expiry")

    if expiry:

        now = datetime.utcnow()

        if expiry.tzinfo is not None:
            expiry = expiry.replace(tzinfo=None)

        if expiry < now:
            raise HTTPException(status_code=400, detail="Token expired")

    hashed_password = get_password_hash(data.new_password)

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"password": hashed_password},
            "$unset": {"reset_token": "", "reset_token_expiry": ""}
        }
    )

    return {"message": "Password updated successfully"}


@api_router.get("/auth/me", response_model=dict)
async def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}


@api_router.put("/auth/profile", response_model=dict)
async def update_profile(data: UserUpdate, user: dict = Depends(get_current_user)):

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})

    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})

    return {"user": updated}

# ==================== CATEGORY ROUTES ====================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    for cat in categories:
        count = await db.products.count_documents({"category_id": cat["id"], "active": True})
        cat["product_count"] = count
    return categories

@api_router.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: str):
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    count = await db.products.count_documents({"category_id": category_id, "active": True})
    category["product_count"] = count
    return category

@api_router.post("/admin/categories", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, admin: dict = Depends(get_admin_user)):
    category_id = str(uuid.uuid4())
    cat_doc = {
        "id": category_id,
        "name": data.name,
        "description": data.description,
        "image": data.image,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(cat_doc)
    return {**cat_doc, "product_count": 0}

@api_router.put("/admin/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryCreate, admin: dict = Depends(get_admin_user)):
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": {"name": data.name, "description": data.description, "image": data.image}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    count = await db.products.count_documents({"category_id": category_id, "active": True})
    return {**category, "product_count": count}

@api_router.delete("/admin/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ==================== PRODUCT ROUTES ====================

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 20
):
    query = {"active": True}
    if category_id:
        query["category_id"] = category_id
    if featured is not None:
        query["featured"] = featured
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Fetch category names
    cat_ids = list(set(p["category_id"] for p in products))
    categories = await db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in categories}
    
    for p in products:
        p["category_name"] = cat_map.get(p["category_id"], "Unknown")
    
    return products

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    category = await db.categories.find_one({"id": product["category_id"]}, {"_id": 0})
    product["category_name"] = category["name"] if category else "Unknown"
    return product

@api_router.post("/admin/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, admin: dict = Depends(get_admin_user)):
    # Verify category exists
    category = await db.categories.find_one({"id": data.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    product_id = str(uuid.uuid4())
    product_doc = {
        "id": product_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(product_doc)
    return {**product_doc, "category_name": category["name"]}

@api_router.put("/admin/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductUpdate, admin: dict = Depends(get_admin_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    category = await db.categories.find_one({"id": product["category_id"]}, {"_id": 0})
    product["category_name"] = category["name"] if category else "Unknown"
    return product

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.get("/admin/products", response_model=List[ProductResponse])
async def get_admin_products(
    admin: dict = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 50
):
    products = await db.products.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    cat_ids = list(set(p["category_id"] for p in products))
    categories = await db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in categories}
    for p in products:
        p["category_name"] = cat_map.get(p["category_id"], "Unknown")
    return products

# ==================== CART ROUTES ====================

@api_router.get("/cart", response_model=CartResponse)
async def get_cart(user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "items": [],
            "total": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.carts.insert_one(cart)
    return cart

@api_router.post("/cart/add", response_model=CartResponse)
async def add_to_cart(item: CartItem, user: dict = Depends(get_current_user)):
    # Verify product exists and has stock
    product = await db.products.find_one({"id": item.product_id, "active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product["stock"] < item.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock")
    
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "items": [],
            "total": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    
    # Update or add item
    found = False
    for cart_item in cart["items"]:
        if cart_item["product_id"] == item.product_id:
            cart_item["quantity"] = item.quantity
            cart_item["price"] = product["price"]
            cart_item["name"] = product["name"]
            cart_item["image"] = product["images"][0] if product["images"] else ""
            found = True
            break
    
    if not found:
        cart["items"].append({
            "product_id": item.product_id,
            "quantity": item.quantity,
            "price": product["price"],
            "name": product["name"],
            "image": product["images"][0] if product["images"] else ""
        })
    
    # Calculate total
    cart["total"] = sum(i["price"] * i["quantity"] for i in cart["items"])
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": cart},
        upsert=True
    )
    return cart

@api_router.delete("/cart/remove/{product_id}", response_model=CartResponse)
async def remove_from_cart(product_id: str, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart["items"] = [i for i in cart["items"] if i["product_id"] != product_id]
    cart["total"] = sum(i["price"] * i["quantity"] for i in cart["items"])
    cart["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.carts.update_one({"user_id": user["id"]}, {"$set": cart})
    return cart

@api_router.delete("/cart/clear", response_model=CartResponse)
async def clear_cart(user: dict = Depends(get_current_user)):
    cart = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "items": [],
        "total": 0,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": cart},
        upsert=True
    )
    return cart

# ==================== ORDER ROUTES ====================

def generate_order_number():
    import random
    return f"ORD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}"

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    # Get cart
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart or not cart["items"]:
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Verify stock and calculate totals
    subtotal = 0
    order_items = []
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if not product or product["stock"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Product {item['name']} is out of stock")
        
        subtotal += product["price"] * item["quantity"]
        order_items.append({
            "product_id": item["product_id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": item["quantity"],
            "image": product["images"][0] if product["images"] else ""
        })
    
    shipping_fee = 0 if subtotal >= 500 else 50  # Free shipping above 500
    total = subtotal + shipping_fee
    
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    
    # Create Razorpay order
    razorpay_order = None
    razorpay_order_id = None
    if data.payment_method == "razorpay":
        try:
            razorpay_order = razorpay_client.order.create({
                "amount": int(total * 100),  # In paise
                "currency": "INR",
                "receipt": order_number[:40],
                "payment_capture": 1
            })
            razorpay_order_id = razorpay_order["id"]
        except Exception as e:
            logger.warning(f"Razorpay order creation failed (test mode): {e}")
            # For demo/test mode, create a mock order ID
            razorpay_order_id = f"order_demo_{order_number}"
    
    order_doc = {
        "id": order_id,
        "order_number": order_number,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "items": order_items,
        "shipping_address": data.shipping_address.model_dump(),
        "subtotal": subtotal,
        "shipping_fee": shipping_fee,
        "total": total,
        "status": "confirmed" if data.payment_method == "cod" else "pending",
        "payment_status": "pending" if data.payment_method == "razorpay" else "cod",
        "payment_method": data.payment_method,
        "razorpay_order_id": razorpay_order_id if data.payment_method == "razorpay" else None,
        "payment_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order_doc)

    # Handle Cash on Delivery orders
    if data.payment_method == "cod":

        # Reduce product stock
        for item in order_items:
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )

        # Clear user's cart
        await db.carts.delete_one({"user_id": user["id"]})

    return order_doc

@api_router.post("/orders/{order_id}/verify-payment")
async def verify_payment(order_id: str, data: PaymentVerify, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if demo mode order (skip signature verification for demo)
    is_demo = (order.get("razorpay_order_id") or "").startswith("order_demo_")
    
    if not is_demo:
        # Verify signature for real Razorpay orders
        try:
            generated_signature = hmac.new(
                RAZORPAY_KEY_SECRET.encode(),
                f"{data.razorpay_order_id}|{data.razorpay_payment_id}".encode(),
                hashlib.sha256
            ).hexdigest()
            
            if generated_signature != data.razorpay_signature:
                raise HTTPException(status_code=400, detail="Invalid payment signature")
        except Exception as e:
            logger.error(f"Payment verification failed: {e}")
            raise HTTPException(status_code=400, detail="Payment verification failed")
    
    # Update order
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": "paid",
            "payment_id": data.razorpay_payment_id or f"pay_demo_{order_id[:8]}",
            "status": "confirmed"
        }}
    )
    
    # Update stock
    for item in order["items"]:
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"stock": -item["quantity"]}}
        )
    
    # Clear cart
    await db.carts.delete_one({"user_id": user["id"]})
    
    return {"message": "Payment verified successfully", "order_id": order_id}

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_user_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    
    # Calculate revenue
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Recent orders stats
    pending_orders = await db.orders.count_documents({"status": "pending"})
    
    # Sales by month (last 6 months)
    from datetime import timedelta
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()
    sales_pipeline = [
        {"$match": {"payment_status": "paid", "created_at": {"$gte": six_months_ago}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 7]},
            "total": {"$sum": "$total"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    sales_by_month = await db.orders.aggregate(sales_pipeline).to_list(12)
    
    # Low stock products
    low_stock = await db.products.count_documents({"stock": {"$lt": 10}})
    
    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_users": total_users,
        "total_revenue": total_revenue,
        "pending_orders": pending_orders,
        "low_stock_products": low_stock,
        "sales_by_month": sales_by_month
    }

@api_router.get("/admin/orders", response_model=List[OrderResponse])
async def get_admin_orders(
    admin: dict = Depends(get_admin_user),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {}
    if status:
        query["status"] = status
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return orders

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, admin: dict = Depends(get_admin_user)):
    valid_statuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "rejected"
]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order status updated"}

@api_router.get("/admin/users")
async def get_admin_users(
    admin: dict = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 50
):
    users = await db.users.find({}, {"_id": 0, "password": 0}).skip(skip).limit(limit).to_list(limit)
    return users

@api_router.put("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, admin: dict = Depends(get_admin_user)):
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User role updated"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):

    user = await db.users.find_one({"id": user_id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent main admin deletion
    if user.get("email") == "admin@store.com":
        raise HTTPException(status_code=400, detail="Main admin cannot be deleted")

    await db.users.delete_one({"id": user_id})

    return {"message": "User deleted successfully"}
# ==================== SEED DATA ====================

@api_router.post("/seed-data")
async def seed_data():
    """Seed initial categories and sample products"""
    
    # Check if data already exists
    existing = await db.categories.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded"}
    
    # Categories
    categories = [
        {"id": str(uuid.uuid4()), "name": "Electronics", "description": "Gadgets and electronic devices", "image": "https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?auto=compress&cs=tinysrgb&w=800"},
        {"id": str(uuid.uuid4()), "name": "Fashion", "description": "Clothing and accessories", "image": "https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=800"},
        {"id": str(uuid.uuid4()), "name": "Home & Living", "description": "Furniture and home decor", "image": "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800"},
        {"id": str(uuid.uuid4()), "name": "Sports", "description": "Sports equipment and gear", "image": "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=800"},
    ]
    await db.categories.insert_many(categories)
    
    # Products
    products = [
        {"id": str(uuid.uuid4()), "name": "Wireless Headphones", "description": "Premium noise-cancelling wireless headphones with 30-hour battery life", "price": 4999, "compare_price": 7999, "category_id": categories[0]["id"], "images": ["https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 50, "featured": True, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Smart Watch Pro", "description": "Advanced smartwatch with health monitoring and GPS", "price": 12999, "compare_price": 15999, "category_id": categories[0]["id"], "images": ["https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 30, "featured": True, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Laptop Stand", "description": "Ergonomic aluminum laptop stand for better posture", "price": 1999, "compare_price": 2999, "category_id": categories[0]["id"], "images": ["https://images.pexels.com/photos/4065891/pexels-photo-4065891.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 100, "featured": False, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Cotton T-Shirt", "description": "Premium cotton t-shirt, comfortable and stylish", "price": 799, "compare_price": 1299, "category_id": categories[1]["id"], "images": ["https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 200, "featured": False, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Denim Jacket", "description": "Classic denim jacket for all seasons", "price": 2499, "compare_price": 3999, "category_id": categories[1]["id"], "images": ["https://images.pexels.com/photos/1124468/pexels-photo-1124468.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 75, "featured": True, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Running Shoes", "description": "Lightweight running shoes with superior cushioning", "price": 3999, "compare_price": 5999, "category_id": categories[3]["id"], "images": ["https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 60, "featured": True, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Yoga Mat", "description": "Eco-friendly yoga mat with anti-slip surface", "price": 999, "compare_price": 1499, "category_id": categories[3]["id"], "images": ["https://images.pexels.com/photos/4056535/pexels-photo-4056535.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 150, "featured": False, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Table Lamp", "description": "Modern minimalist table lamp with adjustable brightness", "price": 1499, "compare_price": 2499, "category_id": categories[2]["id"], "images": ["https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=800"], "stock": 80, "featured": False, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.products.insert_many(products)
    
    # Create admin user
    admin_exists = await db.users.find_one({"email": "admin@store.com"})
    if not admin_exists:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": "admin@store.com",
            "password": get_password_hash("admin123"),
            "phone": "9999999999",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
    
    return {"message": "Data seeded successfully"}

@api_router.get("/razorpay-key")
async def get_razorpay_key():
    """Return the Razorpay key ID for frontend"""
    return {"key_id": RAZORPAY_KEY_ID}

# ==================== MAIN APP CONFIG ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
