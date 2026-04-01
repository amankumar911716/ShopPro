import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { formatPrice, calculateDiscount } from '../context/AppContext';
import { ArrowRight, Truck, Shield, RefreshCw, Headphones, ChevronRight, Star } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const HomePage = () => {
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Seed data first
        await axios.post(`${API}/seed-data`).catch(() => {});
        
        const [catRes, prodRes] = await Promise.all([
          axios.get(`${API}/categories`),
          axios.get(`${API}/products?featured=true&limit=8`)
        ]);
        setCategories(catRes.data);
        setFeaturedProducts(prodRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const features = [
    { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹500' },
    { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout' },
    { icon: RefreshCw, title: 'Easy Returns', desc: '30-day return policy' },
    { icon: Headphones, title: '24/7 Support', desc: 'Dedicated support team' }
  ];

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero Section */}
<section className="relative bg-secondary overflow-hidden" data-testid="hero-section">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

      <div className="space-y-6 animate-[fadeInUp_0.8s_ease-out]">

        <span className="inline-block px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full">
          New Collection 2026
        </span>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight text-primary">
          Discover Quality <br />
          <span className="text-accent">Products</span> for You
        </h1>

        <p className="text-lg text-muted-foreground max-w-md">
          Shop the latest trends in electronics, fashion, home decor, and more.
          Quality products at unbeatable prices.
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4">

          <Button
            size="lg"
            asChild
            data-testid="shop-now-btn"
            className="group relative overflow-hidden bg-accent text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <Link to="/products" className="flex items-center">
              Shop Now
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-2" />
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            asChild
            className="group border-2 hover:bg-accent hover:text-white transition-all duration-300 hover:-translate-y-1"
          >
            <Link to="/products?featured=true" className="flex items-center">
              View Featured
              <ChevronRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Button>

        </div>

        {/* Trust Badge */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex text-yellow-500">
            <Star className="h-4 w-4 fill-yellow-500" />
            <Star className="h-4 w-4 fill-yellow-500" />
            <Star className="h-4 w-4 fill-yellow-500" />
            <Star className="h-4 w-4 fill-yellow-500" />
            <Star className="h-4 w-4 fill-yellow-500" />
          </div>

          <span className="text-sm text-muted-foreground">
            Trusted by 10,000+ customers
          </span>
        </div>

      </div>

      {/* Hero Image */}
      <div className="relative hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent rounded-3xl"></div>

        <img
          src="https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=800"
          alt="Hero"
          className="rounded-3xl shadow-2xl object-cover w-full h-[500px] hover:scale-105 transition-transform duration-500"
        />

      </div>

    </div>
  </div>
</section>
      {/* Features */}
      <section className="py-12 border-b" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16" data-testid="categories-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-serif font-bold">Shop by Category</h2>
              <p className="text-muted-foreground mt-1">Browse our curated collections</p>
            </div>
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link to="/products">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))
            ) : (
              categories.slice(0, 4).map((cat) => (
                <Link 
                  key={cat.id} 
                  to={`/products?category=${encodeURIComponent(cat.name)}`}
                  className="group relative overflow-hidden rounded-xl aspect-square"
                  data-testid={`category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <img
                    src={cat.image || 'https://images.pexels.com/photos/4763075/pexels-photo-4763075.jpeg?auto=compress&cs=tinysrgb&w=800'}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-semibold text-lg">{cat.name}</h3>
                    <p className="text-white/70 text-sm">{cat.product_count} Products</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-secondary/30" data-testid="featured-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-serif font-bold">Featured Products</h2>
              <p className="text-muted-foreground mt-1">Handpicked just for you</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/products?featured=true">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-square" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : (
              featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16" data-testid="cta-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
                  Get 20% Off Your First Order
                </h2>
                <p className="text-white/70 mb-6">
                  Sign up for our newsletter and receive exclusive deals, new arrivals, and special offers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" variant="secondary" asChild>
                    <Link to="/register">Create Account</Link>
                  </Button>
                </div>
              </div>
              <div className="hidden lg:block relative">
                <img
                  src="https://images.pexels.com/photos/5632406/pexels-photo-5632406.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="Promo"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const ProductCard = ({ product }) => {
  const discount = calculateDiscount(product.price, product.compare_price);
  
  return (
    <Link 
      to={`/products/${product.id}`}
      className="group"
      data-testid={`product-card-${product.id}`}
    >
      <Card className="overflow-hidden product-card border-border/60">
        <div className="relative aspect-square overflow-hidden bg-secondary/50">
          <img
            src={product.images?.[0] || 'https://images.pexels.com/photos/4763075/pexels-photo-4763075.jpeg?auto=compress&cs=tinysrgb&w=800'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {discount > 0 && (
            <span className="absolute top-2 left-2 px-2 py-1 text-xs font-medium bg-destructive text-white rounded">
              -{discount}%
            </span>
          )}
          {product.stock < 10 && product.stock > 0 && (
            <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-amber-500 text-white rounded">
              Low Stock
            </span>
          )}
        </div>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{product.category_name}</p>
          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-accent transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-semibold text-primary">{formatPrice(product.price)}</span>
            {product.compare_price && product.compare_price > product.price && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_price)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default HomePage;
