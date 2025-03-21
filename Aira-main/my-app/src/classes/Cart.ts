import { Product } from "./Products";

export function addToCart(product: Product, quantity: number) {
  const cartItem = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    brand: product.brand,
    category: product.category,
    image: product.image,
    quantity: quantity,
  };

  console.log("Added to cart:", cartItem);
  return cartItem;
}
