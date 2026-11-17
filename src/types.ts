export interface Product { id: string; name: string; image?: string; upc?: string }
export interface Retailer { id: string; name: string; logo?: string }
export interface Offer {
  productId: string;
  retailerId: string;
  url: string;
  price?: number;
  currency?: string;
  inStock: boolean;
}
export interface Catalog { products: Product[]; retailers: Retailer[]; offers: Offer[] }
export interface ResolvedOffer { retailer: Retailer; offer: Offer }
