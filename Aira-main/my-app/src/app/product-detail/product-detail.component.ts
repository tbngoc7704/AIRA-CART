import { Component, ChangeDetectorRef } from '@angular/core';
import { ProductsService } from '../products.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductDetailService } from '../product-detail.service';
import { CartService } from '../cart.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
  imports: [CommonModule],
  standalone: true
})
export class ProductDetailComponent {
  product: any;
  errMessage: string = '';
  quantity: number = 1;
  
  constructor(
    public _service: ProductsService,
    private productDetailService: ProductDetailService,
    private cartService: CartService,
    private activateRoute: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    activateRoute.paramMap.subscribe((param) => {
      let id = param.get('id');
      if (id != null) {
        this.searchProduct(id);
      }
    });
  }
  
  searchProduct(productId: string) {
    this._service.getProduct(productId).subscribe({
      next: (data) => {
        this.product = data;
        
        const discountValue = this.product.discount || 0;
        this.product.final_price = (this.product.price * (1 - discountValue / 100)).toFixed(2);
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errMessage = err;
      },
    });
  }
  
  changeQuantity(amount: number) {
    const newQuantity = this.quantity + amount;
    if (newQuantity >= 1) {
      this.quantity = newQuantity;
    }
  }
  
  addToCart() {
    // Kiểm tra xem người dùng đã đăng nhập chưa
    if (!this.cartService.isLoggedIn()) {
      alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng');
      this.router.navigate(['/login']);
      return;
    }
    
    if (!this.product) {
      console.error("Lỗi: Không tìm thấy sản phẩm để thêm vào giỏ hàng.");
      return;
    }
    
    // Xác định product_id đúng từ API response
    const productId = this.product.id || this.product._id;
    
    if (!productId) {
      console.error("Lỗi: Sản phẩm không có ID.");
      return;
    }
    
    const discountValue = this.product.discount || 0;
    const finalPrice = this.product.price * (1 - discountValue / 100);
    
    // Tạo item phù hợp với cấu trúc MongoDB như trong hình
    const cartItem = {
      product_id: productId,
      name: this.product.name,
      price: this.product.price,
      discount: discountValue,
      final_price: finalPrice.toFixed(2),
      image: this.product.image,
      quantity: this.quantity
    };
    
    // Gọi API để thêm vào giỏ hàng
    this.cartService.addToCart(cartItem).subscribe(
      (response: any) => {
        console.log("Thêm vào giỏ hàng thành công:", response);
        alert("Đã thêm sản phẩm vào giỏ hàng!");
      },
      (error: any) => {
        console.error("Lỗi khi thêm vào giỏ hàng:", error);
        if (error.status === 401) {
          // Nếu token hết hạn hoặc không hợp lệ
          alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          this.cartService.logout(); // Xóa token
          this.router.navigate(['/login']);
        }
      }
    );
  }
}