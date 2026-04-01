import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Slider } from '../components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { formatPrice, calculateDiscount } from '../context/AppContext';
import { Search, SlidersHorizontal, Grid, List, X } from 'lucide-react';

const API = "http://127.0.0.1:8000/api";

export const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [priceRange, setPriceRange] = useState([0, 50000]);
  const [sortBy, setSortBy] = useState('newest');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      const searchQuery = searchParams.get('search');
      const categoryQuery = searchParams.get('category');
      const featured = searchParams.get('featured');
      
      if (searchQuery) params.append('search', searchQuery);
      if (categoryQuery) {
        const cat = categories.find(c => c.name === categoryQuery);
        if (cat) params.append('category_id', cat.id);
      }
      if (featured) params.append('featured', featured);
      
      const res = await axios.get(`${API}/products?${params.toString()}`);
      let sortedProducts = res.data;
      
      // Client-side sorting
      switch (sortBy) {
        case 'price-low':
          sortedProducts.sort((a, b) => a.price - b.price);
          break;
        case 'price-high':
          sortedProducts.sort((a, b) => b.price - a.price);
          break;
        case 'name':
          sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
          break;
        default:
          // newest - keep API order
          break;
      }
      
      // Price filter
      sortedProducts = sortedProducts.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
      
      setProducts(sortedProducts);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    const params = new URLSearchParams(searchParams);
    if (category && category !== 'all') {
      params.set('category', category);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setPriceRange([0, 50000]);
    setSortBy('newest');
    setSearchParams({});
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h4 className="font-medium mb-3">Categories</h4>
        <div className="space-y-2">
          <button
            onClick={() => handleCategoryChange('')}
            className={`block text-sm w-full text-left py-1 px-2 rounded hover:bg-secondary transition-colors ${!selectedCategory ? 'bg-secondary font-medium' : ''}`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.name)}
              className={`block text-sm w-full text-left py-1 px-2 rounded hover:bg-secondary transition-colors ${selectedCategory === cat.name ? 'bg-secondary font-medium' : ''}`}
            >
              {cat.name} ({cat.product_count})
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-medium mb-3">Price Range</h4>
        <Slider
          value={priceRange}
          onValueChange={setPriceRange}
          min={0}
          max={50000}
          step={500}
          className="mb-2"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
      </div>

      {/* Apply Filters Button */}
      <Button onClick={fetchProducts} className="w-full">
        Apply Filters
      </Button>
      <Button variant="outline" onClick={clearFilters} className="w-full">
        Clear All
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="products-page">
      {/* Header */}
      <div className="bg-secondary/30 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-serif font-bold mb-2">
            {searchParams.get('search') ? `Search: "${searchParams.get('search')}"` : 
             searchParams.get('category') || 
             searchParams.get('featured') ? 'Featured Products' : 'All Products'}
          </h1>
          <p className="text-muted-foreground">
            {products.length} products found
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="font-semibold mb-4">Filters</h3>
              <FilterContent />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="product-search"
                  />
                </div>
              </form>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); fetchProducts(); }}>
                <SelectTrigger className="w-[180px]" data-testid="sort-select">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Mobile Filter */}
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="outline" size="icon">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterContent />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Active Filters */}
            {(selectedCategory || searchParams.get('search')) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                    {selectedCategory}
                    <button onClick={() => handleCategoryChange('')}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchParams.get('search') && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary rounded-full text-sm">
                    "{searchParams.get('search')}"
                    <button onClick={() => { setSearch(''); setSearchParams({}); }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Products Grid/List */}
            {loading ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'space-y-4'}>
                {Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="aspect-square" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No products found</p>
                <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="products-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="space-y-4" data-testid="products-list">
                {products.map((product) => (
                  <ProductListItem key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductCard = ({ product }) => {
  const discount = calculateDiscount(product.price, product.compare_price);
  
  return (
    <Link to={`/products/${product.id}`} className="group" data-testid={`product-${product.id}`}>
      <Card className="overflow-hidden product-card border-border/60 h-full">
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

const ProductListItem = ({ product }) => {
  const discount = calculateDiscount(product.price, product.compare_price);
  
  return (
    <Link to={`/products/${product.id}`} className="group" data-testid={`product-list-${product.id}`}>
      <Card className="overflow-hidden product-card border-border/60">
        <div className="flex">
          <div className="relative w-40 h-40 overflow-hidden bg-secondary/50 flex-shrink-0">
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
          </div>
          <CardContent className="p-4 flex-1">
            <p className="text-xs text-muted-foreground mb-1">{product.category_name}</p>
            <h3 className="font-medium group-hover:text-accent transition-colors">
              {product.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {product.description}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="font-semibold text-primary text-lg">{formatPrice(product.price)}</span>
              {product.compare_price && product.compare_price > product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compare_price)}
                </span>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
};

export default ProductsPage;
