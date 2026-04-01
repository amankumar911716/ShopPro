import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useCart, formatPrice } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import axios from 'axios';
import { CreditCard, Truck, ShieldCheck, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();
  const { cart, clearCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [razorpayKey, setRazorpayKey] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('razorpay');

  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    pincode: '',
    phone: user?.phone || ''
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (cart.items.length === 0) {
      navigate('/cart');
      return;
    }
    fetchRazorpayKey();
  }, [isAuthenticated, cart.items.length]);

  const fetchRazorpayKey = async () => {
    try {
      const res = await axios.get(`${API}/razorpay-key`);
      setRazorpayKey(res.data.key_id);
    } catch (error) {
      console.error('Failed to fetch Razorpay key:', error);
    }
  };

  const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shipping;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!address.street || !address.city || !address.state || !address.pincode || !address.phone) {
      toast.error('Please fill all address fields');
      return;
    }

    if (!/^\d{6}$/.test(address.pincode)) {
      toast.error('Please enter a valid 6-digit pincode');
      return;
    }

    if (!/^\d{10}$/.test(address.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      const orderRes = await axios.post(
        `${API}/orders`,
        {
          shipping_address: address,
          payment_method: paymentMethod
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const order = orderRes.data;

      // COD selected
      if (paymentMethod === 'cod') {
        toast.success('Order placed successfully!');
        clearCart();
        navigate(`/orders/${order.id}`);
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        setLoading(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: order.total * 100,
        currency: 'INR',
        name: 'ShopPro',
        description: `Order #${order.order_number}`,
        order_id: order.razorpay_order_id,
        handler: async (response) => {
          try {
            await axios.post(
              `${API}/orders/${order.id}/verify-payment`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Payment successful!');
            clearCart();
            navigate(`/orders/${order.id}`);
          } catch (error) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: address.phone
        },
        theme: {
          color: '#0f172a'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info('Payment cancelled');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      setLoading(false);

    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.detail || 'Failed to process order');
      setLoading(false);
    }
  };

  if (!isAuthenticated || cart.items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <h1 className="text-3xl font-serif font-bold mb-8">Checkout</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            <div className="lg:col-span-2 space-y-6">

              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5"/>
                    Shipping Address
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">

                  <div>
                    <Label>Street Address *</Label>
                    <Input
                      value={address.street}
                      onChange={(e)=>setAddress(a=>({...a,street:e.target.value}))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    <div>
                      <Label>City *</Label>
                      <Input
                        value={address.city}
                        onChange={(e)=>setAddress(a=>({...a,city:e.target.value}))}
                      />
                    </div>

                    <div>
                      <Label>State *</Label>
                      <Input
                        value={address.state}
                        onChange={(e)=>setAddress(a=>({...a,state:e.target.value}))}
                      />
                    </div>

                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    <div>
                      <Label>Pincode *</Label>
                      <Input
                        value={address.pincode}
                        onChange={(e)=>setAddress(a=>({...a,pincode:e.target.value}))}
                      />
                    </div>

                    <div>
                      <Label>Phone *</Label>
                      <Input
                        value={address.phone}
                        onChange={(e)=>setAddress(a=>({...a,phone:e.target.value}))}
                      />
                    </div>

                  </div>

                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">

                  {/* Razorpay */}
                  <div
                    className={`p-4 border rounded-lg cursor-pointer ${paymentMethod==='razorpay' ? 'bg-secondary/50 border-accent':''}`}
                    onClick={()=>setPaymentMethod('razorpay')}
                  >
                    <p className="font-medium">Razorpay</p>
                    <p className="text-sm text-muted-foreground">
                      Pay using UPI, cards, netbanking
                    </p>
                  </div>

                  {/* COD */}
                  <div
                    className={`p-4 border rounded-lg cursor-pointer ${paymentMethod==='cod' ? 'bg-secondary/50 border-accent':''}`}
                    onClick={()=>setPaymentMethod('cod')}
                  >
                    <p className="font-medium">Cash on Delivery</p>
                    <p className="text-sm text-muted-foreground">
                      Pay when the product is delivered
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-green-600"/>
                    Your payment information is secure
                  </div>

                </CardContent>
              </Card>

            </div>

            {/* Order Summary */}
            <div>

              <Card className="sticky top-24">

                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">

                  <div className="space-y-3">

                    {cart.items.map(item=>(
                      <div key={item.product_id} className="flex justify-between">

                        <span>{item.name} x {item.quantity}</span>

                        <span>{formatPrice(item.price*item.quantity)}</span>

                      </div>
                    ))}

                  </div>

                  <Separator/>

                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{shipping===0?'FREE':formatPrice(shipping)}</span>
                  </div>

                  <Separator/>

                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >

                    {loading
                      ? "Processing..."
                      : paymentMethod==='cod'
                        ? "Place Order (COD)"
                        : `Pay ${formatPrice(total)}`
                    }

                  </Button>

                </CardContent>

              </Card>

            </div>

          </div>
        </form>

      </div>
    </div>
  );
};

export default CheckoutPage;