import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../products.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule], // ✅ Thêm CommonModule để sử dụng *ngFor, *ngIf
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css'] // ✅ Đổi styleUrl thành styleUrls (dạng mảng)
})
export class ProductComponent implements OnInit {
  products: any;
  errMessage: string = '';

  constructor(private _service: ProductsService, private cartService: CartService, private router: Router) { }

  ngOnInit() {
    this._service.getProducts().subscribe({
      next: (data) => { this.products = data; },
      error: (err) => { this.errMessage = err; }
    });
  }

  viewDetail(product: any) {
    this.router.navigate(['/view-product-detail', product.id]);
  }

  addToCart(product: any) {
    if (!this.cartService.isLoggedIn()) {
      alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng');
      this.router.navigate(['/login']);
      return;
    }

    if (!product || !product.id) {
      console.error('Lỗi: Không tìm thấy sản phẩm để thêm vào giỏ hàng.');
      return;
    }

    // Tính giá cuối cùng sau khi giảm giá
    const discountValue = product.discount || 0;
    const finalPrice = product.price * (1 - discountValue / 100);

    // Tạo item phù hợp với cấu trúc MongoDB
    const cartItem = {
      product_id: product.id,
      name: product.name,
      price: product.price,
      discount: discountValue,
      final_price: finalPrice.toFixed(2),
      image: product.image,
      quantity: 1
    };

    // Gọi CartService để thêm vào giỏ hàng
    this.cartService.addToCart(cartItem).subscribe({
      next: (response: any) => {
        console.log("Thêm vào giỏ hàng thành công:", response);
        alert("Đã thêm sản phẩm vào giỏ hàng!");
      },
      error: (error: any) => {
        console.error("Lỗi khi thêm vào giỏ hàng:", error);
        if (error.status === 401) {
          alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          this.cartService.logout();
          this.router.navigate(['/login']);
        } else {
          alert('Có lỗi xảy ra: ' + error);
        }
      }
    });
  }
}